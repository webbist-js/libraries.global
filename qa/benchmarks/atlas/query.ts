import { performance } from "node:perf_hooks"

import {
  ATLAS_LIMITS,
  atlasKeysetFilter,
  atlasMatchesProjection,
  atlasResolveScope,
  emptyAtlasFilters,
  type AtlasBounds,
  type AtlasProjection,
  type AtlasScope,
} from "@repo/shared-data"

import {
  accessCoverage,
  aggregate,
  exactTotal,
  filter,
  search,
  type Dataset,
} from "./engine.js"
import { readReport, report, requireDisposable, statistics } from "./runtime.js"

requireDisposable()
const dataset = await readReport<Dataset>("dataset")
const sample = await readReport<AtlasProjection[]>("oracle-sample")
const now = new Date(dataset.evaluatedAt)
const world: AtlasBounds = { west: -180, east: 180, south: -90, north: 90 }
const scope = (
  bbox: AtlasBounds = world,
  patch: Partial<AtlasScope["filters"]> = {},
  access: Partial<AtlasScope["accessibility"]> = {}
): AtlasScope & { bbox: AtlasBounds } => ({
  bbox,
  filters: { ...emptyAtlasFilters(), ...patch },
  accessibility: { enabled: false, selected: [], view: "matches", ...access },
})
const cases = [
  ["world", scope()],
  ["dense-city", scope({ west: -0.5, east: 0.2, south: 51.2, north: 51.8 })],
  [
    "country",
    { ...scope(), place: { level: "country" as const, id: "england" } },
  ],
  ["common-facility", scope(world, { facilities: ["Access 0"] })],
  [
    "rare-combination",
    scope(world, {
      types: ["academic"],
      facilities: ["Facility 30", "Facility 70"],
    }),
  ],
  [
    "access-compare",
    scope(
      world,
      {},
      { enabled: true, selected: ["Access 0", "Access 1"], view: "compare" }
    ),
  ],
  [
    "access-gaps",
    scope(
      world,
      {},
      { enabled: true, selected: ["Access 0", "Access 1"], view: "gaps" }
    ),
  ],
  ["open-now", scope(world, { opening: "now" })],
  ["open-at", scope(world, { opening: "at", atDay: 3, atMinutes: 555 })],
  ["dateline", scope({ west: 170, east: -170, south: -90, north: 90 })],
  ["polar", scope({ west: -180, east: 180, south: 85, north: 90 })],
] as const
const checks: Record<string, unknown> = {}

async function keyset(
  s: AtlasScope,
  sort: "name" | "place",
  cap: number,
  checkOrder = true
): Promise<{ ids: number[]; seconds: number }> {
  const field = sort === "name" ? "name_sort" : "place_sort"
  const ids: number[] = []
  let continuation = "",
    previousKey = "",
    previousId = 0
  const started = performance.now()
  while (ids.length < cap) {
    const result = await search({
      filter: `${filter(s, dataset)}${continuation ? ` AND ${continuation}` : ""}`,
      sort: [`${field}:asc`, "atlas_id:asc"],
      limit: Math.min(500, cap - ids.length),
      attributesToRetrieve: ["atlas_id", field],
    })
    if (!result.hits.length) break
    for (const row of result.hits) {
      const key = row[field]
      if (
        checkOrder &&
        (key < previousKey ||
          (key === previousKey && row.atlas_id <= previousId))
      )
        throw new Error("Invalid keyset order/tie continuation")
      ids.push(row.atlas_id)
      previousKey = key
      previousId = row.atlas_id
    }
    continuation = atlasKeysetFilter(field, previousKey, previousId)
  }
  if (new Set(ids).size !== ids.length)
    throw new Error("Duplicate keyset record")

  return { ids, seconds: (performance.now() - started) / 1000 }
}

// Real-engine parity compares exact IDs with the independent shared predicate.
for (const [name, s] of cases) {
  const expected = sample
    .filter((r) =>
      atlasMatchesProjection(r, atlasResolveScope(s, dataset.dictionary), now)
    )
    .map((r) => r.atlas_id)
    .sort((a, b) => a - b)
  const received: number[] = []
  let last = 0
  while (true) {
    const result = await search({
      filter: `${filter(s, dataset)} AND atlas_id <= 2000 AND atlas_id > ${last}`,
      sort: ["atlas_id:asc"],
      limit: 500,
      attributesToRetrieve: ["atlas_id"],
    })
    if (!result.hits.length) break
    received.push(...result.hits.map((r) => r.atlas_id))
    last = result.hits.at(-1)!.atlas_id
  }
  if (JSON.stringify(expected) !== JSON.stringify(received))
    throw new Error(`Real Meili membership mismatch: ${name}`)
  checks[name] = {
    fixtureIds: expected.length,
    aggregate: await aggregate(s, dataset),
  }
}
const counted = exactTotal(
  await search({
    filter: filter(scope(), dataset),
    limit: 0,
    facets: ["locale"],
  })
)
if (counted !== dataset.listed || counted <= 1000)
  throw new Error(`Exact facet total mismatch: ${counted} vs ${dataset.listed}`)
