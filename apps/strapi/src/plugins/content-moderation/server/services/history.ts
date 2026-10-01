import { randomUUID } from "node:crypto"

import { isActivityPublic } from "../../../../utils/activity-visibility"
import { RECORD_META_KEYS } from "../utils/record-review"

/**
 * Public history read from Change Records (`library-change`) and Article
 * Changes (`article-change`). Published rows only (constraints,
 * Clarification 1): draft-only writes never reach a public surface. A
 * contributor is named only when their profile's activity is public; admin,
 * token and system actors are shown by kind alone.
 */

const LIBRARY_CHANGE = "api::library-change.library-change"
const ARTICLE_CHANGE = "api::article-change.article-change"
const PROFILE = "api::user-profile.user-profile"
const SUBMISSION = "plugin::content-moderation.submission"
const TABLE = "library_changes"
const PG_CLIENTS = new Set(["postgres", "pg", "postgresql"])
/** Rows loaded for one page of batches; far above any real batch size. */
const ROWS_PER_PAGE = 5000

export type HistoryActor = { kind: string; username: string | null }

export type LibraryHistoryBatch = {
  batchId: string
  changedAt: string
  action: string
  source: string
  actor: HistoryActor
  fields: { field: string; previous?: unknown; next?: unknown }[]
  submissionDocumentId: string | null
}

export type HistoryMeta = { page: number; pageSize: number; total: number }

type ChangeRow = {
  batchId: string
  field: string
  previous?: unknown
  next?: unknown
  action?: string | null
  source?: string | null
  actorKind?: string | null
  actorId?: string | null
  submissionDocumentId?: string | null
  changedAt?: string | Date | null
}

function isPostgres(strapi: any): boolean {
  return PG_CLIENTS.has(String(strapi.db?.dialect?.client ?? "").toLowerCase())
}

/**
 * `changed_at` as `YYYY-MM`. SQLite stores Strapi datetimes either as ISO
 * text or as epoch milliseconds, so both are handled.
 */
function monthExpr(strapi: any): string {
  return isPostgres(strapi)
    ? "to_char(date_trunc('month', changed_at), 'YYYY-MM')"
    : "strftime('%Y-%m', CASE WHEN typeof(changed_at) IN ('integer', 'real') THEN datetime(changed_at / 1000, 'unixepoch') ELSE changed_at END)"
}

const iso = (v: unknown): string =>
  v instanceof Date
    ? v.toISOString()
    : typeof v === "number"
      ? new Date(v).toISOString()
      : String(v ?? "")

const monthKey = (v: unknown): string =>
  v instanceof Date ? v.toISOString().slice(0, 7) : String(v ?? "").slice(0, 7)

/** The first instant of the month `months - 1` months before now (UTC). */
function windowStart(months: number, now = new Date()): Date {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (months - 1), 1)
  )
}

/** `YYYY-MM` for each month of the window, oldest first. */
function windowMonths(months: number, now = new Date()): string[] {
  const out: string[] = []
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))
    out.push(d.toISOString().slice(0, 7))
  }

  return out
}

/** baUserId → username, for contributors whose activity is public. */
async function publicUsernames(
  strapi: any,
  actorIds: (string | null | undefined)[]
): Promise<Map<string, string>> {
  const ids = [
    ...new Set(
      actorIds.flatMap((a) =>
        typeof a === "string" && a.startsWith("ba:") && a.length > 3
          ? [a.slice(3)]
          : []
      )
    ),
  ]
  const out = new Map<string, string>()
  if (ids.length === 0) return out
  const profiles = (await strapi.documents(PROFILE).findMany({
    filters: { baUserId: { $in: ids } },
    fields: ["baUserId", "username", "profileVisibility", "publicPrefs"],
    limit: ids.length,
  })) as any[]
  for (const p of profiles ?? [])
    if (p.baUserId && p.username && isActivityPublic(p))
      out.set(p.baUserId, p.username)

  return out
}

function actorOf(
  row: { actorKind?: string | null; actorId?: string | null },
  names: Map<string, string>
): HistoryActor {
  const kind = row.actorKind ?? "system"
  if (kind !== "contributor") return { kind, username: null }
  const id = typeof row.actorId === "string" ? row.actorId : ""

  return {
    kind,
    username: id.startsWith("ba:") ? (names.get(id.slice(3)) ?? null) : null,
  }
}

