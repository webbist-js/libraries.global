import { createHash } from "node:crypto"

import type { Core } from "@strapi/strapi"

import { type InternalEvent, maskEmail } from "./slack"

const TABLE = "internal_notifications"
type Row = Record<string, string>
type AuthRow = {
  id: string
  userId: string
  createdAt: string
  emailVerified: boolean
}
type Source = {
  name: string
  table: string
  at: string
  filter?: (query: ReturnType<Core.Strapi["db"]["connection"]>) => unknown
  event: (row: Row) => Omit<InternalEvent, "eventKey" | "eventAt">
}

const TYPES: Record<string, string> = {
  correction: "Correction / verification / photo",
  new_library: "New Library",
  library_claim: "Library Claim",
  library_edit: "Library edit",
  event_feed: "Event Feed",
  wiki_edit: "Knowledge edit",
  blog_submission: "Journal submission",
  topic_suggestion: "Topic suggestion",
  role_application: "Role Application",
  drive_proposal: "Drive Proposal",
}

const sources: Source[] = [
  {
    name: "beta",
    table: "subscribers",
    at: "consented_at",
    filter: (q) =>
      q.where("source.type", "beta_waitlist").where("source.state", "active"),
    event: (r) => ({
      kind: "beta_signup",
      title: "Beta access requested",
      detail: `${maskEmail(r.email)} · ${r.communication_locale || "en"}`,
    }),
  },
  {
    name: "submission",
    table: "cm_submissions",
    at: "updated_at",
    filter: (q) => q.whereNot("source.status", "draft"),
    event: (r) => ({
      kind: "contribution",
      title: "Contribution submitted",
      actorId: r.submitted_by_user_id,
      detail: `${TYPES[r.submission_type] || "Submission"} · ${r.content_locale || "en"} · ${r.status}`,
      href: `/moderation/${encodeURIComponent(r.document_id)}`,
    }),
  },
  {
    name: "review",
    table: "cm_review_events",
    at: "created_at",
    filter: (q) =>
      q.whereIn("source.to_status", [
        "approved",
        "rejected",
        "needs_info",
        "pending",
      ]),
    event: (r) => ({
      kind: "review",
      title:
        r.reviewer_kind === "staff" && r.to_status === "approved"
          ? "Staff published a contribution"
          : `Submission ${r.to_status === "approved" ? "accepted" : r.to_status === "needs_info" ? "needs changes" : r.to_status === "pending" ? "resubmitted" : "not accepted"}`,
      actorId: r.reviewer_kind === "admin" ? undefined : r.reviewer_id,
      detail: `Submission ${r.submission_document_id} · ${r.reviewer_kind || "reviewer"}`,
      href: `/moderation/${encodeURIComponent(r.submission_document_id)}`,
    }),
  },
  {
    name: "notice",
    table: "staff_audits",
    at: "at",
    filter: (q) =>
      q.whereIn("source.action", [
        "notice_created",
        "notice_updated",
        "notice_ended",
        "access_reported",
        "stepup_locked",
        "joined",
        "removed",
        "level_changed",
      ]),
    event: (r) => ({
      kind: "staff_activity",
      title: r.action.startsWith("notice_")
        ? "Library Notice changed"
        : "Library staff activity",
      actorId: r.actor,
      detail: r.action.replaceAll("_", " "),
      href: "/staff",
    }),
  },
  {
    name: "suggestion",
    table: "cm_option_suggestions",
    at: "updated_at",
    filter: (q) =>
      q
        .where("source.publication_status", "published")
        .whereNot("source.status", "removed"),
    event: (r) => ({
      kind: "contribution",
      title: "Option suggested",
      actorId: r.suggested_by,
      detail: `${r.option_key} · ${r.name}`,
      href: `/community/suggestions?suggestion=${encodeURIComponent(r.document_id)}`,
    }),
  },
  {
    name: "thread",
    table: "discussions_threads",
    at: "updated_at",
    filter: (q) => q.whereIn("source.state", ["visible", "pending"]),
    event: (r) => ({
      kind: "discussion",
      title: "Discussion started",
      actorId: r.author_key?.startsWith("ba:")
        ? r.author_key.slice(3)
        : undefined,
      detail: `Discussion · ${r.language} · ${r.state}`,
      href: `/community/discussions/${encodeURIComponent(r.document_id)}`,
    }),
  },
  {
    name: "reply",
    table: "discussions_replys",
    at: "updated_at",
    filter: (q) => q.whereIn("source.state", ["visible", "pending"]),
    event: (r) => ({
      kind: "discussion",
      title: "Discussion reply posted",
      actorId: r.author_key?.startsWith("ba:")
        ? r.author_key.slice(3)
        : undefined,
      detail: `Thread ${r.thread_id} · ${r.language} · ${r.state}`,
      href: `/community/discussions/${encodeURIComponent(r.thread_id)}`,
    }),
  },
  {
    name: "discussion-report",
    table: "discussions_reports",
    at: "created_at",
    event: (r) => ({
      kind: "moderation_alert",
      title: "Discussion reported",
      actorId: r.reporter_key?.startsWith("ba:")
        ? r.reporter_key.slice(3)
        : undefined,
      detail: `Report ${r.document_id} · ${r.record_type} · ${r.state}`,
      href: "/moderation/discussions",
    }),
  },
  // Direct editor publishing also has a durable Article Change, even without a Submission.
  {
    name: "article",
    table: "article_changes",
    at: "changed_at",
    filter: (q) =>
      q
        .where("source.version_status", "published")
        .whereIn("source.actor_kind", ["contributor", "admin"])
        .whereNull("source.submission_document_id"),
    event: (r) => ({
      kind: "contribution",
      title: `${r.article_kind === "wiki" ? "Knowledge" : "Journal"} article ${r.kind}`,
      actorId: r.actor_kind === "contributor" ? r.actor_id : undefined,
      detail: `${r.slug || r.article_document_id} · ${r.content_locale || "en"} · ${r.actor_kind}`,
      href: r.article_kind === "wiki" ? "/knowledge" : "/journal",
    }),
  },
  {
    name: "email-failure",
    table: "notifications",
    at: "updated_at",
    filter: (q) => q.where("source.email_state", "failed"),
    event: (r) => ({
      kind: "delivery_alert",
      title: "Email delivery exhausted retries",
      detail: `${r.kind} · notification ${r.document_id}`,
    }),
  },
  {
    name: "feed-health",
    table: "notifications",
    at: "created_at",
    filter: (q) => q.where("source.kind", "feed_update"),
    event: (r) => ({
      kind: "feed_alert",
      title: "Event Feed update",
      actorId: r.ba_user_id,
      detail: r.title,
      href: r.href,
    }),
  },
  {
    name: "billing",
    table: "notifications",
    at: "created_at",
    filter: (q) => q.where("source.kind", "billing_update"),
    event: (r) => ({
      kind: "billing_update",
      title: "Membership / billing update",
      actorId: r.ba_user_id,
      detail: `${r.title} · ${process.env.BILLING_ENV === "live" ? "live" : "sandbox"}`,
      href: r.href,
    }),
  },
  {
    name: "beta-invite-sent",
    table: "beta_invitations",
    at: "sent_at",
    event: () => ({
      kind: "beta_invitation",
      title: "Beta invitation sent",
      detail: "A requested beta invitation was accepted by the email provider.",
    }),
  },
  {
    name: "beta-invite-accepted",
    table: "beta_invitations",
    at: "accepted_at",
    event: () => ({
      kind: "beta_invitation",
      title: "Beta invitation redeemed",
      detail:
        "A beta visitor redeemed their invitation. Account creation is reported separately.",
    }),
  },
]

