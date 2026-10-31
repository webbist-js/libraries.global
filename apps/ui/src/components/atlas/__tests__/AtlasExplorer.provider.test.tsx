// @vitest-environment happy-dom
import { emptyAtlasFilters, parseAtlasQueryRequest } from "@repo/shared-data"
import {
  type ComponentProps,
  type ReactNode,
  useEffect,
  useImperativeHandle,
} from "react"
import { afterEach, expect, it, vi } from "vitest"

import { act, cleanup, fireEvent, render, screen, within } from "@/test/render"

import { AtlasExplorer } from "../AtlasExplorer"
import type { AtlasListView as AtlasListViewComponent } from "../AtlasListView"

const observed = vi.hoisted(() => ({
  plan: "pro",
  map: null as any,
  list: null as any,
  flyTo: vi.fn(),
  fitBounds: vi.fn(),
}))
vi.mock("@/lib/access-client", () => ({
  useEntitlements: () => ({
    plan: observed.plan,
    ready: true,
    can: () => observed.plan === "pro",
  }),
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
    useImperativeHandle(props.ref, () => ({
      flyTo: observed.flyTo,
      fitBounds: observed.fitBounds,
    }))
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
vi.mock("../AtlasListView", async (importOriginal) => {
  const { AtlasListView } = await importOriginal<{
    AtlasListView: typeof AtlasListViewComponent
  }>()

  return {
    AtlasListView: (props: ComponentProps<typeof AtlasListViewComponent>) => {
      observed.list = props

      return <AtlasListView {...props} />
    },
  }
})
vi.mock("../AtlasSearchTab", () => ({
  AtlasSearchTab: () => null,
  buildPlaces: () => [],
}))
vi.mock("../AtlasLibraryPanel", () => ({
  AtlasLibraryPanel: ({
    onReach,
    reachPrompt,
  }: {
    onReach: () => void
    reachPrompt?: ReactNode
  }) => (
    <>
      <button type="button" onClick={onReach}>
        Reach from here
      </button>
      {reachPrompt}
    </>
  ),
}))
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

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  observed.plan = "pro"
  observed.map = null
  observed.list = null
  observed.flyTo.mockClear()
  observed.fitBounds.mockClear()
})
it("opens the installed context analysis panel and keeps the background when Reach is added", async () => {
  window.history.replaceState(
    null,
    "",
    "/en/map?layers=pins,population,deprivation"
  )
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (url.includes("/api/atlas/context?kind=catalogue"))
        return Response.json({
          schemaVersion: 1,
          releases: [
            {
              id: "deprivation-gb-eng-test",
              theme: "deprivation",
              country: "GB-ENG",
              name: "England",
              year: 2025,
              edition: "IMD 2025",
              boundary: "2021 LSOAs",
              source: "MHCLG",
              sourceUrl: "https://www.gov.uk",
              licence: "OGL",
              attribution: "Crown copyright",
              note: "National ranks",
              areaCount: 33755,
              bounds: { west: -6, east: 2, south: 50, north: 56 },
            },
          ],
        })
      if (url === "/api/atlas/manifest")
        return Response.json({
          manifest: null,
          dictionary: { version: "dict", entries: [] },
        })

      return Response.json(
        { error: "Not used in this interaction" },
        { status: 503 }
      )
    })
  )
  await act(async () => {
    render(<AtlasExplorer scalable />)
  })
  expect(screen.getByRole("tabpanel", { name: "Deprivation" })).toBeTruthy()
  expect(
    screen.getByRole("combobox", { name: "Nation and edition" })
  ).toBeTruthy()
  expect(observed.map.contextRelease.id).toBe("deprivation-gb-eng-test")
  expect(observed.map.layers).not.toContain("population")
  fireEvent.click(screen.getByRole("button", { name: "Add travel-time reach" }))
  const tabs = within(screen.getByRole("tablist", { name: "Inspect" }))
  expect(screen.getByRole("tabpanel", { name: "Reach" })).toBeTruthy()
  const layers = [...observed.map.layers]
  fireEvent.click(tabs.getByRole("tab", { name: "Deprivation" }))
  expect(screen.getByRole("tabpanel", { name: "Deprivation" })).toBeTruthy()
  expect(observed.map.layers).toEqual(layers)
  fireEvent.click(screen.getByRole("button", { name: "Minimise Inspect" }))
  expect(screen.queryByRole("tabpanel", { name: "Deprivation" })).toBeNull()
  expect(observed.map.layers).toEqual(layers)
  fireEvent.click(
    within(
      screen.getByRole("navigation", { name: "Minimised Inspect" })
    ).getByRole("button", { name: "Reach", description: /Travel-time reach/ })
  )
  expect(screen.getByRole("tabpanel", { name: "Reach" })).toBeTruthy()
  fireEvent.click(
    screen.getByRole("button", { name: "Remove Reach (turns the layer off)" })
  )
  expect(observed.map.layers).not.toContain("reach")
  expect(screen.getByRole("tabpanel", { name: "Deprivation" })).toBeTruthy()
  fireEvent.click(screen.getByRole("button", { name: "Undo" }))
  expect(observed.map.layers).toEqual(layers)
})

