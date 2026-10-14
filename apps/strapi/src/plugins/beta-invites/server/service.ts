import { betaInvitationEmail } from "@repo/shared-data"

import {
  ACCESS_LIFETIME,
  hashCode,
  INVITE_LIFETIME,
  newCredential,
  openCode,
  validCode,
} from "./credentials"
import { emailConfigured } from "../../content-moderation/server/utils/email-config"

export const INVITATION = "plugin::beta-invites.invitation"
const SUBSCRIBER = "api::subscriber.subscriber"
const NOTIFICATION = "api::notification.notification"
const sendingAvailable = () =>
  emailConfigured() && (process.env.EMAIL_LINK_SECRET?.length ?? 0) >= 32

export class InviteError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message)
  }
}

export function eligible(subscriber: any, invitation?: any): boolean {
  return (
    subscriber?.type === "beta_waitlist" &&
    subscriber.state === "active" &&
    !!subscriber.consentedAt &&
    (!invitation ||
      new Date(subscriber.consentedAt).getTime() ===
        new Date(invitation.consentedAt).getTime())
  )
}

export function invitationState(
  invitation: any,
  queue?: any,
  now = Date.now()
): string {
  if (!invitation) return "waiting"
  if (invitation.revokedAt) return "revoked"
  if (invitation.acceptedAt)
    return new Date(invitation.accessExpiresAt).getTime() > now
      ? "accepted"
      : "expired"
  if (new Date(invitation.expiresAt).getTime() <= now) return "expired"
  if (queue?.emailState === "failed") return "failed"
  if (queue?.emailState === "skipped") return "unavailable"
  if (invitation.sentAt) return "sent"

  return "queued"
}

