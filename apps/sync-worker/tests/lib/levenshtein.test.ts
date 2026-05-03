import { describe, it, expect } from "vitest"

import { normalisedDistance, isLikelyMatch } from "../../src/lib/levenshtein"

describe("normalisedDistance", () => {
  it("returns 0 for identical strings", () => {
    expect(
      normalisedDistance(
        "Manchester Central Library",
        "Manchester Central Library"
      )
    ).toBe(0)
  })

  it("returns 1 for completely different strings", () => {
    expect(normalisedDistance("abc", "xyz")).toBe(1)
  })

  it("returns < 0.1 for minor typo", () => {
    expect(
      normalisedDistance(
        "Manchester Central Library",
        "Manchester Central Librery"
      )
    ).toBeLessThan(0.1)
  })

  it("is case-insensitive", () => {
    expect(normalisedDistance("LEEDS CENTRAL", "Leeds Central")).toBe(0)
  })
})

describe("isLikelyMatch", () => {
  it("returns confident for distance <= 0.25", () => {
    expect(
      isLikelyMatch("Leeds Central Library", "Leeds Central Library")
    ).toBe("confident")
  })

  it("returns review for distance 0.25–0.40", () => {
    expect(isLikelyMatch("Leeds Library", "Leeds Central Library")).toBe(
      "review"
    )
  })

  it("returns none for distance > 0.40", () => {
    expect(isLikelyMatch("The Swan Pub", "Leeds Central Library")).toBe("none")
  })
})