it("keeps the scalable provider, desktop/mobile lists and every list sort compatible with the query API", async () => {
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
      if (url.startsWith("/api/atlas/library")) {
        const key = new URL(url, "http://localhost").searchParams.get("key")

        return Response.json({
          library: {
            id: key ?? "selected",
            name: key === "fixture-library" ? "Fixture library" : "Selected",
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
      }
      if (url === "/api/atlas/manifest")
        return Response.json({
          manifest: null,
          dictionary: { version: "dict", entries: [] },
        })
      if (url === "/api/atlas/query") {
        const input = JSON.parse(init.body)
        inputs.push(input)
        // Use the route's parser to reject UI-only filters and camera fields,
        // so a valid-looking browser layer cannot hide an HTTP 400.
        try {
          parseAtlasQueryRequest(input)
        } catch {
          return Response.json(
            { error: "Invalid Atlas query" },
            { status: 400 }
          )
        }
        if (input.purpose === "list")
          return Response.json({
            ...metadata,
            exactTotal: 1,
            reachableTotal: 1,
            hasMore: false,
            rows: [
              {
                documentId: "fixture-library",
                name: "Fixture library",
                slug: "fixture-library",
                path: null,
                type: "public",
                city: "Glasgow",
                country: "United Kingdom",
                region: null,
                coordinate: { lat: 55.72, lng: -4.48 },
                status: "open",
                timezone: "Europe/London",
                hours: null,
                openNow: "unknown",
                accessibility: [],
                completeness: 50,
              },
            ],
          })
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
  const atlas = render(
    <AtlasExplorer
      scalable
      feedbackPrompt={<button type="button">Atlas feedback</button>}
    />
  )
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
  expect(observed.flyTo).toHaveBeenCalledWith(0, 0, 14)
  expect(observed.map.mobileRouteLines).toBe(false)
  expect(observed.map.mobileOpacity).toBe(0.4)
  expect(screen.getByRole("button", { name: "Atlas feedback" })).toBeTruthy()
  await act(async () => observed.map.onError("webgl"))
  expect(observed.list.remoteScope.filters).toEqual(emptyAtlasFilters())
  expect(observed.list.libraries).toEqual([])
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1000)
  })
  expect(
    screen.getByRole("rowheader", { name: /^Fixture library/ })
  ).toBeTruthy()
  expect(
    screen.queryByText("Atlas data is temporarily unavailable.")
  ).toBeNull()
  for (const [sort, label] of Object.entries({
    distance: "Nearest the centre",
    name: "Name · A–Z",
    name_desc: "Name · Z–A",
    place: "Place · A–Z",
    place_desc: "Place · Z–A",
    record: "Least complete first",
    record_desc: "Most complete first",
  })) {
    fireEvent.click(screen.getByRole("combobox", { name: "Sort" }))
    fireEvent.click(
      screen.getByRole("option", {
        name: label,
      })
    )
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000)
    })
    expect(
      screen.getByRole("rowheader", { name: /^Fixture library/ })
    ).toBeTruthy()
    expect(inputs).toContainEqual(
      expect.objectContaining({ purpose: "list", sort })
    )
  }
  await act(async () => {
    observed.map.onView({
      lat: 1,
      lng: 1,
      zoom: 3,
      bounds: { west: -2, east: 2, south: -2, north: 2 },
    })
    await vi.advanceTimersByTimeAsync(1000)
  })
  expect(screen.getByRole("combobox", { name: "Sort" }).textContent).toContain(
    "Most complete first"
  )
  expect(screen.getByRole("button", { name: "Atlas feedback" })).toBeTruthy()

  await act(async () => {
    await vi.advanceTimersByTimeAsync(1000)
  })
  const desktopLibrary = screen.getByRole("button", {
    name: "Fixture library",
  })
  const desktopTable = screen.getByRole("table")
  observed.flyTo.mockClear()
  fireEvent.click(desktopLibrary)
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1000)
  })
  expect(screen.getByRole("heading", { name: "Fixture library" })).toBeTruthy()
  expect(screen.getByRole("table")).toBe(desktopTable)
  expect(desktopLibrary.getAttribute("aria-expanded")).toBe("true")
  expect(screen.getByRole("combobox", { name: "Sort" }).textContent).toContain(
    "Most complete first"
  )
  expect(observed.flyTo).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole("button", { name: "Back to results" }))
  await act(async () => {
    await vi.advanceTimersByTimeAsync(100)
  })
  expect(screen.getByRole("table")).toBe(desktopTable)
  expect(document.activeElement).toBe(desktopLibrary)

  atlas.unmount()
  window.history.replaceState(null, "", "/en/map?layers=pins")
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: query === "(max-width: 1023px)",
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }))
  )
  render(
    <AtlasExplorer
      scalable
      feedbackPrompt={<button type="button">Atlas feedback</button>}
    />
  )
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1000)
  })
  expect(
    screen.getByRole("button", { name: "Panel size: peek. Change size" })
  ).toBeTruthy()
  expect(
    within(screen.getByRole("region", { name: "Explore panel" })).getByRole(
      "button",
      { name: "Atlas feedback" }
    )
  ).toBeTruthy()
  fireEvent.click(screen.getByRole("radio", { name: /^List$/ }))
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1000)
  })
  expect(
    screen.getByRole("rowheader", { name: /^Fixture library/ })
  ).toBeTruthy()
  const mobileLibrary = screen.getByRole("button", { name: "Fixture library" })
  const mobileTable = screen.getByRole("table")
  fireEvent.click(mobileLibrary)
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1000)
  })
  expect(screen.getByRole("heading", { name: "Fixture library" })).toBeTruthy()
  expect(mobileTable.isConnected).toBe(true)
  expect(screen.queryByRole("table")).toBeNull()
  fireEvent.click(screen.getByRole("button", { name: /^Inspect ·/ }))
  fireEvent.click(screen.getByRole("button", { name: "Back to results" }))
  await act(async () => {
    await vi.advanceTimersByTimeAsync(100)
  })
  expect(screen.getByRole("table")).toBe(mobileTable)
  expect(document.activeElement).toBe(mobileLibrary)
})

