import { SESSION_PROFILE_MAX_CLAIMS } from "@repo/access"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { makeFakeStrapi } from "./helpers/fake-strapi"
import controller from "../src/api/auth-bridge/controllers/auth-bridge"
import { NON_CLAIM_AFFILIATION_ROLES } from "../src/utils/affiliations"

const PROFILE = "api::user-profile.user-profile"
const AFF = "api::library-affiliation.library-affiliation"
const GRANT = "api::entitlement-grant.entitlement-grant"
const VERIFY = "api::pro-verification.pro-verification"
const ROLE_GRANT = "api::role-grant.role-grant"

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
          dismissedPrompts: ["find-contribute", "not-a-prompt"],
        },
      ],
      [AFF]: [
        { documentId: "a1", baUserId: "u1", library: { documentId: "libA" } },
        { documentId: "a2", baUserId: "u2", library: { documentId: "libB" } },
        // A proposer row (from a new-library submission) is not a claim.
        {
          documentId: "a3",
          baUserId: "u1",
          role: "proposer",
          library: { documentId: "libC" },
        },
        // A row with no role at all (an email-domain auto-claim) still is.
        {
          documentId: "a4",
          baUserId: "u1",
          role: null,
          library: { documentId: "libD" },
        },
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
      [ROLE_GRANT]: [
        {
          documentId: "r1",
          baUserId: "u1",
          role: "verified_librarian",
          queue: "all",
          scopeLocale: null,
          expiresAt: null,
        },
        {
          documentId: "r2",
          baUserId: "u1",
          role: "moderator",
          queue: "knowledge",
          scopeLocale: "fr",
          expiresAt: FUTURE_ISO,
        },
        {
          documentId: "r3",
          baUserId: "u1",
          role: "editorial_board",
          queue: "all",
          scopeLocale: null,
          expiresAt: "2020-01-01T00:00:00Z",
        },
        {
          documentId: "r4",
          baUserId: "u2",
          role: "wiki_editor",
          queue: "all",
          scopeLocale: null,
          expiresAt: null,
        },
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

  it("returns role, username, tier, known dismissed prompts and only this user's claims", async () => {
    const c = ctx({ baUserId: "u1" })
    await controller.sessionProfile(c)
    expect(c.body).toEqual({
      contributorRole: "verified_librarian",
      username: "ada",
      tier: "Indexer",
      claims: ["libA", "libD"],
      staff: [],
      grants: [{ plan: "pro", expiresAt: null }],
      roleGrants: [
        { role: "verified_librarian", queue: "all", locale: null },
        { role: "moderator", queue: "knowledge", locale: "fr" },
      ],
      verifications: [{ expiresAt: FUTURE_ISO }],
      teams: [],
      earnedProUntil: FUTURE_ISO,
      dismissedPrompts: ["find-contribute"],
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
      staff: [],
      grants: [],
      roleGrants: [],
      verifications: [],
      teams: [],
      earnedProUntil: null,
      dismissedPrompts: [],
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

  it("excludes expired role grants and reads at most 50", async () => {
    const c = ctx({ baUserId: "u1" })
    await controller.sessionProfile(c)
    expect(c.body.roleGrants.map((g: any) => g.role)).not.toContain(
      "editorial_board"
    )
    const i = fake.documents.mock.calls.findIndex(
      ([u]: [string]) => u === ROLE_GRANT
    )
    const { findMany } = fake.documents.mock.results[i].value
    expect(findMany.mock.calls[0][0].limit).toBe(50)
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

describe("NON_CLAIM_AFFILIATION_ROLES", () => {
  it("names the proposer role, the one affiliation that is not a claim", () => {
    expect(NON_CLAIM_AFFILIATION_ROLES).toEqual(["proposer"])
  })
})
