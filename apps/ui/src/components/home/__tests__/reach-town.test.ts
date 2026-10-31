import { describe, expect, it } from "vitest"

import {
  TOWN_NODES,
  TOWN_STREETS,
  townDistance,
  townReach,
  townWalkingDistances,
  townCatchmentContains,
  townCatchmentPath,
  townRiverCenter,
  WALK_UNITS_PER_MINUTE,
} from "@/components/home/reach-town"

describe("illustrative walking reach", () => {
  it("requires a bridge detour instead of crossing directly to the opposite bank", () => {
    const distance = townWalkingDistances().eastCentre!
    expect(distance).toBeGreaterThan(
      townDistance(TOWN_NODES.library!, TOWN_NODES.eastCentre!) * 1.4
    )
    expect(distance).toBeGreaterThan(5 * WALK_UNITS_PER_MINUTE)
    expect(
      TOWN_STREETS.filter((s) => {
        const a = TOWN_NODES[s.from]!,
          b = TOWN_NODES[s.to]!

        return (a.x < 410 && b.x > 410) || (b.x < 410 && a.x > 410)
      }).every((s) => s.bridge)
    ).toBe(true)
  })
  it("clips partial street segments exactly at the time budget", () => {
    const distances = townWalkingDistances(),
      budget = 5 * WALK_UNITS_PER_MINUTE
    const partial = townReach(5).filter(
      (s) => s.id.endsWith("-a") || s.id.endsWith("-b")
    )
    expect(partial.length).toBeGreaterThan(0)
    for (const segment of partial) {
      const street = TOWN_STREETS.find((s) =>
        segment.id.startsWith(s.id + "-")
      )!
      const origin = segment.id.endsWith("-a") ? street.from : street.to
      expect(
        distances[origin]! + townDistance(segment.from, segment.to)
      ).toBeCloseTo(budget, 6)
    }
    expect(townReach(0)).toHaveLength(0)
    const length = (minutes: number) =>
      townReach(minutes).reduce(
        (total, s) => total + townDistance(s.from, s.to),
        0
      )
    expect(length(5)).toBeLessThan(length(10))
    expect(length(10)).toBeLessThan(length(15))
  })
  it("fills a catchment surface over the town without painting an unbridged river crossing", () => {
    expect(townCatchmentContains(15, { x: 240, y: 230 })).toBe(true)
    expect(townCatchmentContains(15, { x: 410, y: 205 })).toBe(false)
    expect(townCatchmentPath(15)).toMatch(/^M.+Z$/)
    expect(townCatchmentPath(15)).not.toMatch(/NaN|Infinity/)
  })
  it("keeps the curved river clear while allowing the two bridges", () => {
    for (const y of [60, 160, 205, 250, 350]) {
      const x = townRiverCenter(y)
      for (const offset of [-12, 0, 12])
        expect(townCatchmentContains(15, { x: x + offset, y })).toBe(false)
    }
    expect(townCatchmentContains(15, { x: townRiverCenter(110), y: 110 })).toBe(
      true
    )
    expect(townCatchmentContains(15, { x: townRiverCenter(287), y: 287 })).toBe(
      true
    )
  })
  it("reaches along outer streets without swallowing the spaces beside them", () => {
    expect(townCatchmentContains(15, TOWN_NODES.c0!)).toBe(true)
    expect(townCatchmentContains(15, { x: -5, y: 270 })).toBe(false)
    expect(townCatchmentContains(15, { x: 240, y: 230 })).toBe(true)
    expect(townCatchmentContains(0, TOWN_NODES.library!)).toBe(false)
  })
})
