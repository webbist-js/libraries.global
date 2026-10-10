// @vitest-environment happy-dom
import { emptyAtlasFilters, parseAtlasQueryRequest } from "@repo/shared-data"
import { act, cleanup, render } from "@testing-library/react"
import { useEffect } from "react"
import { afterEach, expect, it, vi } from "vitest"

const observed = vi.hoisted(() => ({ map: null as any, list: null as any }))
vi.mock("@/lib/access-client", () => ({
  useEntitlements: () => ({ plan: "pro", ready: true, can: () => true }),
}))
vi.mock("@/lib/navigation", () => ({
  GlobalLink: () => null,
  Link: () => null,
  useRouter: () => ({ push: vi.fn() }),
  routing: { locales: ["en"], defaultLocale: "en" },
}))
vi.mock("../AtlasMap", () => ({
  AtlasMap: (props: any) => {
    observed.map = props
    useEffect(() => {
      props.onReady()
      props.onView({
        lat: 0,
        lng: 0,
        zoom: -4.53,
        bounds: { west: -1, east: 1, south: -1, north: 1 },
      })
    }, [])

    return null
  },
}))
vi.mock("../AtlasListView", () => ({
  AtlasListView: (props: any) => {
    observed.list = props

    return null
  },
}))
vi.mock("../AtlasSearchTab", () => ({
  AtlasSearchTab: () => null,
  buildPlaces: () => [],
}))
vi.mock("../AtlasLibraryPanel", () => ({ AtlasLibraryPanel: () => null }))
vi.mock("../AtlasPlansSheet", () => ({ AtlasPlansSheet: () => null }))
vi.mock("../AtlasStopPanel", () => ({ AtlasStopPanel: () => null }))
vi.mock("../useMobileAtlas", () => ({
  useMobileAtlas: () => ({
    stops: [],
    clusters: [],
    routes: [],
    live: [],
    total: 0,
    libraries: [],
    zoomIn: false,
  }),
}))
import { AtlasExplorer } from "../AtlasExplorer"

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  observed.map = null
  observed.list = null
})
it("switches the complete provider without a bulk download and preserves independent selection and no-WebGL list fallback", async () => {
  vi.useFakeTimers()
  window.history.replaceState(
    null,
    "",
    "/en/map?lib=selected&layers=pins,perCapita&routeLines=0&mobileOpacity=0.4"
  )
  const seen: string[] = []
  const inputs: unknown[] = []
  const metadata = {
    schemaVersion: 1,
    queryEpoch: "epoch",
    dictionaryVersion: "dict",
    indexedThrough: "1",
    fingerprint: "fixture",
    evaluatedAt: new Date().toISOString(),
  }
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: any) => {
      seen.push(url)
      if (url.startsWith("/api/atlas/library"))
        return Response.json({
          library: {
            id: "selected",
            name: "Selected",
            hours: null,
            access: [],
            services: [],
            lat: 0,
            lng: 0,
            type: "Public",
            status: "open",
            notices: [],
          },
        })
      if (url === "/api/atlas/manifest")
        return Response.json({
          manifest: null,
          dictionary: { version: "dict", entries: [] },
        })
      if (url === "/api/atlas/query") {
        const input = JSON.parse(init.body)
        inputs.push(input)
        // The actual route rejects UI-only mobile filters. Exercise the same
        // parser here so a valid-looking browser layer cannot hide a 400.
        parseAtlasQueryRequest(input)
        if (input.purpose === "libraryAccess")
          return Response.json({
            ...metadata,
            areas: [],
            level: input.level,
            coverage: { countries: ["GBR"], note: "UK local areas" },
            summary: {
              countries: 0,
              libraryCount: 0,
              population: null,
              per100k: null,
            },
            unmappedLibraries: 0,
            baseline: { year: 2024 },
            geometry: { type: "geojson", url: "/fixture" },
          })
        if (input.purpose === "viewport")
          return Response.json({
            ...metadata,
            populations: {
              listed: {
                mode: "aggregate",
                exactTotal: 2500,
                complete: true,
                cells: [],
              },
            },
          })
        if (input.purpose === "counts")
          return Response.json({
            ...metadata,
            exactTotal: 2500,
            typeGroups: { public: 2500 },
            operatorGroups: {},
            facilities: [],
            accessibility: [],
            presets: [],
            foundedRange: null,
            events: 0,
            catalogue: 0,
          })

        return Response.json({
          ...metadata,
          suggestions: [],
          libraries: [],
          places: [],
        })
      }
      throw new Error(`Unexpected bulk or legacy request: ${url}`)
    })
  )
  render(<AtlasExplorer scalable />)
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1000)
  })
  expect(seen.some((url) => url.includes("libraries/atlas"))).toBe(false)
  expect(inputs.some((input: any) => input.purpose === "libraryAccess")).toBe(
    true
  )
  for (const input of inputs)
    expect(() => parseAtlasQueryRequest(input)).not.toThrow()
  expect(observed.map.generation.viewport.populations.listed.exactTotal).toBe(
    2500
  )
  expect(observed.map.libraries).toEqual([])
  expect(observed.map.selected.id).toBe("selected")
  expect(observed.map.mobileRouteLines).toBe(false)
  expect(observed.map.mobileOpacity).toBe(0.4)
  await act(async () => observed.map.onError("webgl"))
  expect(observed.list.remoteScope.filters).toEqual(emptyAtlasFilters())
  expect(observed.list.libraries).toEqual([])
})
