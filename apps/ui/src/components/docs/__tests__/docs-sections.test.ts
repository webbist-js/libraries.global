import { describe, expect, it } from "vitest"

import { openSectionsByDefault } from "../docs-sections"

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
      "design-system": [],
      governance: [],
    })
    expect([...open]).toEqual(["contributing"])
  })

  it("opens nothing when no page is active", () => {
    const open = openSectionsByDefault({
      "getting-started": [page(false)],
      contributing: [],
      events: [],
      "data-api": [],
      "design-system": [],
      governance: [],
    })
    expect(open.size).toBe(0)
  })
})
