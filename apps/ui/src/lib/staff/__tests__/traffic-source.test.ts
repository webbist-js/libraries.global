import { describe, expect, it } from "vitest"

import { parseTrafficRange } from "../traffic-source"

describe("parseTrafficRange", () => {
  it("accepts 7, 30 and 90 (first of a list) and falls back to 30", () => {
    expect(parseTrafficRange("7")).toBe(7)
    expect(parseTrafficRange(["90", "7"])).toBe(90)
    expect(parseTrafficRange("15")).toBe(30)
    expect(parseTrafficRange(undefined)).toBe(30)
    expect(parseTrafficRange("x")).toBe(30)
  })
})
