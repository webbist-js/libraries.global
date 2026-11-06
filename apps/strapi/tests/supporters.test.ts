import { afterEach, describe, expect, it, vi } from "vitest"

import { makeFakeStrapi } from "./helpers/fake-strapi"
import bridge from "../src/api/auth-bridge/controllers/auth-bridge"
import { readSupporters, supporterMark } from "../src/utils/supporters"

const PROFILE = "api::user-profile.user-profile"
const CONFIG = "api::site-config.site-config"
let nextId = 1
/** A Supporter by default: 100 accepted contributions, not revoked. */
const profile = (id: string, extra = {}) => ({
  id: nextId++,
  documentId: `p-${id}`,
  baUserId: id,
  username: id,
  firstName: id,
  profileVisibility: "public",
  acceptedContributions: 100,
  recognitionRevokedAt: null,
  createdAt: "2026-09-01T00:00:00Z",
  ...extra,
})

afterEach(() => {
  delete (globalThis as any).strapi
  vi.unstubAllEnvs()
})

const joined = (id: string) => ({
  createdAt: id === "future" ? "2026-10-20T00:00:00Z" : "2026-10-01T00:00:00Z",
})

describe("supporter directory", () => {
  it("lists earned Supporters only: 100 accepted contributions, never points, plans or revoked recognition", async () => {
    const { strapi } = makeFakeStrapi({
      [PROFILE]: [
        profile("hundred"),
        profile("many", { acceptedContributions: 250 }),
        profile("almost", { acceptedContributions: 99, points: 90000 }),
        profile("revoked", { recognitionRevokedAt: "2026-10-01T00:00:00Z" }),
        profile("free", { acceptedContributions: 0 }),
      ],
    })
    const result = await readSupporters(strapi, {})
    expect(result.total).toBe(2)
    expect(result.entries.map((p) => p.username).sort()).toEqual([
      "hundred",
      "many",
    ])
    expect(result.entries[0]).not.toHaveProperty("since")
    expect(result).not.toHaveProperty("newThisMonth")
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
    })
    const result = await readSupporters(strapi, {})
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
    expect((await readSupporters(strapi, { q: "Secretown" })).matched).toBe(0)
    expect((await readSupporters(strapi, { country: "US" })).matched).toBe(0)
    expect((await readSupporters(strapi, { q: "leeds" })).matched).toBe(1)
  })

  it("paginates beyond internal batches, sorts deterministically and bounds the requested page", async () => {
    const ids = Array.from(
      { length: 505 },
      (_, i) => `user${String(i).padStart(3, "0")}`
    )
    const { strapi } = makeFakeStrapi({
      [PROFILE]: ids.map((id, i) => profile(id, { id: i + 1 })),
    })
    const result = await readSupporters(strapi, { page: "999", sort: "name" })
    expect(result.total).toBe(505)
    expect(result.page).toBe(22)
    expect(result.entries).toHaveLength(1)
    expect(result.entries[0]?.username).toBe("user504")
    expect((await readSupporters(strapi, { page: "-1" })).page).toBe(1)
  })

  it("does not invent costs or income, and reads real dated figures from Site config", async () => {
    const { strapi, store } = makeFakeStrapi()
    expect((await readSupporters(strapi, {})).costs).toBeNull()
    store[CONFIG] = [
      {
        documentId: "config",
        costMonth: "2026-10-01",
        monthlyRunningCosts: "200.50",
        costCurrency: "GBP",
        costBreakdown: "Hosting and maps",
      },
    ]
    expect((await readSupporters(strapi, {})).costs).toEqual({
      month: "2026-10-01",
      currency: "GBP",
      runningCosts: 200.5,
      supportIncome: null,
      breakdown: "Hosting and maps",
    })
  })

  it("filters continent pills using public locations and shows only public new members this month", async () => {
    const { strapi } = makeFakeStrapi({
      [PROFILE]: [
        profile("europe", { country: "GB", ...joined("europe") }),
        profile("america", { country: "BR", ...joined("america") }),
        profile("asia", { country: "JP", ...joined("asia") }),
        profile("hidden", {
          country: "GB",
          publicPrefs: { showLocation: false },
          ...joined("hidden"),
        }),
        profile("out", {
          supporterListed: false,
          country: "GB",
          ...joined("out"),
        }),
        profile("future", { country: "GB", ...joined("future") }),
      ],
    })
    const europe = await readSupporters(strapi, { region: "europe" })
    expect(europe.entries.map((p) => p.username).sort()).toEqual([
      "europe",
      "future",
    ])
    expect(
      (await readSupporters(strapi, { region: "americas" })).entries.map(
        (p) => p.username
      )
    ).toEqual(["america"])
    expect(
      (await readSupporters(strapi, { q: "Brazil" })).entries.map(
        (p) => p.username
      )
    ).toEqual(["america"])
    const all = await readSupporters(strapi, {})
    expect(all.entries.map((p) => p.username)).not.toContain("out")
    expect(all.entries.find((p) => p.username === "hidden")?.country).toBeNull()
  })

  it("resolves the profile mark separately from directory listing and removes it on revocation", async () => {
    const p = profile("one", { supporterListed: false })
    const { strapi, store } = makeFakeStrapi({ [PROFILE]: [p] })
    expect(await supporterMark(strapi, p)).toBe(true)
    expect(
      await supporterMark(strapi, { ...p, supporterBadgeVisible: false })
    ).toBe(false)
    store[PROFILE]![0]!.recognitionRevokedAt = "2026-10-01T00:00:00Z"
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