it("focuses a selected service's bounding box once and preserves the camera on later map movement", async () => {
  vi.useFakeTimers()
  window.history.replaceState(null, "", "/en/map?network=one")
  const bounds = { west: -3.18, east: -2.96, south: 53.31, north: 53.43 }
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (url.startsWith("/api/atlas/networks"))
        return Response.json({
          selected: {
            documentId: "one",
            name: "Wirral",
            bounds,
            available: true,
            areaCodes: ["E08000015"],
          },
        })

      return Response.json({ type: "FeatureCollection", features: [] })
    })
  )
  render(<AtlasExplorer />)
  await act(async () => vi.advanceTimersByTimeAsync(1000))
  expect(observed.fitBounds).toHaveBeenCalledWith(bounds)
  const count = observed.fitBounds.mock.calls.length
  await act(async () =>
    observed.map.onView({ lat: 53.4, lng: -3, zoom: 12, bounds })
  )
  await act(async () => vi.advanceTimersByTimeAsync(1000))
  expect(observed.fitBounds).toHaveBeenCalledTimes(count)
})

it("keeps the mobile sheet expanded and the service calculation when switching drawers", async () => {
  vi.useFakeTimers()
  window.history.replaceState(
    null,
    "",
    "/en/map?layers=pins,reach,population,access&reachScope=network&network=one"
  )
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: query === "(max-width: 1023px)",
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }))
  )
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (url.startsWith("/api/atlas/networks"))
        return Response.json({
          networks: [],
          countries: [],
          regions: [],
          next: null,
          selected: {
            documentId: "one",
            name: "Wirral",
            kind: "library_service",
            bounds: { west: -3.2, east: -3, south: 53.3, north: 53.5 },
            available: true,
            areaCodes: ["E08000015"],
            areaName: "Wirral",
            eligibleLibraries: 13,
            excludedLibraries: 0,
            countries: [],
          },
        })
      if (url === "/api/atlas/network-reach")
        return Response.json({
          schemaVersion: 1,
          networkId: "one",
          areaCode: "E08000015",
          mode: "walking",
          state: "unsupported",
        })

      return Response.json({ type: "FeatureCollection", features: [] })
    })
  )
  render(<AtlasExplorer />)
  await act(async () => vi.advanceTimersByTimeAsync(1000))
  const calculationsSoFar = () =>
    vi
      .mocked(fetch)
      .mock.calls.filter(([url]) => url === "/api/atlas/network-reach")
  expect(calculationsSoFar()).toHaveLength(0)
  expect(
    (
      screen.getByRole("button", {
        name: "Calculate coverage",
      }) as HTMLButtonElement
    ).disabled
  ).toBe(false)
  await act(async () =>
    observed.map.onView({
      lat: 53.4,
      lng: -3.1,
      zoom: 12,
      bounds: { west: -3.2, east: -3, south: 53.3, north: 53.5 },
    })
  )
  await act(async () => vi.advanceTimersByTimeAsync(1000))
  expect(calculationsSoFar()).toHaveLength(0)
  fireEvent.click(screen.getByRole("button", { name: "Calculate coverage" }))
  await act(async () => vi.advanceTimersByTimeAsync(1000))
  expect(calculationsSoFar()).toHaveLength(1)
  fireEvent.click(
    screen.getByRole("button", { name: "Panel size: half. Change size" })
  )
  fireEvent.click(
    screen.getByRole("button", { name: "Panel size: full. Change size" })
  )
  fireEvent.click(
    screen.getByRole("button", { name: "Panel size: half. Change size" })
  )
  expect(
    screen.getByRole("button", { name: "Panel size: full. Change size" })
  ).toBeTruthy()
  const drawerCards = screen.getByRole("tablist", { name: "Inspect" })
  expect(
    screen.getByRole("navigation", { name: "Atlas workspace" })
  ).toBeTruthy()
  // Focus restoration from a portal must scroll the results, never the sheet.
  expect(
    screen.getByRole("region", { name: "Explore panel" }).classList
  ).toContain("overflow-clip")
  expect(
    screen.getByText("1 library filter applies to this calculation.")
  ).toBeTruthy()
  fireEvent.click(screen.getByRole("button", { name: "Reset filters" }))
  await act(async () => vi.advanceTimersByTimeAsync(1000))
  expect(observed.map.layers).toContain("access")
  expect(observed.map.accessibilityView).toBe("compare")
  expect(screen.queryByRole("button", { name: "Reset filters" })).toBeNull()
  expect(calculationsSoFar()).toHaveLength(1)
  fireEvent.click(screen.getByRole("button", { name: "Calculate coverage" }))
  await act(async () => vi.advanceTimersByTimeAsync(1000))
  const calculations = vi
    .mocked(fetch)
    .mock.calls.filter(([url]) => url === "/api/atlas/network-reach")
  const lastCalculation = calculations.at(-1)
  expect(
    JSON.parse(String(lastCalculation?.[1]?.body)).scope.accessibility.view
  ).toBe("compare")

  const calls = vi
    .mocked(fetch)
    .mock.calls.filter(([url]) => url === "/api/atlas/network-reach").length
  const fits = observed.fitBounds.mock.calls.length
  fireEvent.click(within(drawerCards).getByRole("tab", { name: "Population" }))
  expect(screen.getByRole("tabpanel", { name: "Population" })).toBeTruthy()
  fireEvent.click(within(drawerCards).getByRole("tab", { name: "Reach" }))
  await act(async () => vi.advanceTimersByTimeAsync(1000))
  expect(
    screen.getByRole("combobox", { name: "Reach scope" }).textContent
  ).toContain("Library service")
  expect(
    screen.getByRole("button", { name: "Panel size: full. Change size" })
  ).toBeTruthy()
  expect(observed.map.layers).toEqual(
    expect.arrayContaining(["reach", "population"])
  )
  expect(observed.fitBounds).toHaveBeenCalledTimes(fits)
  expect(
    vi
      .mocked(fetch)
      .mock.calls.filter(([url]) => url === "/api/atlas/network-reach")
  ).toHaveLength(calls)
  await act(async () =>
    observed.map.onView({
      lat: 53.4,
      lng: -3,
      zoom: 8,
      bounds: { west: -8, east: 2, south: 50, north: 60 },
    })
  )
  expect(
    (
      screen.getByRole("button", {
        name: "Calculate coverage",
      }) as HTMLButtonElement
    ).disabled
  ).toBe(false)
  await act(async () => vi.advanceTimersByTimeAsync(10000))
  expect(calculationsSoFar()).toHaveLength(calls)
})

