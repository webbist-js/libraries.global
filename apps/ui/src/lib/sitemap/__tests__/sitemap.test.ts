import { describe, expect, it } from "vitest"

import {
  filesFor,
  pageOf,
  parseSitemapFileName,
  sitemapFileName,
  URLS_PER_FILE,
} from "../files"
import { escapeXml, sitemapIndexXml, urlsetXml } from "../xml"

describe("sitemap files", () => {
  it("holds 10,000 URLs a file, well under the protocol's 50,000", () => {
    expect(URLS_PER_FILE).toBe(10_000)
  })

  it("needs one file per 10,000 URLs, and none for none", () => {
    expect(filesFor(0)).toBe(0)
    expect(filesFor(1)).toBe(1)
    expect(filesFor(10_000)).toBe(1)
    expect(filesFor(10_001)).toBe(2)
    // Every library on earth fits in one index (50,000 files max).
    expect(filesFor(2_900_000)).toBe(290)
  })

  it("names files by category, locale and page, and parses them back", () => {
    const file = { segment: "libraries", locale: "en", page: 3 } as const

    expect(sitemapFileName(file)).toBe("libraries-en-3.xml")
    expect(parseSitemapFileName("libraries-en-3.xml")).toEqual(file)
    expect(parseSitemapFileName("pages-cs-1.xml")).toEqual({
      segment: "pages",
      locale: "cs",
      page: 1,
    })
  })

  it.each([
    "libraries-en-0.xml",
    "libraries-en-01.xml",
    "libraries-en-1",
    "books-en-1.xml",
    "libraries-1.xml",
    "../libraries-en-1.xml",
  ])("refuses %s", (name) => {
    expect(parseSitemapFileName(name)).toBeNull()
  })

  it("slices a list into 1-based pages", () => {
    const items = Array.from({ length: URLS_PER_FILE + 5 }, (_, i) => i)

    expect(pageOf(items, 1)).toHaveLength(URLS_PER_FILE)
    expect(pageOf(items, 2)).toEqual([10_000, 10_001, 10_002, 10_003, 10_004])
    expect(pageOf(items, 3)).toEqual([])
    expect(pageOf(items, 0)).toEqual([])
  })
})

describe("sitemap xml", () => {
  it("escapes the five XML specials", () => {
    expect(escapeXml(`a&b<c>"d'`)).toBe("a&amp;b&lt;c&gt;&quot;d&apos;")
  })

  it("writes a urlset with only the fields each entry has", () => {
    const xml = urlsetXml([
      {
        url: "https://libraries.global/europe?x=1&y=2",
        lastModified: "2026-09-29T00:00:00.000Z",
        changeFrequency: "weekly",
        priority: 0.9,
      },
      { url: "https://libraries.global/map" },
    ])

    expect(xml).toMatch(/^<\?xml version="1.0" encoding="UTF-8"\?>\n<urlset /)
    expect(xml).toContain(
      "<url><loc>https://libraries.global/europe?x=1&amp;y=2</loc><lastmod>2026-09-29T00:00:00.000Z</lastmod><changefreq>weekly</changefreq><priority>0.9</priority></url>"
    )
    expect(xml).toContain("<url><loc>https://libraries.global/map</loc></url>")
  })

  it("writes a sitemap index", () => {
    const xml = sitemapIndexXml([
      "https://libraries.global/sitemaps/pages-en-1.xml",
    ])

    expect(xml).toContain("<sitemapindex ")
    expect(xml).toContain(
      "<sitemap><loc>https://libraries.global/sitemaps/pages-en-1.xml</loc></sitemap>"
    )
  })
})
