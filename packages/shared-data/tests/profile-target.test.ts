import { describe, it, expect } from "vitest"

import { isExistingProfileTarget } from "../profile-target"

describe("bounded existing profile lookup", () => {
  it("accepts historical hyphenated names without changing registration rules", () => {
    expect(isExistingProfileTarget("preview-writer")).toBe(true)
    expect(isExistingProfileTarget("public_reader")).toBe(true)
  })
  it("rejects control characters, path segments, query delimiters and unbounded/empty values", () => {
    for (const target of [
      null,
      [],
      "",
      "a".repeat(31),
      "../private",
      String.raw`name\path`,
      "name?actor=a",
      "name#fragment",
      "name\n",
      " leading",
    ])
      expect(isExistingProfileTarget(target)).toBe(false)
  })
})
