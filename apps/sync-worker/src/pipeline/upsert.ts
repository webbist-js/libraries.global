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

  // Process in chunks to avoid lock pressure
  for (let i = 0; i < events.length; i += CHUNK_SIZE) {
    const chunk = events.slice(i, i + CHUNK_SIZE)
    const rows = chunk.map(toRow)

    const result = await db.raw(
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
         sync_hash = CASE WHEN ev_events.sync_hash != EXCLUDED.sync_hash THEN EXCLUDED.sync_hash ELSE ev_events.sync_hash END,
         title = CASE WHEN ev_events.sync_hash != EXCLUDED.sync_hash THEN EXCLUDED.title ELSE ev_events.title END,
         description = CASE WHEN ev_events.sync_hash != EXCLUDED.sync_hash THEN EXCLUDED.description ELSE ev_events.description END,
         summary = CASE WHEN ev_events.sync_hash != EXCLUDED.sync_hash THEN EXCLUDED.summary ELSE ev_events.summary END,
         start_time = CASE WHEN ev_events.sync_hash != EXCLUDED.sync_hash THEN EXCLUDED.start_time ELSE ev_events.start_time END,
         end_time = CASE WHEN ev_events.sync_hash != EXCLUDED.sync_hash THEN EXCLUDED.end_time ELSE ev_events.end_time END,
         status = CASE WHEN ev_events.sync_hash != EXCLUDED.sync_hash THEN EXCLUDED.status ELSE ev_events.status END,
         image_url = CASE WHEN ev_events.sync_hash != EXCLUDED.sync_hash THEN EXCLUDED.image_url ELSE ev_events.image_url END,
         last_seen_at = NOW(),
         updated_at = NOW()
       RETURNING (xmax = 0) as inserted, (ev_events.sync_hash != EXCLUDED.sync_hash) as changed`,
      rows.flatMap((r) => Object.values(r)) as Knex.RawBinding[]
    )

    for (const row of (result.rows as {
      inserted: boolean
      changed: boolean
    }[]) ?? []) {
      if (row.inserted) stats.created++
      else if (row.changed) stats.updated++
      else stats.unchanged++
    }
  }

  return stats
}
