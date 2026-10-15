import { NextRequest } from "next/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  mobileAppConfig,
  mobileConsoleHref,
  mobilePageTarget,
  mobileRequestOrigin,
  mobileSignInHref,
} from "../mobile-app"
import { mobileAppRequest, mobileAppRoute } from "../proxies/mobileApp"
import { isSameOrigin } from "../same-origin"

vi.mock("@/lib/navigation", () => ({
  routing: { locales: ["en", "cs", "fr"], defaultLocale: "en" },
}))
const ID = "a".repeat(24)
const request = (
  path: string,
  host = "mobile.libraries.global",
  headers = {}
) =>
  new NextRequest(`https://${host}${path}`, { headers: { host, ...headers } })

beforeEach(() => {
  vi.stubEnv("APP_PUBLIC_URL", "https://libraries.global")
  vi.stubEnv("MOBILE_APP_URL", "https://mobile.libraries.global")
})
afterEach(() => vi.unstubAllEnvs())

describe("mobile app domain", () => {
  it("maps the root, vehicle and localized manifest into the existing console", () => {
    expect(mobilePageTarget("/")).toBe("/en/live")
    expect(mobilePageTarget(`/${ID}`)).toBe(`/en/live/${ID}`)
    expect(mobilePageTarget(`/fr/${ID}`)).toBe(`/fr/live/${ID}`)
    expect(mobilePageTarget("/cs/manifest.webmanifest")).toBe(
      "/cs/live/manifest.webmanifest"
    )
    expect(mobileConsoleHref(ID, "cs")).toBe(
      `https://mobile.libraries.global/cs/${ID}`
    )
  })
  it.each([
    "/staff",
    "/auth/signin",
    "/sitemap.xml",
    "/api/billing/status",
    "/api/auth/sign-in/email",
    "/live",
    "/fr/live",
    `/${ID}/edit`,
    "/short",
  ])("does not expose other app routes at %s", (path) => {
    expect(mobileAppRoute(request(path))?.status).toBe(404)
  })
  it.each([
    "/",
    `/cs/${ID}`,
    "/manifest.webmanifest",
    "/live-sw.js",
    "/api/mobile/live/start",
    "/api/auth/sign-out",
    "/api/auth/passkey/verify-authentication",
  ])("allows the console dependency %s", (path) => {
    expect(mobileAppRoute(request(path))).toBeNull()
  })
  it("retires the old public /live paths and leaves the rest of the main site alone", () => {
    expect(
      mobileAppRoute(request(`/fr/live/${ID}`, "libraries.global"))?.status
    ).toBe(404)
    expect(mobileAppRoute(request("/about", "libraries.global"))).toBeNull()
  })
  it("disallows crawling the whole mobile origin", async () => {
    const response = mobileAppRoute(request("/robots.txt"))!
    expect(await response.text()).toContain("Disallow: /")
    expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow")
  })
  it("keeps sign-in on the main site and bounds the return path", () => {
    expect(mobilePageTarget(`//${ID}`)).toBeNull()
    expect(
      new URL(mobileSignInHref(`/x/..//${ID}`)).searchParams.get("next")
    ).toBe("/")
    const url = new URL(mobileSignInHref(`/cs/${ID}`))
    expect(url.origin).toBe("https://libraries.global")
    expect(url.pathname).toBe("/cs/auth/mobile")
    expect(url.searchParams.get("next")).toBe(`/cs/${ID}`)
    expect(
      new URL(mobileSignInHref("//evil.example")).searchParams.get("next")
    ).toBe("/")
    expect(new URL(mobileSignInHref("/staff")).searchParams.get("next")).toBe(
      "/"
    )
  })
  it("strips caller-supplied layout markers and derives the flag from the host", () => {
    expect(
      mobileAppRequest(
        request("/about", "libraries.global", { "x-mobile-app": "true" })
      ).headers.has("x-mobile-app")
    ).toBe(false)
    expect(mobileAppRequest(request("/")).headers.get("x-mobile-app")).toBe(
      "true"
    )
  })
  it("requires a live write's origin to match its exact allowed host", () => {
    for (const host of ["libraries.global", "mobile.libraries.global"]) {
      const req = request("/api/mobile/live/start", host, {
        origin: `https://${host}`,
      })
      expect(isSameOrigin(req, mobileRequestOrigin(req))).toBe(true)
    }
    const foreign = request(
      "/api/mobile/live/start",
      "mobile.libraries.global",
      { origin: "https://libraries.global" }
    )
    expect(isSameOrigin(foreign, mobileRequestOrigin(foreign))).toBe(false)
    const unknown = request("/api/mobile/live/start", "evil.example", {
      origin: "https://libraries.global",
    })
    expect(isSameOrigin(unknown, mobileRequestOrigin(unknown))).toBe(false)
  })
  it.each([
    "https://evil.example",
    "http://mobile.libraries.global",
    "https://mobile.libraries.global/path",
    "https://user@mobile.libraries.global",
  ])("rejects an unsafe domain configuration: %s", (value) => {
    vi.stubEnv("MOBILE_APP_URL", value)
    expect(() => mobileAppConfig()).toThrow()
  })
  it("keeps local development working when no mobile domain is configured", () => {
    vi.stubEnv("MOBILE_APP_URL", "")
    expect(mobileAppConfig()).toBeNull()
    expect(mobileConsoleHref(ID)).toBe(`/live/${ID}`)
    expect(mobileAppRoute(request("/live", "libraries.global"))).toBeNull()
  })
})
