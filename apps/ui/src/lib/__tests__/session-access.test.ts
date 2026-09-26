import { describe, expect, it } from "vitest"

import { buildSessionAccess } from "../session-access"

describe("buildSessionAccess", () => {
  it("fails closed to a free reader with no capabilities when the bridge failed", () => {
    expect(buildSessionAccess(null)).toEqual({
      profileLoaded: false,
      contributorRole: "reader",
      username: null,
      capabilities: [],
      claimedLibraryIds: [],
      plan: "free",
      planSource: "none",
      features: [],
    })
  })

  it("resolves a wiki editor's capabilities", () => {
    const a = buildSessionAccess({
      contributorRole: "wiki_editor",
      username: "ed",
      tier: "Reader",
      claims: [],
    })
    expect(a.profileLoaded).toBe(true)
    expect(a.capabilities).toContain("docs.directEdit")
    expect(a.capabilities).not.toContain("submit.libraryEdit")
  })

  it("scopes library edit to claims", () => {
    const a = buildSessionAccess({
      contributorRole: "verified_librarian",
      username: "lib",
      tier: null,
      claims: ["libA"],
    })
    expect(a.capabilities).toContain("submit.libraryEdit")
    expect(a.claimedLibraryIds).toEqual(["libA"])
  })

  it("stays free in P-B even at Archivist tier", () => {
    const a = buildSessionAccess({
      contributorRole: "contributor",
      username: "x",
      tier: "Archivist",
      claims: [],
    })
    expect(a.plan).toBe("free")
    expect(a.features).toEqual([])
  })

  it("coerces an unknown role to reader", () => {
    const a = buildSessionAccess({
      contributorRole: "overlord" as never,
      username: null,
      tier: null,
      claims: [],
    })
    expect(a.contributorRole).toBe("reader")
    expect(a.capabilities).not.toContain("docs.directEdit")
  })
})
