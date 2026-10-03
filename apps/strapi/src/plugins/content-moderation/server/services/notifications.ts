import { emailConfigured } from "../utils/email-config"
import {
  applicationDecidedEmail,
  decidedEmail,
  languagesLabel,
  moderatorAlertEmail,
  roleLabel,
} from "../utils/email-templates"

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
const DEFAULT_MODERATORS_EMAIL = "moderators@libraries.global"
const DEFAULT_APP_URL = "https://libraries.global"
/** Only these reaching `pending` alert the moderators (spec §6.3). */
const ALERT_TYPES = new Set(["role_application", "location_request"])

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
  const base = (process.env.APP_PUBLIC_URL || DEFAULT_APP_URL).replace(
    /\/+$/,
    ""
  )

  return `${base}${path}`
}

const fieldsOf = (s: SubmissionRow): Record<string, unknown> =>
  s.fields && typeof s.fields === "object" && !Array.isArray(s.fields)
    ? (s.fields as Record<string, unknown>)
    : {}

const localesOf = (f: Record<string, unknown>): string[] =>
  Array.isArray(f.locales)
    ? f.locales.filter((l): l is string => typeof l === "string")
    : []

const text = (v: unknown, max = 120): string | null =>
  typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null

/** One line saying what a moderator is being asked to review. */
function alertSummary(s: SubmissionRow): string {
  const who = text(s.submittedByName) ?? "A contributor"
  const f = fieldsOf(s)
  if (s.submissionType === "role_application")
    return `${who} applied to be a ${roleLabel(String(f.role ?? "editor"))} for ${languagesLabel(localesOf(f))}.`
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
          const f = fieldsOf(s)
          await send(what, {
            to,
            ...applicationDecidedEmail({
              name,
              role: String(f.role ?? ""),
              locales: localesOf(f),
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
     * Alerts `MODERATORS_EMAIL` that a Role Application or Location Request
     * reached `pending`. Every other type is silent.
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
  }
}
