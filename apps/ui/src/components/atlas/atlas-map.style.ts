// MapLibre style pieces for the Atlas Explorer: pin images, colour ramps and
// layer paint. Canvas and MapLibre paint can't read CSS variables, so the hex
// values below mirror the design tokens in styles/globals.css.

import type { ExpressionSpecification } from "maplibre-gl"

import type { TypeGroupKey } from "./atlas.logic"

export const INK = "#17162B"
export const INDIGO = "#4338CA"
export const OK = "#2F5D3A"
export const MUTED = "#8A8799"
// Blue and amber have distinct hue and luminance; filled vs hollow adds a
// second encoding for colour-vision differences and monochrome displays.
export const ACCESS_MATCH = "#0072B2"
export const ACCESS_GAP = "#9C5700"

/** Keep accessibility counts legible and their borders consistent with pins. */
export function accessibilityClusterStyle(
  totalProperty: string,
  matchesProperty: string,
  compare: boolean
) {
  const total: ExpressionSpecification = ["get", totalProperty]
  const matches: ExpressionSpecification = ["get", matchesProperty]
  const confirmed: ExpressionSpecification = ["==", matches, total]
  const hasMatches: ExpressionSpecification = [">", matches, 0]
  const label: ExpressionSpecification = compare
    ? ["concat", ["to-string", matches], "/", ["to-string", total]]
    : ["to-string", total]
  const size: ExpressionSpecification = [
    "step",
    total,
    compare ? 23 : 15,
    10,
    compare ? 27 : 18,
    100,
    compare ? 32 : 22,
    1000,
    compare ? 38 : 27,
  ]
  // Long confirmed/total labels need more room than a single count.
  const radius: ExpressionSpecification = compare
    ? ["max", size, ["+", 9, ["*", 3.75, ["length", label]]]]
    : size

  return {
    circle: {
      "circle-radius": radius,
      "circle-color": [
        "case",
        confirmed,
        ACCESS_MATCH,
        "#fff",
      ] as ExpressionSpecification,
      "circle-stroke-color": [
        "case",
        confirmed,
        "#fff",
        hasMatches,
        ACCESS_MATCH,
        ACCESS_GAP,
      ] as ExpressionSpecification,
      "circle-stroke-width": 2,
    },
    halo: {
      "circle-radius": ["+", radius, 3] as ExpressionSpecification,
      "circle-color": "rgba(0,0,0,0)",
      "circle-stroke-color": [
        "case",
        hasMatches,
        "rgba(0,114,178,.18)",
        "rgba(156,87,0,.14)",
      ] as ExpressionSpecification,
      "circle-stroke-width": 4,
      "circle-blur": 0.35,
    },
    text: {
      "text-color": [
        "case",
        confirmed,
        "#fff",
        hasMatches,
        ACCESS_MATCH,
        ACCESS_GAP,
      ] as ExpressionSpecification,
    },
    label,
  }
}

export const BUS_ICON_PATH =
  "M5 17V6a2 2 0 012-2h10a2 2 0 012 2v11M5 11h14M5 17h14M7 17v3M17 17v3M8 14h.01M16 14h.01"

/** Foreground of each type tint (TYPE_TINT fg). */
export const TYPE_COLOR: Record<TypeGroupKey, string> = {
  public: "#2F5D3A",
  mobile: "#2F5D3A",
  academic: "#28496E",
  national: "#4A3F8C",
  special: "#8A3F22",
  monastic: "#8A3F22",
  other: "#55536A",
}

/** Shape carries the type as well as colour (never colour alone). */
export const TYPE_SHAPE: Record<
  TypeGroupKey,
  "circle" | "square" | "diamond" | "ring" | "bus"
> = {
  public: "circle",
  mobile: "bus",
  academic: "square",
  national: "diamond",
  special: "ring",
  monastic: "ring",
  other: "circle",
}

// Brand indigo: from the active-chip tint to the primary and hover accents.
// Increasing darkness carries magnitude without introducing extra hues.
const INDIGO_RAMP = [
  "#ECEBFB",
  "#C2BEEC",
  "#9991DF",
  "#6E65D5",
  INDIGO,
  "#3730A3",
] as const

/** Shared scale for continuous density and stepped record completeness. */
export const RAMP = {
  seq: INDIGO_RAMP,
  heat: INDIGO_RAMP,
} as const

const PIN_PX = 14
const RATIO = 2

/** Draws one pin as ImageData for map.addImage. */
function drawPin(
  shape: (typeof TYPE_SHAPE)[TypeGroupKey],
  color: string,
  size: number
) {
  const pad = 3
  const s = (size + pad * 2) * RATIO
  const canvas = document.createElement("canvas")
  canvas.width = s
  canvas.height = s
  const ctx = canvas.getContext("2d")!
  ctx.scale(RATIO, RATIO)
  const c = size / 2 + pad
  const r = size / 2

  const path = () => {
    ctx.beginPath()
    if (shape === "square" || shape === "bus")
      ctx.roundRect(c - r, c - r, size, size, 3)
    else if (shape === "diamond") {
      const d = r * 1.15
      ctx.moveTo(c, c - d)
      ctx.lineTo(c + d, c)
      ctx.lineTo(c, c + d)
      ctx.lineTo(c - d, c)
      ctx.closePath()
    } else ctx.arc(c, c, r, 0, Math.PI * 2)
  }

  // Hairline dark outline so white-bordered pins read on any fill.
  path()
  ctx.lineWidth = 4
  ctx.strokeStyle = "rgba(23,22,43,.25)"
  ctx.stroke()
  path()
  if (shape === "ring" || shape === "bus") {
    ctx.fillStyle = "#fff"
    ctx.fill()
    ctx.lineWidth = shape === "bus" ? 2 : 4
    ctx.strokeStyle = color
    ctx.stroke()
  } else {
    ctx.fillStyle = color
    ctx.fill()
    ctx.lineWidth = 2
    ctx.strokeStyle = "#fff"
    ctx.stroke()
  }
  if (shape === "bus") {
    ctx.save()
    ctx.translate(pad + 2, pad + 2)
    ctx.scale((size - 4) / 24, (size - 4) / 24)
    ctx.lineWidth = 2
    ctx.lineCap = "round"
    ctx.lineJoin = "round"
    ctx.strokeStyle = color
    ctx.stroke(new Path2D(BUS_ICON_PATH))
    ctx.restore()
  }

  return ctx.getImageData(0, 0, s, s)
}

