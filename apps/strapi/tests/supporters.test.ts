import { afterEach, describe, expect, it, vi } from "vitest"

import { makeFakeStrapi } from "./helpers/fake-strapi"
import bridge from "../src/api/auth-bridge/controllers/auth-bridge"
import { readSupporters, supporterMark } from "../src/utils/supporters"

const PROFILE = "api::user-profile.user-profile"
const GRANT = "api::entitlement-grant.entitlement-grant"
const VERIFICATION = "api::pro-verification.pro-verification"
const MEMBER = "plugin::access.team-member"
const CONFIG = "api::site-config.site-config"
const now = new Date("2026-10-08T00:00:00Z")
const profile = (id: string, extra = {}) => ({
  documentId: `p-${id}`,
  baUserId: id,
  username: id,
  firstName: id,
  profileVisibility: "public",
  ...extra,
})
const grant = (id: string, extra = {}) => ({
  documentId: `g-${id}`,
  baUserId: id,
  plan: "supporter",
  expiresAt: null,
  createdAt: "2026-09-01T00:00:00Z",
  ...extra,
})

afterEach(() => {
  delete (globalThis as any).strapi
  vi.unstubAllEnvs()
})

describe("supporter directory", () => {
  it("deduplicates active plans, includes earned/verified Pro and Team seats, and removes expired access", async () => {
    const { strapi } = makeFakeStrapi({
      [PROFILE]: [
        profile("supporter"),
        profile("pro"),
        profile("team"),
        profile("earned", {
          tier: "Scholar",
          points: 5000,
          earnedProUntil: "2026-11-01",
        }),
        profile("hold", { points: 5000, earnedProUntil: "2026-11-01" }),
        profile("verified"),
        profile("seat"),
        profile("expired"),
        profile("lapsed"),
        profile("removed"),
        profile("free"),
      ],
      [GRANT]: [
        grant("supporter"),
        grant("pro", { plan: "pro" }),
        grant("team", { plan: "team" }),
        grant("pro", { documentId: "duplicate", plan: "team" }),
        grant("expired", { expiresAt: "2026-10-01" }),
      ],
      [VERIFICATION]: [
        { documentId: "v", baUserId: "verified", expiresAt: null },
      ],
      [MEMBER]: [
        {
          documentId: "m",
          baUserId: "seat",
          status: "active",
          team: { status: "active", expiresAt: null },
        },
        {
          documentId: "l",
          baUserId: "lapsed",
          status: "active",
          team: { status: "lapsed", expiresAt: null },
        },
        {
          documentId: "r",
          baUserId: "removed",
          status: "removed",
          team: { status: "active", expiresAt: null },
        },
      ],
    })
    const result = await readSupporters(strapi, {}, now)
    expect(result.total).toBe(7)
    expect(result.entries.map((p) => p.username).sort()).toEqual([
      "earned",
      "hold",
      "pro",
      "seat",
      "supporter",
      "team",
      "verified",
    ])
  })

  it("filters privacy before search and aggregates; serializes only public fields", async () => {
    const { strapi } = makeFakeStrapi({
      [PROFILE]: [
        profile("public", { city: "Leeds", country: "GB" }),
        profile("private", {
          profileVisibility: "private",
          city: "Secretown",
          country: "CA",
        }),
        profile("limited", { profileVisibility: "limited" }),
        profile("out", { supporterListed: false }),
        profile("quiet", {
          city: "Hiddenville",
          country: "US",
          publicPrefs: { showLocation: false },
          supporterBadgeVisible: false,
        }),
      ],
      [GRANT]: ["public", "private", "limited", "out", "quiet"].map((id) =>
        grant(id)
      ),
    })
    const result = await readSupporters(strapi, {}, now)
    expect(result.total).toBe(5)
    expect(result.listed).toBe(2)
    expect(result.unlisted).toBe(3)
    expect(result.countries).toEqual(["GB"])
    expect(result.entries.find((p) => p.username === "quiet")).toMatchObject({
      city: null,
      country: null,
    })
    const serialized = JSON.stringify(result)
    for (const secret of [
      "Secretown",
      "Hiddenville",
      "baUserId",
      "supporterListed",
      "supporterBadgeVisible",
      "plan",
    ])
      expect(serialized).not.toContain(secret)
    expect(
      (await readSupporters(strapi, { q: "Secretown" }, now)).matched
    ).toBe(0)
    expect((await readSupporters(strapi, { country: "US" }, now)).matched).toBe(
      0
    )
    expect((await readSupporters(strapi, { q: "leeds" }, now)).matched).toBe(1)
  })

  it("paginates beyond internal batches, sorts deterministically and bounds the requested page", async () => {
    const ids = Array.from(
      { length: 505 },
      (_, i) => `user${String(i).padStart(3, "0")}`
    )
    const { strapi } = makeFakeStrapi({
      [PROFILE]: ids.map((id, i) => profile(id, { id: i })),
      [GRANT]: ids.map((id, i) => grant(id, { id: i })),
    })
    const result = await readSupporters(
      strapi,
      { page: "999", sort: "name" },
      now
    )
    expect(result.total).toBe(505)
    expect(result.page).toBe(22)
    expect(result.entries).toHaveLength(1)
    expect(result.entries[0]?.username).toBe("user504")
    expect((await readSupporters(strapi, { page: "-1" }, now)).page).toBe(1)
  })

  it("does not invent costs or income, and reads real dated figures from Site config", async () => {
    const { strapi, store } = makeFakeStrapi()
    expect((await readSupporters(strapi, {}, now)).costs).toBeNull()
    store[CONFIG] = [
      {
        documentId: "config",
        costMonth: "2026-10-01",
        monthlyRunningCosts: "200.50",
        costCurrency: "GBP",
        costBreakdown: "Hosting and maps",
      },
    ]
    expect((await readSupporters(strapi, {}, now)).costs).toEqual({
      month: "2026-10-01",
      currency: "GBP",
      runningCosts: 200.5,
      supportIncome: null,
      breakdown: "Hosting and maps",
    })
  })

  it("filters continent pills using public locations and shows only public new members this month", async () => {
    const ids = ["europe", "america", "asia", "hidden", "out", "future"]
    const { strapi } = makeFakeStrapi({
      [PROFILE]: [
        profile("europe", { country: "GB" }),
        profile("america", { country: "BR" }),
        profile("asia", { country: "JP" }),
        profile("hidden", {
          country: "GB",
          publicPrefs: { showLocation: false },
        }),
        profile("out", { supporterListed: false, country: "GB" }),
        profile("future", { country: "GB" }),
      ],
      [GRANT]: ids.map((id) =>
        grant(id, {
          createdAt:
            id === "future" ? "2026-10-20T00:00:00Z" : "2026-10-01T00:00:00Z",
        })
      ),
    })
    const europe = await readSupporters(strapi, { region: "europe" }, now)
    expect(europe.entries.map((p) => p.username).sort()).toEqual([
      "europe",
      "future",
    ])
    expect(europe.newThisMonth.map((p) => p.username)).toEqual(["europe"])
    expect(
      (await readSupporters(strapi, { region: "americas" }, now)).entries.map(
        (p) => p.username
      )
    ).toEqual(["america"])
    expect(
      (await readSupporters(strapi, { q: "Brazil" }, now)).entries.map(
        (p) => p.username
      )
    ).toEqual(["america"])
    const all = await readSupporters(strapi, {}, now)
    expect(all.newThisMonth.map((p) => p.username)).not.toContain("out")
    expect(
      all.newThisMonth.find((p) => p.username === "hidden")?.country
    ).toBeNull()
  })

  it("resolves the profile mark separately from directory listing and removes it at expiry", async () => {
    const p = profile("one", { supporterListed: false })
    const { strapi, store } = makeFakeStrapi({
      [PROFILE]: [p],
      [GRANT]: [grant("one")],
    })
    expect(await supporterMark(strapi, p)).toBe(true)
    expect(
      await supporterMark(strapi, { ...p, supporterBadgeVisible: false })
    ).toBe(false)
    store[GRANT]![0]!.expiresAt = "2000-01-01"
    expect(await supporterMark(strapi, p)).toBe(false)
  })
})

