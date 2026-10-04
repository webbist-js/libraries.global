import { describe, expect, it } from "vitest"

import {
  DEFAULT_JOURNAL_QUERY,
  DEFAULT_SECTION_ICON,
  journalHref,
  journalSortParam,
  pageWindow,
  parseJournalQuery,
  placeLabel,
  resolveJournalLanguage,
  sectionVisual,
  showingRange,
} from "./journalLanding.helpers"

describe("parseJournalQuery", () => {
  it("defaults when nothing is given", () => {
    expect(parseJournalQuery({})).toEqual(DEFAULT_JOURNAL_QUERY)
  })

  it("reads valid values", () => {
    expect(
      parseJournalQuery({
        section: "field-notes",
        sort: "oldest",
        page: "3",
        view: "list",
        lang: "fr",
      })
    ).toEqual({
      section: "field-notes",
      sort: "oldest",
      page: 3,
      view: "list",
      lang: "fr",
    })
  })

  it("drops malformed values", () => {
    expect(
      parseJournalQuery({
        section: "../etc",
        sort: "random",
        page: "-2",
        view: "table",
        lang: "english!",
      })
    ).toEqual(DEFAULT_JOURNAL_QUERY)
  })

  it("takes the first of repeated params and caps the page", () => {
    const q = parseJournalQuery({ section: ["history", "x"], page: "99999" })
    expect(q.section).toBe("history")
    expect(q.page).toBe(10_000)
  })
})

describe("journalHref", () => {
  const base = { ...DEFAULT_JOURNAL_QUERY, section: "history", page: 3 }

  it("leaves defaults out", () => {
    expect(journalHref(DEFAULT_JOURNAL_QUERY)).toBe("/journal")
  })

  it("keeps the page when only the view changes", () => {
    expect(journalHref(base, { view: "list" })).toBe(
      "/journal?section=history&page=3&view=list"
    )
  })

  it("starts again at page 1 when the section, sort or language changes", () => {
    expect(journalHref(base, { section: null })).toBe("/journal")
    expect(journalHref(base, { sort: "title" })).toBe(
      "/journal?section=history&sort=title"
    )
    expect(journalHref(base, { lang: "cs" })).toBe(
      "/journal?section=history&lang=cs"
    )
  })

  it("sets an explicit page and a hash", () => {
    expect(journalHref(base, { page: 4 }, "all-articles")).toBe(
      "/journal?section=history&page=4#all-articles"
    )
  })
})

describe("journalSortParam", () => {
  it("breaks ties by id", () => {
    expect(journalSortParam("newest")).toEqual(["publishedAt:desc", "id:desc"])
    expect(journalSortParam("oldest")).toEqual(["publishedAt:asc", "id:asc"])
    expect(journalSortParam("title")).toEqual(["title:asc", "id:asc"])
  })
})

describe("pageWindow", () => {
  it("lists every page up to seven", () => {
    expect(pageWindow(2, 3)).toEqual([1, 2, 3])
    expect(pageWindow(1, 7)).toEqual([1, 2, 3, 4, 5, 6, 7])
  })

  it("windows long ranges around the current page", () => {
    expect(pageWindow(1, 20)).toEqual([1, 2, 3, 4, 5, "gap-end", 20])
    expect(pageWindow(10, 20)).toEqual([
      1,
      "gap-start",
      9,
      10,
      11,
      "gap-end",
      20,
    ])
    expect(pageWindow(20, 20)).toEqual([1, "gap-start", 16, 17, 18, 19, 20])
  })
})

describe("showingRange", () => {
  it("bounds the current page", () => {
    expect(showingRange(1, 9, 27)).toEqual({ from: 1, to: 9 })
    expect(showingRange(3, 9, 22)).toEqual({ from: 19, to: 22 })
  })

  it("is empty past the end or with nothing", () => {
    expect(showingRange(4, 9, 27)).toEqual({ from: 0, to: 0 })
    expect(showingRange(1, 9, 0)).toEqual({ from: 0, to: 0 })
  })
})

describe("placeLabel", () => {
  it("pairs the most specific place with the country", () => {
    expect(
      placeLabel([
        {
          area: { name: "Radlett" },
          region: { name: "Hertfordshire" },
          country: { name: "England" },
        },
      ])
    ).toBe("Radlett, England")
    expect(
      placeLabel([
        { region: { name: "Norfolk" }, country: { name: "England" } },
      ])
    ).toBe("Norfolk, England")
  })

  it("falls back to whatever is known and skips libraries without a place", () => {
    expect(placeLabel([{}, { country: { name: "Wales" } }])).toBe("Wales")
    expect(
      placeLabel([{ region: { name: "Wales" }, country: { name: "Wales" } }])
    ).toBe("Wales")
  })

  it("is null without libraries", () => {
    expect(placeLabel(null)).toBeNull()
    expect(placeLabel([])).toBeNull()
  })
})

describe("resolveJournalLanguage", () => {
  const base = { routeLocale: "cs", defaultLocale: "en" }

  it("uses the requested language when it has articles", () => {
    expect(
      resolveJournalLanguage({
        ...base,
        requested: "fr",
        available: ["en", "fr"],
      })
    ).toBe("fr")
  })

  it("falls back to the route locale, then English", () => {
    expect(
      resolveJournalLanguage({
        ...base,
        requested: "de",
        available: ["en", "cs"],
      })
    ).toBe("cs")
    expect(
      resolveJournalLanguage({ ...base, requested: null, available: ["en"] })
    ).toBe("en")
  })

  it("uses any language that has articles, else the default", () => {
    expect(
      resolveJournalLanguage({ ...base, requested: null, available: ["fr"] })
    ).toBe("fr")
    expect(
      resolveJournalLanguage({ ...base, requested: null, available: [] })
    ).toBe("en")
  })
})

describe("sectionVisual", () => {
  it("uses the section's icon and tint", () => {
    expect(sectionVisual({ icon: "mdi:bank-outline", tint: "rust" })).toEqual({
      icon: "mdi:bank-outline",
      bg: "var(--tint-special-bg)",
      fg: "var(--tint-special-fg)",
    })
  })

  it("falls back to a book in neutral", () => {
    expect(sectionVisual({ icon: "not an icon", tint: "pink" })).toEqual({
      icon: DEFAULT_SECTION_ICON,
      bg: "var(--tint-neutral-bg)",
      fg: "var(--tint-neutral-fg)",
    })
    expect(sectionVisual(null).icon).toBe(DEFAULT_SECTION_ICON)
  })
})
