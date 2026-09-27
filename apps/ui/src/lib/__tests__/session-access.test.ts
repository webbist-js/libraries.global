import { describe, expect, it } from "vitest"

import { buildSessionAccess } from "../session-access"
import type { SessionProfile } from "../session-profile"

const FREE_LIMITS = {
  savedViews: 3,
  savedSearches: 3,
  catalogueChecksPerHour: 30,
  exportRows: 0,
}

const baseProfile: SessionProfile = {
  contributorRole: "contributor",
  username: "x",
  tier: null,
  claims: [],
  grants: [],
  verifications: [],
  earnedProUntil: null,
}

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
      limits: FREE_LIMITS,
    })
  })

  it("resolves a wiki editor's capabilities", () => {
    const a = buildSessionAccess({
      ...baseProfile,
      contributorRole: "wiki_editor",
      username: "ed",
      tier: "Reader",
    })
    expect(a.profileLoaded).toBe(true)
    expect(a.capabilities).toContain("docs.directEdit")
    expect(a.capabilities).not.toContain("submit.libraryEdit")
  })

  it("scopes library edit to claims", () => {
    const a = buildSessionAccess({
      ...baseProfile,
      contributorRole: "verified_librarian",
      username: "lib",
      tier: null,
      claims: ["libA"],
    })
    expect(a.capabilities).toContain("submit.libraryEdit")
    expect(a.claimedLibraryIds).toEqual(["libA"])
  })

  it("coerces an unknown role to reader", () => {
    const a = buildSessionAccess({
      ...baseProfile,
      contributorRole: "overlord" as never,
      username: null,
      tier: null,
    })
    expect(a.contributorRole).toBe("reader")
    expect(a.capabilities).not.toContain("docs.directEdit")
  })

  it("an unexpired pro grant resolves to the pro plan via grant", () => {
    const a = buildSessionAccess({
      ...baseProfile,
      grants: [{ plan: "pro", expiresAt: null }],
    })
    expect(a.plan).toBe("pro")
    expect(a.planSource).toBe("grant")
    expect(a.features).toContain("atlas.export")
    expect(a.limits.exportRows).toBe(10_000)
  })

  it("an unexpired verification resolves to pro via verified", () => {
    const a = buildSessionAccess({
      ...baseProfile,
      verifications: [{ expiresAt: null }],
    })
    expect(a.plan).toBe("pro")
    expect(a.planSource).toBe("verified")
  })

  it("an Archivist tier resolves to pro via earned", () => {
    const a = buildSessionAccess({
      ...baseProfile,
      tier: "Archivist",
    })
    expect(a.plan).toBe("pro")
    expect(a.planSource).toBe("earned")
  })

  it("earnedProUntil a day in the future resolves to pro via earned at a Cartographer tier", () => {
    const now = new Date("2026-01-01T00:00:00Z")
    const a = buildSessionAccess(
      {
        ...baseProfile,
        tier: "Cartographer",
        earnedProUntil: "2026-01-02T00:00:00Z",
      },
      now
    )
    expect(a.plan).toBe("pro")
    expect(a.planSource).toBe("earned")
  })

  it("stays free with the free limits and profileLoaded false when the bridge failed", () => {
    const a = buildSessionAccess(null)
    expect(a.plan).toBe("free")
    expect(a.planSource).toBe("none")
    expect(a.limits).toEqual(FREE_LIMITS)
    expect(a.profileLoaded).toBe(false)
  })

  it("keeps capabilities identical with and without grants", () => {
    const without = buildSessionAccess({
      ...baseProfile,
      contributorRole: "verified_librarian",
      claims: ["libA"],
    })
    const withGrant = buildSessionAccess({
      ...baseProfile,
      contributorRole: "verified_librarian",
      claims: ["libA"],
      grants: [{ plan: "pro", expiresAt: null }],
    })
    expect(withGrant.capabilities).toEqual(without.capabilities)
    expect(withGrant.claimedLibraryIds).toEqual(without.claimedLibraryIds)
    expect(withGrant.plan).not.toBe(without.plan)
  })
})
