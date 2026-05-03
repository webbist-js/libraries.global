// apps/sync-worker/src/pipeline/upsert.ts
import type { Knex } from "knex"

import db from "../db"
import type { NormalizedEvent } from "../providers/types"

export interface UpsertStats {
  created: number
  updated: number
  unchanged: number
}

const CHUNK_SIZE = 500

function toRow(e: NormalizedEvent): Record<string, unknown> {
  return {
    external_id: e.externalId,
    source_provider: e.sourceProvider,
    credential_id: e.credentialId,
    sync_hash: e.syncHash,
    library_id: e.libraryId,
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
    registration_url: e.registrationUrl,
    capacity: e.capacity,
    status: e.status,
    pending_review: e.pendingReview,
    imported_at: e.importedAt,
    last_seen_at: e.lastSeenAt,
    created_at: e.importedAt,
    updated_at: e.lastSeenAt,
    published_at: e.importedAt,
  }
}

export async function upsertEvents(
  events: NormalizedEvent[]
): Promise<UpsertStats> {
  const stats: UpsertStats = { created: 0, updated: 0, unchanged: 0 }

  for (let i = 0; i < events.length; i += CHUNK_SIZE) {
    const chunk = events.slice(i, i + CHUNK_SIZE)
    const rows = chunk.map(toRow)

    // Step 1: Fetch existing hashes to classify rows before upsert
    const pairs = rows.map(
      (r) => [r.source_provider, r.external_id] as [unknown, unknown]
    )
    const placeholders = pairs.map(() => "(?, ?)").join(", ")
    const bindings = pairs.flat() as Knex.RawBinding[]
    const existing = (
      await db.raw(
        `SELECT source_provider, external_id, sync_hash FROM ev_events WHERE (source_provider, external_id) IN (${placeholders})`,
        bindings
      )
    ).rows as {
      source_provider: string
      external_id: string
      sync_hash: string
    }[]

    const existingMap = new Map(
      existing.map((r) => [
        `${r.source_provider}|${r.external_id}`,
        r.sync_hash,
      ])
    )

    // Step 2: Classify each row
    for (const row of rows) {
      const key = `${row.source_provider as string}|${row.external_id as string}`
      const oldHash = existingMap.get(key)
      if (oldHash === undefined) {
        stats.created++
      } else if (oldHash !== row.sync_hash) {
        stats.updated++
      } else {
        stats.unchanged++
      }
    }

    // Step 3: Upsert — unconditionally update all fields on conflict
    await db.raw(
      `INSERT INTO ev_events (${Object.keys(rows[0]!).join(", ")})
       VALUES ${rows
         .map(
           () =>
             `(${Object.keys(rows[0]!)
               .map(() => "?")
               .join(", ")})`
         )
         .join(", ")}
       ON CONFLICT (source_provider, external_id) DO UPDATE SET
         sync_hash = EXCLUDED.sync_hash,
         title = EXCLUDED.title,
         description = EXCLUDED.description,
         summary = EXCLUDED.summary,
         start_time = EXCLUDED.start_time,
         end_time = EXCLUDED.end_time,
         status = EXCLUDED.status,
         image_url = EXCLUDED.image_url,
         last_seen_at = NOW(),
         updated_at = NOW()`,
      rows.flatMap((r) => Object.values(r)) as Knex.RawBinding[]
    )
  }

  return stats
}
