import { describe, expect, it } from "vitest"

import type { WikiSection } from "@/lib/strapi-api/content/server"

import {
  DEFAULT_SECTION_ICON,
  compareDocsArticles,
  docsArticlePath,
  docsPathForSearchHit,
  docsSectionSlugsOf,
  homeSectionOf,
  orderedDocsArticles,
  tintForOrder,
  toDocsSections,
  UNFILED_SECTION_SEGMENT,
} from "../docs.config"

const section = (
  over: Partial<WikiSection> & { slug: string }
): WikiSection => ({
  documentId: `doc-${over.slug}`,
  name: over.slug,
  ...over,
})

describe("toDocsSections", () => {
  it("orders by order then name, and reads icon and description", () => {
    const sections = toDocsSections([
      section({ slug: "governance", name: "Governance", order: 6 }),
      section({
        slug: "getting-started",
        name: "Getting started",
        order: 1,
        icon: " mdi:code-tags ",
        description: "  What the project is.  ",
      }),
      section({ slug: "b-section", name: "B", order: 3 }),
      section({ slug: "a-section", name: "A", order: 3 }),
    ])
    expect(sections.map((s) => s.slug)).toEqual([
      "getting-started",
      "a-section",
      "b-section",
      "governance",
    ])
    expect(sections[0]).toMatchObject({
      title: "Getting started",
      icon: "mdi:code-tags",
      description: "What the project is.",
      order: 1,
    })
  })

  it("puts a section with no order last and gives it the default icon", () => {
    const sections = toDocsSections([
      section({ slug: "later", name: "Later", order: null, icon: "" }),
      section({ slug: "first", name: "First", order: 2 }),
    ])
    expect(sections.map((s) => s.slug)).toEqual(["first", "later"])
    expect(sections[1]!.icon).toBe(DEFAULT_SECTION_ICON)
  })

  it("colours a section from its order", () => {
    const [one, two] = toDocsSections([
      section({ slug: "one", order: 1 }),
      section({ slug: "two", order: 2 }),
    ])
    expect(one!.tintBg).toBe(tintForOrder(1).bg)
    expect(two!.tintFg).toBe(tintForOrder(2).fg)
    expect(one!.tintBg).not.toBe(two!.tintBg)
  })

  it("drops a section without a slug or name and tolerates no data", () => {
    expect(
      toDocsSections([section({ slug: "", name: "Nameless slug" })])
    ).toEqual([])
    expect(toDocsSections(undefined)).toEqual([])
  })
})

describe("tintForOrder", () => {
  it("is stable for an order and wraps around the palette", () => {
    expect(tintForOrder(3)).toEqual(tintForOrder(3))
    expect(tintForOrder(10)).toEqual(tintForOrder(3))
    expect(tintForOrder(-3)).toEqual(tintForOrder(3))
  })

  it("falls back to the first tint without an order", () => {
    expect(tintForOrder(null)).toEqual(tintForOrder(0))
    expect(tintForOrder(undefined)).toEqual(tintForOrder(0))
    expect(tintForOrder(Number.NaN)).toEqual(tintForOrder(0))
  })
})

const sections = toDocsSections([
  section({ slug: "getting-started", order: 1 }),
  section({ slug: "contributing", order: 2 }),
  section({ slug: "events", order: 3 }),
])

describe("docsSectionSlugsOf", () => {
  it("lists the section relation first, then the editor's extra tags", () => {
    expect(
      docsSectionSlugsOf({
        section: { documentId: "s", name: "Events", slug: "events" },
        docsSections: ["contributing", "events"],
      })
    ).toEqual(["events", "contributing"])
  })

  it("takes the first tag as home when there is no relation", () => {
    expect(
      docsSectionSlugsOf({ section: null, docsSections: ["contributing"] })
    ).toEqual(["contributing"])
    expect(docsSectionSlugsOf({ section: null, docsSections: null })).toEqual(
      []
    )
  })
})

describe("homeSectionOf", () => {
  it("files an article under its home section", () => {
    expect(
      homeSectionOf(
        { section: { documentId: "s", name: "Events", slug: "events" } },
        sections
      )?.slug
    ).toBe("events")
  })

  it("files an unfiled or stale article under the first section", () => {
    expect(homeSectionOf({ section: null }, sections)?.slug).toBe(
      "getting-started"
    )
    expect(
      homeSectionOf(
        { section: null, docsSections: ["retired-section"] },
        sections
      )?.slug
    ).toBe("getting-started")
  })

  it("answers null when there are no sections", () => {
    expect(homeSectionOf({ section: null }, [])).toBeNull()
  })
})

describe("docsArticlePath", () => {
  const article = {
    slug: "event-feeds",
    section: { documentId: "s", name: "Events", slug: "events" },
  }

  it("links under the home section", () => {
    expect(docsArticlePath(article)).toBe("/knowledge/events/event-feeds")
    expect(docsArticlePath(article, sections)).toBe(
      "/knowledge/events/event-feeds"
    )
  })

  it("links an unfiled article to the first section when the list is to hand", () => {
    expect(docsArticlePath({ slug: "lost", section: null }, sections)).toBe(
      "/knowledge/getting-started/lost"
    )
  })

  it("uses the unfiled segment without the list, for the route to redirect", () => {
    expect(docsArticlePath({ slug: "lost", section: null })).toBe(
      `/knowledge/${UNFILED_SECTION_SEGMENT}/lost`
    )
  })
})

describe("docsPathForSearchHit", () => {
  it("links a hit under its section slug", () => {
    expect(
      docsPathForSearchHit({ slug: "event-feeds", section_slug: "events" })
    ).toBe("/knowledge/events/event-feeds")
    expect(docsPathForSearchHit({ slug: "lost", section_slug: null })).toBe(
      `/knowledge/${UNFILED_SECTION_SEGMENT}/lost`
    )
  })
})

describe("Knowledge reading order", () => {
  it("uses CMS priority before titles and stable document identities for ties", () => {
    const guides = [
      {
        documentId: "deleting",
        title: "Deleting your account",
        priority: -100,
      },
      { documentId: "finding", title: "Finding a library", priority: 80 },
      { documentId: "about", title: "About Libraries Global", priority: 100 },
      { documentId: "unranked-b", title: "Unranked", priority: null },
      { documentId: "unranked-a", title: "Unranked" },
    ]
    expect(
      [...guides].sort(compareDocsArticles).map((guide) => guide.documentId)
    ).toEqual(["about", "finding", "unranked-a", "unranked-b", "deleting"])
    expect(guides[0]?.documentId).toBe("deleting")
  })
})

it("keeps previous/next within each section's curated sequence before the next section", () => {
  const sections = toDocsSections([
    section({ slug: "getting-started", order: 1 }),
    section({ slug: "events", order: 2 }),
  ])
  const guides = [
    { documentId: "events", priority: 1000, docsSections: ["events"] },
    { documentId: "delete", priority: -100, docsSections: ["getting-started"] },
    { documentId: "about", priority: 100, docsSections: ["getting-started"] },
  ]
  expect(
    orderedDocsArticles(guides, sections).map((guide) => guide.documentId)
  ).toEqual(["about", "delete", "events"])
})
