// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest"

import {
  analyticsAttributes,
  analyticsConsentGranted,
  analyticsConsentVersion,
  captureAnalyticsEvent,
  installAnalyticsClickTracking,
} from "@/lib/analytics-events"
import {
  installGoogleAnalytics,
  type AnalyticsConsentController,
} from "@/lib/google-analytics"

let remove: (() => void) | undefined
afterEach(() => {
  remove?.()
  remove = undefined
  delete window.librariesGlobalAnalytics
  delete window.gtag
  delete window.dataLayer
  document.body.innerHTML = ""
  vi.restoreAllMocks()
})

function setup() {
  window.location.href = "https://libraries.global/libraries?q=PRIVATE_QUERY"
  vi.spyOn(document.head, "append").mockImplementation(() => {})
  const controller = installGoogleAnalytics(window)!
  remove = installAnalyticsClickTracking(window)
  const named = (name: string) =>
    window
      .dataLayer!.map((entry) => Array.from(entry as IArguments))
      .filter((entry) => entry[0] === "event" && entry[1] === name)

  return { controller, named }
}

describe("explicit semantic interactions", () => {
  it("does not fail an accepted async action when its analytics completion throws", () => {
    window.librariesGlobalAnalytics = {
      prepare: () => () => {
        throw new Error("analytics script failed")
      },
    } as unknown as AnalyticsConsentController
    const complete = captureAnalyticsEvent("generate_lead", {
      interaction_source: "beta",
      submission_type: "beta_request",
    })
    expect(complete()).toBe(false)
  })
  it("keeps new consent readers safe in a tab with the earlier page-view-only controller", () => {
    window.librariesGlobalAnalytics = {
      setConsent: vi.fn(),
      pageView: vi.fn(),
      pause: vi.fn(),
    } as unknown as AnalyticsConsentController
    expect(analyticsConsentGranted()).toBe(false)
    expect(analyticsConsentVersion()).toBe(0)
  })
  it("tracks nested link activation once, without reading its URL or text, and cleans up listeners", () => {
    const { controller, named } = setup()
    const link = document.createElement("a")
    link.href = "https://example.org/?email=PRIVATE_EMAIL"
    Object.entries(
      analyticsAttributes("library_action", {
        interaction_source: "library_sidebar",
        action_type: "catalogue",
        library_document_id: "public_library",
      })
    ).forEach(([key, value]) => link.setAttribute(key, value))
    link.innerHTML = "<span>PRIVATE_LABEL</span>"
    link.addEventListener("click", (event) => event.preventDefault())
    document.body.append(link)
    link.firstElementChild!.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true })
    )
    expect(named("library_action")).toHaveLength(0)
    controller.setConsent(true)
    link.firstElementChild!.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true })
    )
    expect(named("library_action")).toHaveLength(1)
    expect(JSON.stringify(named("library_action"))).not.toContain("PRIVATE_")
    remove!()
    link.dispatchEvent(new MouseEvent("click", { bubbles: true }))
    expect(named("library_action")).toHaveLength(1)
  })

  it("counts a nonempty submitted search, not typing/focus or a click inside its form", () => {
    const { controller, named } = setup()
    const form = document.createElement("form")
    Object.entries(
      analyticsAttributes("search", {
        interaction_source: "article",
        search_type: "knowledge",
      })
    ).forEach(([key, value]) => form.setAttribute(key, value))
    form.innerHTML =
      '<input name="q" value="PRIVATE_EMAIL@example.org"><button>Search</button>'
    document.body.append(form)
    controller.setConsent(true)
    form.firstElementChild!.dispatchEvent(
      new MouseEvent("click", { bubbles: true })
    )
    expect(named("search")).toHaveLength(0)
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }))
    expect(named("search")).toHaveLength(1)
    expect(JSON.stringify(named("search"))).not.toContain("PRIVATE_")
    ;(form.firstElementChild as HTMLInputElement).value = " "
    form.dispatchEvent(new Event("submit", { bubbles: true }))
    expect(named("search")).toHaveLength(1)
  })

  it("ignores unmarked controls and drops malformed metadata without breaking clicks", () => {
    const { controller, named } = setup()
    controller.setConsent(true)
    const button = document.createElement("button")
    document.body.append(button)
    button.dispatchEvent(new MouseEvent("click", { bubbles: true }))
    button.dataset.analyticsEvent = "library_action"
    button.dataset.analyticsParams = "invalid JSON"
    expect(() =>
      button.dispatchEvent(new MouseEvent("click", { bubbles: true }))
    ).not.toThrow()
    expect(named("library_action")).toHaveLength(0)
  })
})