it("restores the chosen drawer from a link and supports keyboard navigation without moving the map", async () => {
  vi.useFakeTimers()
  window.history.replaceState(
    null,
    "",
    "/en/map?layers=pins,reach,population,access&analysis=population"
  )
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      Response.json({ type: "FeatureCollection", features: [] })
    )
  )
  render(<AtlasExplorer />)
  await act(async () => vi.advanceTimersByTimeAsync(1000))
  const drawerCards = within(screen.getByRole("tablist", { name: "Inspect" }))
  expect(screen.getByRole("tabpanel", { name: "Population" })).toBeTruthy()
  expect(
    drawerCards
      .getByRole("tab", { name: "Population" })
      .getAttribute("aria-selected")
  ).toBe("true")
  const layers = [...observed.map.layers]
  await act(async () => {
    const population = drawerCards.getByRole("tab", { name: "Population" })
    population.focus()
    fireEvent.keyDown(population, { key: "ArrowRight" })
    await vi.advanceTimersByTimeAsync(0)
  })
  expect(document.activeElement).toBe(
    drawerCards.getByRole("tab", { name: "Accessibility" })
  )
  fireEvent.click(drawerCards.getByRole("tab", { name: "Accessibility" }))
  expect(screen.getByRole("tabpanel", { name: "Accessibility" })).toBeTruthy()
  await act(async () => {
    fireEvent.keyDown(drawerCards.getByRole("tab", { name: "Accessibility" }), {
      key: "Home",
    })
    await vi.advanceTimersByTimeAsync(0)
  })
  expect(document.activeElement).toBe(
    drawerCards.getByRole("tab", { name: "Reach" })
  )
  fireEvent.click(drawerCards.getByRole("tab", { name: "Reach" }))
  expect(screen.getByRole("tabpanel", { name: "Reach" })).toBeTruthy()
  expect(observed.map.layers).toEqual(layers)
  expect(observed.fitBounds).not.toHaveBeenCalled()
  expect(observed.flyTo).not.toHaveBeenCalled()
  await act(async () => vi.advanceTimersByTimeAsync(500))
  expect(new URLSearchParams(window.location.search).get("analysis")).toBe(
    "reach"
  )
})