function drawClosed(size: number) {
  const pad = 3
  const s = (size + pad * 2) * RATIO
  const canvas = document.createElement("canvas")
  canvas.width = s
  canvas.height = s
  const ctx = canvas.getContext("2d")!
  ctx.scale(RATIO, RATIO)
  const c = size / 2 + pad
  ctx.beginPath()
  ctx.arc(c, c, size / 2, 0, Math.PI * 2)
  ctx.fillStyle = "#fff"
  ctx.fill()
  ctx.lineWidth = 1.5
  ctx.strokeStyle = "#A13A1A"
  ctx.stroke()
  const k = size / 4.5
  ctx.beginPath()
  ctx.moveTo(c - k, c - k)
  ctx.lineTo(c + k, c + k)
  ctx.moveTo(c + k, c - k)
  ctx.lineTo(c - k, c + k)
  ctx.lineWidth = 2
  ctx.stroke()

  return ctx.getImageData(0, 0, s, s)
}

export interface ImageSink {
  hasImage: (id: string) => boolean
  addImage: (
    id: string,
    image: ImageData,
    options: { pixelRatio: number }
  ) => void
}

export function addPinImages(map: ImageSink): void {
  for (const key of Object.keys(TYPE_COLOR) as TypeGroupKey[]) {
    const id = `pin-${key}`
    if (!map.hasImage(id))
      map.addImage(
        id,
        drawPin(
          TYPE_SHAPE[key],
          TYPE_COLOR[key],
          key === "mobile" ? 20 : PIN_PX
        ),
        {
          pixelRatio: RATIO,
        }
      )
    if (!map.hasImage(`${id}-sel`))
      map.addImage(
        `${id}-sel`,
        drawPin(TYPE_SHAPE[key], TYPE_COLOR[key], key === "mobile" ? 24 : 18),
        {
          pixelRatio: RATIO,
        }
      )
  }
  if (!map.hasImage("pin-closed"))
    map.addImage("pin-closed", drawClosed(PIN_PX), { pixelRatio: RATIO })
  if (!map.hasImage("pin-access-match"))
    map.addImage("pin-access-match", drawPin("circle", ACCESS_MATCH, PIN_PX), {
      pixelRatio: RATIO,
    })
  if (!map.hasImage("pin-access-gap"))
    map.addImage("pin-access-gap", drawPin("ring", ACCESS_GAP, PIN_PX), {
      pixelRatio: RATIO,
    })
}

/** Fade from the ramp's first hue at zero density, keeping the basemap clear. */
export function heatColor(ramp: readonly [string, ...string[]]): unknown[] {
  const stops: unknown[] = [
    "interpolate",
    ["linear"],
    ["heatmap-density"],
    0,
    `${ramp[0]}00`,
  ]
  ramp.forEach((c, i) => stops.push((i + 1) / ramp.length, c))

  return stops
}

/** Same zoom handover for complete points, tiles and bounded density grids. */
export function heatmapPaint(
  opacity: number,
  weight: unknown = 1,
  grid = false
): Record<string, unknown> {
  const radius = grid
    ? [
        "interpolate",
        ["exponential", 2],
        ["zoom"],
        ...(
          [
            [0, 6],
            [4, 14],
            [6, 18],
            [8, 25],
            [11, 34],
          ] as const
        ).flatMap(([zoom, size]) => [
          zoom,
          [
            "max",
            size,
            ["*", 2 ** zoom, ["coalesce", ["get", "cellPixels"], 0]],
          ],
        ]),
      ]
    : ["interpolate", ["linear"], ["zoom"], 0, 6, 6, 18, 11, 34]

  return {
    "heatmap-weight": weight,
    "heatmap-radius": radius,
    "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 0, 0.6, 9, 1.6],
    "heatmap-color": heatColor(RAMP.heat),
    "heatmap-opacity": [
      "interpolate",
      ["linear"],
      ["zoom"],
      5,
      opacity,
      9,
      opacity * 0.5,
      12,
      0,
    ],
  }
}

/** Step ramp for completeness 0–100. */
export function completenessColor(property = "complete"): unknown[] {
  const s = RAMP.seq

  return [
    "case",
    ["==", ["get", property], null],
    "#777777",
    [
      "step",
      ["coalesce", ["get", property], 0],
      s[1],
      25,
      s[2],
      50,
      s[3],
      75,
      s[4],
      90,
      s[5],
    ],
  ]
}
