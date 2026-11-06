import { SESSION_PROFILE_MAX_CLAIMS } from "@repo/access"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { makeFakeStrapi } from "./helpers/fake-strapi"
import { sessionProfile } from "../src/auth/session-profile"
import { NON_CLAIM_AFFILIATION_ROLES } from "../src/utils/affiliations"

const apiRows = vi.hoisted(() => ({ rows: [] as Record<string, unknown>[] }))
vi.mock("../src/auth/application-db", () => ({
  applicationPool: () => ({
    query: vi.fn(async () => ({ rows: apiRows.rows })),
  }),
}))

const PROFILE = "api::user-profile.user-profile"
const AFF = "api::library-affiliation.library-affiliation"
const ROLE_GRANT = "api::role-grant.role-grant"

const FUTURE_ISO = "2099-01-01T00:00:00Z"

describe("local session profile projection", () => {
  let fake: any
  let fakeServices: ReturnType<typeof makeFakeStrapi>["services"]
  let fakeStore: ReturnType<typeof makeFakeStrapi>["store"]
  beforeEach(() => {
    process.env.STRAPI_BRIDGE_SECRET = "s3cret"
    const { strapi, services, store } = makeFakeStrapi({
      [PROFILE]: [
        {
          documentId: "p1",
          baUserId: "u1",
          contributorRole: "verified_librarian",
          username: "ada",
          country: "CO",
          languages: [{ code: "es", proficiency: "native", id: 1 }],
          tier: "Indexer",
          points: 5000,
          acceptedContributions: 120,
          lastContributionAt: "2026-11-01T00:00:00.000Z",
          recognitionRevokedAt: null,
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
    })
    ;(globalThis as any).strapi = strapi
    fake = strapi
    fakeServices = services
    fakeStore = store
    apiRows.rows = []
  })
  afterEach(() => {
    delete (globalThis as any).strapi
  })

  it("returns role, username, tier, known dismissed prompts and only this user's claims", async () => {
    const result = await sessionProfile(fake, "u1")
    expect(result).toEqual({
      contributorRole: "verified_librarian",
      username: "ada",
      country: "CO",
      languages: [{ code: "es", proficiency: "native" }],
      tier: "Indexer",
      claims: ["libA", "libD"],
      staff: [],
      roleGrants: [
        { role: "verified_librarian", queue: "all", locale: null },
        { role: "moderator", queue: "knowledge", locale: "fr" },
      ],
      teams: [],
      apiAccounts: [],
      rewardsPoints: 5000,
      acceptedContributions: 120,
      lastContributionAt: "2026-11-01T00:00:00.000Z",
      recognitionRevoked: false,
      dismissedPrompts: ["find-contribute"],
    })
  })

  it("defaults an unknown user to a reader with nothing", async () => {
    const result = await sessionProfile(fake, "nobody")
    expect(result).toEqual({
      contributorRole: "reader",
      username: null,
      country: null,
      languages: [],
      tier: null,
      claims: [],
      staff: [],
      roleGrants: [],
      teams: [],
      apiAccounts: [],
      rewardsPoints: 0,
      acceptedContributions: 0,
      lastContributionAt: null,
      recognitionRevoked: false,
      dismissedPrompts: [],
    })
  })

  it("reads at most SESSION_PROFILE_MAX_CLAIMS affiliations", async () => {
    await sessionProfile(fake, "u1")
    const i = fake.documents.mock.calls.findIndex(
      ([uid]: [string]) => uid === AFF
    )
    const { findMany } = fake.documents.mock.results[i].value
    expect(findMany.mock.calls[0][0].limit).toBe(SESSION_PROFILE_MAX_CLAIMS)
  })

  it("excludes expired role grants and reads at most 50", async () => {
    const result = await sessionProfile(fake, "u1")
    expect(result.roleGrants.map((g: any) => g.role)).not.toContain(
      "editorial_board"
    )
    const i = fake.documents.mock.calls.findIndex(
      ([u]: [string]) => u === ROLE_GRANT
    )
    const { findMany } = fake.documents.mock.results[i].value
    expect(findMany.mock.calls[0][0].limit).toBe(50)
  })

  it("sends free workspaces and API accounts from the Team API projection", async () => {
    fakeServices["access.teams"] = {
      listMine: async () => [
        {
          id: "team1",
          name: "Central",
          slug: "central",
          role: "organiser",
          libraryCount: 1,
          status: "active",
          verified: true,
          organiserName: "Ada",
          libraryDocumentIds: ["libA"],
        },
      ],
    }
    apiRows.rows = [
      {
        team_id: "team1",
        paid_through: FUTURE_ISO,
        revoked: "false",
        mode: "sandbox",
      },
      // A row for an organisation the user is not in is ignored.
      { team_id: "team9", paid_through: FUTURE_ISO, revoked: "false" },
    ]
    const result = await sessionProfile(fake, "u1")
    expect(result.teams).toEqual([
      {
        id: "team1",
        name: "Central",
        slug: "central",
        role: "organiser",
        libraryCount: 1,
        libraryDocumentIds: ["libA"],
        organiserName: "Ada",
      },
    ])
    expect(result.apiAccounts).toEqual([
      {
        teamId: "team1",
        role: "organiser",
        paidThrough: new Date(FUTURE_ISO).toISOString(),
        revoked: false,
      },
    ])
  })

  it("reports revoked recognition as a boolean only", async () => {
    fakeStore[PROFILE]![0]!.recognitionRevokedAt = "2026-10-01T00:00:00.000Z"
    const result = await sessionProfile(fake, "u1")
    expect(result.recognitionRevoked).toBe(true)
    expect(result).not.toHaveProperty("recognitionRevokedAt")
  })
})

describe("NON_CLAIM_AFFILIATION_ROLES", () => {
  it("names the proposer role, the one affiliation that is not a claim", () => {
    expect(NON_CLAIM_AFFILIATION_ROLES).toEqual(["proposer"])
  })
})
