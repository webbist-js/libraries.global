import { createHash } from "node:crypto"
import { setTimeout } from "node:timers/promises"

import {
  emailTemplate,
  digestEmail,
  communityReportEmail,
  withEmailPreferences,
  type DigestEmailData,
  type CommunityEmailData,
  NOTIFICATION_DEFAULTS,
  type NotificationPreference,
} from "@repo/shared-data"

import { emailConfigured } from "../../../plugins/content-moderation/server/utils/email-config"
import { emailActionUrl, emailLinkToken } from "../../../utils/email-links"
import { verifiedEmailMap } from "../../../utils/email-recipients"
import { withLeaderLock } from "../../../utils/leader-lock"
import {
  communityWeek,
  personalWeek,
  reportBody,
  weeklyWindow,
} from "../../../utils/weekly-community-report"

const UID = "api::notification.notification"
const PROFILE = "api::user-profile.user-profile"
const LOCK = 7_420_102
type Kind =
  | "new_follower"
  | "library_update"
  | "submission_review"
  | "drive_closed"
  | "weekly_digest"
  | "weekly_report"
  | "recognition"
  | "announcement"
  | "newsletter_confirmation"
  | "staff_update"
  | "feed_update"
  | "billing_update"
  | "beta_invitation"
  | "discussion_update"
type Input = {
  baUserId?: string
  eventKey: string
  kind: Kind
  title: string
  body: string
  href?: string
  inApp?: boolean
  emailPreference?: NotificationPreference | "transactional"
  recipientEmail?: string
  emailPayload?: Record<string, unknown>
}

export function wantsActivityEmail(
  prefs: Record<string, unknown> | null | undefined,
  preference?: string
): boolean {
  if (preference === "transactional") return true
  if (preference === "weeklyDigest")
    return (
      prefs?.weeklyDigest === true &&
      typeof prefs?.digestConsentedAt === "string"
    )
  if (preference === "weeklyReport")
    return (
      prefs?.weeklyReport === true &&
      typeof prefs?.reportConsentedAt === "string"
    )
  if (preference === "marketing")
    return (
      prefs?.marketing === true && typeof prefs?.productConsentedAt === "string"
    )
  if (!preference || !Object.hasOwn(NOTIFICATION_DEFAULTS, preference))
    return false

  return (
    (prefs?.[preference] ??
      NOTIFICATION_DEFAULTS[preference as NotificationPreference]) === true
  )
}

