import {
  ATLAS_LIMITS,
  atlasCell,
  atlasCellId,
  atlasLocalGeography,
  atlasPoint,
  emptyAtlasFilters,
  parseAtlasQueryRequest,
  projectAtlasLibrary,
  type AtlasLibrarySource,
  type AtlasScope,
} from "@repo/shared-data"
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest"

import { atlasIndexSettings } from "../../../../sync-worker/src/atlas/meili-index"
import type { AtlasBackend, AtlasBackendState } from "../atlas-backend"
import { atlasExactTotal, AtlasQueryEngine } from "../atlas-query"

import fixture from "../../../../../qa/fixtures/atlas/corpus.json"

const now = new Date(fixture.evaluatedAt)
const records = fixture.records.flatMap((row, n) => {
  const projection = projectAtlasLibrary(
    { ...fixture.defaults, ...row } as AtlasLibrarySource,
    { atlasId: n + 1, canonicalLocale: "en", now }
  )

  return projection ? [projection] : []
})
const state: AtlasBackendState = {
  schemaVersion: 1,
  queryEpoch: "query-fixture",
  dictionary: fixture.dictionary as any,
  canonicalLocale: "en",
  projectionRevision: "1",
  indexedThrough: "1",
  journalFloor: "0",
  clockDue: null,
  heartbeatAt: now.toISOString(),
  manifest: null,
}
const scope = (filters: Partial<AtlasScope["filters"]> = {}): AtlasScope => ({
  filters: { ...emptyAtlasFilters(), ...filters },
  accessibility: { enabled: false, selected: [], view: "matches" },
  bbox: { west: -180, east: 180, south: -90, north: 90 },
})
describe("Atlas completeness guards", () => {
  it("uses exact facets beyond the hit window and rejects missing counts", () => {
    expect(
      atlasExactTotal(
        {
          hits: [],
          estimatedTotalHits: 1000,
          facetDistribution: { locale: { en: 123456 } },
        },
        "en"
      )
    ).toBe(123456)
    expect(() =>
      atlasExactTotal({ hits: [], estimatedTotalHits: 1000 }, "en")
    ).toThrow("exact locale facet")
  })
})

