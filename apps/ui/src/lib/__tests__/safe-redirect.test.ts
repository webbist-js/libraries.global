import { describe, expect, it } from "vitest"

import { safeRedirectPath } from "../safe-redirect"

describe("safeRedirectPath", () => {
  it.each([
    ["/", "/"],
    ["/profile/alex", "/profile/alex"],
    ["/europe/uk/london?tab=hours#main", "/europe/uk/london?tab=hours#main"],
  ])("allows same-origin path %s", (input, expected) => {
    expect(safeRedirectPath(input)).toBe(expected)
  })

  it.each([
    "https://evil.example.com/login",
    "//evil.example.com",
    String.raw`/\evil.example.com`,
    String.raw`\\evil.example.com`,
    // eslint-disable-next-line sonarjs/code-eval -- asserting it is rejected
    "javascript:alert(1)",
    "/%09/evil.example.com".replace("%09", "\t"),
    "profile",
    "",
  ])("rejects %s", (input) => {
    expect(safeRedirectPath(input)).toBe("/")
  })

  it("returns the fallback for null/undefined", () => {
    expect(safeRedirectPath(null, "/home")).toBe("/home")
    expect(safeRedirectPath(undefined)).toBe("/")
  })
})