export default ({ strapi }: { strapi: any }) => {
  const query = (uid: string) => strapi.db.query(uid)
  const subscriber = (id: string) =>
    query(SUBSCRIBER).findOne({ where: { documentId: id } })
  const invitation = (id: string) =>
    query(INVITATION).findOne({ where: { documentId: id } })
  // All issue/redeem/revoke/send operations for one subscriber serialize across CMS instances.
  const locked = <T>(id: string, work: () => Promise<T>): Promise<T> =>
    strapi.db.transaction(async ({ trx }: { trx: any }) => {
      if (["pg", "postgres", "postgresql"].includes(strapi.db.dialect.client))
        await trx.raw(
          "SELECT pg_advisory_xact_lock(hashtextextended(?, 7420106))",
          [id]
        )

      return work()
    })
  const allInvitations = (id: string) =>
    query(INVITATION).findMany({
      where: { subscriberDocumentId: id },
      orderBy: { id: "desc" },
      limit: 100,
    })
  const revoke = async (id: string, actor: string) => {
    await query(INVITATION).updateMany({
      where: { subscriberDocumentId: id, revokedAt: { $null: true } },
      data: {
        revokedAt: new Date().toISOString(),
        revokedBy: actor,
        tokenHash: null,
        tokenCiphertext: null,
      },
    })
  }

  return {
    async issue(id: string, actor: string, resend = false) {
      if (!sendingAvailable())
        throw new InviteError(503, "Email sending is not configured.")

      return locked(id, async () => {
        const person = await subscriber(id)
        if (!eligible(person))
          throw new InviteError(
            409,
            "This subscriber has no active beta access request."
          )
        const [current] = await allInvitations(id)
        const state = invitationState(current)
        // Send is idempotent. An explicit resend replaces previous credentials and browser passes.
        if (
          current &&
          !["revoked", "expired"].includes(state) &&
          (!resend || Date.now() - new Date(current.issuedAt).getTime() < 60000)
        )
          return { queued: false }
        await revoke(id, actor)
        const issuedAt = new Date().toISOString()
        const row = await strapi.documents(INVITATION).create({
          data: {
            subscriberDocumentId: id,
            consentedAt: person.consentedAt,
            issuedBy: actor,
            issuedAt,
            expiresAt: new Date(Date.now() + INVITE_LIFETIME).toISOString(),
            ...newCredential(),
          },
        })
        const mail = await strapi.service(NOTIFICATION).enqueue({
          eventKey: `beta-invitation:${row.documentId}`,
          kind: "beta_invitation",
          inApp: false,
          title: "Your beta invitation",
          body: "Requested beta access",
          emailPreference: "transactional",
          emailPayload: { invitationId: row.documentId },
        })
        await query(INVITATION).update({
          where: { id: row.id },
          data: { notificationId: mail.documentId },
        })

        return { queued: true }
      })
    },

    async revoke(id: string, actor: string) {
      return locked(id, async () => {
        const person = await subscriber(id)
        if (person?.type !== "beta_waitlist")
          throw new InviteError(404, "Beta subscriber not found.")
        await revoke(id, actor)
      })
    },

    async retry(id: string) {
      return locked(id, async () => {
        const person = await subscriber(id)
        const [current] = await allInvitations(id)
        if (
          !eligible(person, current) ||
          !current ||
          current.revokedAt ||
          current.acceptedAt ||
          !current.tokenCiphertext ||
          new Date(current.expiresAt).getTime() <= Date.now()
        )
          throw new InviteError(
            409,
            "This invitation cannot be retried. Send a new invitation."
          )
        await query(NOTIFICATION).updateMany({
          where: { documentId: current.notificationId, emailState: "failed" },
          data: {
            emailState: "pending",
            attempts: 0,
            lastError: null,
            nextAttemptAt: new Date().toISOString(),
          },
        })
      })
    },

    /** Called by the shared email worker; no beta mail is emitted by a waitlist submission. */
    async deliver(mail: any, now: Date): Promise<"sent" | "skipped"> {
      const candidate = await invitation(mail.emailPayload?.invitationId)
      if (!candidate) {
        await query(NOTIFICATION).update({
          where: { id: mail.id },
          data: { emailState: "skipped" },
        })

        return "skipped"
      }

      return locked(candidate.subscriberDocumentId, async () => {
        const row = await invitation(candidate.documentId)
        const person = await subscriber(candidate.subscriberDocumentId)
        const pending = await query(NOTIFICATION).findOne({
          where: { id: mail.id },
        })
        if (pending?.emailState !== "pending") return "skipped"
        if (
          !eligible(person, row) ||
          !row ||
          row.revokedAt ||
          row.acceptedAt ||
          new Date(row.expiresAt).getTime() <= now.getTime() ||
          !row.tokenCiphertext
        ) {
          await query(NOTIFICATION).update({
            where: { id: mail.id },
            data: { emailState: "skipped" },
          })
          if (row)
            await query(INVITATION).update({
              where: { id: row.id },
              data: {
                tokenHash: null,
                tokenCiphertext: null,
                ...(!row.acceptedAt &&
                !row.revokedAt &&
                new Date(row.expiresAt).getTime() > now.getTime()
                  ? { revokedAt: now.toISOString(), revokedBy: "system" }
                  : {}),
              },
            })

          return "skipped"
        }
        const message = betaInvitationEmail({
          code: openCode(row.tokenCiphertext),
          locale: person.communicationLocale,
          siteUrl: process.env.APP_PUBLIC_URL || "https://libraries.global",
        })
        await strapi
          .plugin("email")
          .service("email")
          .send({
            to: person.email,
            replyTo: process.env.EMAIL_REPLY_TO,
            ...message,
          })
        const sentAt = new Date().toISOString()
        await query(INVITATION).update({
          where: { id: row.id },
          data: { sentAt, tokenCiphertext: null },
        })
        await query(SUBSCRIBER).update({
          where: { id: person.id },
          data: { invitedAt: sentAt },
        })
        await query(NOTIFICATION).update({
          where: { id: mail.id },
          data: { emailState: "sent", sentAt, lastError: null },
        })

        return "sent"
      })
    },

    async redeem(code: unknown) {
      if (!validCode(code)) return null
      const candidate = await query(INVITATION).findOne({
        where: { tokenHash: hashCode(code) },
      })
      if (!candidate) return null

      return locked(candidate.subscriberDocumentId, async () => {
        const row = await invitation(candidate.documentId)
        const person = await subscriber(candidate.subscriberDocumentId)
        if (
          !eligible(person, row) ||
          !row ||
          row.tokenHash !== hashCode(code) ||
          !row.sentAt ||
          row.revokedAt ||
          row.acceptedAt ||
          new Date(row.expiresAt).getTime() <= Date.now()
        )
          return null
        const acceptedAt = new Date().toISOString()
        const accessExpiresAt = new Date(
          Date.now() + ACCESS_LIFETIME
        ).toISOString()
        await query(INVITATION).update({
          where: { id: row.id },
          data: {
            acceptedAt,
            accessExpiresAt,
            tokenHash: null,
            tokenCiphertext: null,
          },
        })

        return {
          invitationId: row.documentId,
          expiresAt: new Date(accessExpiresAt).getTime(),
        }
      })
    },

    async validate(id: string) {
      const row = await invitation(id)
      if (
        !row?.acceptedAt ||
        row.revokedAt ||
        new Date(row.accessExpiresAt).getTime() <= Date.now()
      )
        return false

      return eligible(await subscriber(row.subscriberDocumentId), row)
    },

    async history(id: string) {
      if ((await subscriber(id))?.type !== "beta_waitlist")
        throw new InviteError(404, "Beta subscriber not found.")
      const rows = await allInvitations(id)

      return Promise.all(
        rows.map(async (row: any) => {
          const mail = await query(NOTIFICATION).findOne({
            where: { documentId: row.notificationId },
          })

          return {
            id: row.documentId,
            issuedAt: row.issuedAt,
            expiresAt: row.expiresAt,
            sentAt: row.sentAt,
            acceptedAt: row.acceptedAt,
            accessExpiresAt: row.accessExpiresAt,
            revokedAt: row.revokedAt,
            status: invitationState(row, mail),
            attempts: mail?.attempts ?? 0,
            lastError: mail?.lastError ?? null,
          }
        })
      )
    },

    async list(input: {
      q: string
      locale: string
      status: string
      page: number
    }) {
      const db = strapi.db.connection
      const status = `CASE WHEN s.state <> 'active' OR s.consented_at IS NULL THEN 'unavailable'
        WHEN i.id IS NULL THEN 'waiting' WHEN i.revoked_at IS NOT NULL THEN 'revoked'
        WHEN i.accepted_at IS NOT NULL THEN CASE WHEN i.access_expires_at > CURRENT_TIMESTAMP THEN 'accepted' ELSE 'expired' END
        WHEN i.expires_at <= CURRENT_TIMESTAMP THEN 'expired' WHEN n.email_state = 'failed' THEN 'failed'
        WHEN n.email_state = 'skipped' THEN 'unavailable' WHEN i.sent_at IS NOT NULL THEN 'sent' ELSE 'queued' END`
      const base = db("subscribers as s")
        .leftJoin("beta_invitations as i", function () {
          this.on("i.subscriber_document_id", "s.document_id").andOn(
            "i.id",
            "=",
            db.raw(
              "(SELECT MAX(latest.id) FROM beta_invitations latest WHERE latest.subscriber_document_id = s.document_id)"
            )
          )
        })
        .leftJoin("notifications as n", "n.document_id", "i.notification_id")
        .where("s.type", "beta_waitlist")
      if (input.q)
        base.whereILike(
          "s.email",
          `%${input.q.replaceAll(/[\\%_]/g, String.raw`\$&`)}%`
        )
      if (input.locale) base.where("s.communication_locale", input.locale)
      const counts = await base
        .clone()
        .select(db.raw(`${status} AS status`))
        .count("s.id as count")
        .groupByRaw(status)
      const selected = db.from(
        base
          .clone()
          .select(
            "s.document_id as id",
            "s.email",
            "s.communication_locale as locale",
            "s.created_at as requestedAt",
            "i.sent_at as sentAt",
            "i.accepted_at as acceptedAt",
            db.raw(`${status} AS status`)
          )
          .as("people")
      )
      if (input.status) selected.where("status", input.status)
      const [total] = await selected.clone().count("id as count")
      const rows = await selected
        .select("*")
        .orderBy("requestedAt", "asc")
        .orderBy("id", "asc")
        .offset((input.page - 1) * 25)
        .limit(25)

      return {
        data: rows,
        total: Number(total.count),
        page: input.page,
        counts: Object.fromEntries(
          counts.map((row: any) => [row.status, Number(row.count)])
        ),
        sendingAvailable: sendingAvailable(),
      }
    },

    async prune() {
      await query(INVITATION).updateMany({
        where: {
          expiresAt: { $lt: new Date().toISOString() },
          tokenCiphertext: { $notNull: true },
        },
        data: { tokenHash: null, tokenCiphertext: null },
      })
    },
  }
}
