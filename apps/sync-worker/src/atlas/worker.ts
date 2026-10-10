import { projectAtlasLibrary } from "@repo/shared-data"
import {
  atlasLocalAreaCode,
  atlasLocalBoundaryVersion,
} from "@repo/shared-data/atlas-local"

import type { AtlasSourceClient } from "./source-client"
import { type AtlasStore, AtlasLeaseLost, type AtlasJob } from "./store"

export class AtlasWorker {
  lastError: string | null = null
  constructor(
    readonly store: AtlasStore,
    readonly source: AtlasSourceClient,
    readonly canonicalLocale: string,
    readonly log: (message: string) => void = console.log
  ) {}

  async tick(token: string): Promise<number> {
    this.lastError = null
    await this.store.clocks(token)
    const jobs = await this.store.claim(token)
    if (!jobs.length) return 0
    const documents = jobs.filter((job) => job.kind === "document"),
      fanouts = jobs.filter((job) => job.kind === "fanout")
    for (const job of fanouts) {
      try {
        await this.store.fanout(token, job)
      } catch (error) {
        if (error instanceof AtlasLeaseLost) throw error
        await this.failed(token, [job], error)
      }
    }
    if (documents.length) {
      try {
        const ids = [...new Set(documents.map((job) => job.entity_id))]
        const sources = await this.source.batch(ids),
          atlasIds = await this.store.allocate(token, ids),
          now = new Date()
        const projections = new Map(
          ids.map((id) => [
            id,
            sources.get(id)
              ? projectAtlasLibrary(sources.get(id)!, {
                  atlasId: atlasIds.get(id)!,
                  canonicalLocale: this.canonicalLocale,
                  now,
                })
              : null,
          ])
        )
        for (const projection of projections.values())
          if (projection) {
            projection.local_area_code = atlasLocalAreaCode({
              lat: projection.original_lat,
              lng: projection.original_lng,
            })
            projection.local_area_version = atlasLocalBoundaryVersion
          }
        await this.store.apply(token, documents, projections, sources)
      } catch (error) {
        if (error instanceof AtlasLeaseLost) throw error
        await this.failed(token, documents, error)
      }
    }

    return jobs.length
  }

  private async failed(token: string, jobs: AtlasJob[], error: unknown) {
    await this.store.fail(token, jobs, error)
    const message = error instanceof Error ? error.message : "operation failed"
    this.lastError = message
    this.log(
      `[atlas] ${jobs.some((job) => job.attempts >= 4) ? "ALERT repeated failure" : "retry"}: ${jobs.length} jobs; ${message}`
    )
  }
}
