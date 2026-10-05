// apps/sync-worker/src/pipeline/upsert.ts
import { createId } from "@paralleldrive/cuid2"
import type { Knex } from "knex"

import db from "../db"
import type { NormalizedEvent } from "../types"

export interface UpsertStats {
  created: number
  updated: number
  unchanged: number
}

const CHUNK_SIZE = 500

/** `plugin::events.event` table (collectionName `ev_events`). */
export const EVENTS_TABLE = "ev_events"

/**
 * Strapi v5 join table for the `event.library` manyToOne relation:
 * `{collectionName}_{attribute}_lnk` with `{singular}_id` columns —
 * `ev_events_library_lnk (id, event_id, library_id)`, unique on
 * `(event_id, library_id)`. Read from the local Postgres; it matches
 * `strapi.db.metadata.get("plugin::events.event").attributes.library.joinTable`.
 */
export const EVENT_LIBRARY_LINK_TABLE = "ev_events_library_lnk"

/**
 * Columns refreshed when an event is seen again. Identity columns
 * (`id`, `document_id`), audit timestamps (`created_at`, `published_at`) and
 * `pending_review` (a moderator's decision) are deliberately left alone.
 */
const UPDATE_COLUMNS = [
  "credential_id",
  "sync_hash",
  "library_entity_ref",
  "title",
  "description",
  "summary",
  "url",
  "image_url",
  "start_time",
  "end_time",
  "all_day",
  "timezone",
  "event_type",
  "audience",
  "tags",
  "is_free",
  "price_min",
  "price_max",
  "capacity",
  "status",
  "last_seen_at",
  "updated_at",
] as const

/**
 * One `ev_events` row as Strapi's Document Service would store it: a cuid2
 * `document_id` (Strapi's own generator), `published_at` set (the type has no
 * draft/publish, so every row is "published"), `locale` null (not localised).
 * The library relation lives in the join table, written separately below;
 * `library_entity_ref` is the denormalised copy the public API filters on.
 */
function toRow(e: NormalizedEvent): Record<string, unknown> {
  return {
    document_id: createId(),
    external_id: e.externalId,
    source_provider: e.sourceProvider,
    credential_id: e.credentialId,
    sync_hash: e.syncHash,
    library_entity_ref: e.libraryEntityRef,
    title: e.title,
    description: e.description,
    summary: e.summary,
    url: e.url,
    image_url: e.imageUrl,
    start_time: e.startTime,
    end_time: e.endTime,
    all_day: e.allDay,
    timezone: e.timezone,
    event_type: e.eventType,
    audience: JSON.stringify(e.audience),
    tags: JSON.stringify(e.tags),
    is_free: e.isFree,
    price_min: e.priceMin,
    price_max: e.priceMax,
    capacity: e.capacity,
    status: e.status,
    pending_review: e.pendingReview,
    imported_at: e.importedAt,
    last_seen_at: e.lastSeenAt,
    created_at: e.importedAt,
    updated_at: e.lastSeenAt,
    published_at: e.importedAt,
    locale: null,
  }
}

const pairKey = (provider: unknown, externalId: unknown) =>
  `${String(provider)}|${String(externalId)}`

/** Postgres refuses to touch the same row twice in one INSERT ... ON CONFLICT; keep the last occurrence. */
function dedupe(events: NormalizedEvent[]): NormalizedEvent[] {
  const byKey = new Map<string, NormalizedEvent>()
  for (const e of events) byKey.set(pairKey(e.sourceProvider, e.externalId), e)

  return [...byKey.values()]
}

type Rows<T> = { rows: T[] }

async function upsertChunk(
  trx: Knex.Transaction | Knex,
  chunk: NormalizedEvent[],
  stats: UpsertStats
): Promise<void> {
  const rows = chunk.map(toRow)
  const columns = Object.keys(rows[0]!)

  // Step 1: existing hashes, to classify created / updated / unchanged
  const pairs = chunk.map((e) => [e.sourceProvider, e.externalId] as const)
  const existing = (
    (await trx.raw(
      `SELECT source_provider, external_id, sync_hash FROM ${EVENTS_TABLE} WHERE (source_provider, external_id) IN (${pairs
        .map(() => "(?, ?)")
        .join(", ")})`,
      pairs.flat() as Knex.RawBinding[]
    )) as Rows<{
      source_provider: string
      external_id: string
      sync_hash: string
    }>
  ).rows

  const existingHash = new Map(
    existing.map((r) => [
      pairKey(r.source_provider, r.external_id),
      r.sync_hash,
    ])
  )
  for (const e of chunk) {
    const oldHash = existingHash.get(pairKey(e.sourceProvider, e.externalId))
    if (oldHash === undefined) stats.created++
    else if (oldHash !== e.syncHash) stats.updated++
    else stats.unchanged++
  }

  // Step 2: upsert on the (source_provider, external_id) unique index.
  // A conflict keeps the row's id and document_id, so links and any URL
  // built on the documentId stay stable across syncs.
  const valuesSql = rows
    .map(() => `(${columns.map(() => "?").join(", ")})`)
    .join(", ")
  const setSql = UPDATE_COLUMNS.map((c) => `${c} = EXCLUDED.${c}`).join(
    ",\n         "
  )
  const inserted = (
    (await trx.raw(
      `INSERT INTO ${EVENTS_TABLE} (${columns.join(", ")})
       VALUES ${valuesSql}
       ON CONFLICT (source_provider, external_id) DO UPDATE SET
         ${setSql}
       RETURNING id, source_provider, external_id`,
      rows.flatMap((r) => Object.values(r)) as Knex.RawBinding[]
    )) as Rows<{ id: number; source_provider: string; external_id: string }>
  ).rows

  // Step 3: the library relation (join table). Drop any link that points at a
  // different library than this sync matched, then add the current one.
  const libraryByKey = new Map(
    chunk.map((e) => [pairKey(e.sourceProvider, e.externalId), e.libraryId])
  )
  const links = inserted
    .map(
      (r) =>
        [
          r.id,
          libraryByKey.get(pairKey(r.source_provider, r.external_id)),
        ] as const
    )
    .filter((l): l is readonly [number, number] => typeof l[1] === "number")
  if (links.length === 0) return

  const linkValues = links.map(() => "(?::int, ?::int)").join(", ")
  const linkBindings = links.flat() as Knex.RawBinding[]
  await trx.raw(
    `DELETE FROM ${EVENT_LIBRARY_LINK_TABLE} lnk
     USING (VALUES ${linkValues}) AS v(event_id, library_id)
     WHERE lnk.event_id = v.event_id AND lnk.library_id <> v.library_id`,
    linkBindings
  )
  await trx.raw(
    `INSERT INTO ${EVENT_LIBRARY_LINK_TABLE} (event_id, library_id)
     VALUES ${links.map(() => "(?, ?)").join(", ")}
     ON CONFLICT (event_id, library_id) DO NOTHING`,
    linkBindings
  )
}

export async function upsertEvents(
  events: NormalizedEvent[]
): Promise<UpsertStats> {
  const stats: UpsertStats = { created: 0, updated: 0, unchanged: 0 }
  const unique = dedupe(events)

  for (let i = 0; i < unique.length; i += CHUNK_SIZE) {
    const chunk = unique.slice(i, i + CHUNK_SIZE)
    await db.transaction((trx) => upsertChunk(trx, chunk, stats))
  }

  return stats
}
