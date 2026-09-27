import { describe, expect, it } from "vitest"

import { buildContributorShortcuts } from "../contributor-shortcuts"

const hrefs = (groups: ReturnType<typeof buildContributorShortcuts>) =>
  groups.map((g) => [g.key, g.items.map((i) => i.href)])

describe("buildContributorShortcuts", () => {
  it("gives readers and contributors no role shortcuts", () => {
    expect(
      buildContributorShortcuts({ capabilities: [], claimedLibraries: [] })
    ).toEqual([])
    expect(
      buildContributorShortcuts({
        capabilities: ["submit.correction", "submit.docSuggestion"],
        claimedLibraries: [],
      })
    ).toEqual([])
  })

  it("links doc editors to the Knowledge editor, and to the CMS for the Journal", () => {
    const groups = buildContributorShortcuts({
      capabilities: ["docs.directEdit"],
      claimedLibraries: [],
      cmsUrl: "https://cms.example.org/",
    })
    expect(hrefs(groups)).toEqual([
      [
        "knowledge",
        [
          "/contribute/knowledge/new",
          "/knowledge",
          "https://cms.example.org/admin/content-manager/collection-types/api::blog-article.blog-article/create",
          "https://cms.example.org/admin/content-manager/collection-types/api::blog-article.blog-article",
        ],
      ],
    ])
    expect(groups[0]?.items.filter((i) => i.external)).toHaveLength(2)
  })

  it("leaves the Journal out when no CMS URL is configured", () => {
    const groups = buildContributorShortcuts({
      capabilities: ["docs.directEdit"],
      claimedLibraries: [],
    })
    expect(hrefs(groups)).toEqual([
      ["knowledge", ["/contribute/knowledge/new", "/knowledge"]],
    ])
  })

  it("names each claimed library in its edit link", () => {
    const groups = buildContributorShortcuts({
      capabilities: ["submit.libraryEdit", "events.feed"],
      claimedLibraries: [
        { name: "British Library", slug: "british-library" },
        { name: "Bodleian", slug: "bodleian" },
      ],
    })
    expect(groups[0]?.title).toBe("Your libraries")
    expect(groups[0]?.items.map((i) => [i.label, i.href])).toEqual([
      ["Edit British Library", "/contribute/edit/british-library"],
      ["Edit Bodleian", "/contribute/edit/bodleian"],
      ["Connect an event feed", "/contribute/events"],
      ["Add a library", "/contribute/add"],
    ])
  })

  it("uses the singular title and skips the event feed without that capability", () => {
    const groups = buildContributorShortcuts({
      capabilities: ["submit.libraryEdit"],
      claimedLibraries: [{ name: "Bodleian", slug: "bodleian" }],
    })
    expect(groups[0]?.title).toBe("Your library")
    expect(hrefs(groups)).toEqual([
      ["libraries", ["/contribute/edit/bodleian", "/contribute/add"]],
    ])
  })

  it("falls back to the edit search while claims are unresolved", () => {
    const groups = buildContributorShortcuts({
      capabilities: ["submit.libraryEdit"],
      claimedLibraries: [{ name: null, slug: "no-name" }],
    })
    expect(groups[0]?.items[0]).toMatchObject({
      label: "Edit your library",
      href: "/contribute/edit",
    })
  })

  it("caps named library links at three", () => {
    const claimed = ["a", "b", "c", "d"].map((s) => ({ name: s, slug: s }))
    const groups = buildContributorShortcuts({
      capabilities: ["submit.libraryEdit"],
      claimedLibraries: claimed,
    })
    expect(hrefs(groups)).toEqual([
      [
        "libraries",
        [
          "/contribute/edit/a",
          "/contribute/edit/b",
          "/contribute/edit/c",
          "/contribute/edit",
          "/contribute/add",
        ],
      ],
    ])
  })

  it("lists library tools before Knowledge tools for someone with both", () => {
    const groups = buildContributorShortcuts({
      capabilities: ["docs.directEdit", "submit.libraryEdit"],
      claimedLibraries: [{ name: "Bodleian", slug: "bodleian" }],
    })
    expect(groups.map((g) => g.key)).toEqual(["libraries", "knowledge"])
  })
})
