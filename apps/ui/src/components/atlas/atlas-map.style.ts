// MapLibre style pieces for the Atlas Explorer: pin images, colour ramps and
// layer paint. Canvas and MapLibre paint can't read CSS variables, so the hex
// values below mirror the design tokens in styles/globals.css.

import type { TypeGroupKey } from "./atlas.logic"

export const INK = "#17162B"
export const INDIGO = "#4338CA"
export const OK = "#2F5D3A"
export const MUTED = "#8A8799"

/** Foreground of each type tint (TYPE_TINT fg). */
export const TYPE_COLOR: Record<TypeGroupKey, string> = {
  public: "#2F5D3A",
  academic: "#28496E",
  national: "#4A3F8C",
  special: "#8A3F22",
  monastic: "#8A3F22",
  other: "#55536A",
}

/** Shape carries the type as well as colour (never colour alone). */
export const TYPE_SHAPE: Record<
  TypeGroupKey,
  "circle" | "square" | "diamond" | "ring"
> = {
  public: "circle",
  academic: "square",
  national: "diamond",
  special: "ring",
  monastic: "ring",
  other: "circle",
}

/** Colour-blind-safe ramps from the design's data-viz sheet. */
export const RAMP = {
  seq: ["#F1EEF8", "#D6D0EE", "#ADA2DC", "#7E6EC4", "#4F3DA3", "#2E2170"],
  heat: ["#FDF0C2", "#F9CB85", "#EF9355", "#D25F34", "#9E3719"],
}

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
    if (shape === "square") ctx.roundRect(c - r, c - r, size, size, 3)
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
  if (shape === "ring") {
    ctx.fillStyle = "#fff"
    ctx.fill()
    ctx.lineWidth = 4
    ctx.strokeStyle = color
    ctx.stroke()
  } else {
    ctx.fillStyle = color
    ctx.fill()
    ctx.lineWidth = 2
    ctx.strokeStyle = "#fff"
    ctx.stroke()
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
      map.addImage(id, drawPin(TYPE_SHAPE[key], TYPE_COLOR[key], PIN_PX), {
        pixelRatio: RATIO,
      })
    if (!map.hasImage(`${id}-sel`))
      map.addImage(`${id}-sel`, drawPin(TYPE_SHAPE[key], TYPE_COLOR[key], 18), {
        pixelRatio: RATIO,
      })
  }
  if (!map.hasImage("pin-closed"))
    map.addImage("pin-closed", drawClosed(PIN_PX), { pixelRatio: RATIO })
}

/** Heatmap colour ramp: transparent at zero, then the design's heat steps. */
export function heatColor(ramp: string[]): unknown[] {
  const stops: unknown[] = [
    "interpolate",
    ["linear"],
    ["heatmap-density"],
    0,
    "rgba(253,240,194,0)",
  ]
  ramp.forEach((c, i) => stops.push((i + 1) / ramp.length, c))

  return stops
}

/** Step ramp for completeness 0–100. */
export function completenessColor(): unknown[] {
  const s = RAMP.seq

  return [
    "step",
    ["get", "complete"],
    s[1],
    25,
    s[2],
    50,
    s[3],
    75,
    s[4],
    90,
    s[5],
  ]
}