export default ({ strapi }: { strapi: any }) => ({
  async libraryHistory(
    documentId: string,
    o: { page: number; pageSize: number; values: boolean }
  ): Promise<{ data: LibraryHistoryBatch[]; meta: HistoryMeta }> {
    const knex = strapi.db.connection
    const scoped = () =>
      knex(TABLE)
        .where("library_document_id", documentId)
        .where("version_status", "published")

    // One page of batch ids by their latest row, then those batches' rows.
    const [totalRow, page] = await Promise.all([
      scoped().countDistinct({ total: "batch_id" }).first(),
      scoped()
        .select("batch_id")
        .max({ last_changed_at: "changed_at" })
        .groupBy("batch_id")
        .orderBy([
          { column: "last_changed_at", order: "desc" },
          { column: "batch_id", order: "desc" },
        ])
        .limit(o.pageSize)
        .offset((o.page - 1) * o.pageSize),
    ])
    const meta = {
      page: o.page,
      pageSize: o.pageSize,
      total: Number((totalRow as any)?.total ?? 0),
    }
    const order = ((page ?? []) as { batch_id: string }[]).map(
      (r) => r.batch_id
    )
    if (order.length === 0) return { data: [], meta }

    const rows = (await strapi.documents(LIBRARY_CHANGE).findMany({
      filters: {
        libraryDocumentId: { $eq: documentId },
        versionStatus: { $eq: "published" },
        batchId: { $in: order },
      },
      sort: [{ changedAt: "desc" }, { id: "asc" }],
      limit: ROWS_PER_PAGE,
    })) as ChangeRow[]

    const byBatch = new Map<string, ChangeRow[]>()
    for (const r of rows ?? [])
      byBatch.set(r.batchId, [...(byBatch.get(r.batchId) ?? []), r])
    const names = await publicUsernames(
      strapi,
      (rows ?? [])
        .filter((r) => r.actorKind === "contributor")
        .map((r) => r.actorId)
    )

    const data = order.flatMap((batchId): LibraryHistoryBatch[] => {
      const group = byBatch.get(batchId)
      if (!group || group.length === 0) return []
      const head = group[0]!

      return [
        {
          batchId,
          changedAt: iso(head.changedAt),
          action: head.action ?? "update",
          source: head.source ?? "system",
          actor: actorOf(head, names),
          fields: group.map((r) =>
            o.values
              ? { field: r.field, previous: r.previous, next: r.next }
              : { field: r.field }
          ),
          submissionDocumentId: head.submissionDocumentId ?? null,
        },
      ]
    })

    return { data, meta }
  },

  async libraryHistoryStats(
    documentId: string,
    months: number
  ): Promise<{
    months: {
      month: string
      batches: number
      fields: number
      contributors: number
    }[]
    byField: { field: string; count: number }[]
    byAction: { action: string; count: number }[]
    verificationEvents: string[]
  }> {
    const knex = strapi.db.connection
    const now = new Date()
    const month = monthExpr(strapi)
    const scoped = () =>
      knex(TABLE)
        .where("library_document_id", documentId)
        .where("version_status", "published")
        .where("changed_at", ">=", windowStart(months, now).toISOString())

    const [perMonth, perField, perAction, verified] = (await Promise.all([
      scoped()
        .select(knex.raw(`${month} as month`))
        .countDistinct({ batches: "batch_id" })
        .count({ fields: "*" })
        .select(
          knex.raw(
            "count(distinct case when actor_kind = 'contributor' then actor_id end) as contributors"
          )
        )
        .groupBy(knex.raw(month)),
      scoped().select("field").count({ count: "*" }).groupBy("field"),
      scoped()
        .select("action")
        .countDistinct({ count: "batch_id" })
        .groupBy("action"),
      scoped()
        .select(knex.raw(`${month} as month`))
        .where("field", "lastVerifiedAt")
        .groupBy(knex.raw(month)),
    ])) as Record<string, any>[][]

    const byMonth = new Map<string, Record<string, any>>()
    for (const r of perMonth ?? []) byMonth.set(monthKey(r.month), r)
    const desc = <T extends { count: number }>(
      rows: T[],
      name: (r: T) => string
    ) =>
      rows.sort((a, b) => b.count - a.count || name(a).localeCompare(name(b)))

    return {
      months: windowMonths(months, now).map((m) => {
        const r = byMonth.get(m)

        return {
          month: m,
          batches: Number(r?.batches ?? 0),
          fields: Number(r?.fields ?? 0),
          contributors: Number(r?.contributors ?? 0),
        }
      }),
      byField: desc(
        (perField ?? [])
          .filter((r) => typeof r.field === "string")
          .map((r) => ({ field: r.field as string, count: Number(r.count) })),
        (r) => r.field
      ),
      byAction: desc(
        (perAction ?? [])
          .filter((r) => typeof r.action === "string")
          .map((r) => ({ action: r.action as string, count: Number(r.count) })),
        (r) => r.action
      ),
      verificationEvents: [
        ...new Set((verified ?? []).map((r) => monthKey(r.month))),
      ]
        .filter(Boolean)
        .sort(),
    }
  },

  async articleHistory(
    kind: "wiki" | "blog",
    documentId: string,
    o: { page: number; pageSize: number }
  ): Promise<{
    data: {
      changedAt: string
      kind: string
      locale: string
      actor: HistoryActor
      editSummary: string | null
    }[]
    meta: HistoryMeta
  }> {
    const filters = {
      articleKind: { $eq: kind },
      articleDocumentId: { $eq: documentId },
      versionStatus: { $eq: "published" },
    }
    const [total, rows] = await Promise.all([
      strapi.documents(ARTICLE_CHANGE).count({ filters }),
      strapi.documents(ARTICLE_CHANGE).findMany({
        filters,
        sort: [{ changedAt: "desc" }, { id: "desc" }],
        start: (o.page - 1) * o.pageSize,
        limit: o.pageSize,
      }),
    ])
    const list = (rows ?? []) as any[]
    const names = await publicUsernames(
      strapi,
      list.filter((r) => r.actorKind === "contributor").map((r) => r.actorId)
    )

    return {
      data: list.map((r) => ({
        changedAt: iso(r.changedAt),
        kind: r.kind,
        locale: r.contentLocale ?? "",
        actor: actorOf(r, names),
        editSummary: r.editSummary ?? null,
      })),
      meta: { page: o.page, pageSize: o.pageSize, total: Number(total ?? 0) },
    }
  },
})

