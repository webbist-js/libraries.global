import { describe, expect, expectTypeOf, it } from "vitest"

import {
  canSubmit,
  promoteRole,
  resolveCapabilities,
  type CapabilityInput,
} from "../src"

const input = (over: Partial<CapabilityInput> = {}): CapabilityInput => ({
  signedIn: true,
  contributorRole: "reader",
  claims: [],
  ...over,
})

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
  })

  it("only allows library_edit on claimed libraries", () => {
    const c = resolveCapabilities(
      input({
        contributorRole: "verified_librarian",
        claims: [{ libraryDocumentId: "lib1" }],
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
    for (const role of ["reader", "contributor", "verified_librarian"] as const)
      expect(
        canSubmit(
          resolveCapabilities(input({ contributorRole: role })),
          "wiki_edit",
          { directWikiEdit: true }
        )
      ).toBe(false)
  })

  it("rejects unknown submission types", () => {
    const c = resolveCapabilities(input({ contributorRole: "editorial_board" }))
    expect(canSubmit(c, "pro_upgrade" as never)).toBe(false)
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
    expect(promoteRole("editorial_board", "verified_librarian")).toBe(
      "editorial_board"
    )
  })
})
