import type { Core } from "@strapi/strapi"
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest"

import factory from "../src/api/roadmap/controllers/roadmap"
import { roadmapKeyProblem } from "../src/documentMiddlewares/roadmap-keys"
import {
  ROADMAP,
  ROADMAP_SUGGESTION,
  ROADMAP_VOTE,
  roadmapEngagement,
  setRoadmapVote,
} from "../src/utils/roadmap"

const SECRET = "s3cret"
const REPLY = "plugin::discussions.reply"

type KnexChain = {
  select: () => KnexChain
  count: () => KnexChain
  whereIn: () => KnexChain
  andWhere: () => KnexChain
  groupBy: () => Promise<Record<string, unknown>[]>
}
type Vote = { itemKey: string; baUserId: string }

/** A knex stand-in answering one GROUP BY per table. */
function knexReturning(rows: Record<string, Record<string, unknown>[]>) {
  return vi.fn((table: string) => {
    const chain: KnexChain = {
      select: () => chain,
      count: () => chain,
      whereIn: () => chain,
      andWhere: () => chain,
      groupBy: async () => rows[table] ?? [],
    }

    return chain
  })
}

function fakeStrapi({
  roadmap = {
    features: [{ key: "save-views", title: "Save views" }],
    dataImports: [{ key: "germany", place: "Germany", source: "DBS" }],
  } as Record<string, unknown> | null,
  votes = [] as Vote[],
  threads = [] as Record<string, unknown>[],
  replies = [] as Record<string, unknown>[],
} = {}) {
  const created: Record<string, unknown>[] = []
  const vote = {
    findOne: vi.fn(
      async ({ where }: { where: Vote }) =>
        votes.find(
          (v) => v.itemKey === where.itemKey && v.baUserId === where.baUserId
        ) ?? null
    ),
    findMany: vi.fn(
      async ({
        where,
      }: {
        where: { baUserId: string; itemKey: { $in: string[] } }
      }) =>
        votes.filter(
          (v) =>
            v.baUserId === where.baUserId &&
            where.itemKey.$in.includes(v.itemKey)
        )
    ),
    create: vi.fn(async ({ data }: { data: Vote }) => {
      votes.push(data)

      return data
    }),
    deleteMany: vi.fn(async ({ where }: { where: Vote }) => {
      votes = votes.filter(
        (v) => !(v.itemKey === where.itemKey && v.baUserId === where.baUserId)
      )
    }),
    count: vi.fn(
      async ({ where }: { where: { itemKey: string } }) =>
        votes.filter((v) => v.itemKey === where.itemKey).length
    ),
  }
  const suggestionDocs = {
    findMany: vi.fn(async () => []),
    findOne: vi.fn(async () => null),
    count: vi.fn(async () => 0),
    create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
      created.push(data)

      return data
    }),
  }
  const strapi = {
    contentType: () => ({ uid: ROADMAP }),
    documents: vi.fn((uid: string) =>
      uid === ROADMAP
        ? { findFirst: vi.fn(async () => roadmap) }
        : uid === ROADMAP_SUGGESTION
          ? suggestionDocs
          : {}
    ),
    db: {
      query: (uid: string) =>
        uid === ROADMAP_VOTE ? vote : { findMany: vi.fn(async () => threads) },
      metadata: {
        get: (uid: string) => ({
          tableName:
            uid === ROADMAP_VOTE
              ? "roadmap_votes"
              : uid === REPLY
                ? "replies"
                : "threads",
          attributes: {
            itemKey: { columnName: "item_key" },
            threadId: { columnName: "thread_id" },
            state: { columnName: "state" },
          },
        }),
      },
      connection: knexReturning({
        roadmap_votes: Object.entries(
          votes.reduce<Record<string, number>>((acc, v) => {
            acc[v.itemKey] = (acc[v.itemKey] ?? 0) + 1

            return acc
          }, {})
        ).map(([item_key, n]) => ({ item_key, votes: String(n) })),
        replies,
      }),
    },
  }

  return {
    strapi: strapi as unknown as Core.Strapi,
    created,
    suggestionDocs,
    votes: () => votes,
  }
}

/** The Koa context fields the roadmap controller reads and writes. */
type TestCtx = {
  request: { body: unknown; headers: Record<string, string> }
  query: Record<string, unknown>
  set: Mock
  unauthorized: Mock
  badRequest: Mock
  notFound: Mock
  tooManyRequests: Mock
  status?: number
  body?: { data?: { voted?: unknown } }
}
type RoadmapController = Record<
  "vote" | "engagement" | "suggest",
  (ctx: TestCtx) => Promise<unknown>
>

const controllerFor = (strapi: Core.Strapi) =>
  (factory as unknown as (deps: { strapi: Core.Strapi }) => RoadmapController)({
    strapi,
  })

