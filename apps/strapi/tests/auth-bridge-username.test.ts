import { describe, expect, it } from "vitest"

import { isValidUsername } from "../src/utils/username"

describe("isValidUsername", () => {
  it.each([
    ["alice_01", true],
    ["ab", false],
    ["Alice", false],
    ["аlice", false],
    ["a".repeat(31), false],
    ["admin", false],
  ])("%s → %s", (u, ok) => expect(isValidUsername(u)).toBe(ok))
})
