import { describe, expect, it } from "vitest"

import { makeFakeStrapi } from "./helpers/fake-strapi"
import {
  hasLibraryFeature,
  loadTeamInputs,
  loadTeamMemberships,
  TEAM_MEMBER_UID,
  TEAM_UID,
} from "../src/utils/team-access"

const GRANT = "api::entitlement-grant.entitlement-grant"
const LIB_A = "libraryaaaaaaaaaaaaaaaa1"
const LIB_B = "librarybbbbbbbbbbbbbbbb1"
const LIB_C = "libraryccccccccccccccc1"

const team = (
  documentId: string,
  name: string,
  libraries: string[],
  over: Record<string, unknown> = {}
) => ({
  documentId,
  name,
  slug: name.toLowerCase().replaceAll(/\s+/g, "-"),
  status: "active",
  verifiedAt: "2026-01-01T00:00:00.000Z",
  expiresAt: null,
  libraries: libraries.map((id) => ({ documentId: id })),
  ...over,
})
const active = team("team00000000000000000001", "Active Team", [LIB_A])
const lapsed = team("team00000000000000000002", "Lapsed Team", [LIB_B], {
  status: "lapsed",
  verifiedAt: null,
})
const expired = team("team00000000000000000003", "Expired Team", [LIB_C], {
  expiresAt: "2020-01-01T00:00:00.000Z",
})
const row = (
  documentId: string,
  baUserId: string,
  teamRole: string,
  status: string,
  t: ReturnType<typeof team>
) => ({ documentId, baUserId, teamRole, status, team: t })

function setup() {
  return makeFakeStrapi({
    [TEAM_UID]: [active, lapsed, expired],
    [TEAM_MEMBER_UID]: [
      row("teammember00000000000001", "u1", "organiser", "active", active),
      row("teammember00000000000002", "u1", "member", "active", lapsed),
      row("teammember00000000000003", "u1", "member", "invited", expired),
      row("teammember00000000000004", "u2", "member", "active", expired),
      row("teammember00000000000005", "u2", "member", "removed", active),
    ],
    [GRANT]: [
      { documentId: "grant", baUserId: "u3", plan: "team", expiresAt: null },
    ],
  })
}

describe("loadTeamInputs", () => {
  it("lists active memberships with each Team's libraries, reporting lapsed and expired ones as they are", async () => {
    const { strapi } = setup()
    expect(await loadTeamInputs(strapi, "u1")).toEqual([
      { libraryDocumentIds: [LIB_A], expiresAt: null, status: "active" },
      { libraryDocumentIds: [LIB_B], expiresAt: null, status: "lapsed" },
    ])
    expect(await loadTeamMemberships(strapi, "u1")).toEqual([
      expect.objectContaining({
        teamDocumentId: active.documentId,
        name: "Active Team",
        teamRole: "organiser",
        verified: true,
      }),
      expect.objectContaining({
        teamDocumentId: lapsed.documentId,
        teamRole: "member",
        status: "lapsed",
        verified: false,
      }),
    ])
    // An invited or removed row is no membership.
    expect(await loadTeamInputs(strapi, "u2")).toEqual([
      {
        libraryDocumentIds: [LIB_C],
        expiresAt: "2020-01-01T00:00:00.000Z",
        status: "active",
      },
    ])
    expect(await loadTeamInputs(strapi, "nobody")).toEqual([])
  })
})

describe("hasLibraryFeature", () => {
  it("unlocks library-scoped features per library, from active unexpired Teams only", async () => {
    const { strapi } = setup()
    expect(await hasLibraryFeature(strapi, "u1", "library.team", LIB_A)).toBe(
      true
    )
    expect(
      await hasLibraryFeature(strapi, "u1", "library.traffic", LIB_A)
    ).toBe(true)
    expect(await hasLibraryFeature(strapi, "u1", "library.team", LIB_B)).toBe(
      false
    )
    expect(await hasLibraryFeature(strapi, "u1", "library.team", LIB_C)).toBe(
      false
    )
    expect(await hasLibraryFeature(strapi, "u2", "library.team", LIB_C)).toBe(
      false
    )
  })
  it("gives Pro personally through an active Team, while a personal team grant alone unlocks no library", async () => {
    const { strapi } = setup()
    // Not library-scoped: the person's own plan decides, whatever the library.
    expect(
      await hasLibraryFeature(strapi, "u1", "library.history", LIB_B)
    ).toBe(true)
    expect(
      await hasLibraryFeature(strapi, "u3", "library.history", LIB_A)
    ).toBe(true)
    expect(await hasLibraryFeature(strapi, "u3", "library.team", LIB_A)).toBe(
      false
    )
    expect(
      await hasLibraryFeature(strapi, "nobody", "library.history", LIB_A)
    ).toBe(false)
  })
})
