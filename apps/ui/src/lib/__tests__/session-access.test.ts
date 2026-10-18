import { describe, expect, it } from "vitest"

import { buildSessionAccess } from "../session-access"
import type { SessionProfile } from "../session-profile"

const FREE_LIMITS = {
  savedViews: 3,
  savedSearches: 3,
  exportRows: 0,
}

const baseProfile: SessionProfile = {
  contributorRole: "contributor",
  username: "x",
  tier: null,
  claims: [],
  staff: [],
  grants: [],
  roleGrants: [],
  verifications: [],
  earnedProUntil: null,
  dismissedPrompts: [],
  teams: [],
}

describe("buildSessionAccess", () => {
  it("fails closed to a free reader with no capabilities when the bridge failed", () => {
    expect(buildSessionAccess(null)).toEqual({
      profileLoaded: false,
      contributorRole: "reader",
      username: null,
      compositionPreferences: { country: null, languages: [] },
      capabilities: [],
      claimedLibraryIds: [],
      staffLibraries: [],
      moderationScopes: [],
      editorLocales: { docs: [], journal: [] },
      plan: "free",
      planSource: "none",
      features: [],
      limits: FREE_LIMITS,
      dismissedPrompts: [],
      teams: [],
      teamLibraryIds: [],
    })
  })

  it("carries the prompts the user has hidden", () => {
    const a = buildSessionAccess({
      ...baseProfile,
      dismissedPrompts: ["find-contribute"],
    })
    expect(a.dismissedPrompts).toEqual(["find-contribute"])
  })

  it("carries owner composition preferences independently of role grants", () => {
    const preferences = {
      country: "CO",
      languages: [{ code: "es", proficiency: "native" as const }],
    }
    const access = buildSessionAccess({
      ...baseProfile,
      compositionPreferences: preferences,
    })
    expect(access.compositionPreferences).toEqual(preferences)
    expect(access.capabilities).toEqual(
      buildSessionAccess(baseProfile).capabilities
    )
  })

  it("resolves a wiki editor's capabilities", () => {
    const a = buildSessionAccess({
      ...baseProfile,
      contributorRole: "wiki_editor",
      username: "ed",
      tier: "Reader",
      roleGrants: [{ role: "wiki_editor", queue: "all", locale: null }],
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
      staff: [
        {
          libraryDocumentId: "libA",
          staffRole: "owner",
          canGoLive: false,
          name: "Library A",
          slug: "library-a",
          libraryType: "Public",
        },
      ],
      roleGrants: [{ role: "verified_librarian", queue: "all", locale: null }],
    })
    expect(a.capabilities).toContain("submit.libraryEdit")
    expect(a.claimedLibraryIds).toEqual(["libA"])
    expect(a.staffLibraries).toEqual([
      {
        id: "libA",
        role: "owner",
        canGoLive: false,
        name: "Library A",
        slug: "library-a",
        libraryType: "Public",
      },
    ])
  })

  it("no longer treats a legacy claim without a staff entry as staff", () => {
    const a = buildSessionAccess({
      ...baseProfile,
      contributorRole: "verified_librarian",
      claims: ["libA"],
      roleGrants: [{ role: "verified_librarian", queue: "all", locale: null }],
    })
    expect(a.capabilities).not.toContain("submit.libraryEdit")
    expect(a.staffLibraries).toEqual([])
  })

  it("an active team gives Pro via team and scopes its libraries", () => {
    const a = buildSessionAccess({
      ...baseProfile,
      teams: [
        {
          id: "t1",
          name: "Kent Libraries",
          slug: "kent-libraries",
          role: "organiser",
          libraryCount: 2,
          libraryDocumentIds: ["libA", "libB"],
          expiresAt: null,
          status: "active",
          organiserName: null,
        },
      ],
    })
    expect(a.plan).toBe("pro")
    expect(a.planSource).toBe("team")
    expect(a.teamLibraryIds).toEqual(["libA", "libB"])
    expect(a.teams).toEqual([
      {
        id: "t1",
        name: "Kent Libraries",
        slug: "kent-libraries",
        role: "organiser",
        libraryCount: 2,
      },
    ])
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
      roleGrants: [{ role: "verified_librarian", queue: "all", locale: null }],
    })
    const withGrant = buildSessionAccess({
      ...baseProfile,
      contributorRole: "verified_librarian",
      claims: ["libA"],
      roleGrants: [{ role: "verified_librarian", queue: "all", locale: null }],
      grants: [{ plan: "pro", expiresAt: null }],
    })
    expect(withGrant.capabilities).toEqual(without.capabilities)
    expect(withGrant.claimedLibraryIds).toEqual(without.claimedLibraryIds)
    expect(withGrant.plan).not.toBe(without.plan)
  })

  it("a knowledge/fr moderator grant yields moderate.queue and the scope, no editor locales", () => {
    const a = buildSessionAccess({
      ...baseProfile,
      contributorRole: "moderator",
      roleGrants: [{ role: "moderator", queue: "knowledge", locale: "fr" }],
    })
    expect(a.capabilities).toContain("moderate.queue")
    expect(a.moderationScopes).toEqual([{ queue: "knowledge", locale: "fr" }])
    expect(a.editorLocales).toEqual({ docs: [], journal: [] })
  })

  it("a wiki_editor grant for fr yields docs editor locale fr only", () => {
    const a = buildSessionAccess({
      ...baseProfile,
      contributorRole: "wiki_editor",
      roleGrants: [{ role: "wiki_editor", queue: "all", locale: "fr" }],
    })
    expect(a.editorLocales.docs).toEqual(["fr"])
    expect(a.editorLocales.journal).toEqual([])
    expect(a.moderationScopes).toEqual([])
  })

  it("grants decide capabilities, not the derived contributorRole", () => {
    const a = buildSessionAccess({
      ...baseProfile,
      contributorRole: "wiki_editor",
      roleGrants: [],
    })
    expect(a.capabilities).not.toContain("docs.directEdit")
  })
})