it("retains the selected library as the Reach target while inspecting another layer", async () => {
  vi.useFakeTimers()
  window.history.replaceState(
    null,
    "",
    "/en/map?lib=one&layers=pins,reach,population"
  )
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (url === "/api/public-proxy/api/libraries/atlas")
        return Response.json({
          type: "FeatureCollection",
          features: [
            {
              geometry: { type: "Point", coordinates: [-3.1, 53.4] },
              properties: {
                id: "one",
                slug: "one",
                name: "Fixture library",
                type: "Public",
                status: "open",
                operator: null,
                city: null,
                country: "United Kingdom",
                region: null,
                hours: null,
                access: [],
                services: [],
                notices: [],
              },
            },
          ],
        })
      if (url === "/api/atlas/reach")
        return Response.json({
          schemaVersion: 1,
          state: "ready",
          libraryId: "one",
          mode: "walking",
          coordinateHash: "a".repeat(64),
          calculatedAt: "2026-10-25T00:00:00Z",
          method: "fixture",
          snapDistanceMetres: 0,
          network: {
            release: "fixture",
            source: "OSM",
            sourceUrl: "https://example.test",
            licence: "ODbL",
          },
          population: {
            release: "fixture",
            source: "Population",
            sourceUrl: "https://example.test",
            licence: "CC BY 4.0",
            year: 2020,
          },
          warnings: [],
          contours: [5, 10, 15, 30].map((minutes) => ({
            minutes,
            residents: minutes,
            coveredFraction: 1,
            geometry: {
              type: "Polygon",
              coordinates: [
                [
                  [-3.2, 53.3],
                  [-3, 53.3],
                  [-3, 53.5],
                  [-3.2, 53.5],
                  [-3.2, 53.3],
                ],
              ],
            },
          })),
        })

      return Response.json({ type: "FeatureCollection", features: [] })
    })
  )
  render(<AtlasExplorer />)
  await act(async () => vi.advanceTimersByTimeAsync(1000))
  expect(
    vi.mocked(fetch).mock.calls.filter(([url]) => url === "/api/atlas/reach")
  ).toHaveLength(0)
  await act(async () =>
    observed.map.onView({
      lat: 53.4,
      lng: -3.1,
      zoom: 12,
      bounds: { west: -3.2, east: -3, south: 53.3, north: 53.5 },
    })
  )
  await act(async () => vi.advanceTimersByTimeAsync(1000))
  const drawerCards = within(screen.getByRole("tablist", { name: "Inspect" }))
  fireEvent.click(drawerCards.getByRole("tab", { name: "Reach" }))
  expect(observed.map.selected.id).toBe("one")
  fireEvent.click(drawerCards.getByRole("tab", { name: "Population" }))
  expect(screen.getByRole("tabpanel", { name: "Population" })).toBeTruthy()
  expect(observed.map.selected.id).toBe("one")
  fireEvent.click(drawerCards.getByRole("tab", { name: "Reach" }))
  expect(screen.getByRole("tabpanel", { name: "Reach" })).toBeTruthy()
  expect(
    vi.mocked(fetch).mock.calls.filter(([url]) => url === "/api/atlas/reach")
  ).toHaveLength(1)
  expect(observed.fitBounds).toHaveBeenCalledWith(
    { west: -3.2, east: -3, south: 53.3, north: 53.5 },
    11
  )
})

