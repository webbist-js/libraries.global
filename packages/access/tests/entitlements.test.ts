import { describe, expect, it } from "vitest"

import {
  API_REACH_PER_DAY,
  API_REACH_PER_HOUR,
  buildSessionAccess,
  can,
  CONTRIBUTOR_MIN_ACCEPTED,
  EXPLORER_FEATURES,
  has,
  isQualifyingContribution,
  isRecentlyActive,
  limitOf,
  recognitionOf,
  resolveEntitlements,
  SUPPORTER_MIN_ACCEPTED,
  type EntitlementInput,
  type SessionProfile,
} from "../src"

const NOW = new Date("2026-11-06T12:00:00Z")
const days = (n: number) =>
  new Date(NOW.getTime() + n * 86_400_000).toISOString()
const base = (over: Partial<EntitlementInput> = {}): EntitlementInput => ({
  signedIn: true,
  now: NOW,
  ...over,
})

describe("Explorer", () => {
  it("is public with nothing when signed out, whatever else is passed", () => {
    const e = resolveEntitlements({
      signedIn: false,
      now: NOW,
      acceptedContributions: 1000,
      apiAccounts: [{ role: "organiser", paidThrough: days(30) }],
    })
    expect(e.standing).toBe("public")
    expect(e.features.size).toBe(0)
    expect(Object.values(e.limits).every((n) => n === 0)).toBe(true)
  })

  it("gives every signed-in account the Explorer browse tools for free, without Reach", () => {
    const e = resolveEntitlements(base())
    expect(e.standing).toBe("explorer")
    expect([...e.facts]).toEqual(["explorer"])
    expect([...e.features].sort()).toEqual([...EXPLORER_FEATURES].sort())
    expect(can(e, "atlas.contextLayers")).toBe(true)
    expect(can(e, "index.export")).toBe(true)
    expect(can(e, "atlas.reach")).toBe(false)
    expect(can(e, "atlas.serviceReach")).toBe(false)
    expect(can(e, "api.key")).toBe(false)
    expect(limitOf(e, "exportRows")).toBe(10_000)
    expect(limitOf(e, "exportsPerDay")).toBe(20)
    expect(limitOf(e, "savedViews")).toBe(1000)
    expect(limitOf(e, "reachRunsPerWeek")).toBe(0)
    expect(limitOf(e, "analysisAreaMultiplier")).toBe(0)
  })
})

describe("earned recognition", () => {
  it("counts accepted contributions, not points", () => {
    expect(recognitionOf({ acceptedContributions: 0 })).toBe("none")
    expect(
      recognitionOf({ acceptedContributions: CONTRIBUTOR_MIN_ACCEPTED })
    ).toBe("contributor")
    expect(
      recognitionOf({ acceptedContributions: SUPPORTER_MIN_ACCEPTED - 1 })
    ).toBe("contributor")
    expect(
      recognitionOf({ acceptedContributions: SUPPORTER_MIN_ACCEPTED })
    ).toBe("supporter")
    expect(
      recognitionOf({ acceptedContributions: 500, recognitionRevoked: true })
    ).toBe("none")
    for (const bad of [-1, 1.5, Number.NaN, null, undefined])
      expect(recognitionOf({ acceptedContributions: bad as number })).toBe(
        "none"
      )
  })

  it("gives a Contributor two one-library Reach calculations a week and no service Reach", () => {
    const e = resolveEntitlements(base({ acceptedContributions: 1 }))
    expect(e.standing).toBe("contributor")
    expect(has(e, "contributor")).toBe(true)
    expect(can(e, "atlas.reach")).toBe(true)
    expect(can(e, "atlas.serviceReach")).toBe(false)
    expect(limitOf(e, "reachRunsPerWeek")).toBe(2)
    expect(limitOf(e, "analysisRunsPerHour")).toBe(0)
    expect(limitOf(e, "analysisServiceLibraries")).toBe(0)
  })

  it("Supporter is recognition only: no extra tools or quota", () => {
    const contributor = resolveEntitlements(base({ acceptedContributions: 1 }))
    const supporter = resolveEntitlements(base({ acceptedContributions: 100 }))
    expect(supporter.standing).toBe("supporter")
    expect(has(supporter, "supporter")).toBe(true)
    expect([...supporter.features]).toEqual([...contributor.features])
    expect(supporter.limits).toEqual(contributor.limits)
  })

  it("only counts substantive accepted actions", () => {
    expect(isQualifyingContribution("new_library_approved", 50)).toBe(true)
    expect(isQualifyingContribution("new_library_approved", 0)).toBe(false)
    expect(isQualifyingContribution("daily_streak", 5)).toBe(false)
    expect(isQualifyingContribution("admin_adjustment", 100)).toBe(false)
  })

  it("shows recent activity separately from recognition", () => {
    expect(isRecentlyActive(days(-29), NOW)).toBe(true)
    expect(isRecentlyActive(days(-31), NOW)).toBe(false)
    expect(isRecentlyActive(null, NOW)).toBe(false)
  })
})