const ctxOf = (body: unknown, signedIn = true): TestCtx => ({
  request: {
    body,
    headers: signedIn
      ? {
          "x-service-secret": SECRET,
          "x-ba-user-id": "ba-1",
          "x-ba-user-name": "Ada%20L",
        }
      : {},
  },
  query: {},
  set: vi.fn(),
  unauthorized: vi.fn(() => "unauthorized"),
  badRequest: vi.fn(() => "badRequest"),
  notFound: vi.fn(() => "notFound"),
  tooManyRequests: vi.fn(() => "tooManyRequests"),
})

beforeEach(() => {
  process.env.STRAPI_BRIDGE_SECRET = SECRET
})

describe("roadmap keys", () => {
  it("rejects a key used twice across features and imports", () => {
    expect(
      roadmapKeyProblem({
        features: [{ key: "germany" }],
        dataImports: [{ key: "germany" }],
      })
    ).toMatch(/used twice/)
  })

  it("keeps the suggestion namespace for community suggestions", () => {
    expect(
      roadmapKeyProblem({ features: [{ key: "suggestion-abc" }] })
    ).toMatch(/cannot start/)
    expect(roadmapKeyProblem({ features: [{ key: "save-views" }] })).toBeNull()
  })
})

describe("roadmap votes", () => {
  it("records one vote per account and removes it again", async () => {
    const { strapi, votes } = fakeStrapi()
    await expect(
      setRoadmapVote(strapi, "ba-1", "save-views", true)
    ).resolves.toEqual({ voted: true, votes: 1 })
    await setRoadmapVote(strapi, "ba-1", "save-views", true)
    expect(votes()).toHaveLength(1)
    await expect(
      setRoadmapVote(strapi, "ba-1", "save-views", false)
    ).resolves.toEqual({ voted: false, votes: 0 })
  })

  it("needs a signed-in account and an item on the roadmap", async () => {
    const { strapi } = fakeStrapi()
    const controller = controllerFor(strapi)
    expect(
      await controller.vote(ctxOf({ key: "save-views", voted: true }, false))
    ).toBe("unauthorized")
    expect(await controller.vote(ctxOf({ key: "Bad Key", voted: true }))).toBe(
      "badRequest"
    )
    expect(await controller.vote(ctxOf({ key: "unknown", voted: true }))).toBe(
      "notFound"
    )
    const ctx = ctxOf({ key: "germany", voted: true })
    await controller.vote(ctx)
    expect(ctx.body).toEqual({ data: { voted: true, votes: 1 } })
  })
})

describe("roadmap engagement", () => {
  it("counts votes and visible posts and reports the viewer's votes", async () => {
    const { strapi } = fakeStrapi({
      votes: [
        { itemKey: "save-views", baUserId: "ba-1" },
        { itemKey: "save-views", baUserId: "ba-2" },
      ],
      threads: [
        {
          documentId: "t1",
          targetKey: "api::roadmap.roadmap-item:germany",
          activityAt: "2026-11-02T10:00:00.000Z",
          createdAt: "2026-11-01T10:00:00.000Z",
        },
      ],
      replies: [{ thread_id: "t1", replies: "3" }],
    })
    expect(await roadmapEngagement(strapi, ["save-views", "germany"])).toEqual({
      "save-views": { votes: 2, posts: 0, activityAt: null, threadId: null },
      germany: {
        votes: 0,
        posts: 4,
        activityAt: "2026-11-02T10:00:00.000Z",
        threadId: "t1",
      },
    })
    const controller = controllerFor(strapi)
    const ctx = ctxOf(undefined)
    await controller.engagement(ctx)
    expect(ctx.body.data.voted).toEqual(["save-views"])
    expect(ctx.set).toHaveBeenCalledWith("Cache-Control", "private, no-store")
  })
})

describe("dataset suggestions", () => {
  it("saves a valid suggestion as a draft with its author", async () => {
    const { strapi, created } = fakeStrapi()
    const controller = controllerFor(strapi)
    const ctx = ctxOf({
      place: " Portugal ",
      source: "Rede Nacional de Bibliotecas Públicas",
      sourceUrl: "https://example.org/rnbp",
      licence: "CC BY 4.0",
    })
    await controller.suggest(ctx)
    expect(ctx.status).toBe(201)
    expect(created[0]).toMatchObject({
      place: "Portugal",
      submittedBy: "ba-1",
      submitterName: "Ada L",
    })
  })

  it("refuses unsafe links and too many suggestions in a week", async () => {
    const { strapi, suggestionDocs } = fakeStrapi()
    const controller = controllerFor(strapi)
    expect(
      await controller.suggest(
        ctxOf({ place: "X", source: "Y", sourceUrl: "ftp://example.org/data" })
      )
    ).toBe("badRequest")
    suggestionDocs.count.mockResolvedValueOnce(5)
    expect(await controller.suggest(ctxOf({ place: "X", source: "Y" }))).toBe(
      "tooManyRequests"
    )
  })
})
