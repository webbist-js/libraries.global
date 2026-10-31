import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { makeFakeStrapi } from "./helpers/fake-strapi"
import factory from "../src/api/user-profile/controllers/user-profile"

const PROFILE = "api::user-profile.user-profile"
const TARGET = { documentId: "pAda", username: "ada", baUserId: "uAda" }

function ctx(
  params: Record<string, string>,
  query: Record<string, unknown> = {},
  headers: Record<string, string> = {}
) {
  const c: any = {
    params,
    query,
    request: { headers },
    send: (body: unknown) => ((c.status = 200), (c.body = body)),
    notFound: () => (c.status = 404),
    forbidden: () => (c.status = 403),
    unauthorized: () => (c.status = 401),
    badRequest: () => (c.status = 400),
  }

  return c
}

describe("profile follower counts", () => {
  let controller: any
  let store: ReturnType<typeof makeFakeStrapi>["store"]

  beforeEach(() => {
    process.env.STRAPI_BRIDGE_SECRET = "s3cret"
    const fake = makeFakeStrapi({
      [PROFILE]: [
        {
          ...TARGET,
          appearancePreference: "dark",
          theme: "light",
          profileVisibility: "public",
          publicPrefs: { showFollows: false },
          followedProfiles: [{ documentId: "pOther", username: "other" }],
        },
        {
          documentId: "pPrivateFollower",
          username: "private-follower",
          profileVisibility: "private",
          followedProfiles: [TARGET],
        },
        {
          documentId: "pHiddenFollower",
          username: "hidden-follower",
          profileVisibility: "public",
          publicPrefs: { showFollows: false },
          followedProfiles: [TARGET],
        },
        {
          documentId: "pOther",
          username: "other",
          profileVisibility: "public",
        },
      ],
    })
    store = fake.store
    ;(globalThis as any).strapi = fake.strapi
    controller = factory({
      strapi: {
        ...fake.strapi,
        contentType: () => ({ uid: PROFILE }),
      },
    } as any)
  })

  afterEach(() => {
    delete (globalThis as any).strapi
  })

  it("keeps interface preferences private on both public profile addresses, even for the owner", async () => {
    for (const [method, params] of [
      ["findByUsername", { username: TARGET.username }],
      ["findByDocumentId", { documentId: TARGET.documentId }],
    ] as const) {
      const c = ctx(
        params,
        {},
        { "x-service-secret": "s3cret", "x-ba-user-id": TARGET.baUserId }
      )
      await controller[method](c)
      expect(c.body.data).not.toHaveProperty("appearancePreference")
      expect(c.body.data).not.toHaveProperty("theme")
    }
    const owner = ctx(
      {},
      {},
      { "x-service-secret": "s3cret", "x-ba-user-id": TARGET.baUserId }
    )
    await controller.findMe(owner)
    expect(owner.body.data.appearancePreference).toBe("dark")
  })

  it("counts incoming follows, including hidden people, without exposing their identities", async () => {
    const c = ctx({ username: TARGET.username })
    await controller.findByUsername(c)

    expect(c.status).toBe(200)
    expect(c.body.data.followerCount).toBe(2)
    expect(c.body.data.followedProfiles).toEqual([])
    expect(JSON.stringify(c.body)).not.toContain("private-follower")
    expect(JSON.stringify(c.body)).not.toContain("hidden-follower")
  })

  it("returns the same count when addressed by documentId", async () => {
    const c = ctx({ documentId: TARGET.documentId })
    await controller.findByDocumentId(c)

    expect(c.body.data.followerCount).toBe(2)
  })

  it("keeps a private profile private, while its owner can see their count", async () => {
    store[PROFILE][0]!.profileVisibility = "private"
    const anon = ctx({ username: TARGET.username })
    await controller.findByUsername(anon)
    expect(anon.status).toBe(403)
    expect(anon.body).toBeUndefined()

    const owner = ctx(
      {},
      {},
      { "x-service-secret": "s3cret", "x-ba-user-id": TARGET.baUserId }
    )
    await controller.findMe(owner)
    expect(owner.body.data.followerCount).toBe(2)
  })

  it("reports zero for a profile with no followers", async () => {
    const c = ctx({ username: "hidden-follower" })
    await controller.findByUsername(c)

    expect(c.body.data.followerCount).toBe(0)
  })
})
