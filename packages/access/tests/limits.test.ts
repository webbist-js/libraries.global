import { describe, expect, it } from "vitest"

import { contributionLimits } from "../src"

describe("contributionLimits", () => {
  it("scales with tier and never drops below the Reader floor", () => {
    const reader = contributionLimits("Reader")
    const curator = contributionLimits("Curator")
    expect(reader).toEqual({
      pendingSubmissions: 5,
      submissionsPerHour: 10,
      uploadsPerDay: 20,
    })
    expect(curator.pendingSubmissions).toBeGreaterThan(
      reader.pendingSubmissions
    )
    expect(contributionLimits(null)).toEqual(reader)
    expect(contributionLimits("Nonsense")).toEqual(reader)
  })
})
