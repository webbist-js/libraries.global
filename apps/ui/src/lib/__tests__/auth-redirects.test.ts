import { describe, expect, it } from "vitest"

import {
  MAGIC_LINK_ERROR_PATH,
  magicLinkCallbacks,
  parseVerifyEmailState,
  POST_SIGNIN_PATH,
  signInCallbackURL,
  verifyLinkErrorPath,
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

describe("signInCallbackURL", () => {
  it("lands on post-signin with no next when the destination is home", () => {
    expect(signInCallbackURL("/")).toBe(POST_SIGNIN_PATH)
    expect(signInCallbackURL(null)).toBe(POST_SIGNIN_PATH)
  })

  it("carries the destination as next, encoded once", () => {
    const callbackURL = signInCallbackURL("/libraries?view=list&sort=name")

    expect(callbackURL).toBe(
      "/auth/post-signin?next=%2Flibraries%3Fview%3Dlist%26sort%3Dname"
    )
    // The client navigates to it as is, and a resent confirmation link
    // redirects to it after one encode/decode round trip.
    for (const landed of [
      new URL(callbackURL, "http://localhost:3000"),
      new URL(
        decodeURIComponent(encodeURIComponent(callbackURL)),
        "http://localhost:3000"
      ),
    ]) {
      expect(landed.pathname).toBe("/auth/post-signin")
      expect(landed.searchParams.get("next")).toBe(
        "/libraries?view=list&sort=name"
      )
    }
  })

  it("passes Better Auth's relative callbackURL check", () => {
    // trusted-origins.mjs, allowRelativePaths
    const relative = /^\/(?!\/|\\|%2f|%5c)[\w\-.+/@]*(?:\?[\w\-.+/=&%@]*)?$/
    expect(signInCallbackURL("/libraries?view=list&sort=name")).toMatch(
      relative
    )
  })

  it("drops unsafe destinations", () => {
    expect(signInCallbackURL("https://evil.test/")).toBe(POST_SIGNIN_PATH)
    expect(signInCallbackURL("//evil.test")).toBe(POST_SIGNIN_PATH)
  })
})

describe("verifyLinkErrorPath", () => {
  it("is null without an error", () => {
    expect(verifyLinkErrorPath(undefined)).toBeNull()
    expect(verifyLinkErrorPath("")).toBeNull()
  })

  it("explains an expired link", () => {
    expect(verifyLinkErrorPath("token_expired")).toBe(
      "/auth/verify-email-sent?state=expired"
    )
  })

  it("treats every other code as an invalid link", () => {
    for (const code of ["invalid_token", "user_not_found", "anything"]) {
      expect(verifyLinkErrorPath(code)).toBe(
        "/auth/verify-email-sent?state=invalid"
      )
    }
  })
})

describe("parseVerifyEmailState", () => {
  it("accepts the known states and defaults to sent", () => {
    expect(parseVerifyEmailState("expired")).toBe("expired")
    expect(parseVerifyEmailState("unverified")).toBe("unverified")
    expect(parseVerifyEmailState(undefined)).toBe("sent")
    expect(parseVerifyEmailState(["expired"])).toBe("sent")
    expect(parseVerifyEmailState("<script>")).toBe("sent")
  })
})