/** Read committed records, including writes missed during downtime. The anti-join
 * avoids cursors that can skip a slow transaction with a smaller sequence id. */
async function contentEvent(strapi: Core.Strapi, source: Source, row: Row) {
  const event = source.event(row)
  if (source.name.startsWith("beta-invite-")) {
    const subscriber = await strapi.db
      .query("api::subscriber.subscriber")
      .findOne({
        where: { documentId: row.subscriber_document_id },
        select: ["email"],
      })
    event.detail = `${maskEmail(subscriber?.email)} · ${event.detail}`
  }
  if (source.name === "review") {
    const submission = await strapi.db
      .query("plugin::content-moderation.submission")
      .findOne({
        where: { documentId: row.submission_document_id },
        select: ["submissionType", "targetSlug", "contentLocale"],
      })
    if (submission)
      event.detail = `${TYPES[submission.submissionType] || "Submission"} · ${submission.contentLocale || "en"} · ${row.reviewer_kind || "reviewer"}`
  }
  if (source.name === "notice") {
    const audit = await strapi.db
      .query("plugin::library-staff.staff-audit")
      .findOne({
        where: { id: row.id },
        populate: { library: { select: ["name", "slug"] } },
      })
    if (audit?.library) {
      event.detail += ` · ${audit.library.name}`
      if (audit.library.slug)
        event.href = `/staff/${encodeURIComponent(audit.library.slug)}/notices`
    }
  }

  return {
    ...event,
    eventKey: `${source.name}:${row.id}`,
    eventAt: new Date(row[source.at]).toISOString(),
  }
}

