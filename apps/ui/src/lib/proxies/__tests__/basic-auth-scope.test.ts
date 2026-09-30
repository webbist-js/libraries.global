import { describe, expect, it } from "vitest"

import { isApiPath, needsBasicAuth } from "../basic-auth-scope"

describe("needsBasicAuth", () => {
  it.each([
    "/",
    "/en",
    "/europe/england",
    "/api/profile/me",
    "/api/newsletter",
    "/api/public-proxy/api/libraries",
    "/api/export/atlas",
    "/api/authors", // not /api/auth
    "/api/previews", // not /api/preview
  ])("guards %s", (path) => {
    expect(needsBasicAuth(path)).toBe(true)
  })

  it.each([
    "/api/cron/retention",
    "/api/cron",
    "/api/preview",
    "/api/preview/",
    "/api/auth/sign-in/email",
    "/api/auth",
    "/api/revalidate",
    "/api/health",
  ])("exempts %s, which carries its own secret or exposes nothing", (path) => {
    expect(needsBasicAuth(path)).toBe(false)
  })
})

describe("isApiPath", () => {
  it("tells route handlers from pages", () => {
    expect(isApiPath("/api/health")).toBe(true)
    expect(isApiPath("/api")).toBe(true)
    expect(isApiPath("/apis")).toBe(false)
    expect(isApiPath("/en/api")).toBe(false)
  })
})
