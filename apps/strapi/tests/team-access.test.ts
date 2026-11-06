import { describe, expect, it } from "vitest"

import { makeFakeStrapi } from "./helpers/fake-strapi"
import {
  loadTeamMemberships,
  teamIsActive,
  TEAM_MEMBER_UID,
  TEAM_UID,
} from "../src/utils/team-access"

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
  libraries: libraries.map((id) => ({ documentId: id })),
  ...over,
})
const active = team("team00000000000000000001", "Active Team", [LIB_A])
const lapsed = team("team00000000000000000002", "Lapsed Team", [LIB_B], {
  status: "lapsed",
  verifiedAt: null,
})
const third = team("team00000000000000000003", "Third Team", [LIB_C])
const row = (
  documentId: string,
  baUserId: string,
  teamRole: string,
  status: string,
  t: ReturnType<typeof team>
) => ({ documentId, baUserId, teamRole, status, team: t })

function setup() {
  return makeFakeStrapi({
    [TEAM_UID]: [active, lapsed, third],
    [TEAM_MEMBER_UID]: [
      row("teammember00000000000001", "u1", "organiser", "active", active),
      row("teammember00000000000002", "u1", "member", "active", lapsed),
      row("teammember00000000000003", "u1", "member", "invited", third),
      row("teammember00000000000004", "u2", "member", "active", third),
      row("teammember00000000000005", "u2", "member", "removed", active),
    ],
  })
}

describe("loadTeamMemberships", () => {
  it("lists active memberships with each workspace's libraries; payment expiry never lapses a workspace", async () => {
    const { strapi } = setup()
    expect(await loadTeamMemberships(strapi, "u1")).toEqual([
      expect.objectContaining({
        teamDocumentId: active.documentId,
        name: "Active Team",
        teamRole: "organiser",
        status: "active",
        verified: true,
        libraryDocumentIds: [LIB_A],
      }),
      expect.objectContaining({
        teamDocumentId: lapsed.documentId,
        teamRole: "member",
        status: "lapsed",
        verified: false,
        libraryDocumentIds: [LIB_B],
      }),
    ])
    // An invited or removed row is no membership.
    expect(await loadTeamMemberships(strapi, "u2")).toEqual([
      expect.objectContaining({
        teamDocumentId: third.documentId,
        status: "active",
      }),
    ])
    const [row] = await loadTeamMemberships(strapi, "u1")
    expect(row).not.toHaveProperty("expiresAt")
    expect(row).not.toHaveProperty("selfService")
    expect(await loadTeamMemberships(strapi, "nobody")).toEqual([])
  })
  it("treats status as an admin lifecycle flag only", () => {
    expect(teamIsActive({ status: "active" })).toBe(true)
    expect(teamIsActive({ status: "lapsed" })).toBe(false)
  })
})
