import { describe, expect, it, vi } from "vitest"

import createLeaderboard from "../../src/plugins/rewards/server/services/leaderboard"

type SubmissionRow = {
  submitted_by_user_id: string
  approved_count: string | number
  approved_all: string | number
  rejected_all: string | number
}

function fakeStrapi(
  rows: { ba_user_id: string; periodPoints: string }[],
  profiles: Record<string, unknown>[],
  submissionRows: SubmissionRow[] = []
) {
  let table = ""
  const builder: any = {
    select: () => builder,
    sum: () => builder,
    from: (t: string) => {
      table = t

      return builder
    },
    groupBy: () => builder,
    orderBy: () => builder,
    limit: () => builder,
    offset: () => builder,
    where: () => builder,
    whereIn: () => builder,
    whereNot: () => builder,
    havingRaw: () => builder,
    raw: (sql: string, bindings?: unknown[]) => ({ sql, bindings }),
    // Mimics knex's thenable query builder so `await q` resolves to `rows`.
    // eslint-disable-next-line unicorn/no-thenable -- intentional: fakes a knex query builder
    then: (resolve: (v: unknown) => void) => {
      if (table === "cm_submissions") return resolve(submissionRows)

      return resolve(rows)
    },
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
          city: "Boston",
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
    expect(entry.city).toBeNull()
    expect(entry.contributorRole).toBeNull()
  })

  it("keeps approvedCount and acceptanceRate for a private profile with submissions", async () => {
    const strapi = fakeStrapi(
      [{ ba_user_id: "u1", periodPoints: "10" }],
      [
        {
          baUserId: "u1",
          username: "alice",
          firstName: "Alice",
          lastName: "A",
          country: "US",
          city: "Boston",
          contributorRole: "contributor",
          profileVisibility: "private",
        },
      ],
      [
        {
          submitted_by_user_id: "u1",
          approved_count: "5",
          approved_all: "9",
          rejected_all: "1",
        },
      ]
    )
    const [entry] = await createLeaderboard({ strapi }).getLeaderboard({
      period: "all",
      page: 1,
      limit: 10,
    })
    expect(entry.country).toBeNull()
    expect(entry.city).toBeNull()
    expect(entry.approvedCount).toBe(5)
    // 9 approved / (9 approved + 1 rejected) = 90%
    expect(entry.acceptanceRate).toBe(90)
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
          city: "Lyon",
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
    expect(entry.city).toBeNull()
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
          city: "Berlin",
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
    expect(entry.city).toBe("Berlin")
  })

  it("hides city but keeps counts when the profile has showLocation off", async () => {
    const strapi = fakeStrapi(
      [{ ba_user_id: "u4", periodPoints: "5" }],
      [
        {
          baUserId: "u4",
          username: "dave",
          firstName: "Dave",
          lastName: "D",
          country: "GB",
          city: "Leeds",
          contributorRole: "contributor",
          profileVisibility: "public",
          publicPrefs: { showActivity: true, showLocation: false },
        },
      ],
      [
        {
          submitted_by_user_id: "u4",
          approved_count: "2",
          approved_all: "4",
          rejected_all: "1",
        },
      ]
    )
    const [entry] = await createLeaderboard({ strapi }).getLeaderboard({
      period: "all",
      page: 1,
      limit: 10,
    })
    expect(entry.country).toBeNull()
    expect(entry.city).toBeNull()
    expect(entry.approvedCount).toBe(2)
    expect(entry.acceptanceRate).toBe(80)
  })
})

describe("getLeaderboard approved counts and acceptance rate", () => {
  it("carries approvedCount and acceptanceRate from the submissions aggregate", async () => {
    const strapi = fakeStrapi(
      [{ ba_user_id: "u1", periodPoints: "10" }],
      [{ baUserId: "u1", username: "alice", profileVisibility: "public" }],
      [
        {
          submitted_by_user_id: "u1",
          approved_count: "3",
          approved_all: "6",
          rejected_all: "2",
        },
      ]
    )
    const [entry] = await createLeaderboard({ strapi }).getLeaderboard({
      period: "month",
      page: 1,
      limit: 10,
    })
    expect(entry.approvedCount).toBe(3)
    // 6 approved / (6 approved + 2 rejected) = 75%
    expect(entry.acceptanceRate).toBe(75)
  })

  it("is null when the user has no decided submissions", async () => {
    const strapi = fakeStrapi(
      [{ ba_user_id: "u1", periodPoints: "10" }],
      [{ baUserId: "u1", username: "alice", profileVisibility: "public" }],
      []
    )
    const [entry] = await createLeaderboard({ strapi }).getLeaderboard({
      period: "month",
      page: 1,
      limit: 10,
    })
    expect(entry.approvedCount).toBe(0)
    expect(entry.acceptanceRate).toBeNull()
  })
})

