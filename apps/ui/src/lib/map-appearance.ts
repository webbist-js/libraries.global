import type { LayerSpecification, Map as MapLibreMap } from "maplibre-gl"

/** Cartographic colours stay quieter than the surrounding interface and data. */
export const DARK_MAP_PALETTE = {
  land: "#343641",
  water: "#171f2c",
  park: "#2d443d",
  residential: "#393b46",
  building: "#454854",
  road: "#73798b",
  minorRoad: "#525968",
  roadCasing: "#292d39",
  boundary: "#858798",
  label: "#e0e1e9",
  halo: "#292d39",
  cluster: "#363349",
  clusterStroke: "#b8b2ee",
  clusterText: "#f3f1fa",
} as const

export const NEUTRAL_CLUSTER_METADATA = { "lg:neutral-cluster": true }

function darkBasemapColor(id: string, type: string, property: string) {
  const p = DARK_MAP_PALETTE
  if (/halo/.test(property)) return p.halo
  if (type === "symbol") return p.label
  if (/water|ocean|river/.test(id)) return p.water
  if (/park|wood|vegetation|grass|landcover/.test(id)) return p.park
  if (/residential/.test(id)) return p.residential
  if (/road|bridge|tunnel|transport|rail|aeroway/.test(id))
    return /cas(e|ing)/.test(id)
      ? p.roadCasing
      : /pri|trunk|mot/.test(id)
        ? p.road
        : p.minorRoad
  if (/boundary|admin/.test(id)) return p.boundary
  if (/building/.test(id)) return p.building

  return type === "line" ? p.minorRoad : p.land
}

const CLUSTER_PAINT = {
  "circle-color": ["#fff", DARK_MAP_PALETTE.cluster],
  "circle-stroke-color": ["#4338ca", DARK_MAP_PALETTE.clusterStroke],
  "text-color": ["#17162b", DARK_MAP_PALETTE.clusterText],
}

function updateNeutralCluster(
  map: MapLibreMap,
  layer: LayerSpecification,
  dark: boolean
) {
  if (
    !(layer.metadata as Record<string, unknown> | undefined)?.[
      "lg:neutral-cluster"
    ] ||
    !("paint" in layer)
  )
    return
  for (const [property, pair] of Object.entries(CLUSTER_PAINT)) {
    const value = (layer.paint as Record<string, unknown>)?.[property]
    if (typeof value !== "string") continue
    const normalized = value.toLowerCase()
    if (!pair.includes(normalized)) continue
    const next = pair[dark ? 1 : 0]
    if (normalized !== next)
      map.setPaintProperty(
        layer.id,
        property as Parameters<MapLibreMap["setPaintProperty"]>[1],
        next as never
      )
  }
}

const ROUTE_COLOURS = new Map([
  ["#2f5d3a", "route"],
  ["#8ad5ae", "route"],
  ["#3730a3", "coarse"],
  ["#b8b2ff", "coarse"],
])

function updateRoutePaint(
  map: MapLibreMap,
  layer: LayerSpecification,
  overlayPaint: Map<string, Map<string, string>>
) {
  if (!("paint" in layer)) return
  for (const [property, value] of Object.entries(layer.paint ?? {})) {
    if (!property.endsWith("-color") || typeof value !== "string") continue
    let colors = overlayPaint.get(layer.id)
    const role = colors?.get(property) ?? ROUTE_COLOURS.get(value.toLowerCase())
    if (!role) continue
    if (!colors) {
      colors = new Map()
      overlayPaint.set(layer.id, colors)
    }
    colors.set(property, role)
    map.setPaintProperty(
      layer.id,
      property as Parameters<MapLibreMap["setPaintProperty"]>[1],
      mapAppearanceColor(`var(--t-map-${role})`)
    )
  }
}

/** Retint the original basemap in place. Never replace a style: app sources,
 * selection, camera, credits and overlays must survive an appearance change. */
export function bindMapAppearance(map: MapLibreMap) {
  type Paint = Record<string, unknown>
  const originals = new Map<string, { type: string; paint: Paint }>()
  let captured = false
  let disposed = false
  let overlayUpdateQueued = false
  const overlayPaint = new Map<string, Map<string, string>>()
  // Explicitly marked neutral clusters can change with appearance. Expressions
  // encoding accessibility or other data retain their original colours.
  const updateClusters = () => {
    if (disposed) return
    const dark = document.documentElement.classList.contains("dark")
    for (const layer of map.getStyle().layers ?? [])
      updateNeutralCluster(map, layer, dark)
  }

  const clustersChanged = () => {
    if (overlayUpdateQueued || disposed) return
    overlayUpdateQueued = true
    queueMicrotask(() => {
      overlayUpdateQueued = false
      updateClusters()
    })
  }
  const update = () => {
    if (disposed || !captured) return
    const dark = document.documentElement.classList.contains("dark")
    for (const [id, original] of originals) {
      if (!map.getLayer(id)) continue
      const properties = Object.keys(original.paint).filter((key) =>
        key.endsWith("-color")
      )
      // Background has an optional paint block in the style specification.
      if (
        original.type === "background" &&
        !properties.includes("background-color")
      )
        properties.push("background-color")
      for (const property of properties) {
        let value: unknown = original.paint[property] ?? null
        if (dark) value = darkBasemapColor(id, original.type, property)
        map.setPaintProperty(
          id,
          property as Parameters<MapLibreMap["setPaintProperty"]>[1],
          value as never
        )
      }
    }
    updateClusters()
    // Application route hues keep their meaning but gain contrast on deep land.
    for (const layer of map.getStyle().layers ?? []) {
      if (originals.has(layer.id) || !("paint" in layer)) continue
      updateRoutePaint(map, layer, overlayPaint)
    }
  }

  const capture = () => {
    if (!captured) {
      for (const layer of map.getStyle().layers ?? []) {
        if (layer.type === "raster") continue
        originals.set(layer.id, {
          type: layer.type,
          paint: structuredClone(
            ("paint" in layer ? layer.paint : {}) ?? {}
          ) as Paint,
        })
      }
      captured = true
    }
    update()
  }
  const loaded = () => queueMicrotask(update)
  map.on("load", loaded)
  map.on("style.load", capture)
  map.on("styledata", clustersChanged)
  if (map.isStyleLoaded()) capture()
  const observer = new MutationObserver(update)
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  })

  return () => {
    disposed = true
    observer.disconnect()
    map.off("load", loaded)
    map.off("style.load", capture)
    map.off("styledata", clustersChanged)
  }
}

/** Canvas and MapLibre paint need resolved colours, rather than CSS var strings. */
export function mapAppearanceColor(value: string): string {
  const name = /^var\((--[^)]+)\)$/.exec(value)?.[1]

  return name
    ? getComputedStyle(document.documentElement)
        .getPropertyValue(name)
        .trim() || (name === "--t-map-route" ? "#2f5d3a" : "#3730a3")
    : value
}
