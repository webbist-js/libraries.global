import { describe, expect, it } from "vitest"

import { followerLabel } from "../LibraryFollowerCount"

describe("followerLabel", () => {
  it("names the count, singular and plural", () => {
    expect(followerLabel(1)).toBe("1 follower")
    expect(followerLabel(1250)).toBe("1,250 followers")
  })

  it("says so when nobody follows yet", () => {
    expect(followerLabel(0)).toBe("No followers yet")
  })
})
