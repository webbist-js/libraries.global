import { describe, expect, it } from "vitest"

import { redactUrl, redactUrlsInText } from "../../src/lib/redact-url"

describe("redactUrl", () => {
  it("strips the query string, fragment and userinfo", () => {
    expect(
      redactUrl("https://user:secret@feeds.example.com/cal.ics?token=abc#x")
    ).toBe("https://feeds.example.com/cal.ics")
  })

  it("keeps the port and path", () => {
    expect(redactUrl("http://example.com:8080/a/b?k=v")).toBe(
      "http://example.com:8080/a/b"
    )
  })

  it("returns a placeholder for an unparseable URL", () => {
    expect(redactUrl("not a url")).toBe("[url]")
    expect(redactUrl("")).toBe("[url]")
  })
})

describe("redactUrlsInText", () => {
  it("redacts every URL in a message and leaves the rest alone", () => {
    const msg =
      "Aspen feed returned 401: https://a:b@api.example.com/x?apiKey=SECRET and https://other.example.org/y#frag done"
    expect(redactUrlsInText(msg)).toBe(
      "Aspen feed returned 401: https://api.example.com/x and https://other.example.org/y done"
    )
  })

  it("handles text with no URLs and non-strings", () => {
    expect(redactUrlsInText("plain error")).toBe("plain error")
    expect(redactUrlsInText(undefined)).toBeUndefined()
    expect(redactUrlsInText(null)).toBeNull()
  })

  it("does not swallow trailing punctuation", () => {
    expect(redactUrlsInText("see https://example.com/a?x=1.")).toBe(
      "see https://example.com/a."
    )
    expect(redactUrlsInText("(https://example.com/a?x=1)")).toBe(
      "(https://example.com/a)"
    )
  })
})
