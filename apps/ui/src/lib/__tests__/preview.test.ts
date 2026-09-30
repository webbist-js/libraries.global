import { describe, expect, it } from "vitest"

import { isValidPreviewUrl, readPreviewSecret } from "../preview"

describe("isValidPreviewUrl", () => {
  it("accepts root-relative page paths", () => {
    expect(isValidPreviewUrl("/")).toBe(true)
    expect(isValidPreviewUrl("/about")).toBe(true)
    expect(isValidPreviewUrl("/about/team-2026")).toBe(true)
  })

  it("gives the same answer every time (no sticky regex state)", () => {
    for (let i = 0; i < 4; i++) expect(isValidPreviewUrl("/about")).toBe(true)
  })

  it.each(["about", "//evil.example", "/about?x=1", "/a b", "null", ""])(
    "rejects %j",
    (url) => {
      expect(isValidPreviewUrl(url)).toBe(false)
    }
  )
})

describe("readPreviewSecret", () => {
  it("prefers the X-Preview-Secret header", () => {
    const req = new Request("http://localhost/api/preview?secret=query", {
      headers: { "X-Preview-Secret": "header" },
    })

    expect(readPreviewSecret(req)).toBe("header")
  })

  it("falls back to the query string for the Strapi preview button", () => {
    const req = new Request("http://localhost/api/preview?secret=query")

    expect(readPreviewSecret(req)).toBe("query")
  })

  it("returns an empty string when neither is present", () => {
    expect(readPreviewSecret(new Request("http://localhost/api/preview"))).toBe(
      ""
    )
  })
})
