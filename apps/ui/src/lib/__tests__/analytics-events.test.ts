import { describe, expect, it, vi } from "vitest"

import {
  navigationAttributes,
  sanitizeAnalyticsEvent,
} from "@/lib/analytics-events"
import { createReadingTracker } from "@/lib/analytics-reading"
import {
  analyticsPageAllowed,
  installGoogleAnalytics,
} from "@/lib/google-analytics"

function fixture(pathname = "/libraries") {
  const marker = vi.fn(() => null as Element | null)
  const append = vi.fn()
  const browser = {
    location: {
      origin: "https://libraries.global",
      pathname,
      search: "?email=PRIVATE_EMAIL&nlat=51.2345",
      hash: "#PRIVATE_CODE",
    },
    document: {
      title: "PRIVATE_TITLE",
      referrer: "https://example.org/?email=PRIVATE_REFERRER",
      querySelector: marker,
      createElement: () => ({ src: "", async: false }),
      head: { append },
    },
  } as unknown as Window
  const controller = installGoogleAnalytics(browser)!
  const events = () =>
    (browser.dataLayer ?? [])
      .filter((entry) => (entry as { event?: string }).event === "lg_analytics")
      .map((entry) => [
        "event",
        (entry as { analytics: { event_name: string } }).analytics.event_name,
        (entry as { analytics: unknown }).analytics,
      ])
  const named = (name: string) => events().filter((entry) => entry[1] === name)

  return { browser, controller, named, append, marker }
}

const action = {
  interaction_source: "library_hero",
  action_type: "directions",
  library_document_id: "public_library_1",
}

