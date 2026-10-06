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

  it("links Knowledge editors to the Knowledge editor only", () => {
    const groups = buildContributorShortcuts({
      capabilities: ["docs.directEdit"],
      claimedLibraries: [],
    })
    expect(groups[0]?.title).toBe("Knowledge")
    expect(hrefs(groups)).toEqual([
      [
        "knowledge",
        ["/contribute/knowledge/new?type=knowledge", "/contribute/knowledge"],
      ],
    ])
    expect(groups[0]?.items.some((i) => i.external)).toBe(false)
  })

  it("links Journal editors to the Journal side of the editor only", () => {
    const groups = buildContributorShortcuts({
      capabilities: ["journal.directEdit"],
      claimedLibraries: [],
    })
    expect(groups[0]?.title).toBe("Journal")
    expect(hrefs(groups)).toEqual([
      [
        "knowledge",
        [
          "/contribute/knowledge/new?type=journal",
          "/contribute/knowledge?type=journal",
        ],
      ],
    ])
  })

  it("gives the editorial board both, Knowledge first", () => {
    const groups = buildContributorShortcuts({
      capabilities: ["docs.directEdit", "journal.directEdit"],
      claimedLibraries: [],
    })
    expect(groups[0]?.title).toBe("Knowledge & Journal")
    expect(groups[0]?.items.map((i) => i.label)).toEqual([
      "Write a Knowledge article",
      "Edit Knowledge articles",
      "Write a Journal article",
      "Edit Journal articles",
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
      ["Edit British Library", "/contribute/index/british-library"],
      ["Edit Bodleian", "/contribute/index/bodleian"],
      ["Event feeds", "/contribute/events"],
      ["Add a library", "/contribute/index/new"],
    ])
  })

  it("uses the singular title and skips the event feed without that capability", () => {
    const groups = buildContributorShortcuts({
      capabilities: ["submit.libraryEdit"],
      claimedLibraries: [{ name: "Bodleian", slug: "bodleian" }],
    })
    expect(groups[0]?.title).toBe("Your library")
    expect(hrefs(groups)).toEqual([
      ["libraries", ["/contribute/index/bodleian", "/contribute/index/new"]],
    ])
  })

  it("falls back to the edit search while claims are unresolved", () => {
    const groups = buildContributorShortcuts({
      capabilities: ["submit.libraryEdit"],
      claimedLibraries: [{ name: null, slug: "no-name" }],
    })
    expect(groups[0]?.items[0]).toMatchObject({
      label: "Edit your library",
      href: "/contribute/index",
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
          "/contribute/index/a",
          "/contribute/index/b",
          "/contribute/index/c",
          "/contribute/index",
          "/contribute/index/new",
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
