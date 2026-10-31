import { describe, expect, it } from "vitest"

import { isStaffSlugParam, staffLibraryHref, teamWorkspaceHref } from "../paths"

describe("staff URLs", () => {
  it("retains the locale and billing continuation without a Team selector", () => {
    const query = { team: "legacy", payment: "updated", seats: "10" }
    expect(teamWorkspaceHref("/billing", "fr", query)).toBe(
      "/fr/staff/teams/billing?payment=updated&seats=10"
    )
    expect(teamWorkspaceHref("", "en")).toBe("/staff/teams")
  })
  it("uses and encodes the library's slug, with deep links intact", () => {
    expect(staffLibraryHref("central-library", "/edit?step=hours")).toBe(
      "/staff/central-library/edit?step=hours"
    )
    expect(staffLibraryHref("a/b")).toBe("/staff/a%2Fb")
  })

  it("falls back to the staff index without a slug", () => {
    expect(staffLibraryHref(null, "/team")).toBe("/staff")
    expect(staffLibraryHref(undefined)).toBe("/staff")
    expect(staffLibraryHref("")).toBe("/staff")
  })

  it("accepts a uid-shaped slug of up to 255 characters and nothing else", () => {
    for (const ok of ["central-library", "lib000000000000000000001", "a.b_c"])
      expect(isStaffSlugParam(ok)).toBe(true)
    for (const bad of ["", "-leading", "a/b", "a b", "../x", "a".repeat(256)])
      expect(isStaffSlugParam(bad)).toBe(false)
  })
})

it("sends legacy API bookmarks and checkout continuations to the dedicated workspace", () => {
  expect(
    teamWorkspaceHref("/api", "en", { payment: "confirming", setup: "1" })
  ).toBe("/developers?payment=confirming&setup=1")
  expect(teamWorkspaceHref("/api", "fr")).toBe("/fr/developers")
})
