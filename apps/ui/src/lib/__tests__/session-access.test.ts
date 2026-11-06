import {
  EXPLORER_FEATURES,
  EXPLORER_LIMITS,
  type SessionProfile,
} from "@repo/access"
import { describe, expect, it } from "vitest"

import { buildSessionAccess } from "../session-access"

const NOW = new Date("2026-11-06T12:00:00Z")

const baseProfile: SessionProfile = {
  contributorRole: "contributor",
  username: "x",
  tier: null,
  claims: [],
  staff: [],
  roleGrants: [],
  dismissedPrompts: [],
  teams: [],
}

describe("buildSessionAccess", () => {
  it("fails closed to an Explorer reader with no capabilities when the bridge failed", () => {
    expect(buildSessionAccess(null, NOW)).toEqual({
      profileLoaded: false,
      contributorRole: "reader",
      username: null,
      compositionPreferences: { country: null, languages: [] },
      capabilities: [],
      claimedLibraryIds: [],
      staffLibraries: [],
      moderationScopes: [],
      editorLocales: { docs: [], journal: [] },
      standing: "explorer",
      facts: ["explorer"],
      recentlyActive: false,
      acceptedContributions: 0,
      features: [...EXPLORER_FEATURES],
      limits: { ...EXPLORER_LIMITS },
      dismissedPrompts: [],
      teams: [],
      apiAccounts: [],
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

  it("a staff workspace grants nothing: no tools, limits or library scope", () => {
    const a = buildSessionAccess(
      {
        ...baseProfile,
        teams: [
          {
            id: "t1",
            name: "Kent Libraries",
            slug: "kent-libraries",
            role: "organiser",
            libraryCount: 2,
            libraryDocumentIds: ["libA", "libB"],
            organiserName: null,
          },
        ],
      },
      NOW
    )
    expect(a.facts).toEqual(["explorer"])
    expect(a.features).not.toContain("atlas.reach")
    expect(a.limits).toEqual(EXPLORER_LIMITS)
    expect(a.capabilities).not.toContain("staff.area")
    expect(a.staffLibraries).toEqual([])
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

  it("one accepted contribution makes a Contributor with the weekly Reach allowance", () => {
    const a = buildSessionAccess(
      {
        ...baseProfile,
        acceptedContributions: 1,
        lastContributionAt: "2026-11-01T00:00:00Z",
      },
      NOW
    )
    expect(a.standing).toBe("contributor")
    expect(a.facts).toEqual(["explorer", "contributor"])
    expect(a.features).toContain("atlas.reach")
    expect(a.features).not.toContain("atlas.serviceReach")
    expect(a.limits.reachRunsPerWeek).toBe(2)
    expect(a.limits.analysisRunsPerHour).toBe(0)
    expect(a.recentlyActive).toBe(true)
    expect(a.acceptedContributions).toBe(1)
  })

  it("100 accepted contributions is Supporter; revocation removes recognition", () => {
    const supporter = buildSessionAccess(
      { ...baseProfile, acceptedContributions: 100 },
      NOW
    )
    expect(supporter.standing).toBe("supporter")
    expect(supporter.facts).toContain("supporter")
    expect(supporter.recentlyActive).toBe(false)
    const revoked = buildSessionAccess(
      { ...baseProfile, acceptedContributions: 100, recognitionRevoked: true },
      NOW
    )
    expect(revoked.standing).toBe("explorer")
    expect(revoked.features).not.toContain("atlas.reach")
  })

  it("an API organiser with settled coverage gets the Reach bonus; members do not", () => {
    const organiser = buildSessionAccess(
      {
        ...baseProfile,
        apiAccounts: [
          {
            teamId: "t1",
            role: "organiser",
            paidThrough: "2026-12-01T00:00:00Z",
          },
        ],
      },
      NOW
    )
    expect(organiser.facts).toContain("apiCustomer")
    expect(organiser.features).toEqual(
      expect.arrayContaining(["api.key", "atlas.reach", "atlas.serviceReach"])
    )
    expect(organiser.limits.analysisRunsPerHour).toBe(20)
    expect(organiser.limits.analysisRunsPerDay).toBe(100)
    expect(organiser.limits.analysisServiceLibraries).toBe(50)
    expect(organiser.apiAccounts).toEqual([
      { teamId: "t1", role: "organiser", active: true },
    ])
    const member = buildSessionAccess(
      {
        ...baseProfile,
        apiAccounts: [
          { teamId: "t1", role: "member", paidThrough: "2026-12-01T00:00:00Z" },
          {
            teamId: "t2",
            role: "organiser",
            paidThrough: "2026-11-01T00:00:00Z",
          },
        ],
      },
      NOW
    )
    expect(member.facts).not.toContain("apiCustomer")
    expect(member.features).not.toContain("api.key")
    expect(member.apiAccounts.map((x) => x.active)).toEqual([true, false])
  })

  it("stays Explorer with Explorer limits and profileLoaded false when the bridge failed", () => {
    const a = buildSessionAccess(null, NOW)
    expect(a.standing).toBe("explorer")
    expect(a.limits).toEqual(EXPLORER_LIMITS)
    expect(a.profileLoaded).toBe(false)
  })

  it("keeps capabilities identical whatever the recognition or API coverage", () => {
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
      acceptedContributions: 250,
      apiAccounts: [
        {
          teamId: "t1",
          role: "organiser",
          paidThrough: "2999-01-01T00:00:00Z",
        },
      ],
    })
    expect(withGrant.capabilities).toEqual(without.capabilities)
    expect(withGrant.claimedLibraryIds).toEqual(without.claimedLibraryIds)
    expect(withGrant.staffLibraries).toEqual(without.staffLibraries)
    expect(withGrant.facts).not.toEqual(without.facts)
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