const STORE = { type: "plugin", name: "content-moderation" } as const
const BACKFILL_KEY = "library-history-backfill-v1"
const BACKFILL_PAGE = 200

/**
 * One-off: approved library submissions from before Change Records existed
 * get one Change Batch each, so the public history isn't empty. Values were
 * never recorded, so `previous`/`next` are null. A submission that already
 * has Change Records (approved after they existed) is skipped. Guarded by a
 * core-store flag.
 */
export async function backfillLibraryHistory(
  strapi: any
): Promise<{ batches: number }> {
  const store = strapi.store(STORE)
  if (await store.get({ key: BACKFILL_KEY })) return { batches: 0 }

  let batches = 0
  for (let start = 0; ; start += BACKFILL_PAGE) {
    const subs = (await strapi.documents(SUBMISSION).findMany({
      filters: {
        status: { $eq: "approved" },
        targetEntityType: { $eq: "library" },
        targetDocumentId: { $notNull: true },
      },
      sort: "id:asc",
      start,
      limit: BACKFILL_PAGE,
    })) as Record<string, any>[]

    for (const s of subs) {
      if (typeof s.targetDocumentId !== "string" || !s.targetDocumentId)
        continue
      const fields =
        s.fields && typeof s.fields === "object" && !Array.isArray(s.fields)
          ? Object.keys(s.fields).filter((k) => !RECORD_META_KEYS.has(k))
          : []
      if (fields.length === 0) continue
      const recorded = await strapi.documents(LIBRARY_CHANGE).count({
        filters: { submissionDocumentId: { $eq: s.documentId } },
      })
      if (recorded > 0) continue

      const batchId = randomUUID()
      const changedAt = s.reviewedAt ?? s.updatedAt ?? new Date().toISOString()
      for (const field of fields)
        await strapi.documents(LIBRARY_CHANGE).create({
          data: {
            batchId,
            libraryDocumentId: s.targetDocumentId,
            contentLocale: s.contentLocale ?? null,
            versionStatus: "published",
            action: "update",
            field,
            previous: null,
            next: null,
            source: "submission",
            actorKind: "contributor",
            actorId: `ba:${s.submittedByUserId}`,
            submissionDocumentId: s.documentId,
            changedAt,
          },
        })
      batches += 1
    }
    if (subs.length < BACKFILL_PAGE) break
  }

  await store.set({
    key: BACKFILL_KEY,
    value: { at: new Date().toISOString(), batches },
  })
  strapi.log.info(
    `[content-moderation] Backfilled ${batches} library history batches`
  )

  return { batches }
}