describe("public analytics events", () => {
  it("keeps navigation metadata for localized and anchored public links", () => {
    const attributes = navigationAttributes("/fr/plans#plan-team", "sidebar")
    expect(JSON.parse(attributes["data-analytics-params"]!)).toMatchObject({
      interaction_source: "sidebar",
      destination: "membership",
      action_type: "open",
    })
    expect(navigationAttributes("/library-networks")).toHaveProperty(
      "data-analytics-event",
      "navigation_action"
    )
    expect(navigationAttributes("/moderation?private=secret")).toEqual({})
    expect(navigationAttributes("https://example.org/plans")).toEqual({})
  })
  it("drops events and pending outcomes before grant, without loading a tag", () => {
    const { controller, browser, named, append } = fixture()
    const complete = controller.prepare("library_action", action)
    expect(controller.track("library_action", action)).toBe(false)
    expect(append).not.toHaveBeenCalled()
    expect(
      browser.dataLayer?.some(
        (entry) => (entry as { event?: string }).event === "lg_analytics"
      )
    ).toBe(false)
    controller.setConsent(true)
    expect(complete()).toBe(false)
    expect(named("library_action")).toHaveLength(0)
  })

  it("sends one GTM envelope and no direct Google event with only allowed public context", () => {
    const { controller, browser, named } = fixture()
    controller.setConsent(true)
    expect(
      controller.track("library_action", {
        ...action,
        email: "PRIVATE_EMAIL",
        latitude: 51.2345,
        href: "PRIVATE_LINK",
        page_location: "PRIVATE_URL",
      })
    ).toBe(true)
    expect(named("library_action")).toHaveLength(1)
    expect(named("library_action")[0]?.[2]).toMatchObject({
      ...action,
      page_title: "library_index",
      page_location: "https://libraries.global/libraries",
      content_locale: "en",
    })
    const envelope = browser.dataLayer!.find(
      (entry) =>
        (entry as { analytics?: { event_name?: string } }).analytics
          ?.event_name === "library_action"
    )
    expect(envelope).toMatchObject({
      event: "lg_analytics",
      analytics: {
        ...action,
        event_name: "library_action",
        schema_version: 1,
        transport: "gtm",
      },
    })
    expect(JSON.stringify(browser.dataLayer)).not.toMatch(
      /PRIVATE_|51\.2345|nlat|latitude/
    )
  })

  it("rejects forged event names, invalid actions and sensitive identifiers", () => {
    const { controller, named } = fixture()
    controller.setConsent(true)
    expect(controller.track("page_view", action)).toBe(false)
    expect(controller.track("purchase", action)).toBe(false)
    expect(
      controller.track("library_action", { ...action, action_type: "submit" })
    ).toBe(false)
    expect(
      controller.track("library_action", {
        ...action,
        library_document_id: "person@example.org",
      })
    ).toBe(false)
    expect(
      controller.track("library_action", {
        ...action,
        interaction_source: "raw text",
      })
    ).toBe(false)
    expect(named("library_action")).toHaveLength(0)
  })

  it("invalidates async outcomes on withdrawal/regrant, route changes and completion", () => {
    const { controller, browser, named } = fixture()
    controller.setConsent(true)
    const withdrawn = controller.prepare("library_action", action)
    controller.setConsent(false)
    controller.setConsent(true)
    expect(withdrawn()).toBe(false)
    const navigated = controller.prepare("library_action", action)
    browser.location.pathname = "/map"
    controller.pageView()
    expect(navigated()).toBe(false)
    const accepted = controller.prepare("library_action", action)
    expect(accepted()).toBe(true)
    expect(accepted()).toBe(false)
    expect(named("library_action")).toHaveLength(1)
  })

  it("allows a resolved result bucket without sending the query or counting failure as zero", () => {
    const { controller, named } = fixture()
    controller.setConsent(true)
    const success = controller.prepare("search_results", {
      interaction_source: "find",
      search_type: "libraries",
    })
    expect(
      success({ result_bucket: "zero", search_term: "PRIVATE_QUERY" })
    ).toBe(true)
    controller.prepare("search_error", {
      interaction_source: "find",
      search_type: "libraries",
    })()
    expect(named("search_results")).toHaveLength(1)
    expect(named("search_error")).toHaveLength(1)
    expect(named("search_results")[0]?.[2]).not.toHaveProperty("search_term")
  })

  it("does not inherit a previous library ID or accept a stale page marker", () => {
    const path = "/en/europe/england/norfolk/library-one"
    const { controller, browser, marker, named } = fixture(path)
    marker.mockReturnValue({
      dataset: { analyticsPath: path },
      getAttribute: (name: string) =>
        ({
          "data-analytics-path": path,
          "data-analytics-library-id": "library_one",
        })[name] ?? null,
    } as unknown as Element)
    controller.setConsent(true)
    expect(named("page_view")[0]?.[2]).toHaveProperty(
      "library_document_id",
      "library_one"
    )
    browser.location.pathname = "/en/europe/england/norfolk/library-two"
    controller.pageView()
    expect(named("page_view")[1]?.[2]).not.toHaveProperty("library_document_id")
    browser.location.pathname = "/journal"
    controller.pageView()
    expect(named("page_view")[2]?.[2]).not.toHaveProperty("library_document_id")
    const messages = browser.dataLayer!.filter(
      (entry) => (entry as { event?: string }).event === "lg_analytics"
    )
    expect(
      browser.dataLayer!.filter(
        (entry) => (entry as { analytics?: unknown }).analytics === null
      )
    ).toHaveLength(messages.length + 1)
    const persistent = browser
      .dataLayer!.map((entry) => Array.from(entry as IArguments))
      .filter((entry) => entry[0] === "set" || entry[0] === "config")
    expect(JSON.stringify(persistent)).not.toContain("library_one")
  })

  it.each([
    "/community/drives/new",
    "/fr/community/drives/a-drive/edit",
    "/cs/community/propose",
    "/en/profile/settings",
    "/contribute/membership/checkout",
    "/live/vehicle",
  ])("blocks %s, including before the route effect runs", (path) => {
    expect(analyticsPageAllowed(path)).toBe(false)
    const { controller, browser, named } = fixture()
    controller.setConsent(true)
    browser.location.pathname = path
    expect(controller.track("library_action", action)).toBe(false)
    expect(named("library_action")).toHaveLength(0)
  })

  it("keeps public drives eligible and key leads limited to accepted beta/newsletter requests", () => {
    expect(analyticsPageAllowed("/fr/community/drives/a-drive")).toBe(true)
    expect(
      sanitizeAnalyticsEvent("generate_lead", {
        interaction_source: "contact",
        submission_type: "feedback",
      })
    ).toBeUndefined()
    expect(
      sanitizeAnalyticsEvent("generate_lead", {
        interaction_source: "beta",
        submission_type: "beta_request",
      })
    ).toBeDefined()
  })
})

describe("article reading", () => {
  it("requires both visible reading time and progress, once per view", () => {
    const sample = createReadingTracker(0)
    expect(sample(0, true, 0.1)).toBe(false)
    expect(sample(30_000, true, 0.2)).toBe(false)
    expect(sample(31_000, true, 0.75)).toBe(true)
    expect(sample(60_000, true, 1)).toBe(false)
  })
  it("does not count hidden time or hidden scrolling, and a new consent view starts afresh", () => {
    const sample = createReadingTracker(0)
    sample(0, true, 0.1)
    sample(10_000, false, 0.1)
    expect(sample(90_000, false, 1)).toBe(false)
    expect(sample(100_000, true, 0.1)).toBe(false)
    expect(sample(120_000, true, 0.75)).toBe(true)
    expect(createReadingTracker(120_000)(120_000, true, 1)).toBe(false)
  })
})