it("keeps service Reach independent from record inspection and switches origin only on explicit request", async () => {
  vi.useFakeTimers()
  window.history.replaceState(
    null,
    "",
    "/en/map?lib=one&layers=pins,reach,population&reachScope=network&network=one"
  )
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (url.startsWith("/api/atlas/networks"))
        return Response.json({
          networks: [],
          countries: [],
          regions: [],
          next: null,
          selected: {
            documentId: "one",
            name: "Wirral",
            kind: "library_service",
            bounds: { west: -3.2, east: -3, south: 53.3, north: 53.5 },
            available: true,
            areaCodes: ["E08000015"],
            areaName: "Wirral",
            eligibleLibraries: 13,
            excludedLibraries: 0,
            countries: [],
          },
        })
      if (url === "/api/atlas/network-reach")
        return Response.json({
          schemaVersion: 1,
          state: "unsupported",
          networkId: "one",
          mode: "walking",
          areaCode: "E08000015",
        })

      if (url === "/api/public-proxy/api/libraries/atlas")
        return Response.json({
          type: "FeatureCollection",
          features: [
            {
              geometry: { type: "Point", coordinates: [-3.1, 53.4] },
              properties: {
                id: "one",
                slug: "one",
                name: "Fixture library",
                type: "Public",
                status: "open",
                operator: null,
                city: null,
                country: "United Kingdom",
                region: null,
                hours: null,
                access: [],
                services: [],
                notices: [],
              },
            },
          ],
        })
      if (url === "/api/atlas/reach")
        return Response.json({
          state: "unsupported",
          libraryId: "one",
          mode: "walking",
        })

      return Response.json({ type: "FeatureCollection", features: [] })
    })
  )
  render(<AtlasExplorer />)
  await act(async () => vi.advanceTimersByTimeAsync(1000))
  expect(
    vi
      .mocked(fetch)
      .mock.calls.filter(([url]) => url === "/api/atlas/network-reach")
  ).toHaveLength(0)
  await act(async () =>
    observed.map.onView({
      lat: 53.4,
      lng: -3.1,
      zoom: 12,
      bounds: { west: -3.2, east: -3, south: 53.3, north: 53.5 },
    })
  )
  fireEvent.click(screen.getByRole("tab", { name: "Reach" }))
  fireEvent.click(screen.getByRole("button", { name: "Calculate coverage" }))
  await act(async () => vi.advanceTimersByTimeAsync(1000))
  const calls = () =>
    vi
      .mocked(fetch)
      .mock.calls.filter(([url]) => url === "/api/atlas/network-reach").length
  const initialCalls = calls()
  expect(initialCalls).toBe(1)
  fireEvent.click(screen.getByRole("tab", { name: "Fixture library" }))
  fireEvent.click(screen.getByRole("button", { name: "Reach from here" }))
  expect(screen.getByText(/Reach is set to Wirral/)).toBeTruthy()
  fireEvent.click(screen.getByRole("button", { name: "Reach from here" }))
  expect(new URLSearchParams(window.location.search).get("reachScope")).toBe(
    "network"
  )
  fireEvent.click(screen.getByRole("button", { name: "Keep service" }))
  await act(async () => vi.advanceTimersByTimeAsync(500))
  expect(calls()).toBe(initialCalls)
  expect(new URLSearchParams(window.location.search).get("reachScope")).toBe(
    "network"
  )
  fireEvent.click(screen.getByRole("button", { name: "Reach from here" }))
  fireEvent.click(
    screen.getByRole("button", { name: "Switch to this library" })
  )
  await act(async () => vi.advanceTimersByTimeAsync(1000))
  expect(
    new URLSearchParams(window.location.search).get("reachScope")
  ).toBeNull()
  expect(screen.getByRole("tabpanel", { name: "Reach" })).toBeTruthy()
  expect(observed.map.selected.id).toBe("one")
  expect(calls()).toBe(initialCalls)
  const origins = vi
    .mocked(fetch)
    .mock.calls.filter(([url]) => url === "/api/atlas/reach")
  expect(origins).toHaveLength(1)
  expect(JSON.parse(String(origins[0]?.[1]?.body)).libraryId).toBe("one")
})

