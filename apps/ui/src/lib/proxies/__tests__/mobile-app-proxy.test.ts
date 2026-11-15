import { NextRequest, NextResponse } from "next/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { BETA_COOKIE } from "@/lib/beta/access"
import { MOBILE_BETA_COOKIE } from "@/lib/mobile-app"
import proxy from "@/proxy"

const { access, stagingAuth } = vi.hoisted(() => ({
  access: vi.fn(),
  stagingAuth: vi.fn(),
}))
vi.mock("@/lib/beta/invitations", () => ({ hasBetaAccess: access }))
vi.mock("@/lib/proxies/basicAuth", () => ({ basicAuth: stagingAuth }))
vi.mock("@/lib/navigation", () => ({
  routing: { locales: ["en", "cs", "fr"], defaultLocale: "en" },
}))
vi.mock("@/lib/proxies/authGuard", () => ({
  authGuard: vi.fn(async () => null),
}))
vi.mock("next-intl/middleware", () => ({
  default: () => () => NextResponse.next(),
}))

const ID = "a".repeat(24)
const req = (path: string, host = "mobile.libraries.global", headers = {}) =>
  new NextRequest(`https://${host}${path}`, {
    headers: { host, "x-forwarded-proto": "https", ...headers },
  })
beforeEach(() => {
  vi.stubEnv("APP_PUBLIC_URL", "https://libraries.global")
  vi.stubEnv("MOBILE_APP_URL", "https://mobile.libraries.global")
  vi.stubEnv("BETA_GATE_ENABLED", "false")
  vi.stubEnv("BASIC_AUTH_ENABLED", "false")
  vi.stubEnv("BETA_ACCESS_SECRET", "s".repeat(32))
  access.mockResolvedValue(false)
  stagingAuth.mockReturnValue(null)
})
afterEach(() => vi.unstubAllEnvs())

describe("mobile proxy integration", () => {
  it("rewrites a vehicle page and forwards the locale, private shell and matching CSP nonce", async () => {
    const response = await proxy(req(`/cs/${ID}`))
    expect(
      new URL(response.headers.get("x-middleware-rewrite")!).pathname
    ).toBe(`/cs/live/${ID}`)
    expect(response.headers.get("x-middleware-request-x-mobile-app")).toBe(
      "true"
    )
    expect(response.headers.get("x-middleware-request-x-live-console")).toBe(
      "true"
    )
    expect(
      response.headers.get("x-middleware-request-x-next-intl-locale")
    ).toBe("cs")
    const nonce = response.headers.get("x-middleware-request-x-nonce")
    expect(response.headers.get("content-security-policy")).toContain(
      `'nonce-${nonce}'`
    )
    expect(response.headers.get("cache-control")).toBe("no-store")
    expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow")
  })
  it("ignores old beta flags and cookies without granting account access", async () => {
    vi.stubEnv("BETA_GATE_ENABLED", "true")
    const response = await proxy(req(`/fr/${ID}`))
    expect(response.headers.get("x-middleware-rewrite")).toContain(
      `/fr/live/${ID}`
    )
    const main = await proxy(
      req("/auth/mobile", "libraries.global", {
        cookie: `${BETA_COOKIE}=retired`,
      })
    )
    expect(main.cookies.get(MOBILE_BETA_COOKIE)).toBeUndefined()
    expect(access).not.toHaveBeenCalled()
  })
  it("never rewrites live API requests into pages or serves main-site pages on mobile", async () => {
    const response = await proxy(req("/api/mobile/live/start"))
    expect(response.headers.has("x-middleware-rewrite")).toBe(false)
    expect((await proxy(req("/staff"))).status).toBe(404)
    expect((await proxy(req("/live", "libraries.global"))).status).toBe(404)
  })
})

describe("Knowledge Markdown routing", () => {
  it.each([
    ["/knowledge/data-api/guide.md", "/en/knowledge/data-api/guide/markdown"],
    [
      "/fr/knowledge/data-api/guide.md",
      "/fr/knowledge/data-api/guide/markdown",
    ],
  ])(
    "rewrites %s to the text handler while preserving the language query",
    async (path, target) => {
      const response = await proxy(
        req(`${path}?contentLang=cs`, "libraries.global")
      )
      const rewritten = new URL(response.headers.get("x-middleware-rewrite")!)
      expect(rewritten.pathname).toBe(target)
      expect(rewritten.searchParams.get("contentLang")).toBe("cs")
    }
  )

  it("runs staging access checks before Markdown rewrites", async () => {
    vi.stubEnv("BASIC_AUTH_ENABLED", "true")
    stagingAuth.mockReturnValue(
      new NextResponse("Authentication required", { status: 401 })
    )
    const staging = await proxy(
      req("/knowledge/data-api/guide.md", "libraries.global")
    )
    expect(staging.status).toBe(401)
    expect(staging.headers.has("x-middleware-rewrite")).toBe(false)
  })
})
