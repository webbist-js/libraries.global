import { describe, expect, it } from "vitest"

import {
  buildIcs,
  escapeIcs,
  foldLine,
  safeIcsFilename,
} from "../../src/plugins/events/server/utils/ics"

const base = {
  uid: "abc123",
  summary: "Reading Group",
  dtstart: "2026-06-01T13:00:00.000Z",
  dtend: "2026-06-01T14:00:00.000Z",
}

/** Every line of an ICS body, unfolded (a continuation line starts with a space). */
const logicalLines = (ics: string) => ics.replaceAll("\r\n ", "").split("\r\n")

describe("escapeIcs", () => {
  it("escapes backslash, semicolon, comma and newlines, and drops CR", () => {
    expect(escapeIcs(String.raw`a;b,c\d`)).toBe(String.raw`a\;b\,c\\d`)
    expect(escapeIcs("line1\nline2")).toBe(String.raw`line1\nline2`)
    expect(escapeIcs("line1\r\nline2")).toBe(String.raw`line1\nline2`)
    expect(escapeIcs("line1\rline2")).toBe("line1line2")
  })
})

describe("foldLine", () => {
  it("leaves short lines alone", () => {
    expect(foldLine("SUMMARY:short")).toBe("SUMMARY:short")
  })

  it("folds at 75 octets, not 75 characters", () => {
    // 'é' is 2 octets in UTF-8: 60 of them = 120 octets, 60 characters.
    const line = `SUMMARY:${"é".repeat(60)}`
    const folded = foldLine(line)
    const physical = folded.split("\r\n")
    expect(physical.length).toBeGreaterThan(1)
    for (const p of physical)
      expect(Buffer.byteLength(p, "utf8")).toBeLessThanOrEqual(75)
    for (const p of physical.slice(1)) expect(p.startsWith(" ")).toBe(true)
    // never split a multibyte character
    for (const p of physical) expect(p).not.toContain("�")
    expect(folded.replaceAll("\r\n ", "")).toBe(line)
  })

  it("folds a long ASCII line into <=75 octet pieces that reassemble", () => {
    const line = `DESCRIPTION:${"x".repeat(300)}`
    const folded = foldLine(line)
    for (const p of folded.split("\r\n"))
      expect(Buffer.byteLength(p)).toBeLessThanOrEqual(75)
    expect(folded.replaceAll("\r\n ", "")).toBe(line)
  })
})

describe("buildIcs", () => {
  it("CRLF injection in the title produces no extra lines", () => {
    const ics = buildIcs(
      [
        {
          ...base,
          summary: "Talk\r\nATTENDEE:mailto:evil@example.com\nEND:VEVENT",
        },
      ],
      "Cal"
    )
    const lines = logicalLines(ics)
    expect(lines.filter((l) => l.startsWith("ATTENDEE"))).toHaveLength(0)
    expect(lines.filter((l) => l === "END:VEVENT")).toHaveLength(1)
    expect(lines.find((l) => l.startsWith("SUMMARY:"))).toBe(
      String.raw`SUMMARY:Talk\nATTENDEE:mailto:evil@example.com\nEND:VEVENT`
    )
  })

  it("CRLF injection in the url produces no extra lines, and the URL is escaped", () => {
    const ics = buildIcs(
      [{ ...base, url: "https://example.com/e/1\r\nX-EVIL:1\nEND:VCALENDAR" }],
      "Cal"
    )
    const lines = logicalLines(ics)
    expect(lines.filter((l) => l.startsWith("X-EVIL"))).toHaveLength(0)
    expect(lines.filter((l) => l === "END:VCALENDAR")).toHaveLength(1)
    const url = lines.find((l) => l.startsWith("URL:"))
    expect(url).toBeDefined()
    expect(url).not.toContain("\n")
  })

  it("only emits URL for http(s) links", () => {
    for (const bad of [
      // eslint-disable-next-line sonarjs/code-eval -- a fixture that must be rejected, never evaluated
      "javascript:alert(1)",
      "ftp://x",
      "data:text/html,hi",
      " mailto:a@b",
    ]) {
      const ics = buildIcs([{ ...base, url: bad }], "Cal")
      expect(logicalLines(ics).some((l) => l.startsWith("URL:"))).toBe(false)
    }
    const ok = buildIcs(
      [{ ...base, url: "https://example.com/e/1?a=1,2;3" }],
      "Cal"
    )
    expect(logicalLines(ok).find((l) => l.startsWith("URL:"))).toBe(
      String.raw`URL:https://example.com/e/1?a=1\,2\;3`
    )
  })

  it("never emits a null UID", () => {
    const ics = buildIcs(
      [
        { ...base, uid: null as unknown as string },
        { ...base, uid: "" },
      ],
      "Cal"
    )
    const uids = logicalLines(ics).filter((l) => l.startsWith("UID:"))
    expect(uids).toHaveLength(2)
    for (const u of uids) {
      expect(u).not.toContain("null@")
      expect(u).not.toContain("undefined@")
      expect(u).toMatch(/^UID:[A-Za-z0-9-]+@libraries\.global$/)
    }
    expect(new Set(uids).size).toBe(2)
  })

  it("escapes the calendar name and location", () => {
    const ics = buildIcs(
      [{ ...base, location: "A;B\r\nC" }],
      "Name\r\nX-INJECT:1"
    )
    const lines = logicalLines(ics)
    expect(lines.filter((l) => l.startsWith("X-INJECT"))).toHaveLength(0)
    expect(lines.find((l) => l.startsWith("LOCATION:"))).toBe(
      String.raw`LOCATION:A\;B\nC`
    )
  })

  it("every physical line is at most 75 octets", () => {
    const ics = buildIcs(
      [{ ...base, description: "ü".repeat(200), summary: "x".repeat(200) }],
      "Cal"
    )
    for (const p of ics.split("\r\n"))
      expect(Buffer.byteLength(p)).toBeLessThanOrEqual(75)
  })
})

describe("safeIcsFilename", () => {
  it("keeps only [A-Za-z0-9_-]", () => {
    expect(safeIcsFilename("GB-BL-001")).toBe("GB-BL-001")
    expect(safeIcsFilename('a"b;c/d\\e f\r\n')).toBe("abcdef")
    expect(safeIcsFilename("")).toBe("events")
    expect(safeIcsFilename("../../etc/passwd")).toBe("etcpasswd")
  })
})
