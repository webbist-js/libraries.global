import {
  EVENT_PROVIDERS,
  type EventProviderKey,
  FEED_TEST_LABEL,
  type FeedTestCode,
} from "@repo/shared-data"

import { verifiedEmailMap } from "../../../../utils/email-recipients"
import { emailConfigured } from "../utils/email-config"
import {
  applicationDecidedEmail,
  claimApprovedEmail,
  decidedEmail,
  driveThanksEmail,
  languagesLabel,
  moderatorAlertEmail,
  roleLabel,
} from "../utils/email-templates"
import { roleApplicationFields } from "../utils/params"
import { driveProposalTitle } from "../utils/submission-summary"

/** What the notifications read from a submission row. */
export type SubmissionRow = {
  documentId: string
  submissionType: string
  submittedByUserId?: string | null
  submittedByEmail?: string | null
  submittedByName?: string | null
  fields?: unknown
  draftData?: unknown
  reviewNote?: string | null
}

type Decision = "approved" | "rejected" | "needs_info"

const PROFILE = "api::user-profile.user-profile"
const DEFAULT_MODERATORS_EMAIL = "moderators@libraries.global"
const DEFAULT_APP_URL = "https://libraries.global"
/** Only these reaching `pending` alert the moderators (spec §6.3). */
const ALERT_TYPES = new Set([
  "role_application",
  "event_feed",
  "drive_proposal",
])
/** Chunk size for an `$in` lookup over an arbitrary number of baUserIds. */
const ID_CHUNK = 200
/** `drive.unit` (spec's Drive Scope/Unit) → the plural a thank-you email reads naturally with. */
const DRIVE_UNIT_PLURAL: Record<string, string> = {
  library: "libraries",
  branch: "branches",
  record: "records",
}

export type NotificationTask = () => Promise<void>
type Scheduler = (task: NotificationTask) => void

/** Runs the task on a later tick, after the response is on its way. */
const nextTick: Scheduler = (task) => {
  setImmediate(() => {
    task().catch(() => {})
  })
}
let scheduler: Scheduler = nextTick

/** Tests: replace how notification tasks are run; no argument restores it. */
export function setNotificationScheduler(next?: Scheduler): void {
  scheduler = next ?? nextTick
}

/**
 * Queues a notification off the request path: the caller never waits for
 * the email provider, and a failure is only logged.
 */
export function scheduleNotification(
  strapi: any,
  what: string,
  task: NotificationTask
): void {
  const guarded: NotificationTask = async () => {
    try {
      await task()
    } catch (err) {
      strapi.log.warn(`[notifications] ${what} failed`, err)
    }
  }
  try {
    scheduler(guarded)
  } catch (err) {
    strapi.log.warn(`[notifications] could not queue ${what}`, err)
  }
}

/** `${APP_PUBLIC_URL}${path}`, without a doubled slash. */
function appUrl(path: string): string {
  let base = process.env.APP_PUBLIC_URL || DEFAULT_APP_URL
  while (base.endsWith("/")) base = base.slice(0, -1)

  return `${base}${path}`
}

const text = (v: unknown, max = 120): string | null =>
  typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null

/** One line saying what a moderator is being asked to review. */
function alertSummary(s: SubmissionRow): string {
  const who = text(s.submittedByName) ?? "A contributor"
  if (s.submissionType === "role_application") {
    const { role, queue, locales } = roleApplicationFields(s.fields)

    return `${who} applied to be a ${roleLabel(role ?? "editor", queue)} for ${languagesLabel(locales)}.`
  }
  if (s.submissionType === "drive_proposal") {
    const title = driveProposalTitle(s.draftData)

    return title ? `Drive proposal: ${title}` : "Drive proposal"
  }
  if (s.submissionType === "event_feed") {
    const f = (s.fields ?? {}) as Record<string, any>
    const label =
      EVENT_PROVIDERS[f.provider as EventProviderKey]?.label ??
      "An event platform"
    const library = text(f.libraryName) ?? "a library"

    return `${label} feed ${f.kind === "replace" ? "details replaced" : "connected"} for ${library}; the connection test said "${FEED_TEST_LABEL[f.test?.result as FeedTestCode] ?? "not run"}".`
  }
  const f = (
    s.fields && typeof s.fields === "object" ? s.fields : {}
  ) as Record<string, unknown>
  const kind = f.kind === "area" ? "area" : "region"
  const name = text(f.name)

  return name
    ? `${who} asked for a new ${kind}: ${name}.`
    : `${who} asked for a new ${kind}.`
}

