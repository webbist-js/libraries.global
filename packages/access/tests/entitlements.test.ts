import { describe, expect, it } from "vitest"

import {
  can,
  EARNED_PRO_HOLD_DAYS,
  isEarnedProTier,
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
    ["Cartographer", null, "free"],
    ["Archivist", null, "pro"],
    ["Curator", null, "pro"],
    ["Cartographer", days(10), "pro"],
    ["Cartographer", days(-1), "free"],
  ] as const)("tier %s with hold %s resolves to %s", (tier, hold, plan) => {
    const e = resolveEntitlements(
      base({ rewardsTier: tier, earnedProUntil: hold })
    )
    expect(e.plan).toBe(plan)
    if (plan === "pro") expect(e.source).toBe("earned")
  })

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

describe("isEarnedProTier", () => {
  it("is true from Archivist up and false below or unknown", () => {
    expect(isEarnedProTier("Archivist")).toBe(true)
    expect(isEarnedProTier("Scholar")).toBe(true)
    expect(isEarnedProTier("Curator")).toBe(true)
    expect(isEarnedProTier("Cartographer")).toBe(false)
    expect(isEarnedProTier(null)).toBe(false)
    expect(isEarnedProTier("archivist")).toBe(false)
  })
  it("holds for 90 days", () => {
    expect(EARNED_PRO_HOLD_DAYS).toBe(90)
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
