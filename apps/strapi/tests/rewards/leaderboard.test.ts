import { describe, expect, it, vi } from "vitest"

import createLeaderboard from "../../src/plugins/rewards/server/services/leaderboard"

function fakeStrapi(
  rows: { ba_user_id: string; periodPoints: string }[],
  profiles: Record<string, unknown>[]
) {
  const builder: any = {
    select: () => builder,
    sum: () => builder,
    from: () => builder,
    groupBy: () => builder,
    orderBy: () => builder,
    limit: () => builder,
    offset: () => builder,
    where: () => builder,
    // Mimics knex's thenable query builder so `await q` resolves to `rows`.
    // eslint-disable-next-line unicorn/no-thenable -- intentional: fakes a knex query builder
    then: (resolve: (v: unknown) => void) => resolve(rows),
  }

  const strapi: any = {
    db: {
      connection: builder,
      query: vi.fn(() => ({
        findMany: vi.fn(async () => profiles),
      })),
    },
    plugin: vi.fn(() => ({
      service: () => ({ getPreviousWeekRankMap: async () => new Map() }),
    })),
  }

  return strapi
}

describe("getLeaderboard privacy", () => {
  it("anonymises a private profile", async () => {
    const strapi = fakeStrapi(
      [{ ba_user_id: "u1", periodPoints: "10" }],
      [
        {
          baUserId: "u1",
          username: "alice",
          firstName: "Alice",
          lastName: "A",
          country: "US",
          contributorRole: "contributor",
          profileVisibility: "private",
        },
      ]
    )
    const [entry] = await createLeaderboard({ strapi }).getLeaderboard({
      period: "all",
      page: 1,
      limit: 10,
    })
    expect(entry.username).toBeNull()
    expect(entry.firstName).toBe("Private")
    expect(entry.lastName).toBe("contributor")
    expect(entry.country).toBeNull()
    expect(entry.contributorRole).toBeNull()
  })

  it("anonymises a public profile that opted out of showActivity", async () => {
    const strapi = fakeStrapi(
      [{ ba_user_id: "u2", periodPoints: "5" }],
      [
        {
          baUserId: "u2",
          username: "bob",
          firstName: "Bob",
          lastName: "B",
          country: "FR",
          contributorRole: "contributor",
          profileVisibility: "public",
          publicPrefs: { showActivity: false },
        },
      ]
    )
    const [entry] = await createLeaderboard({ strapi }).getLeaderboard({
      period: "all",
      page: 1,
      limit: 10,
    })
    expect(entry.username).toBeNull()
    expect(entry.firstName).toBe("Private")
    expect(entry.lastName).toBe("contributor")
    expect(entry.country).toBeNull()
    expect(entry.contributorRole).toBeNull()
  })

  it("shows a public profile with activity on", async () => {
    const strapi = fakeStrapi(
      [{ ba_user_id: "u3", periodPoints: "5" }],
      [
        {
          baUserId: "u3",
          username: "carol",
          firstName: "Carol",
          lastName: "C",
          country: "DE",
          contributorRole: "contributor",
          profileVisibility: "public",
          publicPrefs: { showActivity: true, showLocation: true },
        },
      ]
    )
    const [entry] = await createLeaderboard({ strapi }).getLeaderboard({
      period: "all",
      page: 1,
      limit: 10,
    })
    expect(entry.username).toBe("carol")
    expect(entry.country).toBe("DE")
  })
})
