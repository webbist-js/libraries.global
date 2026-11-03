import { randomBytes } from "node:crypto"

import type { Core } from "@strapi/strapi"

/**
 * Review Locks (ADR-0008): a Moderator's two-minute lease on an item under
 * review, renewed while the review page is visible. Taking one is a single
 * upsert that only replaces an expired lock or the caller's own, so two
 * Moderators can't both win. Reads are advisory; Strapi enforces them on
 * moderation writes, and the decision's compare-and-set stays the last guard.
 */

export const REVIEW_LOCK_UID = "plugin::content-moderation.review-lock"
export const LOCK_TTL_MS = 2 * 60 * 1000
export const SUBMISSION_LOCK = "submission"

export type LockHolder = { id: string; name: string | null }
export type ReviewLock = {
  holderId: string
  holderName: string | null
  expiresAt: string
}
/** The caller's view of a lock: theirs, someone else's, or nobody's. */
export type LockState =
  | { state: "mine"; expiresAt: string; holderName: string | null }
  | { state: "held"; expiresAt: string; holderName: string | null }
  | { state: "free" }

const MAX_IDS = 100

/** A lock table row, keyed by column name. */
type LockRow = Record<string, unknown>
/** The knex builder the conditional-merge callback is bound to. */
type WhereBuilder = {
  where: (
    column: string,
    operator: string,
    value: unknown
  ) => { orWhere: (column: string, value: unknown) => unknown }
}

function tables(strapi: Core.Strapi) {
  const meta = strapi.db.metadata.get(REVIEW_LOCK_UID)
  const col = (attribute: string) =>
    (meta.attributes[attribute] as { columnName?: string } | undefined)
      ?.columnName ??
    attribute.replaceAll(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)

  return {
    table: meta.tableName,
    documentId: col("documentId"),
    kind: col("subjectKind"),
    id: col("subjectId"),
    holder: col("holderId"),
    name: col("holderName"),
    expires: col("expiresAt"),
    previous: col("previousHolderId"),
    takenOver: col("takenOverAt"),
    created: col("createdAt"),
    updated: col("updatedAt"),
    published: col("publishedAt"),
  }
}

const iso = (value: unknown) => new Date(value as string).toISOString()

function rowToLock(t: ReturnType<typeof tables>, row: LockRow): ReviewLock {
  return {
    holderId: row[t.holder] as string,
    holderName: (row[t.name] as string | null | undefined) ?? null,
    expiresAt: iso(row[t.expires]),
  }
}

/** How a lock reads to a given caller at a given time. */
export function lockStateFor(
  lock: ReviewLock | null,
  callerId: string,
  now = Date.now()
): LockState {
  if (!lock || Date.parse(lock.expiresAt) <= now) return { state: "free" }

  return {
    state: lock.holderId === callerId ? "mine" : "held",
    expiresAt: lock.expiresAt,
    holderName: lock.holderName,
  }
}

const cleanName = (name: string | null) =>
  name?.replaceAll(/\s+/g, " ").trim().slice(0, 120) || null

/** The live lock on one item, or null. */
export async function readLock(
  strapi: Core.Strapi,
  kind: string,
  id: string,
  now = Date.now()
): Promise<ReviewLock | null> {
  const t = tables(strapi)
  const row = await strapi.db
    .connection(t.table)
    .select(t.holder, t.name, t.expires)
    .where({ [t.kind]: kind, [t.id]: id })
    .where(t.expires, ">", new Date(now))
    .first()

  return row ? rowToLock(t, row) : null
}

/**
 * Takes or renews the lock for `holder`, unless someone else holds a live
 * one. Returns the caller's view of the lock afterwards.
 */
export async function acquireLock(
  strapi: Core.Strapi,
  kind: string,
  id: string,
  holder: LockHolder,
  now = Date.now()
): Promise<LockState> {
  const t = tables(strapi)
  const knex = strapi.db.connection
  const at = new Date(now)
  const expires = new Date(now + LOCK_TTL_MS)
  const name = cleanName(holder.name)
  const rows = await knex(t.table)
    .insert({
      [t.documentId]: randomBytes(12).toString("hex"),
      [t.kind]: kind,
      [t.id]: id,
      [t.holder]: holder.id,
      [t.name]: name,
      [t.expires]: expires,
      [t.created]: at,
      [t.updated]: at,
      [t.published]: at,
    })
    .onConflict([t.kind, t.id])
    .merge({
      [t.holder]: holder.id,
      [t.name]: name,
      [t.expires]: expires,
      [t.updated]: at,
    })
    .where(function (this: WhereBuilder) {
      this.where(`${t.table}.${t.expires}`, "<=", at).orWhere(
        `${t.table}.${t.holder}`,
        holder.id
      )
    })
    .returning([t.holder, t.name, t.expires])
  if (rows?.length) return lockStateFor(rowToLock(t, rows[0]), holder.id, now)

  return lockStateFor(await readLock(strapi, kind, id, now), holder.id, now)
}

/**
 * Takes the lock from whoever holds it, keeping who that was. Any Moderator
 * with the item in scope may do this after confirming (checked by the caller).
 */
export async function takeOverLock(
  strapi: Core.Strapi,
  kind: string,
  id: string,
  holder: LockHolder,
  now = Date.now()
): Promise<{ lock: LockState; previousHolderId: string | null }> {
  const t = tables(strapi)
  const current = await readLock(strapi, kind, id, now)
  if (!current || current.holderId === holder.id)
    return {
      lock: await acquireLock(strapi, kind, id, holder, now),
      previousHolderId: null,
    }
  const at = new Date(now)
  const expires = new Date(now + LOCK_TTL_MS)
  const count = await strapi.db
    .connection(t.table)
    .where({ [t.kind]: kind, [t.id]: id, [t.holder]: current.holderId })
    .update({
      [t.holder]: holder.id,
      [t.name]: cleanName(holder.name),
      [t.expires]: expires,
      [t.previous]: current.holderId,
      [t.takenOver]: at,
      [t.updated]: at,
    })
  // Someone renewed or released in between: report what is there now.
  if (!count)
    return {
      lock: await acquireLock(strapi, kind, id, holder, now),
      previousHolderId: null,
    }

  return {
    lock: {
      state: "mine",
      expiresAt: expires.toISOString(),
      holderName: cleanName(holder.name),
    },
    previousHolderId: current.holderId,
  }
}

/** Releases the caller's own lock; anyone else's is left alone. */
export async function releaseLock(
  strapi: Core.Strapi,
  kind: string,
  id: string,
  holderId: string
): Promise<void> {
  const t = tables(strapi)
  await strapi.db
    .connection(t.table)
    .where({ [t.kind]: kind, [t.id]: id, [t.holder]: holderId })
    .delete()
}

/** Live locks for a page of items: one bounded query. */
export async function liveLocks(
  strapi: Core.Strapi,
  kind: string,
  ids: string[],
  now = Date.now()
): Promise<Map<string, ReviewLock>> {
  const wanted = [...new Set(ids)].slice(0, MAX_IDS)
  if (wanted.length === 0) return new Map()
  const t = tables(strapi)
  const rows = await strapi.db
    .connection(t.table)
    .select(t.id, t.holder, t.name, t.expires)
    .where(t.kind, kind)
    .whereIn(t.id, wanted)
    .where(t.expires, ">", new Date(now))

  return new Map(
    (rows as LockRow[]).map((row) => [row[t.id] as string, rowToLock(t, row)])
  )
}