/**
 * Best-effort moderation emails (spec §6.3). Every call runs after the
 * status change has committed, logs as `[notifications]`, and never throws:
 * an email that fails never undoes or blocks a transition.
 */
export default ({ strapi }: { strapi: any }) => {
  /** Sends one email, or logs why it didn't. Never throws. */
  async function send(
    what: string,
    msg: { to: string; subject: string; text: string; html: string },
    activity?: {
      baUserId: string
      eventKey: string
      kind: "submission_review" | "drive_closed"
      preference: "editsReviewed" | "drives" | "transactional"
      href: string
    }
  ): Promise<void> {
    try {
      if (activity) {
        const emailPayload = {
          subject: msg.subject,
          text: msg.text,
          html: msg.html,
        }
        await strapi.service("api::notification.notification").enqueue({
          baUserId: activity.baUserId,
          eventKey: activity.eventKey,
          kind: activity.kind,
          title: msg.subject,
          body: msg.text,
          href: activity.href,
          emailPreference: activity.preference,
          emailPayload,
        })

        return
      }
      const email = strapi.plugin?.("email")?.service?.("email")
      if (!emailConfigured() || typeof email?.send !== "function") {
        strapi.log.info(
          `[notifications] no email provider configured; skipped ${what}`
        )

        return
      }
      await email.send(msg)
    } catch (err) {
      strapi.log.warn(`[notifications] could not send ${what}`, err)
    }
  }

  return {
    /**
     * Tells the submitter their submission was decided. Respects
     * `editsReviewed`, except for Role Applications, which always send.
     */
    /**
     * The library an approved claim is for: its `targetDocumentId`, else
     * the published library its `targetSlug` names. Null when neither
     * resolves (the email then links the Staff area index).
     */
    async claimLibraryId(s: SubmissionRow): Promise<string | null> {
      const target = text((s as Record<string, unknown>).targetDocumentId, 64)
      if (target) return target
      const slug = text((s as Record<string, unknown>).targetSlug, 255)
      if (!slug) return null
      const [row] = (await strapi.documents("api::library.library").findMany({
        filters: { slug: { $eq: slug } },
        fields: ["documentId"],
        status: "published",
        limit: 1,
      })) as { documentId?: string }[]

      return row?.documentId ?? null
    },

    async submissionDecided(s: SubmissionRow, status: Decision): Promise<void> {
      const what = `the ${status} email for ${s.documentId}`
      try {
        const to = text(s.submittedByEmail, 320) ?? ""
        if (!to && !s.submittedByUserId) {
          strapi.log.info(`[notifications] no submitter email; skipped ${what}`)

          return
        }
        const url = appUrl("/contribute/submissions")
        const name = text(s.submittedByName)
        const note = s.reviewNote?.trim() || null
        const activity = s.submittedByUserId
          ? {
              baUserId: s.submittedByUserId,
              eventKey: `decision:${s.documentId}:${status}:${note ?? ""}`,
              kind: "submission_review" as const,
              preference: "editsReviewed" as "editsReviewed" | "transactional",
              href: "/contribute/submissions",
            }
          : undefined

        if (s.submissionType === "role_application") {
          const { role, queue, locales } = roleApplicationFields(s.fields)
          await send(
            what,
            {
              to,
              ...applicationDecidedEmail({
                name,
                role: role ?? "",
                queue,
                locales,
                status,
                note,
                url,
              }),
            },
            activity ? { ...activity, preference: "transactional" } : undefined
          )

          return
        }

        // An approved Library Claim opens the Staff area: that email always
        // goes, with the link, whatever `notifPrefs.editsReviewed` says.
        if (s.submissionType === "library_claim" && status === "approved") {
          const libraryDocumentId = await (this as any).claimLibraryId(s)
          const library = libraryDocumentId
            ? await strapi.documents("api::library.library").findOne({
                documentId: libraryDocumentId,
                status: "published",
                fields: ["slug"],
              })
            : null
          await send(
            what,
            {
              to,
              ...claimApprovedEmail({
                name,
                libraryName: text(
                  (s.fields as Record<string, unknown> | null)?.libraryName
                ),
                url: library?.slug
                  ? appUrl(`/staff/${library.slug}`)
                  : appUrl("/staff"),
                note,
              }),
            },
            activity ? { ...activity, preference: "transactional" } : undefined
          )

          return
        }

        await send(
          what,
          {
            to,
            ...decidedEmail({
              name,
              type: s.submissionType,
              status,
              note,
              url,
            }),
          },
          activity
        )
      } catch (err) {
        strapi.log.warn(`[notifications] could not prepare ${what}`, err)
      }
    },

    /**
     * Alerts `MODERATORS_EMAIL` that a Role Application, event feed or
     * Drive Proposal reached `pending`. Every other type is silent.
     */
    async submissionPending(s: SubmissionRow): Promise<void> {
      if (!ALERT_TYPES.has(s.submissionType)) return
      const what = `the moderator alert for ${s.documentId}`
      try {
        await send(what, {
          to: process.env.MODERATORS_EMAIL || DEFAULT_MODERATORS_EMAIL,
          ...moderatorAlertEmail({
            type: s.submissionType,
            summary: alertSummary(s),
            url: appUrl(`/contribute/moderation/${s.documentId}`),
          }),
        })
      } catch (err) {
        strapi.log.warn(`[notifications] could not prepare ${what}`, err)
      }
    },

    /** Current verified Better Auth addresses, never a historical submission address. */
    async emailsOf(baUserIds: string[]): Promise<string[]> {
      if (baUserIds.length === 0) return []

      return [...(await verifiedEmailMap(strapi, baUserIds)).values()]
    },

    /** The same verified lookup keyed by Better Auth id. */
    async emailMapOf(baUserIds: string[]): Promise<Map<string, string>> {
      return verifiedEmailMap(strapi, baUserIds)
    },

    /**
     * Thanks every helper of a drive that just closed, with their own part
     * (spec §8): one task is scheduled for the whole drive, which loads
     * notification prefs, skips anyone who turned `drives` off, looks up
     * emails and sends sequentially — one failed send never stops the
     * rest.
     */
    driveThanks(input: {
      drive: {
        documentId: string
        title: string
        slug: string
        unit: string
        goalMet: boolean
        final: {
          total: number
          done: number
          closedGaps: number
          helpers: number
        }
      }
      helpers: { baUserId: string; tasks: number; bonus: boolean }[]
    }): void {
      const { drive, helpers } = input
      if (helpers.length === 0) return

      scheduleNotification(
        strapi,
        `drive thanks for ${drive.documentId}`,
        async () => {
          const byId = new Map(helpers.map((h) => [h.baUserId, h]))
          const ids = [...byId.keys()]

          const eligible = new Set<string>()
          const names = new Map<string, string | null>()
          for (let i = 0; i < ids.length; i += ID_CHUNK) {
            const chunk = ids.slice(i, i + ID_CHUNK)
            const profiles = (await strapi.documents(PROFILE).findMany({
              filters: { baUserId: { $in: chunk } },
              fields: ["baUserId", "notifPrefs", "firstName", "username"],
              limit: chunk.length,
            })) as {
              baUserId: string
              notifPrefs?: Record<string, unknown> | null
              firstName?: string | null
              username?: string | null
            }[]
            for (const p of profiles) {
              names.set(p.baUserId, text(p.firstName) ?? p.username ?? null)
              eligible.add(p.baUserId)
            }
          }
          if (eligible.size === 0) return

          const url = appUrl(`/community/drives/${drive.slug}`)
          const title = drive.title.replaceAll("*", "")
          const unitPlural = DRIVE_UNIT_PLURAL[drive.unit] ?? "libraries"

          for (const baUserId of eligible) {
            const to = ""
            const helper = byId.get(baUserId)
            if (!helper) continue
            await send(
              `drive thanks for ${drive.documentId} to ${baUserId}`,
              {
                to,
                ...driveThanksEmail({
                  name: names.get(baUserId) ?? null,
                  title,
                  url,
                  goalMet: drive.goalMet,
                  done: drive.final.done,
                  total: drive.final.total,
                  unitPlural,
                  closedGaps: drive.final.closedGaps,
                  helpers: drive.final.helpers,
                  yours: helper.tasks,
                  bonus: helper.bonus,
                }),
              },
              {
                baUserId,
                eventKey: `drive:${drive.documentId}:${baUserId}`,
                kind: "drive_closed",
                preference: "drives",
                href: `/community/drives/${drive.slug}`,
              }
            )
          }
        }
      )
    },
  }
}
