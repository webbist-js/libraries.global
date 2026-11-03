import type {
  ExpressionSpecification,
  Map as MapLibreMap,
  PointLike,
} from "maplibre-gl"

import type { AtlasCountryGeometry } from "@/lib/atlas-countries"

import { INDIGO } from "./atlas-map.style"
import { releaseAtlasArchive, retainAtlasArchive } from "./atlas-pmtiles"

const SOURCE = "atlas-countries"
const HIT = "atlas-country-hit"
const TINT = "atlas-country-tint"
const OUTLINE = "atlas-country-outline"

/** Countries open from the map at world and continent zoom only. */
export const COUNTRY_CLICK_MAX_ZOOM = 5.5

/**
 * Country boundaries under the library layers: an invisible fill for
 * hit-testing at low zoom, and an outline plus faint tint for the hovered
 * and the open country (feature state keyed by iso3).
 */
export class AtlasCountryRenderer {
  private key = ""
  private archive: string | null = null
  private sourceLayer: string | undefined
  private hovered: string | null = null
  private selected: string | null = null

  constructor(private readonly map: MapLibreMap) {}

  update(geometry: AtlasCountryGeometry | null, selected: string | null) {
    if (!geometry) {
      this.destroy()

      return
    }
    const key = `${geometry.type}:${geometry.url}`
    if (key !== this.key) {
      this.destroy()
      this.add(geometry)
      this.key = key
    }
    this.setState(this.selected, { selected: false })
    this.selected = selected
    this.setState(selected, { selected: true })
  }

  /** The country under a point, when countries can be opened at this zoom. */
  countryAt(point: PointLike): string | null {
    if (!this.key || this.map.getZoom() > COUNTRY_CLICK_MAX_ZOOM) return null
    if (!this.map.getLayer(HIT)) return null
    const feature = this.map.queryRenderedFeatures(point, { layers: [HIT] })[0]
    const iso3 = feature?.properties?.iso3 ?? feature?.id

    return typeof iso3 === "string" && /^[A-Z]{3}$/.test(iso3) ? iso3 : null
  }

  hover(iso3: string | null) {
    if (iso3 === this.hovered) return
    this.setState(this.hovered, { hover: false })
    this.hovered = iso3
    this.setState(iso3, { hover: true })
  }

  destroy() {
    for (const layer of [OUTLINE, TINT, HIT])
      if (this.map.getLayer(layer)) this.map.removeLayer(layer)
    if (this.map.getSource(SOURCE)) this.map.removeSource(SOURCE)
    if (this.archive) releaseAtlasArchive(this.archive)
    this.archive = null
    this.key = ""
    this.hovered = null
  }

  private add(geometry: AtlasCountryGeometry) {
    if (geometry.type === "pmtiles") {
      retainAtlasArchive(geometry.url)
      this.archive = geometry.url
      this.sourceLayer = geometry.sourceLayer
      this.map.addSource(SOURCE, {
        type: "vector",
        url: `pmtiles://${geometry.url}`,
        promoteId: geometry.property,
      })
    } else {
      this.sourceLayer = undefined
      this.map.addSource(SOURCE, {
        type: "geojson",
        data: geometry.url,
        promoteId: geometry.property,
      })
    }
    const before = this.map
      .getStyle()
      .layers?.find(
        (layer) =>
          [
            "per-capita-fill",
            "atlas-reach-fill",
            "mobile-route-lines",
            "heat",
            "pins",
            "clusters",
          ].includes(layer.id) || layer.id.startsWith("scalable-")
      )?.id
    const sourceLayer = this.sourceLayer
      ? { "source-layer": this.sourceLayer }
      : {}
    const active: ExpressionSpecification = [
      "any",
      ["boolean", ["feature-state", "selected"], false],
      ["boolean", ["feature-state", "hover"], false],
    ]
    this.map.addLayer(
      {
        id: HIT,
        type: "fill",
        source: SOURCE,
        ...sourceLayer,
        maxzoom: COUNTRY_CLICK_MAX_ZOOM,
        paint: { "fill-color": "#000000", "fill-opacity": 0 },
      },
      before
    )
    this.map.addLayer(
      {
        id: TINT,
        type: "fill",
        source: SOURCE,
        ...sourceLayer,
        paint: {
          "fill-color": INDIGO,
          "fill-opacity": [
            "case",
            ["boolean", ["feature-state", "selected"], false],
            0.08,
            ["boolean", ["feature-state", "hover"], false],
            0.05,
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
          "line-color": INDIGO,
          "line-width": [
            "case",
            ["boolean", ["feature-state", "selected"], false],
            2,
            1.25,
          ],
          "line-opacity": ["case", active, 0.85, 0],
        },
      },
      before
    )
  }

  private setState(iso3: string | null, state: Record<string, boolean>) {
    if (!iso3 || !this.map.getSource(SOURCE)) return
    this.map.setFeatureState(
      {
        source: SOURCE,
        id: iso3,
        ...(this.sourceLayer ? { sourceLayer: this.sourceLayer } : {}),
      },
      state
    )
  }
}
