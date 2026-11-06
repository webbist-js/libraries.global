import { canDirectEdit } from "@repo/access"
import { describe, expect, it } from "vitest"

import {
  apiAccountsOf,
  bonusApiAccountOf,
  canStaffTool,
  hasCapability,
  hasFact,
  requireCapability,
  requireEntitlement,
  requireStaff,
  sessionCapabilities,
  sessionTeamsOf,
  preferredTeams,
  staffLibrariesOf,
} from "../access-server"

describe("access-server", () => {
  it("hasCapability fails closed on missing or malformed fields", () => {
    expect(hasCapability(null, "docs.directEdit")).toBe(false)
    expect(hasCapability({}, "docs.directEdit")).toBe(false)
    expect(
      hasCapability({ capabilities: "docs.directEdit" }, "docs.directEdit")
    ).toBe(false)
    expect(
      hasCapability({ capabilities: ["docs.directEdit"] }, "docs.directEdit")
    ).toBe(true)
  })

  it("requireCapability returns 401, 403 or null", async () => {
    expect(requireCapability(null, "docs.directEdit")?.status).toBe(401)
    expect(
      requireCapability({ capabilities: [] }, "docs.directEdit")?.status
    ).toBe(403)
    expect(
      requireCapability(
        { capabilities: ["docs.directEdit"] },
        "docs.directEdit"
      )
    ).toBeNull()
  })

  it("requireEntitlement returns 401, 402 with an upgrade payload, or null", async () => {
    expect(requireEntitlement(null, "atlas.export")?.status).toBe(401)
    const r = requireEntitlement({ features: [] }, "atlas.export")
    expect(r?.status).toBe(402)
    expect(await r?.json()).toEqual({
      error: "This feature is not available on this account",
      feature: "atlas.export",
      upgradeUrl: "/plans",
    })
    expect(
      requireEntitlement({ features: ["atlas.export"] }, "atlas.export")
    ).toBeNull()
  })

  it("sessionCapabilities rebuilds Capabilities from the session fields", () => {
    const c = sessionCapabilities({
      capabilities: ["moderate.queue", "docs.directEdit"],
      claimedLibraryIds: ["libA"],
      moderationScopes: [{ queue: "knowledge", locale: "fr" }],
      editorLocales: { docs: ["fr"], journal: [] },
    })
    expect(c.set.has("moderate.queue")).toBe(true)
    expect([...c.claimedLibraryIds]).toEqual(["libA"])
    expect(c.moderation).toEqual([{ queue: "knowledge", locale: "fr" }])
    expect(canDirectEdit(c, "docs", "fr")).toBe(true)
    expect(canDirectEdit(c, "docs", "en")).toBe(false)
    expect(canDirectEdit(c, "journal", "fr")).toBe(false)
  })

  it("sessionCapabilities fails closed on missing or malformed fields", () => {
    for (const user of [
      null,
      undefined,
      {},
      "x",
      { moderationScopes: [null, "x", { queue: 1 }], editorLocales: null },
    ]) {
      const c = sessionCapabilities(user)
      expect(c.set.size).toBe(0)
      expect(c.moderation).toEqual([])
      expect(canDirectEdit(c, "docs", "en")).toBe(false)
    }
  })

  it("staffLibrariesOf keeps only well-formed session rows with their names", () => {
    expect(
      staffLibrariesOf({
        staffLibraries: [
          {
            id: "libA",
            role: "owner",
            canGoLive: true,
            name: "A",
            slug: "a",
            libraryType: "Mobile",
          },
          {
            id: "libB",
            role: "editor",
            canGoLive: false,
            name: "B",
            slug: "b",
          },
          {
            id: "libC",
            role: "boss",
            canGoLive: false,
            name: "C",
            slug: "c",
            libraryType: "Public",
          },
          null,
        ],
      })
    ).toEqual([
      {
        id: "libA",
        role: "owner",
        canGoLive: true,
        name: "A",
        slug: "a",
        libraryType: "Mobile",
      },
    ])
    expect(staffLibrariesOf(null)).toEqual([])
  })

  it("sessionTeamsOf fails closed on malformed fields and drops paid-seat state", () => {
    const team = {
      id: "t1",
      name: "Kent",
      slug: "kent",
      role: "organiser",
      libraryCount: 2,
    }
    expect(
      sessionTeamsOf({
        teams: [
          { ...team, status: "lapsed", expiresAt: null },
          { id: "x" },
          "y",
        ],
      })
    ).toEqual([team])
    expect(sessionTeamsOf({})).toEqual([])
  })

  it("apiAccountsOf fails closed; only an active organiser account gives the bonus", () => {
    const user = {
      apiAccounts: [
        { teamId: "t1", role: "member", active: true },
        { teamId: "t2", role: "organiser", active: false },
        { teamId: "t3", role: "organiser", active: true },
        { teamId: 4, role: "organiser", active: true },
        { teamId: "t5", role: "owner", active: true },
      ],
    }
    expect(apiAccountsOf(user).map((a) => a.teamId)).toEqual(["t1", "t2", "t3"])
    expect(bonusApiAccountOf(user)?.teamId).toBe("t3")
    expect(
      bonusApiAccountOf({
        apiAccounts: [{ teamId: "t1", role: "member", active: true }],
      })
    ).toBeNull()
    expect(apiAccountsOf({ apiAccounts: "nope" })).toEqual([])
  })

  it("hasFact reads only a list of facts", () => {
    expect(hasFact({ facts: ["explorer", "supporter"] }, "supporter")).toBe(
      true
    )
    expect(hasFact({ facts: "supporter" }, "supporter")).toBe(false)
    expect(hasFact(null, "explorer")).toBe(false)
  })

  it("staff tools follow the viewer's own claim, never Team membership, payment or recognition", () => {
    const outsider = {
      capabilities: ["staff.area"],
      staffLibraries: [{ id: "libA", role: "editor", canGoLive: false }],
      teams: [
        {
          id: "t1",
          name: "Kent",
          slug: "kent",
          role: "organiser",
          libraryCount: 1,
        },
      ],
      facts: ["explorer", "supporter", "apiCustomer"],
      features: ["api.key", "atlas.serviceReach"],
      apiAccounts: [{ teamId: "t1", role: "organiser", active: true }],
    }
    for (const action of [
      "embed",
      "bulkUpload",
      "traffic",
      "seeTeam",
    ] as const) {
      expect(canStaffTool(outsider, action, "libA")).toBe(true)
      expect(canStaffTool(outsider, action, "libB")).toBe(false)
    }
    expect(canStaffTool(outsider, "manageTeam", "libA")).toBe(false)
    // Without the staff area capability nothing is unlocked.
    expect(
      canStaffTool({ staffLibraries: outsider.staffLibraries }, "embed", "libA")
    ).toBe(false)
    expect(canStaffTool(null, "embed", "libA")).toBe(false)
  })

  it("requireStaff answers 401, 404 for a library outside the session's staff, 403 beyond the level, or null", () => {
    const editor = {
      capabilities: ["staff.area"],
      staffLibraries: [{ id: "libA", role: "editor", canGoLive: false }],
    }
    expect(requireStaff(null, "libA", "seeTeam")?.status).toBe(401)
    expect(requireStaff(editor, "libB", "seeTeam")?.status).toBe(404)
    expect(
      requireStaff({ staffLibraries: editor.staffLibraries }, "libA", "seeTeam")
        ?.status
    ).toBe(404)
    expect(requireStaff(editor, "libA", "seeTeam")).toBeNull()
    expect(requireStaff(editor, "libA", "manageTeam")?.status).toBe(403)
  })
})

it("lists organised workspaces first, otherwise keeping the session's order", () => {
  const member = {
    id: "m",
    name: "Team",
    slug: "team",
    role: "member" as const,
    libraryCount: 0,
  }
  const organiser = { ...member, id: "o", role: "organiser" as const }
  const other = { ...member, id: "m2" }
  expect(
    preferredTeams([member, organiser, other]).map((team) => team.id)
  ).toEqual(["o", "m", "m2"])
})
