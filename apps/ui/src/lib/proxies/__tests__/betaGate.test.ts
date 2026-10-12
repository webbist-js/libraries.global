import { NextRequest } from "next/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { BETA_COOKIE, BETA_MAX_AGE, createBetaPass } from "@/lib/beta/access"
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
    expect(
      betaShellRequest(request("/legal/terms")).headers.has(
        "x-beta-public-shell"
      )
    ).toBe(false)
  })
  it("keeps exceptions exact and method-specific", () => {
    expect(betaPublicRequest("/privacy", "GET")).toBe(true)
    expect(betaPublicRequest("/privacy", "POST")).toBe(false)
    expect(betaPublicRequest("/legal/terms", "GET")).toBe(true)
    expect(betaPublicRequest("/legal/membership", "GET")).toBe(true)
    expect(betaPublicRequest("/fr/legal/cancellation-refunds", "GET")).toBe(
      true
    )
    expect(betaPublicRequest("/legal/membership", "POST")).toBe(false)
    expect(betaPublicRequest("/cs/legal/terms", "GET")).toBe(true)
    expect(betaPublicRequest("/legal/terms", "POST")).toBe(false)
    expect(betaPublicRequest("/legal/terms/other", "GET")).toBe(false)
    expect(betaPublicRequest("/api/beta/access", "POST")).toBe(true)
    expect(betaPublicRequest("/api/beta/access", "GET")).toBe(false)
    expect(betaPublicRequest("/api/contact", "POST")).toBe(true)
    expect(betaPublicRequest("/api/contact", "GET")).toBe(false)
    expect(betaPublicRequest("/api/contact/other", "POST")).toBe(false)
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
  it.each([
    "/legal/terms",
    "/legal/privacy",
    "/legal/cookies",
    "/legal/membership",
    "/legal/cancellation-refunds",
    "/legal/beta",
    "/cs/legal/membership",
    "/fr/legal/terms",
    "/email/preferences",
  ])("uses the full site shell after beta entry on %s", (path) => {
    const req = request(path, {
      cookie: `${BETA_COOKIE}=${createBetaPass()}`,
      "x-beta-public-shell": "true",
    })
    expect(betaGate(req)).toBeNull()
    expect(betaShellRequest(req).headers.has("x-beta-public-shell")).toBe(false)
  })
  it("keeps the entrance independent and makes the temporary notice public", () => {
    for (const path of [
      "/beta",
      "/legal/beta",
      "/cs/legal/beta",
      "/fr/legal/beta",
    ])
      for (const accepted of [false, true]) {
        const cookie = accepted ? `${BETA_COOKIE}=${createBetaPass()}` : ""
        const req = request(path, { cookie })
        expect(betaGate(req)).toBeNull()
        expect(betaShellRequest(req).headers.has("x-beta-public-shell")).toBe(
          path === "/beta" || !accepted
        )
      }
    expect(betaPublicRequest("/legal/beta", "HEAD")).toBe(true)
    expect(betaPublicRequest("/legal/beta", "POST")).toBe(false)
    expect(betaPublicRequest("/legal/beta/other", "GET")).toBe(false)
  })
  it("keeps invalid and expired passes in the public legal shell", () => {
    for (const pass of [
      "forged",
      createBetaPass(Date.now() - (BETA_MAX_AGE + 1) * 1000),
    ]) {
      const req = request("/legal/membership", {
        cookie: `${BETA_COOKIE}=${pass}`,
      })
      expect(betaShellRequest(req).headers.get("x-beta-public-shell")).toBe(
        "true"
      )
    }
  })
})
