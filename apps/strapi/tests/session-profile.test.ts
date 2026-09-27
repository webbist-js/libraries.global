import { SESSION_PROFILE_MAX_CLAIMS } from "@repo/access"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { makeFakeStrapi } from "./helpers/fake-strapi"
import controller from "../src/api/auth-bridge/controllers/auth-bridge"

const PROFILE = "api::user-profile.user-profile"
const AFF = "api::library-affiliation.library-affiliation"
const GRANT = "api::entitlement-grant.entitlement-grant"
const VERIFY = "api::pro-verification.pro-verification"

function ctx(query: Record<string, unknown>, secret = "s3cret") {
  const c: any = {
    query,
    request: { header: { "x-service-secret": secret } },
    send: (b: unknown) => (c.body = b),
    unauthorized: (m: string) => ((c.status = 401), (c.body = m)),
    badRequest: (m: string) => ((c.status = 400), (c.body = m)),
  }

  return c
}

const FUTURE_ISO = "2099-01-01T00:00:00Z"

describe("auth-bridge sessionProfile", () => {
  let fake: any
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
          earnedProUntil: FUTURE_ISO,
        },
      ],
      [AFF]: [
        { documentId: "a1", baUserId: "u1", library: { documentId: "libA" } },
        { documentId: "a2", baUserId: "u2", library: { documentId: "libB" } },
      ],
      [GRANT]: [
        { documentId: "g1", baUserId: "u1", plan: "pro", expiresAt: null },
        {
          documentId: "g2",
          baUserId: "u1",
          plan: "team",
          expiresAt: "2020-01-01T00:00:00Z",
        },
        { documentId: "g3", baUserId: "u2", plan: "pro", expiresAt: null },
      ],
      [VERIFY]: [
        {
          documentId: "v1",
          baUserId: "u1",
          kind: "student",
          expiresAt: FUTURE_ISO,
        },
      ],
    })
    ;(globalThis as any).strapi = strapi
    fake = strapi
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
      grants: [{ plan: "pro", expiresAt: null }],
      verifications: [{ expiresAt: FUTURE_ISO }],
      earnedProUntil: FUTURE_ISO,
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
      grants: [],
      verifications: [],
      earnedProUntil: null,
    })
  })

  it.each([
    ["missing", {}],
    ["empty", { baUserId: "" }],
    ["repeated (array)", { baUserId: ["u1", "u2"] }],
  ])("returns 400 when baUserId is %s", async (_label, query) => {
    const c = ctx(query)
    await controller.sessionProfile(c)
    expect(c.status).toBe(400)
    expect(fake.documents).not.toHaveBeenCalled()
  })

  it("reads at most SESSION_PROFILE_MAX_CLAIMS affiliations", async () => {
    await controller.sessionProfile(ctx({ baUserId: "u1" }))
    const i = fake.documents.mock.calls.findIndex(
      ([uid]: [string]) => uid === AFF
    )
    const { findMany } = fake.documents.mock.results[i].value
    expect(findMany.mock.calls[0][0].limit).toBe(SESSION_PROFILE_MAX_CLAIMS)
  })

  it.each([
    ["grants", GRANT],
    ["verifications", VERIFY],
  ])("reads at most 20 %s, scoped to this user", async (_label, uid) => {
    await controller.sessionProfile(ctx({ baUserId: "u1" }))
    const i = fake.documents.mock.calls.findIndex(([u]: [string]) => u === uid)
    const { findMany } = fake.documents.mock.results[i].value
    expect(findMany.mock.calls[0][0].limit).toBe(20)
    expect(findMany.mock.calls[0][0].filters).toEqual({
      baUserId: { $eq: "u1" },
    })
  })
})
