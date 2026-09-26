import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { makeFakeStrapi } from "./helpers/fake-strapi"
import controller from "../src/api/auth-bridge/controllers/auth-bridge"

const PROFILE = "api::user-profile.user-profile"
const AFF = "api::library-affiliation.library-affiliation"

function ctx(query: Record<string, string>, secret = "s3cret") {
  const c: any = {
    query,
    request: { header: { "x-service-secret": secret } },
    send: (b: unknown) => (c.body = b),
    unauthorized: (m: string) => ((c.status = 401), (c.body = m)),
    badRequest: (m: string) => ((c.status = 400), (c.body = m)),
  }

  return c
}

describe("auth-bridge sessionProfile", () => {
  beforeEach(() => {
    process.env.STRAPI_BRIDGE_SECRET = "s3cret"
    const { strapi } = makeFakeStrapi({
      [PROFILE]: [
        {
          documentId: "p1",
          baUserId: "u1",
          contributorRole: "verified_librarian",
          username: "ada",
          tier: "Indexer",
        },
      ],
      [AFF]: [
        { documentId: "a1", baUserId: "u1", library: { documentId: "libA" } },
        { documentId: "a2", baUserId: "u2", library: { documentId: "libB" } },
      ],
    })
    ;(globalThis as any).strapi = strapi
  })
  afterEach(() => {
    delete (globalThis as any).strapi
  })

  it("rejects a bad secret", async () => {
    const c = ctx({ baUserId: "u1" }, "wrong")
    await controller.sessionProfile(c)
    expect(c.status).toBe(401)
  })

  it("returns role, username, tier and only this user's claims", async () => {
    const c = ctx({ baUserId: "u1" })
    await controller.sessionProfile(c)
    expect(c.body).toEqual({
      contributorRole: "verified_librarian",
      username: "ada",
      tier: "Indexer",
      claims: ["libA"],
    })
  })

  it("defaults an unknown user to a reader with nothing", async () => {
    const c = ctx({ baUserId: "nobody" })
    await controller.sessionProfile(c)
    expect(c.body).toEqual({
      contributorRole: "reader",
      username: null,
      tier: null,
      claims: [],
    })
  })
})