export async function collectContentEvents(
  strapi: Core.Strapi,
  since: string,
  enqueue: (event: InternalEvent) => Promise<void>
) {
  let failed = 0
  for (const source of sources) {
    try {
      const db = strapi.db.connection
      const query = db(`${source.table} as source`)
        .select("source.*")
        .where(
          `source.${source.at}`,
          ">=",
          new Date(
            Math.max(Date.parse(since), Date.now() - 90 * 86_400_000)
          ).toISOString()
        )
        .whereNotExists(function () {
          this.select(db.raw("1"))
            .from(`${TABLE} as delivered`)
            .whereRaw("delivered.event_key = ? || CAST(source.id AS text)", [
              `${source.name}:`,
            ])
        })
        .orderBy("source.id", "asc")
        .limit(50)
      source.filter?.(query)
      const rows = await query
      for (const row of rows)
        await enqueue(await contentEvent(strapi, source, row))
    } catch {
      failed++
      strapi.log.warn(
        `[internal-notifications] Source ${source.name} unavailable`
      )
    }
  }

  return failed
}

/** Feed pages are revisited after a full pass to catch late commits. Collection is limited to the same 90-day window as receipt retention,
 * so deleting old deduplication keys never re-announces historical events. */
function authEvent(kind: "users" | "sessions", row: AuthRow): InternalEvent {
  const eventAt = new Date(row.createdAt).toISOString()
  const actorId = row.userId
  const identity = createHash("sha256").update(actorId).digest("hex")
  if (kind === "users")
    return {
      eventKey: `account:${identity}`,
      kind: "account_created",
      title: "Account created",
      detail: `Email ${row.emailVerified ? "verified" : "awaiting verification"}`,
      actorId,
      eventAt,
    }

  return {
    eventKey: `login:${identity}:${eventAt.slice(0, 13)}`,
    kind: "login",
    title: "Signed in to beta",
    detail:
      "A successful session started (at most one alert per person per hour).",
    actorId,
    eventAt,
  }
}

export async function collectAuthEvents(
  strapi: Core.Strapi,
  enqueue: (event: InternalEvent) => Promise<void>
) {
  const base =
    process.env.APP_INTERNAL_URL ||
    process.env.APP_PUBLIC_URL ||
    "https://libraries.global"
  const secret = process.env.STRAPI_BRIDGE_SECRET
  if (!secret) throw new Error("Internal activity bridge is not configured")
  for (const kind of ["users", "sessions"] as const) {
    const store = strapi.store({
      type: "core",
      name: "internal-notifications",
      key: kind,
    })
    const after = ((await store.get()) as { after?: string })?.after || ""
    const response = await fetch(
      `${base.replace(/\/$/, "")}/api/internal/notifications/activity`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Service-Secret": secret,
        },
        body: JSON.stringify({ kind, after }),
        signal: AbortSignal.timeout(10000),
        redirect: "error",
      }
    )
    if (!response.ok) throw new Error("Internal activity bridge unavailable")
    const result = (await response.json()) as { data: AuthRow[]; next: string }
    if (
      !Array.isArray(result.data) ||
      result.data.length > 100 ||
      typeof result.next !== "string"
    )
      throw new Error("Invalid internal activity feed")
    for (const row of result.data) await enqueue(authEvent(kind, row))
    await store.set({ value: { after: result.next } })
  }
}
