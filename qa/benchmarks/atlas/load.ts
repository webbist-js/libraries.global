import { performance } from "node:perf_hooks"

import { ATLAS_LIMITS, type AtlasProjection } from "@repo/shared-data"

import {
  enqueue,
  indexNames,
  lines,
  readReport,
  report,
  request,
  requireDisk,
  requireDisposable,
} from "./runtime.js"
import { atlasSettings } from "./settings.js"

requireDisposable()
const reset = process.argv.includes("--reset")
const dataset = await readReport<{ mapped: number; fullScale: boolean }>(
  "dataset"
)
const version = await request<{ pkgVersion: string }>("/version")
if (version.pkgVersion !== "1.42.1")
  throw new Error(
    `Pinned benchmark requires Meili 1.42.1, got ${version.pkgVersion}`
  )
const started = performance.now()
for (const [kind, filename, primaryKey] of [
  ["atlas", "projection.ndjson", "atlas_id"],
  ["general", "general.ndjson", "id"],
] as const) {
  const index = indexNames[kind]
  const existing = await request<{ results: { uid: string }[] }>(
    "/indexes?limit=100"
  )
  if (existing.results.some((i) => i.uid === index)) {
    if (!reset)
      throw new Error(
        `Disposable index ${index} already exists. Explicit --reset is required.`
      )
    const deletion = await request<{ taskUid: number }>(
      `/indexes/${index}`,
      undefined,
      "DELETE"
    )
    const { task } = await import("./runtime.js")
    await task(deletion.taskUid)
  }
  await enqueue("/indexes", { uid: index, primaryKey })
  await enqueue(
    `/indexes/${index}/settings`,
    kind === "atlas"
      ? atlasSettings
      : {
          searchableAttributes: [
            "name",
            "description",
            "city",
            "country_name",
            "region_name",
          ],
          filterableAttributes: [
            "locale",
            "libraryType",
            "operationalStatus",
            "accessibility",
            "services",
            "amenities",
            "has_events",
            "has_catalogue",
            "_geo",
            "founded",
          ],
          sortableAttributes: ["name", "founded", "_geo"],
          pagination: { maxTotalHits: 1000 },
          faceting: { maxValuesPerFacet: 512 },
        },
    "PATCH"
  )
  let batch: unknown[] = [],
    loaded = 0,
    batches = 0
  const start = performance.now()
  for await (const row of lines<AtlasProjection>(filename)) {
    batch.push(row)
    if (batch.length < ATLAS_LIMITS.indexBatch) continue
    await enqueue(`/indexes/${index}/documents`, batch)
    loaded += batch.length
    batch = []
    batches++
    if (batches % 20 === 0) {
      await requireDisk()
      console.log(
        JSON.stringify({
          stage: "load",
          index,
          loaded,
          seconds: (performance.now() - start) / 1000,
        })
      )
    }
  }
  if (batch.length) {
    await enqueue(`/indexes/${index}/documents`, batch)
    loaded += batch.length
  }
  await report(`load-${kind}`, {
    index,
    loaded,
    seconds: (performance.now() - start) / 1000,
    statistics: await request(`/indexes/${index}/stats`),
  })
}
await report("load", {
  seconds: (performance.now() - started) / 1000,
  fullScale: dataset.fullScale,
  meilisearch: version,
  statistics: await request("/stats"),
})
