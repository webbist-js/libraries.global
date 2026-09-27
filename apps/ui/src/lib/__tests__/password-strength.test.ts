import { describe, expect, it } from "vitest"

import { passwordStrength } from "../password-strength"

const MIN = 10

describe("passwordStrength", () => {
  it("reports an empty password", () => {
    expect(passwordStrength("", MIN)).toEqual({ score: 0, label: "Empty" })
  })

  it("reports a password under the minimum length as too short", () => {
    expect(passwordStrength("abc123", MIN)).toEqual({
      score: 1,
      label: "Too short",
    })
  })

  it("treats a long run of one or two characters as weak", () => {
    expect(passwordStrength("aaaaaaaaaaaa", MIN)).toEqual({
      score: 1,
      label: "Weak",
    })
    expect(passwordStrength("abababababab", MIN)).toEqual({
      score: 1,
      label: "Weak",
    })
  })

  it("rates a minimum-length single-class password as fair", () => {
    expect(passwordStrength("lanternfox", MIN)).toEqual({
      score: 2,
      label: "Fair",
    })
  })

  it("rates mixed character classes as good", () => {
    expect(passwordStrength("Lantern4fox", MIN)).toEqual({
      score: 3,
      label: "Good",
    })
  })

  it("rates a three-word passphrase as good", () => {
    expect(passwordStrength("maple river lantern", MIN)).toEqual({
      score: 3,
      label: "Good",
    })
  })

  it("rates a four-word passphrase as strong", () => {
    expect(passwordStrength("maple river lantern orbit", MIN)).toEqual({
      score: 4,
      label: "Strong",
    })
  })

  it("rates a long password with mixed classes as strong", () => {
    expect(passwordStrength("Tr0ub4dor&3xyz", MIN)).toEqual({
      score: 4,
      label: "Strong",
    })
  })
})
