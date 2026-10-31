import { afterEach, describe, expect, it, vi } from "vitest"

import {
  analyticsPageAllowed,
  GOOGLE_TAG_MANAGER_ID,
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
  const views = () =>
    (browser.dataLayer ?? [])
      .filter((entry) => (entry as { event?: string }).event === "lg_analytics")
      .map((entry) => [
        "event",
        "page_view",
        (entry as { analytics: unknown }).analytics,
      ])

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
    expect(browser["ga-disable-G-8M465CHXJ6"]).toBe(true)
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
      src: `https://www.googletagmanager.com/gtm.js?id=${GOOGLE_TAG_MANAGER_ID}`,
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
    expect(browser["ga-disable-G-8M465CHXJ6"]).toBe(true)
    expect(views()).toHaveLength(1)
    browser.location.pathname = "/libraries"
    analytics.pageView()
    expect(views()).toHaveLength(2)
    analytics.setConsent(false)
    browser.location.pathname = "/map"
    analytics.pageView()
    expect(views()).toHaveLength(2)
    expect(browser["ga-disable-G-8M465CHXJ6"]).toBe(true)
  })

  it("uses a coarse workspace view when consent is granted on a staff page", () => {
    const { browser, append, views } = fixture(
      "https://libraries.global",
      "/staff/teams"
    )
    installGoogleAnalytics(browser)!.setConsent(true)
    expect(append).toHaveBeenCalledTimes(1)
    expect(views()[0]?.[2]).toMatchObject({
      event_name: "workspace_view",
      page_location: "https://libraries.global/workspace/staff/page/teams",
    })
  })

  it.each([
    "/auth",
    "/cs/staff/library",
    "/fr/live/1",
    "/profile/settings",
    "/contribute",
    "/api/auth",
    "/email/preferences",
    "/moderation",
    "/fr/moderation/suggestions",
    "/moderation/discussions/private-thread",
  ])("excludes %s", (path) => expect(analyticsPageAllowed(path)).toBe(false))

  it.each([
    ["/plans", "membership"],
    ["/library-networks", "network_index"],
    ["/fr/library-networks/public-network", "network"],
    ["/africa/egypt/library-services", "network_index"],
    ["/africa/egypt/library-services/public-service", "network"],
  ])("classifies %s as %s", (path, pageType) => {
    const { browser, views } = fixture("https://libraries.global", path)
    installGoogleAnalytics(browser)!.setConsent(true)
    expect(views()[0]?.[2]).toMatchObject({ page_type: pageType })
  })

  it("sends a coarse moderation view and rejects public interaction fields", () => {
    const { browser, append, views } = fixture(
      "https://libraries.global",
      "/fr/moderation"
    )
    const controller = installGoogleAnalytics(browser)!
    controller.setConsent(true)
    expect(
      controller.track("navigation_action", {
        interaction_source: "navigation",
        action_type: "open",
        destination: "atlas",
      })
    ).toBe(false)
    expect(views()).toHaveLength(1)
    expect(views()[0]?.[2]).toMatchObject({
      event_name: "workspace_view",
      workspace_area: "moderation",
      page_location:
        "https://libraries.global/fr/workspace/moderation/page/overview",
    })
    expect(append).toHaveBeenCalledTimes(1)
  })
})

it("keeps the checkout channel off by default, even with consent", () => {
  const { browser, append } = fixture(
    "https://libraries.global",
    "/staff/teams/billing"
  )
  const analytics = installGoogleAnalytics(browser)!
  analytics.setConsent(true)
  expect(
    analytics.trackCheckout!("begin_checkout", {
      product: "team",
      billing_interval: "year",
    })
  ).toBe(false)
  expect(append).not.toHaveBeenCalled()
})

it("uses a separate consented channel with generic context and no private page views", () => {
  const { browser, append, views } = fixture(
    "https://libraries.global",
    "/fr/staff/teams/billing"
  )
  const analytics = installGoogleAnalytics(browser, undefined, true)!
  const fields = {
    product: "team",
    billing_interval: "year",
    api_addon: "selected",
  }
  expect(analytics.trackCheckout!("begin_checkout", fields)).toBe(false)
  analytics.setConsent(true)
  expect(append).not.toHaveBeenCalled()
  expect(
    analytics.trackCheckout!("begin_checkout", {
      ...fields,
      email: "private@example.test",
      teamId: "private-team",
    })
  ).toBe(true)
  expect(append).toHaveBeenCalledTimes(1)
  expect(views()).toEqual([])
  const events = (browser.dataLayer ?? []).filter(
    (v) => (v as { event?: string }).event === "lg_checkout"
  ) as { analytics: Record<string, unknown> }[]
  expect(events[0]!.analytics).toMatchObject({
    event_name: "begin_checkout",
    page_location: "https://libraries.global/fr/checkout",
    page_referrer: "",
    page_title: "checkout",
    items: [{ item_id: "team", item_variant: "year" }],
  })
  expect(JSON.stringify(events)).not.toMatch(
    /private-team|private@example|staff|token/
  )
  expect(
    analytics.track("membership_interest", {
      interaction_source: "home_plans",
      action_type: "compare",
    })
  ).toBe(false)
  analytics.setConsent(false)
  expect(analytics.trackCheckout!("checkout_handoff", fields)).toBe(false)
})

it("never replays checkout completions across routes or consent epochs", () => {
  const { browser } = fixture("https://libraries.global", "/staff/teams/new")
  const analytics = installGoogleAnalytics(browser, undefined, true)!
  const fields = { product: "team", billing_interval: "year" }
  analytics.setConsent(true)
  const before = analytics.prepareCheckout!("checkout_handoff", fields)
  analytics.setConsent(false)
  analytics.setConsent(true)
  expect(before()).toBe(false)
  const moved = analytics.prepareCheckout!("checkout_handoff", fields)
  browser.location.pathname = "/staff/teams/billing"
  expect(moved()).toBe(false)
  const current = analytics.prepareCheckout!("checkout_handoff", fields)
  expect(current()).toBe(true)
  expect(current()).toBe(false)
  browser.location.pathname = "/staff/private-library/billing"
  expect(analytics.trackCheckout!("checkout_error", fields)).toBe(false)
  expect(
    analytics.trackCheckout!("pricing_action", {
      ...fields,
      action_type: "continue",
    })
  ).toBe(false)
})
