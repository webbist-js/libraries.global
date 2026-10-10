import type { AtlasSourceClient } from "./source-client"
import type { AtlasStore } from "./store"

/** Capture is enabled first. The upper row ID and checkpoint survive restart. */
export async function enqueueAtlasBackfillPage(
  store: AtlasStore,
  source: AtlasSourceClient,
  token: string
): Promise<boolean> {
  const state = await store.db("atlas_state").where({ key: "current" }).first()
  if (state.backfill?.completedAt) return false
  const page = await source.scan(
    state.backfill?.after ?? 0,
    state.backfill?.upper
  )
  await store.db.transaction(async (trx) => {
    await store.fenced(trx, token)
    if (page.rows.length)
      await trx("atlas_outbox").insert(
        page.rows.map((row) => ({
          kind: "document",
          entity_id: row.source.documentId,
        }))
      )
    await trx("atlas_state")
      .where({ key: "current" })
      .update({
        backfill: JSON.stringify({
          upper: page.upper,
          after:
            page.next ?? page.rows.at(-1)?.id ?? state.backfill?.after ?? 0,
          completedAt: page.next === null ? new Date().toISOString() : null,
        }),
      })
  })

  return page.next !== null
}
