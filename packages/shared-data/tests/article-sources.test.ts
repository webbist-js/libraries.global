import { describe, expect, it } from "vitest"

import { articleContentVersion, parseArticleSources } from "../articles"

describe("managed article citations", () => {
  it("normalizes web URLs consistently for CMS and submission validation", () => {
    expect(
      parseArticleSources([
        { title: "Reference", url: "HTTPS://EXAMPLE.ORG/report" },
      ])[0]?.url
    ).toBe("https://example.org/report")
  })

  it("retains citation order and print references while stripping submitted IDs and extras", () => {
    expect(
      parseArticleSources([
        {
          id: 12,
          title: "  Annual report  ",
          url: "https://library.example/report",
          publisher: "Library",
          accessedAt: "2026-10-28",
          secret: "not public",
        },
        { title: "Printed catalogue", notes: "Volume 2, page 31" },
      ])
    ).toEqual([
      {
        title: "Annual report",
        url: "https://library.example/report",
        publisher: "Library",
        accessedAt: "2026-10-28",
        notes: null,
      },
      {
        title: "Printed catalogue",
        url: null,
        publisher: null,
        accessedAt: null,
        notes: "Volume 2, page 31",
      },
    ])
  })
  it.each([
    // eslint-disable-next-line sonarjs/code-eval -- Rejection fixture; this URL is never executed.
    "javascript:alert(1)",
    "data:text/html,test",
    "file:///private/test",
    "/relative",
    "https://user:secret@example.org/report",
  ])("rejects unsafe or credentialled citation URL %s", (url) => {
    expect(() => parseArticleSources([{ title: "Reference", url }])).toThrow()
  })
  it.each([
    { title: "" },
    { title: "x", accessedAt: "2026-02-31" },
    { title: "x", accessedAt: "not-a-date" },
    { title: "x", notes: "x".repeat(1001) },
  ])("rejects invalid citation fields", (source) => {
    expect(() => parseArticleSources([source])).toThrow()
  })
  it("bounds the list and allows deliberate clearing", () => {
    expect(parseArticleSources([])).toEqual([])
    expect(parseArticleSources(undefined)).toEqual([])
    expect(() =>
      parseArticleSources(
        Array.from({ length: 31 }, () => ({ title: "Reference" }))
      )
    ).toThrow()
  })
  it("includes changed citations in revisions but ignores CMS component IDs", () => {
    const old = {
      title: "Story",
      body: [],
      sources: [{ id: 1, title: "Report", url: "https://example.org/a" }],
    }
    expect(articleContentVersion(old)).toBe(
      articleContentVersion({
        ...old,
        sources: [{ ...old.sources[0], id: 98 }],
      })
    )
    expect(articleContentVersion(old)).not.toBe(
      articleContentVersion({ ...old, sources: [{ title: "Updated report" }] })
    )
    expect(articleContentVersion({ title: "Story" })).toBe(
      articleContentVersion({ title: "Story", sources: [] })
    )
  })
})
