import { afterEach, describe, expect, it, vi } from "vitest"

import { fetchLeaderboard, parsePeriod } from "../leaderboard-server"

afterEach(() => vi.unstubAllGlobals())

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
