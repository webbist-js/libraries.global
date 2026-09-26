import { describe, expect, it, vi } from "vitest"

// request-auth imports env validation; the matcher itself needs no env.
vi.mock("@/lib/env-vars", () => ({ getEnvVar: () => {} }))

import { isStrapiEndpointAllowed } from "../request-auth"

describe("isStrapiEndpointAllowed", () => {
  it.each([
    "api/libraries",
    "api/libraries/map-pins",
    "api/events/ics/library/GB-BL-001.ics",
    "api/countries",
  ])("allows %s", (path) => {
    expect(isStrapiEndpointAllowed(path, "GET")).toBe(true)
  })

  it.each([
    "api/libraries/../user-profiles",
    "api/libraries/./../user-profiles",
    "api/libraries-private",
    "api/libraries//user-profiles",
    String.raw`api/libraries/..\user-profiles`,
    "api/libraries/%2e%2e/user-profiles",
    "api/user-profiles",
    "api/users/me",
  ])("blocks %s", (path) => {
    expect(isStrapiEndpointAllowed(path, "GET")).toBe(false)
  })

  it("blocks Strapi auth endpoints that would bypass Better Auth", () => {
    expect(isStrapiEndpointAllowed("api/auth/local/register", "POST")).toBe(
      false
    )
    expect(isStrapiEndpointAllowed("api/auth/forgot-password", "POST")).toBe(
      false
    )
  })

  it("still allows newsletter sign-up", () => {
    expect(isStrapiEndpointAllowed("api/subscribers", "POST")).toBe(true)
  })

  it("does not allow methods that are not listed", () => {
    expect(isStrapiEndpointAllowed("api/libraries", "DELETE")).toBe(false)
  })
})