const selectionFixtureLibrary = (id: string) => ({
  id,
  slug: id,
  name: id,
  type: "Public",
  status: "open",
  operator: null,
  city: "Town",
  country: "United Kingdom",
  region: null,
  path: null,
  tz: "Europe/London",
  hours: null,
  founded: null,
  closed: null,
  events: false,
  catalogue: false,
  access: [],
  services: [],
  complete: 50,
  lat: 0,
  lng: 0,
})

it("shows a selection skeleton and ignores an older library response after another record is selected", async () => {
  vi.useFakeTimers()
  window.history.replaceState(null, "", "/en/map?lib=first&layers=pins")

  let finishFirst!: (response: Response) => void
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (url.startsWith("/api/atlas/library?")) {
        const key = new URL(url, "https://ui.test").searchParams.get("key")
        if (key === "first")
          return new Promise<Response>((resolve) => {
            finishFirst = resolve
          })

        return Response.json({ library: selectionFixtureLibrary("second") })
      }
      if (url === "/api/atlas/manifest")
        return Response.json({
          manifest: null,
          dictionary: { version: "test", entries: [] },
        })

      return Response.json({ error: "Unused fixture" }, { status: 503 })
    })
  )
  render(<AtlasExplorer scalable />)
  await act(async () => vi.advanceTimersByTimeAsync(500))
  expect(screen.getByRole("heading", { name: "Selected library" })).toBeTruthy()
  expect(
    within(screen.getByRole("tabpanel", { name: "Selected library" }))
      .getByRole("status")
      .getAttribute("aria-busy")
  ).toBe("true")
  await act(async () => {
    observed.map.onSelect("second")
    await vi.advanceTimersByTimeAsync(1000)
  })
  expect(screen.getByRole("heading", { name: "second" })).toBeTruthy()
  await act(async () => {
    finishFirst(Response.json({ library: selectionFixtureLibrary("first") }))
    await vi.advanceTimersByTimeAsync(500)
  })
  expect(screen.getByRole("heading", { name: "second" })).toBeTruthy()
  expect(screen.queryByRole("heading", { name: "first" })).toBeNull()
  expect(observed.map.selected.id).toBe("second")
})

it("closes the public accessibility preview without enabling its layer", async () => {
  vi.useFakeTimers()
  observed.plan = "public"
  window.history.replaceState(
    null,
    "",
    "/en/map?layers=pins&analysis=accessibility"
  )
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      Response.json({ type: "FeatureCollection", features: [] })
    )
  )
  render(<AtlasExplorer />)
  await act(async () => vi.advanceTimersByTimeAsync(1000))
  expect(screen.getByRole("heading", { name: "Accessibility" })).toBeTruthy()
  expect(observed.map.layers).toEqual(["pins"])
  fireEvent.click(screen.getByRole("button", { name: "Close Accessibility" }))
  expect(screen.queryByRole("region", { name: "Inspect" })).toBeNull()
  expect(observed.map.layers).toEqual(["pins"])
})
