import { DEFAULT_LOCALE, isSupportedLocale } from "@repo/shared-data"
import type { Core } from "@strapi/strapi"

/**
 * Community Roadmap: product features and dataset imports, edited as one
 * single type. Votes and discussions attach to an item's `key`, which stays
 * the same in every language. Dataset suggestions from the community are
 * their own documents; a published suggestion is votable as
 * `suggestion-<documentId>`.
 */

export const ROADMAP = "api::roadmap.roadmap"
export const ROADMAP_VOTE = "api::roadmap-vote.roadmap-vote"
export const ROADMAP_SUGGESTION = "api::roadmap-suggestion.roadmap-suggestion"
/** A virtual uid: discussion targets for roadmap items and suggestions. */
export const ROADMAP_ITEM_TARGET = "api::roadmap.roadmap-item"
const THREAD = "plugin::discussions.thread"
const REPLY = "plugin::discussions.reply"

export const ITEM_KEY = /^(?=.{1,60}$)[a-z0-9]+(?:-[a-z0-9]+)*$/
export const MAX_KEYS = 120
export const SUGGESTION_PREFIX = "suggestion-"

export type RoadmapItemRef = { key: string; title: string }

const localeOf = (locale: unknown) =>
  typeof locale === "string" && isSupportedLocale(locale)
    ? locale
    : DEFAULT_LOCALE

/** The published roadmap's item keys and titles, in one locale. */
export async function roadmapItems(
  strapi: Core.Strapi,
  locale?: string
): Promise<RoadmapItemRef[]> {
  const roadmap = await strapi.documents(ROADMAP).findFirst({
    status: "published",
    locale: localeOf(locale),
    fields: ["id"],
    populate: {
      features: { fields: ["key", "title"] },
      dataImports: { fields: ["key", "place", "source"] },
    },
  })
  if (!roadmap) return []

  return [
    // `key` is required by the schema, so every saved item has one.
    ...(roadmap.features ?? []).map((f) => ({
      key: f.key as string,
      title: f.title as string,
    })),
    ...(roadmap.dataImports ?? []).map((d) => ({
      key: d.key as string,
      title: `${d.place}: ${d.source}`,
    })),
  ]
}

/** A votable key: a published roadmap item or a published suggestion. */
export async function resolveRoadmapKey(
  strapi: Core.Strapi,
  key: string,
  locale?: string
): Promise<RoadmapItemRef | null> {
  if (!ITEM_KEY.test(key)) return null
  if (key.startsWith(SUGGESTION_PREFIX)) {
    const suggestion = await strapi.documents(ROADMAP_SUGGESTION).findOne({
      documentId: key.slice(SUGGESTION_PREFIX.length),
      status: "published",
      fields: ["place", "source"],
    })

    return suggestion
      ? { key, title: `${suggestion.place}: ${suggestion.source}` }
      : null
  }
  let item = (await roadmapItems(strapi, locale)).find((i) => i.key === key)
  if (!item && localeOf(locale) !== DEFAULT_LOCALE)
    item = (await roadmapItems(strapi, DEFAULT_LOCALE)).find(
      (i) => i.key === key
    )

  return item ?? null
}

export const roadmapItemAnchor = (key: string) =>
  `/community/roadmap#roadmap-${encodeURIComponent(key)}`

const tableOf = (strapi: Core.Strapi, uid: string) =>
  strapi.db.metadata.get(uid).tableName as string
const columnOf = (strapi: Core.Strapi, uid: string, attribute: string) =>
  (
    strapi.db.metadata.get(uid).attributes[attribute] as
      | { columnName?: string }
      | undefined
  )?.columnName ?? attribute

export type RoadmapEngagement = {
  votes: number
  posts: number
  activityAt: string | null
  /** The item's visible thread, for linking to its discussion page. */
  threadId: string | null
}

/**
 * Votes and visible discussion activity for up to {@link MAX_KEYS} keys:
 * one GROUP BY for votes, one thread read and one GROUP BY for replies.
 */
