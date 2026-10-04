import { describe, expect, it } from "vitest"

import {
  coordIsValid,
  formatCoord,
  isLatitude,
  isLongitude,
  parseCoordinatePair,
  readCoord,
} from "../coordinates"

describe("readCoord", () => {
  it("reads plain decimal degrees", () => {
    expect(readCoord(" 51.5297 ")).toBe(51.5297)
    expect(readCoord("-0.1271")).toBe(-0.1271)
    expect(readCoord("+12")).toBe(12)
    expect(readCoord(".5")).toBe(0.5)
  })

  it("is NaN for anything else", () => {
    for (const text of [
      "",
      "abc",
      "51,5297",
      "51.5297N",
      "1e3",
      "--1",
      "1.2.3",
    ])
      expect(readCoord(text)).toBeNaN()
  })
})

describe("isLatitude / isLongitude", () => {
  it("bounds latitude to ±90 and longitude to ±180", () => {
    expect(isLatitude(90)).toBe(true)
    expect(isLatitude(-90.0001)).toBe(false)
    expect(isLongitude(-180)).toBe(true)
    expect(isLongitude(180.5)).toBe(false)
    expect(isLatitude(Number.NaN)).toBe(false)
  })
})

describe("formatCoord", () => {
  it("keeps six decimal places and drops trailing zeros", () => {
    expect(formatCoord(51.5299119)).toBe("51.529912")
    expect(formatCoord(-0.12)).toBe("-0.12")
    expect(formatCoord(-0.0000001)).toBe("0")
  })
})

describe("coordIsValid", () => {
  it("accepts a blank box or a number in range", () => {
    expect(coordIsValid("lat", "  ")).toBe(true)
    expect(coordIsValid("lat", "53.83")).toBe(true)
    expect(coordIsValid("lng", "179.9")).toBe(true)
  })

  it("rejects text and numbers out of range", () => {
    expect(coordIsValid("lat", "91")).toBe(false)
    expect(coordIsValid("lng", "-181")).toBe(false)
    expect(coordIsValid("lat", "north")).toBe(false)
  })
})

describe("parseCoordinatePair", () => {
  it.each([
    "51.5297, -0.1271",
    "51.5297,-0.1271",
    "51.5297 -0.1271",
    "(51.5297, -0.1271)",
    "  51.5297 ,  -0.1271  ",
  ])("splits %j", (text) => {
    expect(parseCoordinatePair(text)).toEqual({ lat: 51.5297, lng: -0.1271 })
  })

  it.each(["51.5297", "51.5, -0.1, 3", "91, 0", "0, 181", "51.5297, west", ""])(
    "ignores %j",
    (text) => {
      expect(parseCoordinatePair(text)).toBeNull()
    }
  )
})
