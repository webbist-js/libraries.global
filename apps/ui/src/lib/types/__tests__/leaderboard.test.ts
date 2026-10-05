import { describe, expect, it } from "vitest"

import { entryPlace, type LeaderboardEntry } from "../leaderboard"

function entry(overrides: Partial<LeaderboardEntry> = {}): LeaderboardEntry {
  return {
    rank: 1,
    username: "alex",
    firstName: null,
    lastName: null,
    country: null,
    city: null,
    avatarUrl: null,
    contributorRole: null,
    periodPoints: 0,
    totalPoints: 0,
    tier: "Reader",
    approvedCount: 0,
    acceptanceRate: null,
    ...overrides,
  }
}

describe("entryPlace", () => {
  it("joins city and country", () => {
    expect(
      entryPlace(entry({ city: "Bristol", country: "United Kingdom" }))
    ).toBe("Bristol, United Kingdom")
  })

  it("falls back to country alone", () => {
    expect(entryPlace(entry({ city: null, country: "United Kingdom" }))).toBe(
      "United Kingdom"
    )
  })

  it("returns null with neither", () => {
    expect(entryPlace(entry({ city: null, country: null }))).toBeNull()
  })

  it("ignores a city with no country", () => {
    expect(entryPlace(entry({ city: "Bristol", country: null }))).toBeNull()
  })
})
