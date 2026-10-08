import { describe, expect, it } from "vitest"

import {
  activeDocsSection,
  openSectionsByDefault,
  sectionPreview,
} from "../docs-sections"

const page = (active: boolean) => ({
  documentId: active ? "a" : "b",
  title: "Page",
  href: "/knowledge/x/y",
  active,
})

describe("openSectionsByDefault", () => {
  it("opens only the section holding the page being read", () => {
    const open = openSectionsByDefault({
      "getting-started": [page(false)],
      contributing: [page(false), page(true)],
      events: [page(false)],
      "data-api": [],
    })
    expect([...open]).toEqual(["contributing"])
  })

  it("opens nothing when no page is active", () => {
    const open = openSectionsByDefault({
      "getting-started": [page(false)],
      contributing: [],
    })
    expect(open.size).toBe(0)
  })
})

describe("activeDocsSection", () => {
  const sections = [{ slug: "contributing" }, { slug: "events" }]

  it("selects a known section slug", () => {
    expect(activeDocsSection("events", sections)).toBe("events")
  })

  it.each([null, undefined, "", "all", "no-such-section"])(
    "shows every section for %s",
    (value) => {
      expect(activeDocsSection(value, sections)).toBe("all")
    }
  )
})

describe("sectionPreview", () => {
  const rows = ["a", "b", "c", "d", "e", "f"]

  it("lists the first four pages on the All sections view, counting the rest", () => {
    expect(sectionPreview(rows, false)).toEqual({
      rows: ["a", "b", "c", "d"],
      hidden: 2,
    })
  })

  it("lists every page on the section's own tab", () => {
    expect(sectionPreview(rows, true)).toEqual({ rows, hidden: 0 })
  })

  it("hides nothing when a section fits within the preview", () => {
    expect(sectionPreview(["a", "b"], false)).toEqual({
      rows: ["a", "b"],
      hidden: 0,
    })
    expect(sectionPreview(["a", "b", "c", "d"], false).hidden).toBe(0)
  })
})
