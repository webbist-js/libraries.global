import {
  atlasAccessColor,
  type AtlasLibraryAccessResponse,
  ATLAS_PER_CAPITA_NO_DATA,
  type AtlasPerCapitaResponse,
} from "@repo/shared-data"
import type { Map as MapLibreMap, PointLike } from "maplibre-gl"

import { releaseAtlasArchive, retainAtlasArchive } from "./atlas-pmtiles"

const SOURCE = "per-capita-countries"
const FILL = "per-capita-fill"
const OUTLINE = "per-capita-outline"
const HATCH = "library-access-hatching"
const PATTERN = "library-access-few-records"

/** Geometry stays immutable. Live filters change only country feature states. */
export class AtlasPerCapitaRenderer {
  private key = ""
  private archive: string | null = null
  private response: AtlasPerCapitaResponse | AtlasLibraryAccessResponse | null =
    null

  constructor(
    private readonly map: MapLibreMap,
    private readonly onSelect: (iso3: string) => void
  ) {}

  update(
    response: AtlasPerCapitaResponse | AtlasLibraryAccessResponse | null,
    opacity: number,
    selected: string | null
  ) {
    this.response = response
    if (!response) {
      for (const layer of [FILL, HATCH, OUTLINE])
        if (this.map.getLayer(layer))
          this.map.setLayoutProperty(layer, "visibility", "none")

      return
    }
    const { geometry } = response
    const property = "property" in geometry ? geometry.property : "iso3"
    const key = `${geometry.type}:${geometry.url}`
    if (key !== this.key) {
      this.destroy()
      this.response = response
      this.key = key
      if (geometry.type === "pmtiles") {
        retainAtlasArchive(geometry.url)
        this.archive = geometry.url
        this.map.addSource(SOURCE, {
          type: "vector",
          url: `pmtiles://${geometry.url}`,
          promoteId: property,
        })
      } else
        this.map.addSource(SOURCE, {
          type: "geojson",
          data: geometry.url,
          promoteId: property,
        })
      const before = this.map
        .getStyle()
        .layers?.find(
          (layer) =>
            ["mobile-route-lines", "heat", "pins", "clusters"].includes(
              layer.id
            ) || layer.id.startsWith("scalable-")
        )?.id
      if (!this.map.hasImage(PATTERN)) {
        const pixels = new Uint8Array(8 * 8 * 4)
        for (let y = 0; y < 8; y++)
          for (let x = 0; x < 8; x++) {
            const offset = (y * 8 + x) * 4
            pixels[offset] = 72
            pixels[offset + 1] = 56
            pixels[offset + 2] = 120
            pixels[offset + 3] = (x + y) % 8 < 2 ? 120 : 0
          }
        this.map.addImage(PATTERN, { width: 8, height: 8, data: pixels })
      }
      const sourceLayer =
        geometry.type === "pmtiles" ? { "source-layer": "countries" } : {}
      this.map.addLayer(
        {
          id: FILL,
          type: "fill",
          source: SOURCE,
          ...sourceLayer,
          paint: {
            "fill-color": [
              "coalesce",
              ["feature-state", "color"],
              ATLAS_PER_CAPITA_NO_DATA,
            ],
            "fill-opacity": opacity,
          },
        },
        before
      )
      this.map.addLayer(
        {
          id: HATCH,
          type: "fill",
          source: SOURCE,
          ...sourceLayer,
          paint: {
            "fill-pattern": PATTERN,
            "fill-opacity": [
              "case",
              ["boolean", ["feature-state", "fewRecords"], false],
              opacity,
              0,
            ],
          },
        },
        before
      )
      this.map.addLayer(
        {
          id: OUTLINE,
          type: "line",
          source: SOURCE,
          ...sourceLayer,
          paint: {
            "line-color": [
              "case",
              ["boolean", ["feature-state", "selected"], false],
              "#17162B",
              "#77726A",
            ],
            "line-width": [
              "case",
              ["boolean", ["feature-state", "selected"], false],
              2.5,
              0.7,
            ],
            "line-dasharray": [2, 1],
          },
        },
        before
      )
    }
    for (const country of "areas" in response
      ? response.areas
      : response.countries)
      this.map.setFeatureState(
        {
          source: SOURCE,
          id: "id" in country ? String(country.id) : country.iso3,
          ...(geometry.type === "pmtiles" ? { sourceLayer: "countries" } : {}),
        },
        {
          color: atlasAccessColor(country.per100k),
          fewRecords:
            country.status === "available" && country.indexedCount < 5,
          selected: ("id" in country ? country.id : country.iso3) === selected,
        }
      )
    this.map.setPaintProperty(FILL, "fill-opacity", opacity)
    this.map.setPaintProperty(HATCH, "fill-opacity", [
      "case",
      ["boolean", ["feature-state", "fewRecords"], false],
      opacity,
      0,
    ])
    for (const layer of [FILL, HATCH, OUTLINE])
      this.map.setLayoutProperty(layer, "visibility", "visible")
  }

  click(point: PointLike): boolean {
    if (!this.response || !this.map.getLayer(FILL)) return false
    const feature = this.map.queryRenderedFeatures(point, { layers: [FILL] })[0]
    const property =
      "property" in this.response.geometry
        ? this.response.geometry.property
        : "iso3"
    if (!feature?.properties[property]) return false
    this.onSelect(String(feature.properties[property]))

    return true
  }

  destroy() {
    for (const layer of [OUTLINE, HATCH, FILL])
      if (this.map.getLayer(layer)) this.map.removeLayer(layer)
    if (this.map.getSource(SOURCE)) this.map.removeSource(SOURCE)
    if (this.archive) releaseAtlasArchive(this.archive)
    this.archive = null
    this.key = ""
    this.response = null
    if (this.map.hasImage(PATTERN)) this.map.removeImage(PATTERN)
  }
}
