import {
  atlasPopulationBaseline,
  atlasLocalGeography,
  atlasAccessColor,
  atlasPeoplePerLibrary,
  atlasPerCapitaCountry,
  atlasPerCapitaSummary,
  emptyAtlasFilters,
  type AtlasPerCapitaResponse,
  type AtlasLibraryAccessResponse,
} from "@repo/shared-data"
import { createElement } from "react"
import { createRoot } from "react-dom/client"

import { AtlasPerCapitaRenderer } from "../../../../apps/ui/src/components/atlas/atlas-per-capita-renderer"
import { atlasProtocol } from "../../../../apps/ui/src/components/atlas/atlas-pmtiles"
import { AtlasPerCapitaControls } from "../../../../apps/ui/src/components/atlas/AtlasPerCapita"

const lib = (globalThis as any).maplibregl
let map: any, renderer: AtlasPerCapitaRenderer
const root = createRoot(document.querySelector("#panel")!)
const { countries: baselineCountries, ...baseline } = atlasPopulationBaseline
const countries = baselineCountries.map((country) =>
  atlasPerCapitaCountry(
    {
      ...country,
      population:
        country.iso3 === "GBR"
          ? 69281000
          : country.iso3 === "USA"
            ? 340000000
            : 1000000,
    },
    country.iso3 === "GBR" ? 6000 : country.iso3 === "USA" ? 16000 : 0,
    country.iso3 === "GBR" ? 6000 : country.iso3 === "USA" ? 16000 : 0
  )
)
const response: AtlasPerCapitaResponse = {
  schemaVersion: 1,
  dictionaryVersion: "fixture",
  fingerprint: "fixture",
  queryEpoch: "fixture",
  indexedThrough: "1",
  evaluatedAt: "2026-10-09T12:00:00Z",
  scope: {
    filters: emptyAtlasFilters(),
    accessibility: { enabled: false, selected: [], view: "matches" },
  },
  baseline,
  countries,
  geometry: { type: "geojson", url: baseline.geometryUrl },
  exactTotal: 22000,
  unmappedLibraries: 0,
  summary: atlasPerCapitaSummary(countries),
}
function controls(selected: string) {
  root.render(
    createElement(AtlasPerCapitaControls, {
      metric: "per100k",
      onMetric: () => {},
      level: "countries",
      onLevel: () => {},
      resolvedLevel: "countries",
      types: [],
      onTypes: () => {},
      onAnalysis: () => controls(selected),
      opacity: 0.65,
      onOpacity: () => {},
    })
  )
}
function idle() {
  return new Promise<void>((resolve) => map.once("idle", resolve))
}
;(globalThis as any).atlasPerCapitaSmoke = {
  async start() {
    lib.addProtocol("pmtiles", atlasProtocol.tile)
    map = new lib.Map({
      container: "map",
      preserveDrawingBuffer: true,
      style: {
        version: 8,
        sources: {},
        layers: [
          {
            id: "background",
            type: "background",
            paint: { "background-color": "#F3F1EC" },
          },
        ],
      },
      center: [15, 25],
      zoom: 1.6,
    })
    await new Promise((resolve) => map.once("load", resolve))
    map.addSource("mobile-routes", {
      type: "geojson",
      data: {
        type: "Feature",
        properties: {},
        geometry: {
          type: "LineString",
          coordinates: [
            [-4, 50],
            [2, 54],
          ],
        },
      },
    })
    map.addLayer({
      id: "mobile-route-lines",
      type: "line",
      source: "mobile-routes",
      paint: { "line-color": "#C64A30", "line-width": 3 },
    })
    map.on("error", (event: any) =>
      (globalThis as any).atlasRendererErrors.push(event.error.message)
    )
    renderer = new AtlasPerCapitaRenderer(map, controls)
    controls("GBR")
  },
  async step(tiles: boolean) {
    const ready = idle()
    renderer.update(
      {
        ...response,
        geometry: tiles
          ? { type: "pmtiles", url: `${location.origin}/countries.pmtiles` }
          : response.geometry,
      },
      0.65,
      "GBR"
    )
    await ready
    const features = map.queryRenderedFeatures({ layers: ["per-capita-fill"] })
    const uk = features.find(
      (feature: any) => feature.properties.iso3 === "GBR"
    )
    if (!uk) throw new Error("UK country was not rendered")
    const state = map.getFeatureState({
      source: "per-capita-countries",
      ...(tiles ? { sourceLayer: "countries" } : {}),
      id: "GBR",
    })
    if (
      state.color !==
        atlasAccessColor(
          countries.find((area) => area.iso3 === "GBR")!.per100k
        ) ||
      !state.selected
    )
      throw new Error("Country feature states did not apply")
    const france = map.getFeatureState({
      source: "per-capita-countries",
      ...(tiles ? { sourceLayer: "countries" } : {}),
      id: "FRA",
    })
    if (france.color !== atlasAccessColor(null))
      throw new Error("An unindexed country was represented as zero")
    const order = map.getStyle().layers.map((layer: any) => layer.id)
    if (order.indexOf("per-capita-fill") > order.indexOf("mobile-route-lines"))
      throw new Error("Country shading obscures an existing map overlay")

    return {
      renderedCountries: new Set(features.map((f: any) => f.properties.iso3))
        .size,
      sources: Object.keys(map.getStyle().sources).length,
    }
  },
  async local() {
    const areas = atlasLocalGeography.areas.map((area) => {
      const rate = atlasPerCapitaCountry(
        {
          iso3: area.code,
          iso2: "GB",
          name: area.name,
          population: 100000,
          featureId: null,
          bounds: area.bounds,
        },
        area.code === "E08000035" ? 10 : 3,
        area.code === "E08000035" ? 10 : 3
      )

      return {
        ...rate,
        id: area.code,
        country: "GBR",
        level: "local" as const,
        populationYear: 2024,
        populationSource: "Synthetic fixture",
        populationSourceUrl: "https://example.com",
        populationLicence: "Fixture",
        populationRetrievedAt: response.evaluatedAt,
        peoplePerLibrary: atlasPeoplePerLibrary(
          rate.libraryCount,
          rate.population
        ),
      }
    })
    const local: AtlasLibraryAccessResponse = {
      ...response,
      level: "local",
      areas,
      coverage: { countries: ["GBR"], note: "Synthetic fixture" },
      baseline: {
        ...baseline,
        version: atlasLocalGeography.version,
        geometryUrl: atlasLocalGeography.geometryUrl,
      },
      geometry: {
        type: "geojson",
        url: atlasLocalGeography.geometryUrl,
        property: "code",
      },
    }
    const ready = idle()
    renderer.update(local, 0.85, "E08000035")
    map.jumpTo({ center: [-1.5, 54], zoom: 5 })
    await ready
    const features = map.queryRenderedFeatures({ layers: ["per-capita-fill"] })
    if (
      !features.some((feature: any) => feature.properties.code === "E08000035")
    )
      throw new Error("Local area was not rendered")
    const state = map.getFeatureState({
      source: "per-capita-countries",
      id: "E08000035",
    })
    if (state.color !== atlasAccessColor(10) || !state.selected)
      throw new Error("Local feature states did not apply")
    const sparse = map.getFeatureState({
      source: "per-capita-countries",
      id: "E08000019",
    })
    if (!sparse.fewRecords || !map.hasImage("library-access-few-records"))
      throw new Error("Sparse local records were not hatched")

    return {
      renderedAreas: new Set(
        features.map((feature: any) => feature.properties.code)
      ).size,
      sources: Object.keys(map.getStyle().sources).length,
    }
  },
  finish() {
    renderer.destroy()
    if (map.hasImage("library-access-few-records"))
      throw new Error("Analysis pattern was not released")
    root.unmount()
    map.removeLayer("mobile-route-lines")
    map.removeSource("mobile-routes")
    const remaining = Object.keys(map.getStyle().sources).length
    map.remove()

    return remaining
  },
}