describe.skipIf(!process.env.ATLAS_TEST_MEILI_URL)(
  "Atlas gateway with the real small Meili fixture",
  () => {
    let backend: AtlasBackend, engine: AtlasQueryEngine
    const request = async (
      path: string,
      method = "GET",
      body?: unknown
    ): Promise<any> => {
      const origin = process.env.ATLAS_TEST_MEILI_URL!
      if (origin !== "http://127.0.0.1:17700")
        throw new Error("Use the isolated Meili fixture")
      const response = await fetch(`${origin}${path}`, {
        method,
        headers: {
          authorization: "Bearer atlas-test-local-only",
          "content-type": "application/json",
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      })
      if (!response.ok) throw new Error(`Fixture HTTP ${response.status}`)

      return response.json()
    }
    const wait = async (uid: number) => {
      for (let i = 0; i < 100; i++) {
        const task = await request(`/tasks/${uid}`)
        if (task.status === "succeeded") return
        if (task.status === "failed")
          throw new Error(JSON.stringify(task.error))
        await new Promise((resolve) => setTimeout(resolve, 20))
      }
      throw new Error("Fixture task timed out")
    }
    beforeAll(async () => {
      try {
        const task = await request("/indexes/atlas-library", "DELETE")
        await wait(task.taskUid)
      } catch {
        /* missing isolated fixture index */
      }
      await wait(
        (
          await request("/indexes", "POST", {
            uid: "atlas-library",
            primaryKey: "documentId",
          })
        ).taskUid
      )
      await wait(
        (
          await request(
            "/indexes/atlas-library/settings",
            "PATCH",
            atlasIndexSettings
          )
        ).taskUid
      )
      backend = {
        state: async () => state,
        search: (body) =>
          request("/indexes/atlas-library/search", "POST", body),
        bridge: async () => {
          throw new Error("No CMS fixture required")
        },
      }
    })
    beforeEach(async () => {
      await wait(
        (await request("/indexes/atlas-library/documents", "DELETE")).taskUid
      )
      await wait(
        (await request("/indexes/atlas-library/documents", "POST", records))
          .taskUid
      )
      engine = new AtlasQueryEngine(backend, state, now)
      vi.stubEnv(
        "ATLAS_CURSOR_SECRET",
        "atlas-test-signing-secret-with-at-least-32-chars"
      )
    })
    afterEach(() => vi.unstubAllEnvs())
    it("counts mobile services once and reconciles local facets with unassigned records", async () => {
      const mapped = records.map((row) => ({
        ...row,
        local_area_version: atlasLocalGeography.version,
        local_area_code:
          row.country_id === "england" && row.original_lat < 60
            ? "E09000033"
            : null,
      }))
      await wait(
        (await request("/indexes/atlas-library/documents", "POST", mapped))
          .taskUid
      )
      const access = new AtlasQueryEngine(
        {
          ...backend,
          bridge: async (path) =>
            path.endsWith("/local")
              ? {
                  geography: atlasLocalGeography,
                  populationVersion: "fixture",
                  observations: atlasLocalGeography.areas.map((area) => ({
                    reportingCode: area.code,
                    year: 2024,
                    population: 100000,
                    boundaryVersion: atlasLocalGeography.version,
                    source: "Test",
                    sourceUrl: "https://example.com",
                    licence: "Test",
                    retrievedAt: now.toISOString(),
                  })),
                }
              : {
                  countries: [
                    { documentId: "england", iso2: "GB", iso3: "GBR" },
                  ],
                },
        },
        state,
        now
      )
      const response = await access.libraryAccess({
        schemaVersion: 1,
        purpose: "libraryAccess",
        level: "local",
        scope: { ...scope({ types: ["mobile"] }), bbox: undefined },
      })
      const eligible = mapped.filter(
        (row) =>
          row.access_listed &&
          row.type_group === "mobile" &&
          row.status !== "planned" &&
          row.country_id === "england"
      )
      expect(eligible.map((row) => row.documentId).sort()).toEqual([
        "depot",
        "mobile-building",
      ])
      expect(response.exactTotal).toBe(eligible.length)
      expect(response.unmappedLibraries).toBe(
        eligible.filter((row) => row.local_area_code === null).length
      )
      expect(
        response.areas.find((row) => row.id === "E09000033")?.libraryCount
      ).toBe(
        eligible.filter((row) => row.local_area_code === "E09000033").length
      )
      expect(
        response.areas.reduce((sum, row) => sum + row.libraryCount, 0) +
          response.unmappedLibraries
      ).toBe(response.exactTotal)
      const ordinary = await engine.count({
        ...scope({ types: ["mobile"] }),
        bbox: undefined,
      })
      expect(ordinary).toBe(1)
    })
    it("reconciles whole-country per-capita counts with null country IDs in the real index", async () => {
      const orphan = {
        ...records[0]!,
        atlas_id: 999,
        documentId: "orphan",
        country_id: null,
      }
      await wait(
        (await request("/indexes/atlas-library/documents", "POST", [orphan]))
          .taskUid
      )
      const countries = new AtlasQueryEngine(
        {
          ...backend,
          bridge: async () => ({
            populationVersion: "fixture",
            observations: [
              {
                key: "fixture:GBR",
                level: "country",
                reportingCode: "GBR",
                iso2: "GB",
                name: "UK",
                population: 69281000,
                year: 2024,
                source: "Test",
                sourceUrl: "https://example.com",
                licence: "Test",
                retrievedAt: "2026-10-09T12:00:00Z",
                method: "direct",
              },
            ],
            countries: [{ documentId: "england", iso2: "GB", iso3: "GBR" }],
          }),
        },
        state,
        now
      )
      const response = await countries.perCapita({
        schemaVersion: 1,
        purpose: "perCapita",
        scope: { ...scope(), bbox: undefined },
      })
      const eligible = records.filter(
        (row) =>
          row.listed && row.type_group !== "mobile" && row.status !== "planned"
      )
      expect(response.exactTotal).toBe(eligible.length + 1)
      expect(
        response.countries.find((row) => row.iso3 === "GBR")?.libraryCount
      ).toBe(eligible.filter((row) => row.country_id === "england").length)
      expect(response.unmappedLibraries).toBe(
        1 + eligible.filter((row) => row.country_id !== "england").length
      )
    })
    it("returns complete aggregates including access and completeness populations", async () => {
      // Keep every population above the point budget so this exercises the
      // large-catalogue path independently of the camera zoom.
      const dense = records.flatMap((row, i) =>
        Array.from({ length: 1001 }, (_, n) => ({
          ...row,
          documentId: `dense-${i}-${n}`,
          atlas_id: 10000 + i * 1001 + n,
        }))
      )
      await wait(
        (await request("/indexes/atlas-library/documents", "POST", dense))
          .taskUid
      )
      const query = parseAtlasQueryRequest({
        schemaVersion: 1,
        purpose: "viewport",
        scope: {
          ...scope(),
          accessibility: {
            enabled: true,
            selected: ["Wheelchair access"],
            view: "compare",
          },
        },
        populations: ["listed", "closures", "events", "late"],
        quality: true,
        density: true,
        zoom: 3,
        width: 800,
        height: 600,
        centre: { lat: 0, lng: 0 },
        drawingPreference: "current",
      })
      if (query.purpose !== "viewport") throw new Error("fixture")
      const result = await engine.viewport(query)
      for (const [name, population] of Object.entries(result.populations)) {
        expect(population.complete).toBe(true)
        if (population.mode !== "aggregate")
          throw new Error("Expected aggregates")
        expect(
          population.cells.reduce((sum, cell) => sum + cell.total, 0)
        ).toBe(population.exactTotal)
        if (name === "listed" || name === "events") {
          expect(population.density?.cells.length).toBeLessThanOrEqual(
            ATLAS_LIMITS.densityCells
          )
          expect(
            population.density?.cells.reduce((sum, cell) => sum + cell.total, 0)
          ).toBe(population.exactTotal)
        } else expect(population.density).toBeUndefined()
        for (const cell of population.cells) {
          expect(
            records.some(
              (row) =>
                Math.abs(row.latitude - cell.centre.lat) < 1e-10 &&
                Math.abs(row.longitude - cell.centre.lng) < 1e-10
            )
          ).toBe(true)
          expect(cell.centre).not.toEqual(atlasCell(cell.id).centre)
          if (cell.total === 1) expect(cell.point?.properties.i).toBeTruthy()
        }
      }
      expect(result.coverage?.total).toBe(fixture.expected.listed.length * 1002)
    })
    it("coarsens a truncated density facet while retaining the full population", async () => {
      const distributed = Array.from({ length: 4096 }, (_, n) => {
        const centre = atlasCell(`6/${n % 64}/${Math.floor(n / 64)}`).centre

        return {
          ...records[0]!,
          documentId: `distributed-${n}`,
          atlas_id: n + 10000,
          latitude: centre.lat,
          longitude: centre.lng,
          original_lat: centre.lat,
          original_lng: centre.lng,
          ...Object.fromEntries(
            Array.from({ length: ATLAS_LIMITS.maxCellZoom + 1 }, (_, z) => [
              `atlas_cell_${z}`,
              atlasCellId(centre, z),
            ])
          ),
        }
      })
      await wait(
        (await request("/indexes/atlas-library/documents", "DELETE")).taskUid
      )
      await wait(
        (await request("/indexes/atlas-library/documents", "POST", distributed))
          .taskUid
      )
      const result = await engine.viewport({
        schemaVersion: 1,
        purpose: "viewport",
        scope: scope(),
        populations: ["listed"],
        density: true,
        zoom: 5,
        width: 800,
        height: 600,
        centre: { lat: 0, lng: 0 },
        drawingPreference: "current",
      })
      const listed = result.populations.listed!
      if (listed.mode !== "aggregate") throw new Error("Expected aggregates")
      expect(listed.exactTotal).toBe(distributed.length)
      expect(listed.density?.cells).toHaveLength(1024)
      expect(
        listed.density?.cells.every((cell) => cell.id.startsWith("5/"))
      ).toBe(true)
      expect(
        listed.density?.cells.reduce((sum, cell) => sum + cell.total, 0)
      ).toBe(distributed.length)
    })
    it("returns complete actual pins for small filtered populations at low zoom", async () => {
      const result = await engine.viewport({
        schemaVersion: 1,
        purpose: "viewport",
        scope: scope({ catalogue: true }),
        populations: ["listed"],
        density: true,
        zoom: 2,
        width: 800,
        height: 600,
        centre: { lat: 0, lng: 0 },
        drawingPreference: "current",
      })
      const listed = result.populations.listed!
      expect(listed.mode).toBe("points")
      if (listed.mode !== "points") throw new Error("Expected actual pins")
      const expected = records
        .filter((row) => row.listed && row.has_catalogue)
        .map(atlasPoint)
      expect(listed.points.map((point) => point.properties)).toEqual(
        expected.map((point) => point.properties)
      )
      listed.points.forEach((point, i) => {
        point.geometry.coordinates.forEach((coordinate, axis) =>
          expect(coordinate).toBeCloseTo(
            expected[i]!.geometry.coordinates[axis]!,
            10
          )
        )
      })
    })
    it("preserves notice-aware now and ordinary minute filters", async () => {
      expect(await engine.count(scope({ opening: "now" }))).toBe(
        fixture.expected.openNow.length
      )
      expect(
        await engine.count(scope({ opening: "at", atDay: 3, atMinutes: 675 }))
      ).toBe(fixture.expected.openAt.length)
    })
    it("uses normal world filters for patched controls and handles same-name facility codes", async () => {
      const query = parseAtlasQueryRequest({
        schemaVersion: 1,
        purpose: "counts",
        scope: {
          ...scope(),
          bbox: undefined,
          accessibility: {
            enabled: true,
            selected: ["Unknown"],
            view: "matches",
          },
        },
      })
      if (query.purpose !== "counts") throw new Error("fixture")
      const result = await engine.counts(query)
      expect(result.exactTotal).toBe(fixture.expected.listed.length)
      expect(
        result.facilities.find((facility) => facility.name === "Wi-Fi")?.count
      ).toBe(fixture.expected.wifi.length)
      expect(result.facilitiesHasMore).toBe(false)
    })
    it("continues name pages without duplicates and rejects a changed scope", async () => {
      const more = Array.from({ length: 35 }, (_, n) => ({
        ...records[0]!,
        documentId: `cursor-${n}`,
        atlas_id: n + 100,
      }))
      await wait(
        (await request("/indexes/atlas-library/documents", "POST", more))
          .taskUid
      )
      const query = parseAtlasQueryRequest({
        schemaVersion: 1,
        purpose: "list",
        scope: scope(),
        sort: "name",
        centre: { lat: 0, lng: 0 },
      })
      if (query.purpose !== "list") throw new Error("fixture")
      const first = await engine.list(query),
        second = await engine.list({ ...query, cursor: first.nextCursor })
      expect(first.rows).toHaveLength(20)
      expect(second.rows).toHaveLength(20)
      expect(
        new Set([...first.rows, ...second.rows].map((row) => row.documentId))
          .size
      ).toBe(40)
      await expect(
        engine.list({
          ...query,
          cursor: first.nextCursor,
          scope: scope({ catalogue: true }),
        })
      ).rejects.toThrow("Cursor expired")
    })
    it("preserves bounded list summaries and disables tiles through the permanent recovery setting", async () => {
      const list = await engine.list({
        schemaVersion: 1,
        purpose: "list",
        scope: scope(),
        sort: "name",
        centre: { lat: 0, lng: 0 },
      })
      expect(list.rows.find((row) => row.documentId === "all")).toMatchObject({
        completeness: 95,
        timezone: "Europe/London",
        openNow: "open",
        accessibility: [
          "Wheelchair access",
          "Step-free access",
          "Hearing loop",
        ],
      })
      expect(
        list.rows.find((row) => row.documentId === "all")?.hours?.[3]
      ).toEqual([[675, 750]])
      expect(
        list.rows
          .filter((row) => row.openNow === "open")
          .map((row) => row.documentId)
          .sort()
      ).toEqual([...fixture.expected.openNow].sort())
      const manifest = {
        buildId: "fixture",
        builtAgainstQueryEpoch: state.queryEpoch,
        canonicalLocale: "en",
        sourceStartRevision: "0",
        sourceEndRevision: "1",
        detailZoom: 10,
      }
      const withArchive = new AtlasQueryEngine(
        backend,
        { ...state, manifest: manifest as any },
        now
      )
      const request = {
        schemaVersion: 1 as const,
        purpose: "viewport" as const,
        scope: scope(),
        zoom: 16,
        width: 800,
        height: 600,
        centre: { lat: 0, lng: 0 },
        populations: ["listed" as const],
        drawingPreference: "auto" as const,
        archiveBuildId: "fixture",
      }
      expect(
        (await withArchive.viewport(request)).populations.listed?.mode
      ).toBe("tiles")
      vi.stubEnv("ATLAS_GEOMETRY_MODE", "current")
      expect(
        (await withArchive.viewport(request)).populations.listed?.mode
      ).toBe("points")
      vi.unstubAllEnvs()
    })
    it("searches distinct places so a dense city cannot hide another matching city", async () => {
      const more = Array.from({ length: 121 }, (_, n) => ({
        ...records[0]!,
        documentId: `place-${n}`,
        atlas_id: n + 100,
        city: n < 120 ? "York" : "Yorkville",
        city_key: n < 120 ? "york" : "yorkville",
      }))
      await wait(
        (await request("/indexes/atlas-library/documents", "POST", more))
          .taskUid
      )
      const result = await engine.search({
        schemaVersion: 1,
        purpose: "search",
        scope: scope({ catalogue: true }),
        q: "York",
      })
      expect(
        result.places
          .filter((place) => place.level === "city")
          .map((place) => place.name)
          .sort()
      ).toEqual(["York", "Yorkville"])
      expect(
        result.places.find((place) => place.id === "york")?.exactTotal
      ).toBe(120)
      expect(
        result.places.find((place) => place.id === "yorkville")?.exactTotal
      ).toBe(1)
    })
    it("falls back to aggregates when complete point geometry exceeds its byte budget", async () => {
      const more = Array.from({ length: 350 }, (_, n) => ({
        ...records[0]!,
        documentId: `bytes-${n}`,
        atlas_id: n + 100,
        name: "📚".repeat(240),
      }))
      expect(
        Buffer.byteLength(JSON.stringify(more.map(atlasPoint)))
      ).toBeGreaterThan(256 * 1024)
      await wait(
        (await request("/indexes/atlas-library/documents", "POST", more))
          .taskUid
      )
      const query = parseAtlasQueryRequest({
        schemaVersion: 1,
        purpose: "viewport",
        scope: scope(),
        populations: ["listed"],
        zoom: 16,
        width: 800,
        height: 600,
        centre: { lat: 0, lng: 0 },
        drawingPreference: "current",
      })
      if (query.purpose !== "viewport") throw new Error("fixture")
      const result = await engine.viewport(query)
      expect(result.populations.listed?.mode).toBe("aggregate")
      expect(result.populations.listed?.exactTotal).toBe(
        350 + fixture.expected.listed.length
      )
    })
  }
)
