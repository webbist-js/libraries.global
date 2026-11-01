import { describe, expect, it } from "vitest"

import {
  can,
  EARNED_PRO_ACTIVITY_DAYS,
  EARNED_PRO_POINTS,
  hasEarnedPro,
  limitOf,
  resolveEntitlements,
  type EntitlementInput,
} from "../src"

const NOW = new Date("2026-10-01T12:00:00Z")
const days = (n: number) =>
  new Date(NOW.getTime() + n * 86_400_000).toISOString()
const base = (over: Partial<EntitlementInput> = {}): EntitlementInput => ({
  signedIn: true,
  now: NOW,
  ...over,
})

it("gives active Team seats larger Reach without buying staff authority", () => {
  const seat = {
    libraryDocumentIds: ["one"],
    expiresAt: days(1),
    status: "active" as const,
  }
  const active = resolveEntitlements(base({ teams: [seat] }))
  expect(active.plan).toBe("pro")
  expect(active.limits.analysisAreaMultiplier).toBe(2)
  expect(active.limits.analysisRunsPerHour).toBe(100)
  expect(can(active, "team.workspace")).toBe(false)
  for (const team of [
    { ...seat, status: "lapsed" as const },
    { ...seat, expiresAt: days(-1) },
  ]) {
    const expired = resolveEntitlements(
      base({ teams: [team], grants: [{ plan: "pro", expiresAt: null }] })
    )
    expect(expired.limits.analysisAreaMultiplier).toBe(1)
    expect(expired.limits.analysisRunsPerHour).toBe(20)
  }
})

describe("Supporter digital tools plan", () => {
  it("includes history and small exports, retains free community access and expires", () => {
    const ent = resolveEntitlements(
      base({ grants: [{ plan: "supporter", expiresAt: null }] })
    )
    expect(ent.plan).toBe("supporter")
    expect([...ent.features].sort()).toEqual([
      "atlas.export",
      "library.history",
    ])
    expect(can(ent, "atlas.analysis")).toBe(false)
    expect(ent.limits).toEqual({
      analysisRunsPerHour: 0,
      analysisAreaMultiplier: 0,
      savedViews: 3,
      savedSearches: 3,
      exportRows: 500,
    })
    expect(
      resolveEntitlements(
        base({ grants: [{ plan: "supporter", expiresAt: days(-1) }] })
      ).plan
    ).toBe("free")
  })

  it("recognizes paid Supporter and chooses Pro when it is also earned", () => {
    expect(
      resolveEntitlements(
        base({ subscription: { plan: "supporter", status: "active" } })
      ).plan
    ).toBe("supporter")
    expect(
      resolveEntitlements(
        base({
          grants: [{ plan: "supporter", expiresAt: null }],
          rewardsTier: "Archivist",
          rewardsPoints: 5000,
          earnedProUntil: days(30),
        })
      ).plan
    ).toBe("pro")
    expect(
      resolveEntitlements(
        base({
          subscription: {
            plan: "supporter",
            status: "canceled",
            periodEnd: days(1),
          },
        })
      ).plan
    ).toBe("supporter")
  })
})

describe("resolveEntitlements: plan baseline", () => {
  it("is public when signed out, whatever else is passed", () => {
    const e = resolveEntitlements(
      base({ signedIn: false, subscription: { plan: "pro", status: "active" } })
    )
    expect(e.plan).toBe("public")
    expect(e.source).toBe("none")
    expect(e.features.size).toBe(0)
  })

  it("is free when signed in with nothing else (the P-B session)", () => {
    const e = resolveEntitlements({ signedIn: true, now: NOW })
    expect(e).toMatchObject({ plan: "free", source: "none" })
    expect(e.features.size).toBe(0)
    expect(limitOf(e, "savedViews")).toBe(3)
  })
})

describe("resolveEntitlements: subscription status", () => {
  it.each([
    ["active", {}, "pro"],
    ["trialing", {}, "pro"],
    ["past_due", { pastDueSince: days(-6) }, "pro"],
    ["past_due", { pastDueSince: days(-8) }, "free"],
    ["past_due", {}, "free"],
    ["canceled", { periodEnd: days(3) }, "pro"],
    ["canceled", { periodEnd: days(-1) }, "free"],
    ["canceled", {}, "free"],
    ["incomplete", {}, "free"],
    ["unpaid", {}, "free"],
  ] as const)("%s %o resolves to %s", (status, extra, plan) => {
    const e = resolveEntitlements(
      base({ subscription: { plan: "pro", status, ...extra } })
    )
    expect(e.plan).toBe(plan)
    expect(e.source).toBe(plan === "pro" ? "paid" : "none")
  })

  it("ignores an unknown subscription plan", () => {
    expect(
      resolveEntitlements(
        base({ subscription: { plan: "platinum", status: "active" } })
      ).plan
    ).toBe("free")
  })
})

