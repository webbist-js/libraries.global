import { afterEach, describe, expect, it, vi } from "vitest"

import {
  fetchLeaderboard,
  fetchStanding,
  parsePeriod,
  PERIOD_PHRASE,
} from "../leaderboard-server"

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe("parsePeriod", () => {
  it("keeps a known period", () => {
    expect(parsePeriod("week")).toBe("week")
    expect(parsePeriod("all")).toBe("all")
  })

  it("defaults to this month", () => {
    expect(parsePeriod(undefined)).toBe("month")
    expect(parsePeriod("decade")).toBe("month")
  })
})

describe("fetchLeaderboard", () => {
  it("asks Strapi for the period and limit", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({ data: [{ rank: 1 }] }, { status: 200 })
    )
    vi.stubGlobal("fetch", fetchMock)

    const entries = await fetchLeaderboard("week", 5)

    expect(entries).toEqual([{ rank: 1 }])
    expect(String((fetchMock.mock.calls as unknown[][])[0]?.[0])).toContain(
      "/api/rewards/leaderboard?period=week&limit=5"
    )
  })

  it("returns an empty list when Strapi fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("", { status: 500 }))
    )
    expect(await fetchLeaderboard("month")).toEqual([])
  })
})

describe("PERIOD_PHRASE", () => {
  it("has a phrase for every period", () => {
    expect(PERIOD_PHRASE).toEqual({
      today: "today",
      week: "this week",
      month: "this month",
      all: "ever",
    })
  })
})

describe("fetchStanding", () => {
  it("sends the period and the bridge headers", async () => {
    vi.stubEnv("STRAPI_BRIDGE_SECRET", "test-secret")
    const fetchMock = vi.fn(async () =>
      Response.json({ data: { globalRank: 1 } }, { status: 200 })
    )
    vi.stubGlobal("fetch", fetchMock)

    const standing = await fetchStanding("ba-user-1", "week")

    expect(standing).toEqual({ globalRank: 1 })
    const [url, init] = (fetchMock.mock.calls as unknown[][])[0] as [
      string,
      RequestInit,
    ]
    expect(String(url)).toContain("/api/rewards/my-standing?period=week")
    expect((init.headers as Record<string, string>)["X-Ba-User-Id"]).toBe(
      "ba-user-1"
    )
  })

  it("defaults to this month", async () => {
    vi.stubEnv("STRAPI_BRIDGE_SECRET", "test-secret")
    const fetchMock = vi.fn(async () =>
      Response.json({ data: { globalRank: 1 } }, { status: 200 })
    )
    vi.stubGlobal("fetch", fetchMock)

    await fetchStanding("ba-user-1")

    expect(String((fetchMock.mock.calls as unknown[][])[0]?.[0])).toContain(
      "period=month"
    )
  })

  it("returns null when there's no bridge secret", async () => {
    vi.stubEnv("STRAPI_BRIDGE_SECRET", "")
    expect(await fetchStanding("ba-user-1")).toBeNull()
  })

  it("returns null when Strapi fails", async () => {
    vi.stubEnv("STRAPI_BRIDGE_SECRET", "test-secret")
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("", { status: 500 }))
    )
    expect(await fetchStanding("ba-user-1")).toBeNull()
  })
})
