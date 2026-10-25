import type { Map as MapLibreMap } from "maplibre-gl"

import { contextTileUrl, type AtlasContextRelease } from "@/lib/atlas-context"

const SOURCE = "atlas-context"
const LAYER = "atlas-context-raster"

/** One bounded tile source beneath catchments and location markers. */
export class AtlasContextRenderer {
  private key = ""
  constructor(private readonly map: MapLibreMap) {}
  update(release: AtlasContextRelease | null, opacity: number) {
    if (!release) {
      this.destroy()

      return
    }
    if (this.key !== release.id) {
      this.destroy()
      this.key = release.id
      const b = release.bounds
      this.map.addSource(SOURCE, {
        type: "raster",
        tiles: [contextTileUrl(release)],
        tileSize: 256,
        maxzoom: 14,
        bounds: [b.west, b.south, b.east, b.north],
        attribution: release.attribution,
      })
      const before = this.map
        .getStyle()
        .layers?.find(
          (layer) =>
            [
              "atlas-reach-fill",
              "mobile-route-lines",
              "heat",
              "pins",
              "clusters",
            ].includes(layer.id) || layer.id.startsWith("scalable-")
        )?.id
      this.map.addLayer(
        {
          id: LAYER,
          type: "raster",
          source: SOURCE,
          paint: {
            "raster-opacity": opacity,
            "raster-resampling":
              release.theme === "deprivation" ? "nearest" : "linear",
            "raster-fade-duration": 100,
          },
        },
        before
      )
    }
    this.map.setPaintProperty(LAYER, "raster-opacity", opacity)
  }

  destroy() {
    if (this.map.getLayer(LAYER)) this.map.removeLayer(LAYER)
    if (this.map.getSource(SOURCE)) this.map.removeSource(SOURCE)
    this.key = ""
  }
}
