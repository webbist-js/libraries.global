import { describe, expect, it } from "vitest"

import { isActivityPublic } from "../src/utils/activity-visibility"

describe("isActivityPublic", () => {
  it("is public for a public profile by default", () => {
    expect(isActivityPublic({ profileVisibility: "public" })).toBe(true)
  })

  it("is hidden when a public profile opts out", () => {
    expect(
      isActivityPublic({
        profileVisibility: "public",
        publicPrefs: { showActivity: false },
      })
    ).toBe(false)
  })

  it("is hidden for private and limited profiles, even with activity on", () => {
    for (const profileVisibility of ["private", "limited"])
      expect(
        isActivityPublic({
          profileVisibility,
          publicPrefs: { showActivity: true },
        })
      ).toBe(false)
  })
})
