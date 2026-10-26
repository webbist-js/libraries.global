import {
  ATLAS_LIMITS,
  ATLAS_DENSITY_MAX_ZOOM,
  atlasDensityIndexProjection,
  ATLAS_OPEN_DAYS,
  ATLAS_OPEN_FRAMES_PER_DAY,
  atlasOpenField,
} from "@repo/shared-data"

import { type AtlasStore, AtlasLeaseLost } from "./store"

export const atlasIndexSettings = {
  searchableAttributes: ["name", "city", "region_name", "country_name"],
  displayedAttributes: ["*"],
  filterableAttributes: [
    "atlas_id",
    "documentId",
    "locale",
    "listed",
    "access_listed",
    "local_area_code",
    "local_area_version",
    "type_group",
    "status",
    "operator_group",
    "network_ids",
    "facility_codes",
    "access_codes",
    "has_access",
    "has_events",
    "has_catalogue",
    "founded",
    "late_sunday",
    "open_tz",
    "closed_dates",
    "clock_valid_until",
    "latitude",
    "longitude",
    "_geo",
    "continent_id",
    "country_id",
    "region_id",
    "area_id",
    "city_key",
    "name_sort",
    "place_sort",
    "completeness",
    ...Array.from(
      { length: ATLAS_DENSITY_MAX_ZOOM + 1 },
      (_, z) => `atlas_cell_${z}`
    ),
    ...["open", "regular_open", "staff_open"].flatMap((prefix) =>
      ATLAS_OPEN_DAYS.flatMap((day) =>
        Array.from({ length: ATLAS_OPEN_FRAMES_PER_DAY }, (_, n) => [
          atlasOpenField(
            day,
            n,
            "from",
            prefix as "open" | "regular_open" | "staff_open"
          ),
          atlasOpenField(
            day,
            n,
            "to",
            prefix as "open" | "regular_open" | "staff_open"
          ),
        ]).flat()
      )
    ),
  ],
  sortableAttributes: [
    "completeness",
    "founded",
    "atlas_id",
    "name_sort",
    "place_sort",
    "_geo",
    "latitude",
    "longitude",
  ],
  pagination: { maxTotalHits: ATLAS_LIMITS.points },
  faceting: { maxValuesPerFacet: ATLAS_LIMITS.facetValues },
}
export class AtlasMeiliIndex {
  readonly index = "atlas-library"
  private readonly base: URL
  constructor(
    readonly store: AtlasStore,
    url: string,
    private readonly key: string
  ) {
    this.base = new URL(url)
    if (!key) throw new Error("Atlas indexing requires a private Meili key")
    if (
      this.base.protocol !== "https:" &&
      !(
        this.base.protocol === "http:" &&
        ["localhost", "127.0.0.1", "meilisearch"].includes(this.base.hostname)
      )
    )
      throw new Error("Atlas indexing requires HTTPS or local Meili")
  }