describe("API customer browser bonus", () => {
  const covered = { role: "organiser" as const, paidThrough: days(10) }

  it("gives an API organiser the standard Reach allowance and key tools", () => {
    const e = resolveEntitlements(base({ apiAccounts: [covered] }))
    expect(has(e, "apiCustomer")).toBe(true)
    expect(can(e, "api.key")).toBe(true)
    expect(can(e, "atlas.serviceReach")).toBe(true)
    expect(limitOf(e, "analysisRunsPerHour")).toBe(API_REACH_PER_HOUR)
    expect(limitOf(e, "analysisRunsPerDay")).toBe(API_REACH_PER_DAY)
    expect(limitOf(e, "analysisServiceLibraries")).toBe(50)
    expect(limitOf(e, "analysisAreaMultiplier")).toBe(1)
    // Independent of recognition.
    expect(e.standing).toBe("explorer")
  })

  it("is not inherited by other members and ends with coverage", () => {
    for (const account of [
      { ...covered, role: "member" as const },
      { ...covered, paidThrough: days(-1) },
      { ...covered, paidThrough: null },
      { ...covered, revoked: true },
    ]) {
      const e = resolveEntitlements(base({ apiAccounts: [account] }))
      expect(has(e, "apiCustomer")).toBe(false)
      expect(can(e, "api.key")).toBe(false)
      expect(can(e, "atlas.reach")).toBe(false)
    }
  })

  it("keeps Contributor Reach alongside the API bonus", () => {
    const e = resolveEntitlements(
      base({ acceptedContributions: 3, apiAccounts: [covered] })
    )
    expect(limitOf(e, "reachRunsPerWeek")).toBe(2)
    expect(limitOf(e, "analysisRunsPerHour")).toBe(20)
  })
})

describe("session projection", () => {
  const profile = (over: Partial<SessionProfile> = {}): SessionProfile => ({
    staff: [],
    contributorRole: "reader",
    username: "reader",
    tier: null,
    claims: [],
    roleGrants: [],
    dismissedPrompts: [],
    teams: [],
    ...over,
  })

  it("projects standing, facts and API accounts", () => {
    const s = buildSessionAccess(
      profile({
        acceptedContributions: 120,
        lastContributionAt: days(-2),
        apiAccounts: [
          { teamId: "t1", role: "organiser", paidThrough: days(5) },
          { teamId: "t2", role: "member", paidThrough: days(-5) },
        ],
      }),
      NOW
    )
    expect(s.standing).toBe("supporter")
    expect(s.facts.sort()).toEqual(
      ["apiCustomer", "contributor", "explorer", "supporter"].sort()
    )
    expect(s.recentlyActive).toBe(true)
    expect(s.apiAccounts).toEqual([
      { teamId: "t1", role: "organiser", active: true },
      { teamId: "t2", role: "member", active: false },
    ])
  })

  it("a missing profile is an Explorer with no recognition", () => {
    const s = buildSessionAccess(null, NOW)
    expect(s.standing).toBe("explorer")
    expect(s.features).toContain("atlas.contextLayers")
    expect(s.features).not.toContain("atlas.reach")
  })
})
