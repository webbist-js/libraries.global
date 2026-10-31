import { readFileSync } from "node:fs"
import path from "node:path"

import { describe, expect, it } from "vitest"

import { DARK_MAP_PALETTE as map } from "@/lib/map-appearance"

const css = readFileSync(path.resolve("src/styles/globals.css"), "utf8")
const luminance = (hex: string) =>
  hex
    .match(/[a-f0-9]{2}/gi)!
    .map((v) => Number.parseInt(v, 16) / 255)
    .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
    .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i]!, 0)

function contrast(a: string, b: string) {
  const x = luminance(a),
    y = luminance(b)

  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
}
const token = (block: string, name: string) => {
  const value = new RegExp(`--t-${name}: (#[a-f0-9]{6})`, "i").exec(block)?.[1]
  if (!value) throw new Error(`Missing ${name}`)

  return value
}

for (const [appearance, selector] of [
  ["light", ":root"],
  ["dark", ".dark"],
] as const) {
  const block = css.slice(css.indexOf(`${selector} {`)).split("}")[0]!
  describe(`${appearance} core contrast roles`, () => {
    for (const surface of ["bg-void", "bg-deep", "bg-surface"]) {
      it(`has readable primary, secondary, link and placeholder ink on ${surface}`, () => {
        for (const ink of ["ink-base", "ink-dim", "ink-low", "accent-primary"])
          expect(
            contrast(token(block, ink), token(block, surface)),
            `${ink} on ${surface}`
          ).toBeGreaterThanOrEqual(4.5)
      })
      it(`has visible control boundaries on ${surface}`, () =>
        expect(
          contrast(token(block, "control-border"), token(block, surface))
        ).toBeGreaterThanOrEqual(3))
    }
    it("has readable white text on solid actions", () => {
      for (const action of [
        "action-primary",
        "action-primary-hover",
        "action-danger",
      ])
        expect(
          contrast("#ffffff", token(block, action)),
          action
        ).toBeGreaterThanOrEqual(4.5)
    })
  })
}

it("keeps dark map counts readable and cluster boundaries visible over geography", () => {
  expect(contrast(map.clusterText, map.cluster)).toBeGreaterThanOrEqual(4.5)
  for (const surface of [map.cluster, map.land, map.water, map.park])
    expect(contrast(map.clusterStroke, surface)).toBeGreaterThanOrEqual(3)
  expect(contrast(map.boundary, map.land)).toBeGreaterThanOrEqual(3)
})