export default ({ strapi }: { strapi: any }) => ({
  /** Persist before returning to the triggering request. A unique key also covers retries. */
  async enqueue(input: Input) {
    const eventKey = createHash("sha256").update(input.eventKey).digest("hex")
    const existing = await strapi.db.query(UID).findOne({ where: { eventKey } })
    if (existing) return existing
    try {
      return await strapi.documents(UID).create({
        data: {
          ...input,
          eventKey,
          inApp: input.inApp ?? true,
          emailState: input.emailPreference ? "pending" : "none",
          attempts: 0,
          nextAttemptAt: new Date().toISOString(),
        },
      })
    } catch (error: any) {
      if (error?.code !== "23505" && error?.cause?.code !== "23505") throw error

      return strapi.db.query(UID).findOne({ where: { eventKey } })
    }
  },

  /** At most 50 messages each minute; preferences and verified address checked at send time. */
  async deliver(now = new Date(), kind?: "beta_invitation") {
    if (!emailConfigured()) return { sent: 0, skipped: 0, failed: 0 }
    const locked = await withLeaderLock(strapi, LOCK, async () => {
      const report = { sent: 0, skipped: 0, failed: 0 }
      const rows = await strapi.db.query(UID).findMany({
        where: {
          emailState: "pending",
          nextAttemptAt: { $lte: now.toISOString() },
          ...(kind ? { kind } : {}),
        },
        orderBy: { id: "asc" },
        limit: 50,
      })
      for (const row of rows) {
        const save = (data: Record<string, unknown>) =>
          strapi.db.query(UID).update({ where: { id: row.id }, data })
        try {
          if (row.kind === "beta_invitation") {
            const state = await strapi
              .plugin("beta-invites")
              .service("invites")
              .deliver(row, now)
            report[state]++
            const interval = Math.max(
              0,
              Math.min(
                Number(process.env.EMAIL_SEND_INTERVAL_MS ?? "1000"),
                30000
              )
            )
            if (state === "sent" && interval > 0) await setTimeout(interval)
            continue
          }
          const profile = row.baUserId
            ? await strapi.db
                .query(PROFILE)
                .findOne({ where: { baUserId: row.baUserId } })
            : null
          if (
            (row.baUserId && !profile) ||
            !wantsActivityEmail(profile?.notifPrefs, row.emailPreference)
          ) {
            await save({ emailState: "skipped" })
            report.skipped++
            continue
          }
          // A newsletter confirmation can no longer send after a suppression or withdrawal.
          if (row.kind === "newsletter_confirmation") {
            const subscriber = await strapi
              .documents("api::subscriber.subscriber")
              .findOne({ documentId: row.emailPayload?.subscriberId })
            if (
              subscriber?.state !== "pending_confirmation" ||
              subscriber?.consentedAt !== row.emailPayload?.consentVersion
            ) {
              await save({ emailState: "skipped" })
              report.skipped++
              continue
            }
          }
          if (row.kind === "announcement") {
            const published = await strapi
              .documents("api::announcement.announcement")
              .findOne({
                documentId: row.emailPayload?.announcementId,
                status: "published",
              })
            if (!published) {
              await save({ emailState: "skipped" })
              report.skipped++
              continue
            }
          }
          const to =
            row.baUserId && !row.recipientEmail
              ? (await verifiedEmailMap(strapi, [row.baUserId])).get(
                  row.baUserId
                )
              : row.recipientEmail
          if (!to) {
            await save({ emailState: "skipped" })
            report.skipped++
            continue
          }
          const base = (
            process.env.APP_PUBLIC_URL || "https://libraries.global"
          ).replace(/\/$/, "")
          const unsubscribeToken =
            row.baUserId &&
            row.emailPreference &&
            row.emailPreference !== "transactional"
              ? emailLinkToken({
                  id: row.baUserId,
                  purpose:
                    row.emailPreference === "weeklyDigest"
                      ? "digest_unsubscribe"
                      : "activity_unsubscribe",
                  ...(row.emailPreference === "weeklyDigest"
                    ? {}
                    : { preference: row.emailPreference }),
                })
              : undefined
          const unsubscribeUrl = unsubscribeToken
            ? emailActionUrl(unsubscribeToken)
            : undefined
          const payload = row.emailPayload ?? {}
          const options = {
            siteUrl: base,
            postalAddress: process.env.EMAIL_POSTAL_ADDRESS,
            url:
              row.href?.startsWith("/") && !row.href.startsWith("//")
                ? base + row.href
                : undefined,
          }
          let message = payload.digest
            ? digestEmail(payload.digest as DigestEmailData, options)
            : payload.communityReport
              ? communityReportEmail(
                  payload.communityReport as CommunityEmailData,
                  { ...options, url: base + "/profile" }
                )
              : typeof payload.subject === "string" &&
                  typeof payload.text === "string" &&
                  typeof payload.html === "string"
                ? {
                    subject: payload.subject,
                    text: payload.text,
                    html: payload.html,
                  }
                : emailTemplate({
                    ...options,
                    title: row.title,
                    body: row.body,
                    eyebrow:
                      row.emailPreference === "transactional"
                        ? "Account & service"
                        : "Your Libraries Global updates",
                    action: "View on Libraries Global",
                  })
          if (unsubscribeUrl)
            message = withEmailPreferences(message, {
              ...options,
              unsubscribeUrl,
              preferencesUrl: base + "/profile/settings#notifications",
              footer:
                row.kind === "weekly_digest"
                  ? "You’re getting this because the weekly digest is on in your notification settings."
                  : row.kind === "weekly_report"
                    ? "You’re getting this because weekly community reports are on in your notification settings."
                    : "You’re getting this because this activity email is on in your notification settings. You can turn off this category below.",
            })
          await strapi
            .plugin("email")
            .service("email")
            .send({
              to,
              replyTo: process.env.EMAIL_REPLY_TO,
              ...message,
              ...(unsubscribeUrl
                ? {
                    headers: {
                      "List-Unsubscribe": `<${base}/api/email/preferences?token=${encodeURIComponent(unsubscribeToken!)}>`,
                      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
                    },
                  }
                : {}),
            })
          await save({
            emailState: "sent",
            sentAt: new Date().toISOString(),
            lastError: null,
          })
          report.sent++
          // Mailtrap's free sandbox needs spacing; live limits are provider-specific.
          const interval = Number(
            process.env.EMAIL_SEND_INTERVAL_MS ??
              (process.env.MAILTRAP_USER && !process.env.SMTP_HOST
                ? "3000"
                : "1000")
          )
          if (interval > 0) await setTimeout(Math.min(interval, 30000))
        } catch {
          const attempts = (row.attempts ?? 0) + 1
          await save({
            attempts,
            emailState: attempts >= 5 ? "failed" : "pending",
            nextAttemptAt: new Date(
              now.getTime() + 60000 * 2 ** attempts
            ).toISOString(),
            lastError:
              "Delivery failed; check provider and recipient service health.",
          })
          report.failed++
          strapi.log.warn(
            `[email] Delivery attempt ${attempts} failed for notification ${row.documentId}`
          )
        }
      }

      return report
    })

    return locked.ran ? locked.result : { sent: 0, skipped: 0, failed: 0 }
  },

  /** Roll up public followed-library updates once per library/day in the inbox. */
  async followedLibraryUpdates(now = new Date()) {
    return withLeaderLock(strapi, 7_420_104, async () => {
      const changes = await strapi.db
        .query("api::library-change.library-change")
        .findMany({
          where: {
            versionStatus: "published",
            action: { $in: ["publish", "update"] },
            source: { $ne: "import" },
            changedAt: {
              $gte: new Date(now.getTime() - 86400000).toISOString(),
              $lte: now.toISOString(),
            },
          },
          select: ["libraryDocumentId", "changedAt"],
          orderBy: { changedAt: "desc" },
          limit: 10000,
        })
      const changed = new Map<string, string>()
      for (const change of changes)
        if (!changed.has(change.libraryDocumentId))
          changed.set(
            change.libraryDocumentId,
            new Date(change.changedAt).toISOString().slice(0, 10)
          )
      if (!changed.size) return { queued: 0 }
      let offset = 0,
        queued = 0
      for (;;) {
        const profiles = await strapi.db.query(PROFILE).findMany({
          orderBy: { id: "asc" },
          offset,
          limit: 100,
          populate: { followedLibraries: true },
        })
        for (const profile of profiles) {
          const ids = [
            ...new Set<string>(
              (profile.followedLibraries ?? []).map(
                (library: any) => library.documentId
              )
            ),
          ].filter((id) => changed.has(id))
          if (!ids.length) continue
          const libraries = await strapi
            .documents("api::library.library")
            .findMany({
              filters: { documentId: { $in: ids } },
              status: "published",
              locale: "en",
              fields: ["name", "documentId", "slug"],
              populate: {
                continent: { fields: ["slug"] },
                country: { fields: ["slug"] },
                region: { fields: ["slug"] },
              },
              limit: 100,
            })
          for (const library of libraries) {
            await this.enqueue({
              baUserId: profile.baUserId,
              kind: "library_update",
              eventKey: `library-update:${library.documentId}:${changed.get(library.documentId)}:${profile.baUserId}`,
              title: `${library.name} was updated`,
              body: "Public information about a library you follow has changed.",
              href: profile.username
                ? `/profile/${encodeURIComponent(profile.username)}/following`
                : "/profile",
            })
            queued++
          }
        }
        if (profiles.length < 100) break
        offset += profiles.length
      }

      return { queued }
    })
  },

  /** A digest contains public library names only, never draft changes or private actor details. */
  async weeklyDigest(now = new Date()) {
    if (process.env.EMAIL_DIGEST_ENABLED !== "true") return { queued: 0 }

    return withLeaderLock(strapi, 7_420_103, async () => {
      const { start, end } = weeklyWindow(now)
      let queued = 0
      let offset = 0
      for (;;) {
        const profiles = await strapi.db.query(PROFILE).findMany({
          orderBy: { id: "asc" },
          offset,
          limit: 100,
          populate: { followedLibraries: true },
        })
        for (const profile of profiles) {
          if (!wantsActivityEmail(profile.notifPrefs, "weeklyDigest")) continue
          const ids = [
            ...new Set<string>(
              (profile.followedLibraries ?? []).map(
                (library: any) => library.documentId
              )
            ),
          ]
          if (!ids.length) continue
          const changes = await strapi.db
            .query("api::library-change.library-change")
            .findMany({
              where: {
                libraryDocumentId: { $in: ids },
                versionStatus: "published",
                action: { $in: ["publish", "update"] },
                source: { $ne: "import" },
                changedAt: {
                  $gte: start.toISOString(),
                  $lt: end.toISOString(),
                },
              },
              select: ["libraryDocumentId"],
              limit: 10000,
            })
          const changed = [
            ...new Set(changes.map((change: any) => change.libraryDocumentId)),
          ]
          if (!changed.length) continue
          const libraries = await strapi
            .documents("api::library.library")
            .findMany({
              filters: { documentId: { $in: changed } },
              status: "published",
              locale: "en",
              fields: ["name", "documentId", "slug"],
              populate: {
                continent: { fields: ["slug"] },
                country: { fields: ["slug"] },
                region: { fields: ["slug"] },
              },
              limit: 100,
            })
          if (!libraries.length) continue
          await this.enqueue({
            baUserId: profile.baUserId,
            kind: "weekly_digest",
            eventKey: `digest:${end.toISOString().slice(0, 10)}:${profile.baUserId}`,
            title: "Your weekly library digest",
            body: `Libraries you follow were updated this week:\n\n${libraries.map((library: any) => `• ${library.name}`).join("\n")}\n\nOpen your following list to explore the latest information.`,
            href: profile.username
              ? `/profile/${encodeURIComponent(profile.username)}/following`
              : "/profile",
            emailPreference: "weeklyDigest",
            emailPayload: {
              digest: {
                start: start.toISOString(),
                end: end.toISOString(),
                libraries: libraries.map((library: any) => {
                  const segments = [
                    library.continent?.slug,
                    library.country?.slug,
                    library.region?.slug,
                    library.slug,
                  ]

                  return {
                    name: library.name,
                    ...(segments.every(Boolean)
                      ? {
                          href:
                            "/" + segments.map(encodeURIComponent).join("/"),
                        }
                      : {}),
                  }
                }),
              },
            },
          })
          queued++
        }
        if (profiles.length < 100) break
        offset += profiles.length
      }

      return { queued }
    })
  },
  async weeklyReport(now = new Date()) {
    if (process.env.EMAIL_REPORT_ENABLED !== "true") return { queued: 0 }

    return withLeaderLock(strapi, 7_420_105, async () => {
      const { start, end } = weeklyWindow(now)
      const week = await communityWeek(strapi, start, end)
      let queued = 0
      for (let offset = 0; ; offset += 100) {
        const profiles = await strapi.db
          .query(PROFILE)
          .findMany({ orderBy: { id: "asc" }, offset, limit: 100 })
        for (const p of profiles) {
          if (!wantsActivityEmail(p.notifPrefs, "weeklyReport")) continue
          const personal = await personalWeek(strapi, p.baUserId, start, end)
          if (
            !week.newLibraries &&
            !week.updatedLibraries &&
            !week.accepted &&
            !week.knowledge &&
            !week.journal &&
            !personal.accepted &&
            !personal.points
          )
            continue
          await this.enqueue({
            baUserId: p.baUserId,
            kind: "weekly_report",
            eventKey: `community-report:${end.toISOString().slice(0, 10)}:${p.baUserId}`,
            title: "Your weekly community report",
            body: reportBody(
              week,
              personal,
              start,
              end,
              (
                process.env.APP_PUBLIC_URL || "https://libraries.global"
              ).replace(/\/$/, "")
            ),
            href: "/contribute/submissions",
            emailPreference: "weeklyReport",
            emailPayload: {
              communityReport: {
                start: start.toISOString(),
                end: end.toISOString(),
                week,
                personal,
              },
            },
          })
          queued++
        }
        if (profiles.length < 100) break
      }

      return { queued }
    })
  },
  /** Only published announcements, once per recipient; signups after publication are excluded. */
  async announcements() {
    return withLeaderLock(strapi, 7_420_106, async () => {
      let queued = 0
      const announcements = await strapi
        .documents("api::announcement.announcement")
        .findMany({ status: "published", limit: 100, sort: "publishedAt:desc" })
      for (const a of announcements) {
        if (
          !a.publishedAt ||
          !["editorialMessages", "marketing", "transactional"].includes(
            a.channel
          )
        )
          continue
        for (let offset = 0; ; offset += 100) {
          const profiles = await strapi.db.query(PROFILE).findMany({
            where: {
              createdAt: { $lte: new Date(a.publishedAt).toISOString() },
            },
            orderBy: { id: "asc" },
            offset,
            limit: 100,
          })
          for (const p of profiles) {
            await this.enqueue({
              baUserId: p.baUserId,
              kind: "announcement",
              eventKey: `announcement:${a.documentId}:${p.baUserId}`,
              title: a.title,
              body: a.body,
              href:
                a.href?.startsWith("/") && !a.href.startsWith("//")
                  ? a.href
                  : undefined,
              emailPreference: a.channel,
              emailPayload: { announcementId: a.documentId },
            })
            queued++
          }
          if (profiles.length < 100) break
        }
      }

      return { queued }
    })
  },
  async purge(now = new Date()) {
    return strapi.db.query(UID).deleteMany({
      where: {
        createdAt: {
          $lt: new Date(now.getTime() - 90 * 86400000).toISOString(),
        },
      },
    })
  },
})