  async request(path: string, method = "GET", body?: unknown): Promise<any> {
    const response = await fetch(new URL(path, this.base), {
      method,
      headers: {
        authorization: `Bearer ${this.key}`,
        "content-type": "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
      redirect: "error",
    })
    if (!response.ok) {
      const error = new Error(`Atlas index HTTP ${response.status}`)
      Object.assign(error, { status: response.status })
      throw error
    }

    return response.json()
  }

  async wait(taskUid: number): Promise<void> {
    const deadline = Date.now() + 30000
    while (Date.now() < deadline) {
      const task = await this.request(`/tasks/${taskUid}`)
      if (task.status === "succeeded") return
      if (["failed", "canceled"].includes(task.status))
        throw new Error(`Atlas index task ${taskUid} ${task.status}`)
      await new Promise((resolve) => setTimeout(resolve, 200))
    }
    throw new Error(`Atlas index task ${taskUid} pending; will resume`)
  }

  async ensure(token: string, indexUid: string = this.index): Promise<void> {
    if (!/^atlas-library(?:-staging-[a-f0-9-]{36})?$/.test(indexUid))
      throw new Error("Invalid Atlas index name")
    await this.store.db.transaction((trx) => this.store.fenced(trx, token))
    try {
      const index = await this.request(`/indexes/${indexUid}`)
      if (index.primaryKey !== "documentId")
        throw new Error(
          "Atlas index has the wrong primary key; use a staging rebuild"
        )
    } catch (error) {
      if ((error as { status?: number }).status !== 404) throw error
      const task = await this.request("/indexes", "POST", {
        uid: indexUid,
        primaryKey: "documentId",
      })
      await this.wait(task.taskUid)
    }
    const task = await this.request(
      `/indexes/${indexUid}/settings`,
      "PATCH",
      atlasIndexSettings
    )
    await this.wait(task.taskUid)
  }

  /** Ordered, durable, idempotent submission. Never reset the general index. */
  async flush(token: string, draining = false): Promise<boolean> {
    const batch = await this.store.db.transaction(async (trx) => {
      const state = await this.store.fenced(trx, token)
      if (state.rebuild?.writerPaused && !draining) return null
      const row = await trx("atlas_index_batches")
        .whereNull("completed_at")
        .orderBy("id")
        .first()
      if (!row || new Date(row.not_before).getTime() > Date.now()) return null
      if (BigInt(row.from_revision) !== BigInt(state.indexed_through) + 1n)
        throw new Error("Non-contiguous Atlas index batch")

      return row
    })
    if (!batch) return false
    try {
      const taskIds: Record<string, number> = batch.task_ids
      for (const [operation, payload] of [
        ["upserts", batch.payload.upserts],
        ["removedIds", batch.payload.removedIds],
      ] as const) {
        if (!Array.isArray(payload) || payload.length > ATLAS_LIMITS.indexBatch)
          throw new Error("Invalid durable index batch")
        if (!payload.length) continue
        if (taskIds[operation] === undefined) {
          await this.store.db.transaction((trx) =>
            this.store.fenced(trx, token)
          )
          const task = await this.request(
            `/indexes/${this.index}/documents${operation === "removedIds" ? "/delete-batch" : ""}`,
            "POST",
            operation === "upserts"
              ? payload.map(atlasDensityIndexProjection)
              : payload
          )
          taskIds[operation] = task.taskUid
          await this.store.db.transaction(async (trx) => {
            await this.store.fenced(trx, token)
            await trx("atlas_index_batches")
              .where({ id: batch.id })
              .update({
                task_ids: JSON.stringify(taskIds),
                status: "submitted",
              })
          })
        }
        await this.wait(taskIds[operation]!)
      }
      await this.store.db.transaction(async (trx) => {
        const state = await this.store.fenced(trx, token)
        if (BigInt(batch.from_revision) !== BigInt(state.indexed_through) + 1n)
          throw new AtlasLeaseLost()
        await trx("atlas_index_batches").where({ id: batch.id }).update({
          status: "succeeded",
          completed_at: trx.fn.now(),
          last_error: null,
        })
        await trx("atlas_state")
          .where({ key: "current" })
          .update({ indexed_through: batch.through_revision })
      })

      return true
    } catch (error) {
      if (error instanceof AtlasLeaseLost) throw error
      await this.store.db.transaction(async (trx) => {
        await this.store.fenced(trx, token)
        const failedTask =
          error instanceof Error && / (failed|canceled)$/.test(error.message)
        await trx("atlas_index_batches")
          .where({ id: batch.id })
          .update({
            attempts: batch.attempts + 1,
            not_before: trx.raw(
              "CURRENT_TIMESTAMP + (? * INTERVAL '1 second')",
              [Math.min(60, 2 ** Math.min(batch.attempts, 6))]
            ),
            last_error:
              error instanceof Error
                ? error.message.slice(0, 2000)
                : "Atlas indexing failed",
            ...(failedTask ? { task_ids: "{}", status: "pending" } : {}),
          })
      })
      throw error
    }
  }
}
