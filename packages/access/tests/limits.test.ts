import { describe, expect, it } from "vitest"

import { contributionLimits } from "../src"

describe("contributionLimits", () => {
  it("scales with tier and never drops below the Reader floor", () => {
    const reader = contributionLimits("Reader", null)
    const curator = contributionLimits("Curator", null)
    expect(reader).toEqual({
      pendingSubmissions: 5,
      submissionsPerHour: 10,
      uploadsPerDay: 20,
    })
    expect(curator.pendingSubmissions).toBeGreaterThan(
      reader.pendingSubmissions
    )
    expect(contributionLimits(null, null)).toEqual(reader)
    expect(contributionLimits("Nonsense", null)).toEqual(reader)
  })
})

describe("contributionLimits for editorial staff", () => {
  it("gives editor roles Curator quotas regardless of tier", () => {
    const curator = contributionLimits("Curator", null)
    expect(contributionLimits("Reader", "wiki_editor")).toEqual(curator)
    expect(contributionLimits(null, "editorial_board")).toEqual(curator)
  })

  it("leaves non-editor roles on their tier quotas", () => {
    expect(contributionLimits("Reader", "verified_librarian")).toEqual(
      contributionLimits("Reader", null)
    )
  })
})
