import { NextRequest } from "next/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { BETA_COOKIE, createBetaPass } from "@/lib/beta/access"
import { betaPublicRequest } from "@/lib/beta/scope"

import { betaGate, betaShellRequest } from "../betaGate"

beforeEach(() => {
  vi.stubEnv("BETA_GATE_ENABLED", "true")
  vi.stubEnv("BETA_PASSWORD", "beta-test")
  vi.stubEnv("BETA_ACCESS_SECRET", "s".repeat(32))
})
afterEach(() => vi.unstubAllEnvs())
const request = (path: string, headers = {}) =>
  new NextRequest(`https://libraries.global${path}`, { headers })

describe("beta routing", () => {
  it.each([
    "/",
    "/map",
    "/cs/libraries",
    "/en/profile/settings",
    "/europe/uk/london/st.johns",
    "/api/public-proxy/api/libraries",
    "/api/export/atlas",
    "/sitemap.xml",
    "/sitemaps/libraries-en-1.xml",
  ])("blocks a locked request to %s", (path) =>
    expect(betaGate(request(path))).not.toBeNull()
  )
  it("preserves a deep link and locale", () => {
    const res = betaGate(request("/cs/libraries?q=Praha"))!
    const url = new URL(res.headers.get("location")!)
    expect(url.pathname).toBe("/cs/beta")
    expect(url.searchParams.get("next")).toBe("/cs/libraries?q=Praha")
  })
  it("uses API errors for fetches and RSC", () => {
    expect(betaGate(request("/api/libraries/search"))?.status).toBe(401)
    expect(betaGate(request("/map", { rsc: "1" }))?.status).toBe(401)
  })
  it("allows valid passes and restores public browsing when disabled", () => {
    expect(
      betaGate(
        request("/map", { cookie: `${BETA_COOKIE}=${createBetaPass()}` })
      )
    ).toBeNull()
    vi.stubEnv("BETA_GATE_ENABLED", "false")
    expect(betaGate(request("/map"))).toBeNull()
  })
  it("keeps exceptions exact and method-specific", () => {
    expect(betaPublicRequest("/api/beta/access", "POST")).toBe(true)
    expect(betaPublicRequest("/api/beta/access", "GET")).toBe(false)
    expect(betaPublicRequest("/api/cron/retention", "GET")).toBe(true)
    expect(betaPublicRequest("/api/cron/other", "GET")).toBe(false)
    expect(betaPublicRequest("/api/auth/sign-up/email", "POST")).toBe(false)
    expect(betaPublicRequest("/api/auth/callback/google", "GET")).toBe(true)
  })
  it("strips forged layout flags", () => {
    expect(
      betaShellRequest(
        request("/map", { "x-beta-public-shell": "true" })
      ).headers.has("x-beta-public-shell")
    ).toBe(false)
    expect(
      betaShellRequest(request("/beta")).headers.get("x-beta-public-shell")
    ).toBe("true")
  })
})
