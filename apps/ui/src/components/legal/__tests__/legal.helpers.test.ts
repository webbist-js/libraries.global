import { describe, expect, it } from "vitest"

import {
  formatLegalDate,
  formatVersion,
  legalReadingMinutes,
  revisionsNewestFirst,
  sectionAnchors,
  sectionNumber,
} from "../legal.helpers"

const words = (n: number) => Array.from({ length: n }, () => "word").join(" ")

const paragraph = (text: string) => ({
  type: "paragraph",
  children: [{ type: "text", text }],
})

describe("sectionAnchors", () => {
  it("slugifies headings, dropping curly apostrophes", () => {
    expect(
      sectionAnchors([
        { heading: "Who we are" },
        { heading: "What we don’t do" },
      ])
    ).toEqual(["who-we-are", "what-we-dont-do"])
  })

  it("keeps anchors unique when headings repeat", () => {
    expect(
      sectionAnchors([
        { heading: "Changes" },
        { heading: "Changes" },
        { heading: "Changes" },
      ])
    ).toEqual(["changes", "changes-2", "changes-3"])
  })

  it("falls back to a positional anchor for headings with no letters", () => {
    expect(sectionAnchors([{ heading: "—" }])).toEqual(["section-1"])
  })
})

describe("sectionNumber", () => {
  it("zero-pads to two digits", () => {
    expect(sectionNumber(0)).toBe("01")
    expect(sectionNumber(11)).toBe("12")
  })
})

describe("revisionsNewestFirst", () => {
  it("orders by date descending without mutating the input", () => {
    const revisions = [
      { version: "1.0", date: "2025-01-12" },
      { version: "2.1", date: "2026-09-01" },
      { version: "2.0", date: "2026-03-03" },
    ]
    const sorted = revisionsNewestFirst(revisions)

    expect(sorted.map((r) => r.version)).toEqual(["2.1", "2.0", "1.0"])
    expect(revisions.map((r) => r.version)).toEqual(["1.0", "2.1", "2.0"])
  })

  it("handles a missing list", () => {
    expect(revisionsNewestFirst(null)).toEqual([])
  })
})

describe("formatVersion", () => {
  it("adds a v prefix only when missing", () => {
    expect(formatVersion("2.1")).toBe("v2.1")
    expect(formatVersion("v1.4")).toBe("v1.4")
    expect(formatVersion(" V3 ")).toBe("V3")
  })
})

describe("formatLegalDate", () => {
  it("formats date-only strings in UTC so the day never shifts", () => {
    expect(formatLegalDate("2026-09-01")).toBe("1 September 2026")
    // ICU spells en-GB September "Sep" or "Sept" depending on its version.
    expect(formatLegalDate("2026-09-01", "short")).toMatch(/^1 Sept? 2026$/)
  })

  it("returns null for missing or invalid dates", () => {
    expect(formatLegalDate(null)).toBeNull()
    expect(formatLegalDate("not a date")).toBeNull()
  })
})

describe("legalReadingMinutes", () => {
  it("counts only prose: lead, summary points, in-short lines and body text", () => {
    const minutes = legalReadingMinutes({
      lead: words(100),
      summaryPoints: [{ text: words(100) }],
      sections: [
        {
          inShort: words(100),
          body: [
            paragraph(words(150)),
            {
              type: "paragraph",
              children: [
                {
                  type: "link",
                  url: "https://example.org/long/url/with/many/segments",
                  children: [{ type: "text", text: words(150) }],
                },
              ],
            },
          ],
        },
      ],
    })

    // 600 words at 200 wpm; the URL and node types must not count.
    expect(minutes).toBe(3)
  })

  it("never reports less than a minute", () => {
    expect(legalReadingMinutes({ sections: [] })).toBe(1)
  })
})
