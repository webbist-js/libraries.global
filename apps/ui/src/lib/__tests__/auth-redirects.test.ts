import { describe, expect, it } from "vitest"

import {
  MAGIC_LINK_ERROR_PATH,
  magicLinkCallbacks,
  POST_SIGNIN_PATH,
} from "../auth-redirects"

/** What Better Auth's verify endpoint does to callbackURL before redirecting. */
function asBetterAuthRedirects(callbackURL: string): URL {
  return new URL(decodeURIComponent(callbackURL), "http://localhost:3000")
}

describe("magicLinkCallbacks", () => {
  it("lands on post-signin with no next when the destination is home", () => {
    expect(magicLinkCallbacks("/")).toEqual({
      callbackURL: POST_SIGNIN_PATH,
      errorCallbackURL: MAGIC_LINK_ERROR_PATH,
    })
    expect(magicLinkCallbacks(null).callbackURL).toBe(POST_SIGNIN_PATH)
    expect(magicLinkCallbacks(undefined).callbackURL).toBe(POST_SIGNIN_PATH)
  })

  it("carries the destination as next, encoded for Better Auth's decode", () => {
    const { callbackURL } = magicLinkCallbacks("/libraries?view=list&sort=name")

    expect(callbackURL).toBe(
      "/auth/post-signin?next=%252Flibraries%253Fview%253Dlist%2526sort%253Dname"
    )
    const landed = asBetterAuthRedirects(callbackURL)
    expect(landed.pathname).toBe("/auth/post-signin")
    expect(landed.searchParams.get("next")).toBe(
      "/libraries?view=list&sort=name"
    )
  })

  it("drops unsafe destinations", () => {
    for (const bad of [
      "https://evil.test/",
      "//evil.test",
      String.raw`/\evil.test`,
      "pro",
    ]) {
      expect(magicLinkCallbacks(bad).callbackURL).toBe(POST_SIGNIN_PATH)
    }
  })

  it("always sends errors to the magic-link page", () => {
    expect(magicLinkCallbacks("/pro").errorCallbackURL).toBe("/auth/magic-link")
  })
})
