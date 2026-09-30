import { describe, expect, it } from "vitest"

import { clampInt } from "../../src/plugins/rewards/server/utils/query"

const opts = { def: 20, min: 1, max: 100 }

describe("clampInt", () => {
  it("parses a numeric string within bounds", () => {
    expect(clampInt("50", opts)).toBe(50)
    expect(clampInt(7, opts)).toBe(7)
  })

  it("returns the default for non-numeric input", () => {
    expect(clampInt("abc", opts)).toBe(20)
    expect(clampInt(undefined, opts)).toBe(20)
    expect(clampInt(null, opts)).toBe(20)
    expect(clampInt("", opts)).toBe(20)
    expect(clampInt(Number.NaN, opts)).toBe(20)
  })

  it("returns the default for arrays and objects", () => {
    expect(clampInt(["5"], opts)).toBe(20)
    expect(clampInt({ limit: 5 }, opts)).toBe(20)
  })

  it("clamps below min and above max", () => {
    expect(clampInt(-1, opts)).toBe(1)
    expect(clampInt("0", opts)).toBe(1)
    expect(clampInt(1e9, opts)).toBe(100)
    expect(clampInt("1e9", opts)).toBe(100)
    expect(clampInt(Number.POSITIVE_INFINITY, opts)).toBe(100)
  })

  it("truncates fractions", () => {
    expect(clampInt("3.9", opts)).toBe(3)
  })
})
