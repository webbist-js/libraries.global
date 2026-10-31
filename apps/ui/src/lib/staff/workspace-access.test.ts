import { describe, expect, it } from "vitest"

import type { TeamSummary } from "./types"
import { canAddStaffLibrary, hasStaffWorkspace } from "./workspace-access"

const library = {
  id: "lib",
  slug: "library",
  name: "Library",
  libraryType: "Public",
  role: "editor",
  canGoLive: false,
}
const team = {
  id: "team",
  slug: "team",
  name: "Team",
  role: "member",
  libraryCount: 0,
  status: "active",
}
const summary: TeamSummary = {
  ...team,
  role: "organiser",
  status: "active",
  organiserName: null,
  libraryDocumentIds: [],
  verified: true,
  expiresAt: null,
}

describe("Staff entry visibility", () => {
  it.each([
    null,
    { id: "reader", plan: "pro" },
    { id: "editor", capabilities: ["docs.directEdit"] },
    { id: "moderator", capabilities: ["moderate.queue"] },
    { id: "claim", claimedLibraryIds: ["lib"] },
  ])(
    "does not infer staff membership from a plan, application or editorial role: %j",
    (user) => {
      expect(hasStaffWorkspace(user)).toBe(false)
    }
  )
  it("includes verified library staff, Team members, organisers and lapsed memberships", () => {
    expect(hasStaffWorkspace({ staffLibraries: [library] })).toBe(true)
    for (const role of ["member", "organiser"])
      for (const status of ["active", "lapsed"])
        expect(hasStaffWorkspace({ teams: [{ ...team, role, status }] })).toBe(
          true
        )
  })
  it("keeps creation available only to existing staff or an active verified Team", () => {
    expect(canAddStaffLibrary(0, [])).toBe(false)
    expect(canAddStaffLibrary(1, [])).toBe(true)
    expect(canAddStaffLibrary(0, [summary])).toBe(true)
    expect(canAddStaffLibrary(0, [{ ...summary, verified: false }])).toBe(false)
    expect(canAddStaffLibrary(0, [{ ...summary, status: "lapsed" }])).toBe(
      false
    )
    expect(
      canAddStaffLibrary(0, [{ ...summary, expiresAt: "2000-01-01" }])
    ).toBe(false)
  })
})