describe("supporter preference writes", () => {
  async function save(
    extra: Record<string, unknown>,
    fields: Record<string, unknown>
  ) {
    const { strapi, store } = makeFakeStrapi({
      [PROFILE]: [profile("one", extra)],
    })
    ;(globalThis as any).strapi = { ...strapi, query: strapi.db.query }
    vi.stubEnv("STRAPI_BRIDGE_SECRET", "supporter-test-secret")
    const ctx: any = {
      request: {
        header: { "x-service-secret": "supporter-test-secret" },
        body: { baUserId: "one", ...fields },
      },
      send: (body: unknown) => {
        ctx.body = body
        ctx.status = 200
      },
      badRequest: () => {
        ctx.status = 400
      },
    }
    await bridge.upsertProfile(ctx)

    return { ctx, profile: store[PROFILE]![0]! }
  }

  it("opts private/limited profiles out and keeps them out after returning to public", async () => {
    const first = await save(
      { supporterListed: true },
      { profileVisibility: "private", supporterListed: true }
    )
    expect(first.profile.supporterListed).toBe(false)
    const second = await save(
      { profileVisibility: "private", supporterListed: false },
      { profileVisibility: "public" }
    )
    expect(second.profile.supporterListed).toBe(false)
  })

  it("updates the two choices independently and rejects non-boolean values", async () => {
    const valid = await save(
      { supporterListed: true, supporterBadgeVisible: true },
      { supporterBadgeVisible: false }
    )
    expect(valid.profile.supporterListed).toBe(true)
    expect(valid.profile.supporterBadgeVisible).toBe(false)
    expect((await save({}, { supporterListed: "true" })).ctx.status).toBe(400)
  })
})
