import { canDirectEdit } from "@repo/access"
import { describe, expect, it } from "vitest"

import {
  hasCapability,
  hasEntitlementForLibrary,
  requireCapability,
  requireEntitlement,
  requireEntitlementForLibrary,
  requireStaff,
  sessionCapabilities,
  sessionTeamsOf,
  preferredTeams,
  staffLibrariesOf,
  teamLibraryIdsOf,
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
      error: "Upgrade required",
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

  it("sessionTeamsOf and teamLibraryIdsOf fail closed on malformed fields", () => {
    const team = {
      id: "t1",
      name: "Kent",
      slug: "kent",
      role: "organiser",
      libraryCount: 2,
    }
    expect(sessionTeamsOf({ teams: [team, { id: "x" }, "y"] })).toEqual([team])
    expect(sessionTeamsOf({})).toEqual([])
    expect(teamLibraryIdsOf({ teamLibraryIds: ["libA", 7, "libB"] })).toEqual([
      "libA",
      "libB",
    ])
    expect(teamLibraryIdsOf("nope")).toEqual([])
  })

  it("library-scoped features need the library in teamLibraryIds; others stay personal", () => {
    const user = {
      features: ["library.team", "atlas.export"],
      teamLibraryIds: ["libA"],
    }
    expect(hasEntitlementForLibrary(user, "library.team", "libA")).toBe(true)
    expect(hasEntitlementForLibrary(user, "library.team", "libB")).toBe(false)
    expect(hasEntitlementForLibrary(user, "library.traffic", "libA")).toBe(true)
    expect(hasEntitlementForLibrary(user, "atlas.export", "libB")).toBe(true)
    expect(hasEntitlementForLibrary(null, "atlas.export", "libA")).toBe(false)
  })

  it("requireEntitlementForLibrary returns 401, 402 with the upgrade payload, or null", async () => {
    expect(
      requireEntitlementForLibrary(null, "library.team", "libA")?.status
    ).toBe(401)
    const r = requireEntitlementForLibrary(
      { features: ["library.team"], teamLibraryIds: [] } as never,
      "library.team",
      "libA"
    )
    expect(r?.status).toBe(402)
    expect(await r?.json()).toEqual({
      error: "Upgrade required",
      feature: "library.team",
      upgradeUrl: "/plans",
    })
    expect(
      requireEntitlementForLibrary(
        { features: [], teamLibraryIds: ["libA"] } as never,
        "library.team",
        "libA"
      )
    ).toBeNull()
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

it("prefers a paid current Team over an earlier unfinished signup", () => {
  const unfinished = {
    id: "draft",
    name: "Team",
    slug: "team",
    role: "organiser" as const,
    libraryCount: 0,
    status: "lapsed" as const,
    expiresAt: null,
  }
  const active = { ...unfinished, id: "paid", status: "active" as const }
  expect(preferredTeams([unfinished, active]).map((team) => team.id)).toEqual([
    "paid",
    "draft",
  ])
  const expired = {
    ...active,
    id: "expired",
    expiresAt: "2020-01-01T00:00:00Z",
  }
  expect(preferredTeams([expired, active])[0]?.id).toBe("paid")
})

it("prefers active self-service Teams to legacy test agreements", () => {
  const legacy = {
    id: "legacy",
    name: "Team",
    slug: "team",
    role: "organiser" as const,
    libraryCount: 0,
    status: "active" as const,
  }
  const paid = { ...legacy, id: "paid", selfService: true }
  expect(preferredTeams([legacy, paid])[0]?.id).toBe("paid")
  expect(preferredTeams([{ ...paid, status: "lapsed" }, legacy])[0]?.id).toBe(
    "legacy"
  )
})