describe("resolveEntitlements: grants, verifications and earned Pro", () => {
  it("honours an unexpired grant and ignores an expired one", () => {
    expect(
      resolveEntitlements(
        base({ grants: [{ plan: "pro", expiresAt: days(1) }] })
      )
    ).toMatchObject({ plan: "pro", source: "grant" })
    expect(
      resolveEntitlements(base({ grants: [{ plan: "pro", expiresAt: null }] }))
        .plan
    ).toBe("pro")
    expect(
      resolveEntitlements(
        base({ grants: [{ plan: "pro", expiresAt: days(-1) }] })
      ).plan
    ).toBe("free")
  })

  it("a team grant outranks paid pro", () => {
    const e = resolveEntitlements(
      base({
        subscription: { plan: "pro", status: "active" },
        grants: [{ plan: "team", expiresAt: null }],
      })
    )
    expect(e).toMatchObject({ plan: "team", source: "grant" })
    expect(can(e, "team.workspace")).toBe(true)
  })

  it("ignores a grant with an unknown plan (fails closed to free)", () => {
    for (const plan of ["platinum", "PRO", "", "public", "free"]) {
      const e = resolveEntitlements(
        base({ grants: [{ plan, expiresAt: null }] })
      )
      expect(e).toMatchObject({ plan: "free", source: "none" })
      expect(e.features.size).toBe(0)
    }
  })

  it("an unexpired verification gives verified pro", () => {
    expect(
      resolveEntitlements(base({ verifications: [{ expiresAt: days(30) }] }))
    ).toMatchObject({ plan: "pro", source: "verified" })
    expect(
      resolveEntitlements(base({ verifications: [{ expiresAt: days(-1) }] }))
        .plan
    ).toBe("free")
  })

  it.each([
    [4999, days(30), "free"],
    [5000, days(30), "pro"],
    [9000, null, "free"],
    [5000, days(0), "free"],
    [5000, days(-1), "free"],
    [5000, "invalid", "free"],
  ] as const)(
    "%s points with expiry %s resolves to %s",
    (points, until, plan) => {
      expect(
        resolveEntitlements(
          base({
            rewardsTier: "Curator",
            rewardsPoints: points,
            earnedProUntil: until,
          })
        ).plan
      ).toBe(plan)
    }
  )

  it("prefers paid over grant over verified over earned at the same plan", () => {
    const all = {
      subscription: { plan: "pro", status: "active" },
      grants: [{ plan: "pro" as const, expiresAt: null }],
      verifications: [{ expiresAt: null }],
      rewardsTier: "Curator",
    }
    expect(resolveEntitlements(base(all)).source).toBe("paid")
    expect(
      resolveEntitlements(base({ ...all, subscription: null })).source
    ).toBe("grant")
    expect(
      resolveEntitlements(base({ ...all, subscription: null, grants: [] }))
        .source
    ).toBe("verified")
  })

  it("is deterministic for a fixed now", () => {
    const input = base({ subscription: { plan: "pro", status: "active" } })
    const a = resolveEntitlements(input)
    const b = resolveEntitlements(input)
    expect([...a.features]).toEqual([...b.features])
    expect(a.limits).toEqual(b.limits)
  })
})

describe("earned Pro policy", () => {
  it("requires 5,000 points and expires exactly 30 days after a contribution", () => {
    expect(EARNED_PRO_POINTS).toBe(5000)
    expect(EARNED_PRO_ACTIVITY_DAYS).toBe(30)
    const until = "2026-02-01T12:00:00Z"
    expect(
      hasEarnedPro(5000, until, new Date("2026-02-01T11:59:59.999Z"))
    ).toBe(true)
    expect(hasEarnedPro(5000, until, new Date(until))).toBe(false)
    expect(hasEarnedPro(Number.NaN, until, new Date("2026-01-01"))).toBe(false)
  })
})

describe("features", () => {
  it("free has none of the Pro features; pro has the atlas and index set", () => {
    const free = resolveEntitlements(base())
    const pro = resolveEntitlements(
      base({ subscription: { plan: "pro", status: "active" } })
    )
    expect(can(free, "atlas.contextLayers")).toBe(false)
    expect(can(pro, "atlas.contextLayers")).toBe(true)
    expect(can(pro, "index.export")).toBe(true)
    expect(can(pro, "team.workspace")).toBe(false)
  })
})

describe("library.history", () => {
  it("supporter, pro and team see field-by-field history; free and public don't", () => {
    const of = (plan: "supporter" | "pro" | "team") =>
      resolveEntitlements(base({ grants: [{ plan, expiresAt: null }] }))
    expect(can(of("pro"), "library.history")).toBe(true)
    expect(can(of("supporter"), "library.history")).toBe(true)
    expect(can(of("team"), "library.history")).toBe(true)
    expect(can(resolveEntitlements(base()), "library.history")).toBe(false)
    expect(
      can(resolveEntitlements(base({ signedIn: false })), "library.history")
    ).toBe(false)
  })
})