checks.exactFacet = { expected: dataset.listed, actual: counted }
const allSample = sample.filter((r) => r.listed)
for (const sort of ["name", "place"] as const) {
  const s = scope()
  // Bound the fixture selection while continuing beyond Meili's 1000-hit window.
  const field = sort === "name" ? "name_sort" : "place_sort"
  let cursor = ""
  const actual: number[] = []
  while (true) {
    const result = await search({
      filter: `${filter(s, dataset)} AND atlas_id <= 2000${cursor ? ` AND ${cursor}` : ""}`,
      sort: [`${field}:asc`, "atlas_id:asc"],
      limit: 20,
      attributesToRetrieve: ["atlas_id", field],
    })
    if (!result.hits.length) break
    actual.push(...result.hits.map((r) => r.atlas_id))
    const last = result.hits.at(-1)!
    cursor = atlasKeysetFilter(field, last[field], last.atlas_id)
  }
  const expected = [...allSample]
    .sort((a, b) =>
      a[field] < b[field]
        ? -1
        : a[field] > b[field]
          ? 1
          : a.atlas_id - b.atlas_id
    )
    .map((r) => r.atlas_id)
  if (JSON.stringify(actual) !== JSON.stringify(expected))
    throw new Error(`${sort} continuation differs from canonical collation`)
  checks[`${sort}-continuation`] = { records: actual.length, complete: true }
}
checks.coverage = await accessCoverage(
  scope(
    world,
    {},
    { enabled: true, selected: ["Access 0", "Access 1"], view: "compare" }
  ),
  dataset
)
const distance = await search({
  filter: filter(scope(), dataset),
  sort: ["_geoPoint(51.5, -0.12):asc", "atlas_id:asc"],
  limit: ATLAS_LIMITS.points,
  attributesToRetrieve: ["atlas_id", "_geoDistance"],
})
checks.distance = {
  returned: distance.hits.length,
  reachableLimit: ATLAS_LIMITS.reachableDistanceRows,
}
const exportSelection = await keyset(scope(), "name", 50001)
checks.exportSelection = {
  records: exportSelection.ids.length,
  seconds: exportSelection.seconds,
  overflowGuard: exportSelection.ids.length === 50001,
}

const requests = Number(
  process.env.ATLAS_BENCH_REQUESTS ??
    (process.argv.includes("--full") ? 1000 : 100)
)
const concurrencyLevels = process.argv.includes("--full") ? [1, 10, 25] : [1]
if (!Number.isSafeInteger(requests) || requests < 1 || requests > 10000)
  throw new Error("ATLAS_BENCH_REQUESTS must be 1..10000")
const measurements: unknown[] = []
for (const concurrency of concurrencyLevels) {
  for (const [name, s] of cases) {
    let next = 0
    const latencies: number[] = [],
      server: number[] = []
    await Promise.all(
      Array.from({ length: concurrency }, async () => {
        while (next++ < requests) {
          const started = performance.now()
          const result = await aggregate(s, dataset)
          latencies.push(performance.now() - started)
          server.push(result.processingTimeMs)
        }
      })
    )
    const row = {
      workload: name,
      concurrency,
      requests: latencies.length,
      roundTripMs: statistics(latencies),
      meiliMs: statistics(server),
    }
    measurements.push(row)
    console.log(JSON.stringify(row))
  }
}
// World-control suggestions run six complete searches together; the most
// selective valid 100-option request is timed separately and never truncated.
const suggestionStart = performance.now()
await Promise.all(
  cases.slice(0, 6).map(async ([, s]) =>
    exactTotal(
      await search({
        filter: filter(s, dataset),
        limit: 0,
        facets: ["locale"],
      })
    )
  )
)
checks.sixQueriesMs = performance.now() - suggestionStart
const maxStart = performance.now()
const maxScope = scope(world, {
  facilities: dataset.dictionary.entries.map((e) => e.name).slice(0, 100),
})
checks.maximumSelectionTotal = exactTotal(
  await search({
    filter: filter(maxScope, dataset),
    limit: 0,
    facets: ["locale"],
  })
)
checks.maximumSelectionMs = performance.now() - maxStart
await report("query", {
  fullScale: dataset.fullScale,
  acceptanceWorkload:
    dataset.fullScale && requests >= 1000 && concurrencyLevels.length === 3,
  checks,
  measurements,
})