export async function roadmapEngagement(
  strapi: Core.Strapi,
  keys: string[]
): Promise<Record<string, RoadmapEngagement>> {
  const wanted = [...new Set(keys.filter((k) => ITEM_KEY.test(k)))].slice(
    0,
    MAX_KEYS
  )
  const out: Record<string, RoadmapEngagement> = Object.fromEntries(
    wanted.map((k) => [
      k,
      { votes: 0, posts: 0, activityAt: null, threadId: null },
    ])
  )
  if (wanted.length === 0) return out

  const knex = strapi.db.connection
  const itemColumn = columnOf(strapi, ROADMAP_VOTE, "itemKey")
  const voteRows = (await knex(tableOf(strapi, ROADMAP_VOTE))
    .select(itemColumn)
    .count("* as votes")
    .whereIn(itemColumn, wanted)
    .groupBy(itemColumn)) as Record<string, unknown>[]
  for (const row of voteRows)
    out[row[itemColumn] as string]!.votes = Number(row.votes)

  const targetKeys = wanted.map((k) => `${ROADMAP_ITEM_TARGET}:${k}`)
  const threads = (await strapi.db.query(THREAD).findMany({
    where: { targetKey: { $in: targetKeys }, state: "visible" },
    select: ["documentId", "targetKey", "activityAt", "createdAt"],
  })) as {
    documentId: string
    targetKey: string
    activityAt: string | null
    createdAt: string
  }[]
  if (threads.length === 0) return out

  const threadColumn = columnOf(strapi, REPLY, "threadId")
  const stateColumn = columnOf(strapi, REPLY, "state")
  const replyRows = (await knex(tableOf(strapi, REPLY))
    .select(threadColumn)
    .count("* as replies")
    .whereIn(
      threadColumn,
      threads.map((t) => t.documentId)
    )
    .andWhere(stateColumn, "visible")
    .groupBy(threadColumn)) as Record<string, unknown>[]
  const replies = new Map(
    replyRows.map((r) => [r[threadColumn] as string, Number(r.replies)])
  )
  for (const thread of threads) {
    const key = thread.targetKey.slice(ROADMAP_ITEM_TARGET.length + 1)
    if (!out[key]) continue
    out[key].threadId = thread.documentId
    out[key].posts = 1 + (replies.get(thread.documentId) ?? 0)
    out[key].activityAt = new Date(
      thread.activityAt ?? thread.createdAt
    ).toISOString()
  }

  return out
}

/** The keys among `keys` this account has voted for. */
export async function roadmapVotesOf(
  strapi: Core.Strapi,
  baUserId: string,
  keys: string[]
): Promise<string[]> {
  const wanted = [...new Set(keys.filter((k) => ITEM_KEY.test(k)))].slice(
    0,
    MAX_KEYS
  )
  if (wanted.length === 0) return []
  const rows = (await strapi.db.query(ROADMAP_VOTE).findMany({
    where: { baUserId, itemKey: { $in: wanted } },
    select: ["itemKey"],
  })) as { itemKey: string }[]

  return rows.map((r) => r.itemKey)
}

const isUniqueViolation = (error: unknown) => {
  const e = error as { code?: string; message?: string } | null

  return (
    e?.code === "23505" ||
    e?.code === "SQLITE_CONSTRAINT" ||
    /unique/i.test(e?.message ?? "")
  )
}

/** Sets this account's vote on a key; returns the key's vote total. */
export async function setRoadmapVote(
  strapi: Core.Strapi,
  baUserId: string,
  itemKey: string,
  voted: boolean
): Promise<{ voted: boolean; votes: number }> {
  const query = strapi.db.query(ROADMAP_VOTE)
  if (voted) {
    const existing = await query.findOne({
      where: { baUserId, itemKey },
      select: ["id"],
    })
    if (!existing)
      try {
        await query.create({ data: { baUserId, itemKey } })
      } catch (error) {
        // A concurrent request created it first; the vote stands.
        if (!isUniqueViolation(error)) throw error
      }
  } else await query.deleteMany({ where: { baUserId, itemKey } })

  return { voted, votes: Number(await query.count({ where: { itemKey } })) }
}
