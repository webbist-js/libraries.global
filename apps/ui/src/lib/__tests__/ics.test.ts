import { describe, expect, it } from "vitest"

import { escapeIcs, escapeIcsUri, isEventDocumentId } from "../ics"

describe("escapeIcs", () => {
  it("escapes backslashes, semicolons and commas", () => {
    expect(escapeIcs(String.raw`a\b;c,d`)).toBe(String.raw`a\\b\;c\,d`)
  })

  it(
    String.raw`turns every line break into a literal \n so no line can be injected`,
    () => {
      expect(escapeIcs("one\r\ntwo\nthree\rfour")).toBe(
        String.raw`one\ntwo\nthree\nfour`
      )
    }
  )

  it("strips other control characters", () => {
    expect(escapeIcs("a\u0000b\u0007c")).toBe("abc")
  })

  it("leaves ordinary text alone", () => {
    expect(escapeIcs("Reading group: Ulysses")).toBe("Reading group: Ulysses")
  })
})

describe("escapeIcsUri", () => {
  it("keeps a plain http(s) URL, commas included", () => {
    expect(escapeIcsUri("https://example.org/a,b?c=1")).toBe(
      "https://example.org/a,b?c=1"
    )
  })

  it("removes CR and LF so a URL can't add ICS lines", () => {
    expect(escapeIcsUri("https://example.org/\r\nX-EVIL:1")).toBe(
      "https://example.org/X-EVIL:1"
    )
  })

  it("rejects anything that isn't an http(s) URL", () => {
    expect(escapeIcsUri("mailto:reader@example.org")).toBeNull()
    expect(escapeIcsUri("not a url")).toBeNull()
    expect(escapeIcsUri("ftp://example.org/x")).toBeNull()
  })
})

describe("isEventDocumentId", () => {
  it.each(["abc123", "A1", "x".repeat(64)])("accepts %s", (id) => {
    expect(isEventDocumentId(id)).toBe(true)
  })

  it.each(["", "x".repeat(65), "../events", "a b", "a/b", "id?x=1"])(
    "rejects %j",
    (id) => {
      expect(isEventDocumentId(id)).toBe(false)
    }
  )
})
