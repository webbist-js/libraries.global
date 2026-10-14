import { afterEach, describe, expect, it, vi } from "vitest"

import {
  analyticsPageAllowed,
  GOOGLE_ANALYTICS_ID,
  installGoogleAnalytics,
  productionAnalyticsEnabled,
} from "../google-analytics"

function fixture(origin = "https://libraries.global", pathname = "/beta") {
  const append = vi.fn()
  const browser = {
    location: { origin, pathname, search: "?token=private", hash: "#secret" },
    document: {
      title: "Libraries Global",
      referrer: "https://example.org/search?email=private",
      createElement: () => ({ async: false, src: "", nonce: "" }),
      head: { append },
    },
  } as unknown as Window
  const commands = () =>
    (browser.dataLayer ?? []).map((entry) => Array.from(entry as IArguments))
  const views = () => commands().filter((entry) => entry[1] === "page_view")

  return { browser, append, commands, views }
}

afterEach(() => vi.unstubAllEnvs())

describe("production analytics", () => {
  it("requires a production build, production app environment and the canonical site", () => {
    vi.stubEnv("NODE_ENV", "production")
    vi.stubEnv("APP_ENV", "production")
    vi.stubEnv("APP_PUBLIC_URL", "https://libraries.global/")
    expect(productionAnalyticsEnabled()).toBe(true)
    vi.stubEnv("APP_PUBLIC_URL", "https://preview.libraries.global")
    expect(productionAnalyticsEnabled()).toBe(false)
    vi.stubEnv("APP_PUBLIC_URL", "https://libraries.global")
    vi.stubEnv("APP_ENV", "testing")
    expect(productionAnalyticsEnabled()).toBe(false)
    vi.stubEnv("APP_ENV", "production")
    vi.stubEnv("NODE_ENV", "development")
    expect(productionAnalyticsEnabled()).toBe(false)
  })

  it.each(["http://localhost:3000", "https://preview.libraries.global"])(
    "does not initialise a tag in a browser on %s",
    (origin) => {
      const { browser, append } = fixture(origin)
      expect(installGoogleAnalytics(browser)).toBeUndefined()
      expect(browser.dataLayer).toBeUndefined()
      expect(append).not.toHaveBeenCalled()
    }
  )

  it("loads nothing and queues no measurement before consent or after refusal", () => {
    const { browser, append, views, commands } = fixture()
    const analytics = installGoogleAnalytics(browser)!
    analytics.pageView()
    analytics.setConsent(false)
    expect(append).not.toHaveBeenCalled()
    expect(views()).toEqual([])
    expect(commands().some((entry) => entry[0] === "config")).toBe(false)
    expect(browser["ga-disable-G-N6DLE0CK0Y"]).toBe(true)
  })

  it("loads once after consent, strips query/hash/referrer data and deduplicates route views", () => {
    const { browser, append, views } = fixture()
    const analytics = installGoogleAnalytics(browser, "test-nonce")!
    analytics.setConsent(true)
    analytics.setConsent(true)
    analytics.pageView()
    expect(append).toHaveBeenCalledTimes(1)
    expect(append.mock.calls[0]?.[0]).toMatchObject({
      async: true,
      src: `https://www.googletagmanager.com/gtag/js?id=${GOOGLE_ANALYTICS_ID}`,
      nonce: "test-nonce",
    })
    expect(views()).toHaveLength(1)
    expect(views()[0]?.[2]).toMatchObject({
      page_location: "https://libraries.global/beta",
      page_referrer: "https://example.org",
    })
    browser.location.pathname = "/fr/libraries"
    analytics.pageView()
    expect(views()).toHaveLength(2)
    expect(append).toHaveBeenCalledTimes(1)
  })

  it("stops measurement on private routes and after withdrawal", () => {
    const { browser, views } = fixture()
    const analytics = installGoogleAnalytics(browser)!
    analytics.setConsent(true)
    browser.location.pathname = "/fr/auth/reset-password"
    analytics.pageView()
    expect(browser["ga-disable-G-N6DLE0CK0Y"]).toBe(true)
    expect(views()).toHaveLength(1)
    browser.location.pathname = "/libraries"
    analytics.pageView()
    expect(views()).toHaveLength(2)
    analytics.setConsent(false)
    browser.location.pathname = "/map"
    analytics.pageView()
    expect(views()).toHaveLength(2)
    expect(browser["ga-disable-G-N6DLE0CK0Y"]).toBe(true)
  })

  it("does not load a tag when consent is granted on a private page", () => {
    const { browser, append } = fixture(
      "https://libraries.global",
      "/staff/team"
    )
    installGoogleAnalytics(browser)!.setConsent(true)
    expect(append).not.toHaveBeenCalled()
  })

  it.each([
    "/auth",
    "/cs/staff/library",
    "/fr/live/1",
    "/profile/settings",
    "/contribute",
    "/api/auth",
    "/email/preferences",
  ])("excludes %s", (path) => expect(analyticsPageAllowed(path)).toBe(false))
})
