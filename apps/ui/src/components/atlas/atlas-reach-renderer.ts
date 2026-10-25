import type { AtlasReachResult } from "@repo/shared-data"
import type { GeoJSONSource, Map as MapLibreMap } from "maplibre-gl"

const SOURCE = "atlas-reach"
const FILL = "atlas-reach-fill"
const LINE = "atlas-reach-line"

/** One bounded selected-library polygon. Never inject national catchments. */
export class AtlasReachRenderer {
  private displayedContour: AtlasReachResult["contours"][number] | null = null

  constructor(private readonly map: MapLibreMap) {}
  update(
    result: AtlasReachResult | null,
    minutes: number,
    opacity: number,
    context = false
  ) {
    const contour = result?.contours.find(
      (contour) => contour.minutes === minutes
    )
    if (!contour || ("empty" in contour && contour.empty)) {
      this.destroy()

      return
    }
    const data = {
      type: "FeatureCollection" as const,
      features: [
        {
          type: "Feature" as const,
          properties: {},
          geometry: contour.geometry,
        },
      ],
    }
    const source = this.map.getSource(SOURCE) as GeoJSONSource | undefined
    if (!source) this.map.addSource(SOURCE, { type: "geojson", data })
    else if (this.displayedContour !== contour) source.setData(data)
    this.displayedContour = contour
    const before = this.map
      .getStyle()
      .layers?.find(
        (layer) => layer.type === "circle" || layer.type === "symbol"
      )?.id
    if (!this.map.getLayer(FILL))
      this.map.addLayer(
        {
          id: FILL,
          type: "fill",
          source: SOURCE,
          paint: { "fill-color": "#6D5BD0", "fill-opacity": opacity * 0.45 },
        },
        before
      )
    if (!this.map.getLayer(LINE))
      this.map.addLayer(
        {
          id: LINE,
          type: "line",
          source: SOURCE,
          paint: {
            "line-color": "#5B43B0",
            "line-width": 2,
            "line-opacity": opacity,
          },
        },
        before
      )
    const gaps = result && "displayGaps" in result && result.displayGaps
    this.map.setPaintProperty(FILL, "fill-color", gaps ? "#B45309" : "#6D5BD0")
    this.map.setPaintProperty(LINE, "line-color", gaps ? "#92400E" : "#5B43B0")
    this.map.setPaintProperty(
      FILL,
      "fill-opacity",
      opacity * (context ? 0.08 : 0.45)
    )
    this.map.setPaintProperty(LINE, "line-opacity", opacity)
  }

  destroy() {
    this.displayedContour = null
    for (const layer of [LINE, FILL])
      if (this.map.getLayer(layer)) this.map.removeLayer(layer)
    if (this.map.getSource(SOURCE)) this.map.removeSource(SOURCE)
  }
}