describe("getStanding period ranks", () => {
  function fakeStandingStrapi(opts: {
    profile: Record<string, unknown> | null
    connectionResponses: unknown[]
  }) {
    let i = 0
    const builder: any = {
      select: () => builder,
      sum: () => builder,
      from: () => builder,
      groupBy: () => builder,
      having: () => builder,
      havingRaw: () => builder,
      orderBy: () => builder,
      limit: () => builder,
      offset: () => builder,
      where: () => builder,
      count: () => builder,
      as: () => builder,
      raw: (sql: string, bindings?: unknown[]) => ({ sql, bindings }),
      // eslint-disable-next-line unicorn/no-thenable -- fakes a knex query builder
      then: (resolve: (v: unknown) => void) =>
        resolve(opts.connectionResponses[i++] ?? []),
    }

    const strapi: any = {
      db: {
        connection: builder,
        query: vi.fn((uid: string) => {
          if (uid === "api::user-profile.user-profile") {
            return { findOne: vi.fn(async () => opts.profile) }
          }

          return { findMany: vi.fn(async () => []) }
        }),
      },
    }

    return strapi
  }

  it("returns monthRank and periodRank when the user has points in both periods", async () => {
    const strapi = fakeStandingStrapi({
      profile: {
        points: 120,
        pointsThisMonth: 40,
        tier: "Indexer",
        streak: 2,
        country: null,
      },
      connectionResponses: [
        [{ count: "4" }], // globalRank: 4 users ahead
        [{ total: "40" }], // monthRank: my points this month
        [{ count: "2" }], // monthRank: COUNT(*) of 2 users ahead this month
        [{ total: "10" }], // periodRank (week): my points this week
        [{ count: "1" }], // periodRank (week): COUNT(*) of 1 user ahead this week
      ],
    })
    const standing = await createLeaderboard({ strapi }).getStanding(
      "u1",
      "week"
    )
    expect(standing.monthRank).toBe(3)
    expect(standing.periodRank).toBe(2)
  })

  it("returns null ranks when the user has no points in the requested period", async () => {
    const strapi = fakeStandingStrapi({
      profile: {
        points: 120,
        pointsThisMonth: 40,
        tier: "Indexer",
        streak: 2,
        country: null,
      },
      connectionResponses: [
        [{ count: "4" }], // globalRank
        [{ total: "40" }], // monthRank: my points this month
        [{ count: "2" }], // monthRank: COUNT(*) of 2 users ahead this month
        [{ total: "0" }], // periodRank (today): no points today
      ],
    })
    const standing = await createLeaderboard({ strapi }).getStanding(
      "u1",
      "today"
    )
    expect(standing.monthRank).toBe(3)
    expect(standing.periodRank).toBeNull()
  })

  it("reuses monthRank as periodRank when the requested period is month", async () => {
    const strapi = fakeStandingStrapi({
      profile: {
        points: 120,
        pointsThisMonth: 40,
        tier: "Indexer",
        streak: 2,
        country: null,
      },
      connectionResponses: [
        [{ count: "4" }], // globalRank
        [{ total: "40" }], // monthRank: my points this month
        [{ count: "2" }], // monthRank: COUNT(*) of 2 users ahead this month
      ],
    })
    const standing = await createLeaderboard({ strapi }).getStanding("u1")
    expect(standing.monthRank).toBe(3)
    expect(standing.periodRank).toBe(3)
  })

  it("returns null ranks when the user has no profile", async () => {
    const strapi = fakeStandingStrapi({
      profile: null,
      connectionResponses: [],
    })
    const standing = await createLeaderboard({ strapi }).getStanding(
      "nobody",
      "all"
    )
    expect(standing.monthRank).toBeNull()
    expect(standing.periodRank).toBeNull()
  })

  it("reaches the all-time ranking code for a real profile", async () => {
    const strapi = fakeStandingStrapi({
      profile: {
        points: 500,
        pointsThisMonth: 40,
        tier: "Cartographer",
        streak: 5,
        country: null,
      },
      connectionResponses: [
        [{ count: "6" }], // globalRank: 6 users ahead
        [{ total: "40" }], // monthRank: my points this month
        [{ count: "2" }], // monthRank: COUNT(*) of 2 users ahead this month
        [{ total: "500" }], // periodRank (all): my all-time points
        [{ count: "0" }], // periodRank (all): COUNT(*) of 0 users ahead all-time
      ],
    })
    const standing = await createLeaderboard({ strapi }).getStanding(
      "u1",
      "all"
    )
    expect(standing.globalRank).toBe(7)
    expect(standing.monthRank).toBe(3)
    expect(standing.periodRank).toBe(1)
  })
})
