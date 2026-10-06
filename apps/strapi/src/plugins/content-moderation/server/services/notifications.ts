import {
  EVENT_PROVIDERS,
  type EventProviderKey,
  FEED_TEST_LABEL,
  type FeedTestCode,
} from "@repo/shared-data"

import { emailConfigured } from "../utils/email-config"
import {
  applicationDecidedEmail,
  decidedEmail,
  languagesLabel,
  moderatorAlertEmail,
  roleLabel,
} from "../utils/email-templates"
import { roleApplicationFields } from "../utils/params"

/** What the notifications read from a submission row. */
export type SubmissionRow = {
  documentId: string
  submissionType: string
  submittedByUserId?: string | null
  submittedByEmail?: string | null
  submittedByName?: string | null
  fields?: unknown
  reviewNote?: string | null
}

type Decision = "approved" | "rejected" | "needs_info"

const PROFILE = "api::user-profile.user-profile"
const SUBMISSION_UID = "plugin::content-moderation.submission"
const DEFAULT_MODERATORS_EMAIL = "moderators@libraries.global"
const DEFAULT_APP_URL = "https://libraries.global"
/** Only these reaching `pending` alert the moderators (spec §6.3). */
const ALERT_TYPES = new Set(["role_application", "event_feed"])
/** Matches `people.ts`'s own lookup: no user-profile carries an email, so
 * the one each person's submissions were filed with is the best we know. */
const EMAIL_ROWS_MAX = 500

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
  if (s.submissionType === "event_feed") {
    const f = (s.fields ?? {}) as Record<string, any>
    const label =
      EVENT_PROVIDERS[f.provider as EventProviderKey]?.label ??
      "An event platform"

    return `${label} feed ${f.kind === "replace" ? "details replaced" : "connected"} for a library; the connection test said "${FEED_TEST_LABEL[f.test?.result as FeedTestCode] ?? "not run"}".`
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
    msg: { to: string; subject: string; text: string; html: string }
  ): Promise<void> {
    try {
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

  /** `notifPrefs.editsReviewed`, true unless the submitter turned it off. */
  async function wantsDecisionEmails(baUserId: string): Promise<boolean> {
    const [profile] = (await strapi.documents(PROFILE).findMany({
      filters: { baUserId: { $eq: baUserId } },
      fields: ["notifPrefs"],
      limit: 1,
    })) as { notifPrefs?: Record<string, unknown> | null }[]

    return profile?.notifPrefs?.editsReviewed !== false
  }

  return {
    /**
     * Tells the submitter their submission was decided. Respects
     * `editsReviewed`, except for Role Applications, which always send.
     */
    async submissionDecided(s: SubmissionRow, status: Decision): Promise<void> {
      const what = `the ${status} email for ${s.documentId}`
      try {
        const to = text(s.submittedByEmail, 320)
        if (!to) {
          strapi.log.info(`[notifications] no submitter email; skipped ${what}`)

          return
        }
        const url = appUrl("/contribute/submissions")
        const name = text(s.submittedByName)
        const note = s.reviewNote?.trim() || null

        if (s.submissionType === "role_application") {
          const { role, queue, locales } = roleApplicationFields(s.fields)
          await send(what, {
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
          })

          return
        }

        if (
          s.submittedByUserId &&
          !(await wantsDecisionEmails(s.submittedByUserId))
        ) {
          strapi.log.info(
            `[notifications] submitter turned off review emails; skipped ${what}`
          )

          return
        }
        await send(what, {
          to,
          ...decidedEmail({
            name,
            type: s.submissionType,
            status,
            note,
            url,
          }),
        })
      } catch (err) {
        strapi.log.warn(`[notifications] could not prepare ${what}`, err)
      }
    },

    /**
     * Alerts `MODERATORS_EMAIL` that a Role Application reached `pending`.
     * Every other type is silent.
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

    /**
     * The latest email each Better Auth user's submissions were filed with
     * (no user-profile carries one). Used only to reach a librarian outside
     * a submission's own flow, e.g. another claimant of a feed that was
     * changed; never a credential value.
     */
    async emailsOf(baUserIds: string[]): Promise<string[]> {
      if (baUserIds.length === 0) return []
      const rows = (await strapi.documents(SUBMISSION_UID).findMany({
        filters: { submittedByUserId: { $in: baUserIds } },
        fields: ["submittedByUserId", "submittedByEmail"],
        sort: [{ createdAt: "desc" }, { id: "desc" }],
        limit: EMAIL_ROWS_MAX,
      })) as { submittedByUserId?: string; submittedByEmail?: string }[]
      const out = new Map<string, string>()
      for (const r of rows) {
        const email = text(r.submittedByEmail, 320)
        if (r.submittedByUserId && email && !out.has(r.submittedByUserId))
          out.set(r.submittedByUserId, email)
      }

      return [...out.values()]
    },
  }
}
