import { describe, expect, it, vi } from "vitest"

import {
  targetLabelOf,
  withTargetLabels,
} from "../../src/plugins/content-moderation/server/utils/target-labels"

const names = {
  library: new Map([["abronhill-library", "Abronhill Library"]]),
  wiki: new Map([["how-review-works", "How review works"]]),
  blog: new Map([["new-shelves", "New shelves at the Mitchell"]]),
}

describe("targetLabelOf", () => {
  it("names a record edit or correction after the library", () => {
    expect(
      targetLabelOf(
        { submissionType: "correction", targetSlug: "abronhill-library" },
        names
      )
    ).toBe("Abronhill Library")
    expect(
      targetLabelOf(
        { submissionType: "library_edit", targetSlug: "gone-library" },
        names
      )
    ).toBe("gone-library")
  })

  it("names an event feed after the library, same as a library edit", () => {
    expect(
      targetLabelOf(
        { submissionType: "event_feed", targetSlug: "abronhill-library" },
        names
      )
    ).toBe("Abronhill Library")
  })

  it("names a new library and a claim from their fields", () => {
    expect(
      targetLabelOf(
        { submissionType: "new_library", fields: { name: "Birmingham" } },
        names
      )
    ).toBe("Birmingham")
    expect(
      targetLabelOf(
        {
          submissionType: "library_claim",
          targetSlug: "british-library",
          fields: { libraryName: "British Library" },
        },
        names
      )
    ).toBe("British Library")
  })

  it("names an article from its draft, then its title, then its slug", () => {
    expect(
      targetLabelOf(
        {
          submissionType: "wiki_edit",
          targetSlug: "how-review-works",
          draftData: { title: "How review works (draft)" },
        },
        names
      )
    ).toBe("How review works (draft)")
    expect(
      targetLabelOf(
        { submissionType: "wiki_edit", targetSlug: "how-review-works" },
        names
      )
    ).toBe("How review works")
    expect(
      targetLabelOf(
        { submissionType: "blog_submission", targetSlug: "new-shelves" },
        names
      )
    ).toBe("New shelves at the Mitchell")
    expect(
      targetLabelOf(
        { submissionType: "wiki_edit", targetSlug: "your-account-and-profile" },
        names
      )
    ).toBe("Your Account And Profile")
  })

  it("describes applications", () => {
    expect(
      targetLabelOf(
        {
          submissionType: "role_application",
          fields: { role: "wiki_editor", locales: ["fr"] },
        },
        names
      )
    ).toBe("Knowledge editor application (fr)")
  })
})

describe("withTargetLabels", () => {
  it("looks names up once per kind, only for the slugs it needs", async () => {
    const findMany = vi.fn(
      async ({ where }: { where: { slug: { $in: string[] } } }) =>
        where.slug.$in.includes("abronhill-library")
          ? [{ slug: "abronhill-library", name: "Abronhill Library" }]
          : [{ slug: "how-review-works", title: "How review works" }]
    )
    const strapi = { db: { query: vi.fn(() => ({ findMany })) } }

    const rows = await withTargetLabels(strapi, [
      { submissionType: "correction", targetSlug: "abronhill-library" },
      { submissionType: "library_edit", targetSlug: "abronhill-library" },
      { submissionType: "wiki_edit", targetSlug: "how-review-works" },
      { submissionType: "new_library", fields: { name: "Birmingham" } },
    ])

    expect(rows.map((r) => r.targetLabel)).toEqual([
      "Abronhill Library",
      "Abronhill Library",
      "How review works",
      "Birmingham",
    ])
    // Libraries and Knowledge articles; no Journal lookup with no Journal rows.
    expect(strapi.db.query).toHaveBeenCalledTimes(2)
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { slug: { $in: ["abronhill-library"] } },
      })
    )
  })

  it("falls back to slugs when a lookup fails", async () => {
    const strapi = {
      db: {
        query: () => ({
          findMany: async () => {
            throw new Error("db down")
          },
        }),
      },
    }

    const [row] = await withTargetLabels(strapi, [
      { submissionType: "correction", targetSlug: "abronhill-library" },
    ])

    expect(row?.targetLabel).toBe("abronhill-library")
  })
})
