import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { makeFakeStrapi } from "./helpers/fake-strapi"
import factory from "../src/api/user-profile/controllers/user-profile"

const PROFILE = "api::user-profile.user-profile"
const AFF = "api::library-affiliation.library-affiliation"
const AWARD = "plugin::rewards.badge-award"

const LIB_A = { id: 1, documentId: "libA" }
const LIB_B = { id: 2, documentId: "libB" }

function ctx(
  params: Record<string, string>,
  query: Record<string, unknown> = {},
  secret?: string
) {
  const c: any = {
    params,
    query,
    request: { headers: secret ? { "x-service-secret": secret } : {} },
    send: (b: unknown) => ((c.status = 200), (c.body = b)),
    notFound: (m: string) => ((c.status = 404), (c.body = m)),
    forbidden: (m: string) => ((c.status = 403), (c.body = m)),
  }

  return c
}

function profile(
  documentId: string,
  username: string,
  baUserId: string,
  profileVisibility: string
) {
  return { documentId, username, baUserId, profileVisibility }
}

describe("user-profile badge endpoints follow profile visibility", () => {
  let controller: any

  beforeEach(() => {
    process.env.STRAPI_BRIDGE_SECRET = "s3cret"
    const { strapi } = makeFakeStrapi({
      [PROFILE]: [
        profile("pPub", "pub", "uPub", "public"),
        { ...profile("pLim", "lim", "uLim", "limited"), city: "Leeds" },
        profile("pPriv", "priv", "uPriv", "private"),
      ],
      [AFF]: [
        { documentId: "a1", baUserId: "uLim", library: LIB_A },
        { documentId: "a2", baUserId: "uMember", library: LIB_A },
        { documentId: "a3", baUserId: "uOther", library: LIB_B },
      ],
      [AWARD]: [
        {
          documentId: "b1",
          baUserId: "uPub",
          badgeId: "first",
          awardedAt: "x",
        },
        {
          documentId: "b2",
          baUserId: "uLim",
          badgeId: "first",
          awardedAt: "y",
        },
        {
          documentId: "b3",
          baUserId: "uPriv",
          badgeId: "first",
          awardedAt: "z",
        },
      ],
    })
    ;(globalThis as any).strapi = strapi
    controller = factory({
      strapi: { ...strapi, contentType: () => ({ uid: PROFILE }) },
    } as any)
  })
  afterEach(() => {
    delete (globalThis as any).strapi
  })

  describe("findBadgesByUsername", () => {
    const call = async (
      username: string,
      query: Record<string, unknown> = {},
      secret?: string
    ) => {
      const c = ctx({ username }, query, secret)
      await controller.findBadgesByUsername(c)

      return c
    }

    it("shows a public profile's badges to anyone", async () => {
      const c = await call("pub")
      expect(c.status).toBe(200)
      expect(c.body.data).toEqual([{ badgeId: "first", awardedAt: "x" }])
    })

    it("hides a limited profile's badges from anonymous callers", async () => {
      expect((await call("lim")).status).toBe(404)
    })

    it("hides them from a viewer who shares no library", async () => {
      expect(
        (await call("lim", { viewerBaUserId: "uOther" }, "s3cret")).status
      ).toBe(404)
    })

    it("shows them to the owner and to an affiliated viewer", async () => {
      const owner = await call("lim", { ownerBaUserId: "uLim" }, "s3cret")
      expect(owner.status).toBe(200)
      expect(owner.body.data).toEqual([{ badgeId: "first", awardedAt: "y" }])
      const member = await call("lim", { viewerBaUserId: "uMember" }, "s3cret")
      expect(member.status).toBe(200)
    })

    it("ignores owner and viewer ids without the bridge secret", async () => {
      expect((await call("lim", { ownerBaUserId: "uLim" })).status).toBe(404)
      expect(
        (await call("lim", { viewerBaUserId: "uMember" }, "wrong")).status
      ).toBe(404)
    })

    it("keeps a private profile owner-only", async () => {
      expect(
        (await call("priv", { viewerBaUserId: "uMember" }, "s3cret")).status
      ).toBe(404)
      expect(
        (await call("priv", { ownerBaUserId: "uPriv" }, "s3cret")).status
      ).toBe(200)
    })
  })

  describe("findBadgesByDocumentId", () => {
    const call = async (
      documentId: string,
      query: Record<string, unknown> = {},
      secret?: string
    ) => {
      const c = ctx({ documentId }, query, secret)
      await controller.findBadgesByDocumentId(c)

      return c
    }

    it("shows a public profile's badges and hides a private one's", async () => {
      expect((await call("pPub")).status).toBe(200)
      expect(
        (await call("pPriv", { ownerBaUserId: "uPriv" }, "s3cret")).status
      ).toBe(404)
    })

    it("applies the limited rule", async () => {
      expect((await call("pLim")).status).toBe(404)
      expect(
        (await call("pLim", { viewerBaUserId: "uOther" }, "s3cret")).status
      ).toBe(404)
      expect(
        (await call("pLim", { viewerBaUserId: "uMember" }, "s3cret")).status
      ).toBe(200)
      expect(
        (await call("pLim", { ownerBaUserId: "uLim" }, "s3cret")).status
      ).toBe(200)
    })
  })

  // findByUsername shares the identity and membership helpers; pin its
  // limited-profile behaviour so the refactor can't drift.
  describe("findByUsername (shared limited rule)", () => {
    const call = async (
      query: Record<string, unknown> = {},
      secret?: string
    ) => {
      const c = ctx({ username: "lim" }, query, secret)
      await controller.findByUsername(c)

      return c
    }

    it("strips contact details unless the viewer is the owner or affiliated", async () => {
      const anon = await call()
      expect(anon.status).toBe(200)
      expect(anon.body.data.city).toBeUndefined()
      expect(
        (await call({ viewerBaUserId: "uOther" }, "s3cret")).body.data.city
      ).toBeUndefined()
      expect(
        (await call({ viewerBaUserId: "uMember" }, "s3cret")).body.data.city
      ).toBe("Leeds")
      expect(
        (await call({ ownerBaUserId: "uLim" }, "s3cret")).body.data.city
      ).toBe("Leeds")
    })
  })
})
