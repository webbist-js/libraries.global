import { describe, expect, expectTypeOf, it } from "vitest"

import {
  canDirectEdit,
  canSubmit,
  grantsFromLegacyRole,
  promoteRole,
  resolveCapabilities,
  SUBMISSION_TYPES,
  type CapabilityInput,
  type ContributorRole,
  type RoleGrant,
} from "../src"

const input = (
  over: Partial<Omit<CapabilityInput, "grants">> & {
    contributorRole?: ContributorRole | null
    grants?: RoleGrant[]
  } = {}
): CapabilityInput => {
  const { contributorRole = "reader", grants, ...rest } = over

  return {
    signedIn: true,
    claims: [],
    ...rest,
    grants: grants ?? grantsFromLegacyRole(contributorRole),
  }
}

describe("resolveCapabilities", () => {
  it("gives anonymous users nothing", () => {
    const c = resolveCapabilities(
      input({ signedIn: false, contributorRole: null })
    )
    expect(c.set.size).toBe(0)
    expect(canSubmit(c, "correction")).toBe(false)
  })

  it("lets any signed-in reader correct, propose, claim, suggest docs and pitch", () => {
    const c = resolveCapabilities(input())
    for (const t of [
      "correction",
      "new_library",
      "library_claim",
      "blog_submission",
      "topic_suggestion",
    ] as const)
      expect(canSubmit(c, t)).toBe(true)
    expect(canSubmit(c, "wiki_edit")).toBe(true) // free-text suggestion
    expect(canSubmit(c, "wiki_edit", { directWikiEdit: true })).toBe(false)
    expect(canSubmit(c, "blog_submission")).toBe(true) // pitch or draft
    expect(canSubmit(c, "blog_submission", { directJournalEdit: true })).toBe(
      false
    )
  })

  it("only allows library_edit on claimed libraries", () => {
    const c = resolveCapabilities(
      input({
        contributorRole: "verified_librarian",
        claims: [
          { libraryDocumentId: "lib1", staffRole: "editor", canGoLive: true },
        ],
      })
    )
    expect(canSubmit(c, "library_edit", { libraryDocumentId: "lib1" })).toBe(
      true
    )
    expect(canSubmit(c, "library_edit", { libraryDocumentId: "lib2" })).toBe(
      false
    )
    expect(canSubmit(c, "library_edit")).toBe(false)
  })

  it("allows event_feed only for a claimed library", () => {
    const c = resolveCapabilities({
      signedIn: true,
      grants: [],
      claims: [
        { libraryDocumentId: "lib1", staffRole: "editor", canGoLive: true },
      ],
    })
    expect(canSubmit(c, "event_feed", { libraryDocumentId: "lib1" })).toBe(true)
    expect(canSubmit(c, "event_feed", { libraryDocumentId: "lib2" })).toBe(
      false
    )
    expect(canSubmit(c, "event_feed")).toBe(false)
    const reader = resolveCapabilities({
      signedIn: true,
      grants: [],
      claims: [],
    })
    expect(canSubmit(reader, "event_feed", { libraryDocumentId: "lib1" })).toBe(
      false
    )
  })

  it("does not let editors edit library records without a claim (D-C2)", () => {
    const c = resolveCapabilities(input({ contributorRole: "editorial_board" }))
    expect(canSubmit(c, "library_edit", { libraryDocumentId: "lib1" })).toBe(
      false
    )
  })

  it("grants direct doc editing to wiki_editor and editorial_board only", () => {
    for (const role of ["wiki_editor", "editorial_board"] as const)
      expect(
        canSubmit(
          resolveCapabilities(input({ contributorRole: role })),
          "wiki_edit",
          { directWikiEdit: true }
        )
      ).toBe(true)
    for (const role of [
      "reader",
      "contributor",
      "verified_librarian",
      "journal_editor",
    ] as const)
      expect(
        canSubmit(
          resolveCapabilities(input({ contributorRole: role })),
          "wiki_edit",
          { directWikiEdit: true }
        )
      ).toBe(false)
  })

  it("grants direct journal editing to journal_editor and editorial_board only", () => {
    for (const role of ["journal_editor", "editorial_board"] as const) {
      const c = resolveCapabilities(input({ contributorRole: role }))
      expect(c.set.has("journal.directEdit")).toBe(true)
      expect(canSubmit(c, "blog_submission", { directJournalEdit: true })).toBe(
        true
      )
    }
    for (const role of [
      "reader",
      "contributor",
      "verified_librarian",
      "wiki_editor",
    ] as const) {
      const c = resolveCapabilities(input({ contributorRole: role }))
      expect(c.set.has("journal.directEdit")).toBe(false)
      expect(canSubmit(c, "blog_submission", { directJournalEdit: true })).toBe(
        false
      )
    }
  })

  it("splits Knowledge and Journal editing between wiki_editor and journal_editor", () => {
    const wiki = resolveCapabilities(input({ contributorRole: "wiki_editor" }))
    const journal = resolveCapabilities(
      input({ contributorRole: "journal_editor" })
    )
    expect(wiki.set.has("docs.directEdit")).toBe(true)
    expect(wiki.set.has("journal.directEdit")).toBe(false)
    expect(journal.set.has("docs.directEdit")).toBe(false)
    expect(journal.set.has("journal.directEdit")).toBe(true)
  })

  it("rejects unknown submission types", () => {
    const c = resolveCapabilities(input({ contributorRole: "editorial_board" }))
    expect(canSubmit(c, "pro_upgrade" as never)).toBe(false)
  })

  it("gives every signed-in user role applications", () => {
    const c = resolveCapabilities(input({ grants: [] }))
    expect(c.set.has("submit.roleApplication")).toBe(true)
    expect(canSubmit(c, "role_application")).toBe(true)
    expect(c.moderation).toEqual([])
    expect(c.set.has("moderate.queue")).toBe(false)
  })

  it("has no Location Request submission type", () => {
    const c = resolveCapabilities(input({ contributorRole: "editorial_board" }))
    expect(SUBMISSION_TYPES).not.toContain("location_request")
    expect(canSubmit(c, "location_request" as never)).toBe(false)
  })

  it("gives signed-out users empty editor locales and no moderation", () => {
    const c = resolveCapabilities(input({ signedIn: false, grants: [] }))
    expect(c.moderation).toEqual([])
    expect(c.editorLocales.docs).not.toBe("all")
    expect(c.editorLocales.journal).not.toBe("all")
    expect([...(c.editorLocales.docs as ReadonlySet<string>)]).toEqual([])
    expect([...(c.editorLocales.journal as ReadonlySet<string>)]).toEqual([])
    expect(canSubmit(c, "role_application")).toBe(false)
  })

  it("scopes a wiki_editor grant to its locale", () => {
    const c = resolveCapabilities(
      input({ grants: [{ role: "wiki_editor", queue: "all", locale: "fr" }] })
    )
    expect(c.set.has("docs.directEdit")).toBe(true)
    expect(c.set.has("journal.directEdit")).toBe(false)
    expect(canDirectEdit(c, "docs", "fr")).toBe(true)
    expect(canDirectEdit(c, "docs", "en")).toBe(false)
    expect(
      canSubmit(c, "wiki_edit", { directWikiEdit: true, locale: "en" })
    ).toBe(false)
    expect(
      canSubmit(c, "wiki_edit", { directWikiEdit: true, locale: "fr" })
    ).toBe(true)
  })

  it("lets a null-locale journal_editor edit every locale", () => {
    const c = resolveCapabilities(
      input({
        grants: [{ role: "journal_editor", queue: "all", locale: null }],
      })
    )
    expect(c.editorLocales.journal).toBe("all")
    expect(canDirectEdit(c, "journal", "cs")).toBe(true)
    expect(canDirectEdit(c, "docs", "cs")).toBe(false)
    expect(
      canSubmit(c, "blog_submission", { directJournalEdit: true, locale: "cs" })
    ).toBe(true)
  })

  it("gives editorial_board every locale and a global moderation scope", () => {
    const c = resolveCapabilities(
      input({
        grants: [{ role: "editorial_board", queue: "all", locale: null }],
      })
    )
    expect(c.editorLocales.docs).toBe("all")
    expect(c.editorLocales.journal).toBe("all")
    expect(c.set.has("moderate.queue")).toBe(true)
    expect(c.moderation).toEqual([{ queue: "all", locale: null }])
  })

  it("grants drives.manage to editorial_board only", () => {
    const board = resolveCapabilities(
      input({
        grants: [{ role: "editorial_board", queue: "all", locale: null }],
      })
    )
    expect(board.set.has("drives.manage")).toBe(true)

    const moderator = resolveCapabilities(
      input({ grants: [{ role: "moderator", queue: "all", locale: null }] })
    )
    expect(moderator.set.has("drives.manage")).toBe(false)

    const noGrants = resolveCapabilities(input({ grants: [] }))
    expect(noGrants.set.has("drives.manage")).toBe(false)

    const signedOut = resolveCapabilities(
      input({ signedIn: false, grants: [] })
    )
    expect(signedOut.set.has("drives.manage")).toBe(false)
  })

  it("adds nothing for contributor and verified_librarian grants", () => {
    const base = resolveCapabilities(input({ grants: [] }))
    const c = resolveCapabilities(
      input({
        grants: [
          { role: "contributor", queue: "all", locale: null },
          { role: "verified_librarian", queue: "all", locale: null },
        ],
      })
    )
    expect([...c.set].sort()).toEqual([...base.set].sort())
    expect(c.moderation).toEqual([])
  })

  it("maps legacy roles to one global grant, and none for reader", () => {
    expect(grantsFromLegacyRole(null)).toEqual([])
    expect(grantsFromLegacyRole("reader")).toEqual([])
    expect(grantsFromLegacyRole("moderator")).toEqual([
      { role: "moderator", queue: "all", locale: null },
    ])
  })

  it("has no plan or entitlement inputs (money never buys trust)", () => {
    expectTypeOf<CapabilityInput>().not.toHaveProperty("plan")
    expectTypeOf<CapabilityInput>().not.toHaveProperty("subscription")
    expectTypeOf<CapabilityInput>().not.toHaveProperty("entitlements")
  })
})

describe("promoteRole", () => {
  it("raises but never lowers", () => {
    expect(promoteRole("reader", "verified_librarian")).toBe(
      "verified_librarian"
    )
    expect(promoteRole(null, "verified_librarian")).toBe("verified_librarian")
    expect(promoteRole("wiki_editor", "verified_librarian")).toBe("wiki_editor")
    expect(promoteRole("journal_editor", "verified_librarian")).toBe(
      "journal_editor"
    )
    expect(promoteRole("editorial_board", "verified_librarian")).toBe(
      "editorial_board"
    )
  })
})
