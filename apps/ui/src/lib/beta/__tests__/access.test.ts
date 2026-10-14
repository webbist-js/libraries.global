import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  betaConfigured,
  betaDestination,
  createBetaPass,
  sameOriginRequest,
  validBetaPass,
} from "../access"

beforeEach(() => {
  vi.stubEnv("BETA_PASSWORD", "invitation:password")
  vi.stubEnv("BETA_ACCESS_SECRET", "s".repeat(32))
  vi.stubEnv("BETA_ACCESS_VERSION", "1")
})
afterEach(() => vi.unstubAllEnvs())

describe("independent beta pass", () => {
  it("verifies a signed pass and rejects tampering and expiry", () => {
    const pass = createBetaPass({
      invitationId: "i".repeat(24),
      expiresAt: 1000 + 30 * 86400000,
    })
    expect(validBetaPass(pass, 2000)).toBe(true)
    expect(validBetaPass(`${pass.slice(0, -1)}!`, 2000)).toBe(false)
    expect(validBetaPass(pass, 1000 + 30 * 86400000)).toBe(false)
    expect(validBetaPass(`${pass}.extra`, 2000)).toBe(false)
    expect(validBetaPass(`${pass.split(".")[0]}.${"é".repeat(43)}`, 2000)).toBe(
      false
    )
  })
  it("revokes passes on version or signing-secret rotation", () => {
    const pass = createBetaPass({
      invitationId: "i".repeat(24),
      expiresAt: Date.now() + 30 * 86400000,
    })
    vi.stubEnv("BETA_ACCESS_VERSION", "2")
    expect(validBetaPass(pass)).toBe(false)
    vi.stubEnv("BETA_ACCESS_VERSION", "1")
    vi.stubEnv("BETA_ACCESS_SECRET", "t".repeat(32))
    expect(validBetaPass(pass)).toBe(false)
  })
  it("fails closed with missing configuration and contains no user or password", async () => {
    const payload = JSON.parse(
      Buffer.from(
        createBetaPass({
          invitationId: "i".repeat(24),
          expiresAt: Date.now() + 30 * 86400000,
        }).split(".")[0]!,
        "base64url"
      ).toString()
    )
    expect(Object.keys(payload).sort()).toEqual([
      "expiresAt",
      "invitationId",
      "version",
    ])
    vi.stubEnv("BETA_ACCESS_SECRET", "short")
    expect(betaConfigured()).toBe(false)
    expect(validBetaPass("anything")).toBe(false)
  })
})

describe("safe continuation", () => {
  it.each([
    "https://evil.example",
    "//evil.example",
    String.raw`/\evil.example`,
    "/%2f%2fevil.example",
    "/beta",
    "/cs/beta",
    "/api/export",
    "/_next/static/x",
    "/x\n",
    "/x%00",
  ])("rejects %s", (value) => expect(betaDestination(value)).toBe("/"))
  it("preserves internal paths and query strings", () =>
    expect(betaDestination("/cs/libraries?q=London")).toBe(
      "/cs/libraries?q=London"
    ))
})

describe("production request origin", () => {
  it("accepts the public HTTPS origin behind an internal Next.js address", () => {
    vi.stubEnv("NODE_ENV", "production")
    vi.stubEnv("APP_PUBLIC_URL", "https://libraries.global")
    const request = (origin: string, extra: Record<string, string> = {}) =>
      new Request("http://libraries-global-app.internal:3000/api/beta/access", {
        headers: { origin, ...extra },
      })
    expect(sameOriginRequest(request("https://libraries.global"))).toBe(true)
    expect(sameOriginRequest(request("https://evil.example"))).toBe(false)
    expect(
      sameOriginRequest(
        request("https://libraries.global", { "sec-fetch-site": "cross-site" })
      )
    ).toBe(false)
  })
  it("fails closed if the production origin is absent or invalid", () => {
    vi.stubEnv("NODE_ENV", "production")
    const req = new Request("https://libraries.global/api/beta/access", {
      headers: { origin: "https://libraries.global" },
    })
    vi.stubEnv("APP_PUBLIC_URL", "")
    expect(sameOriginRequest(req)).toBe(false)
    vi.stubEnv("APP_PUBLIC_URL", "invalid")
    expect(sameOriginRequest(req)).toBe(false)
  })
})
