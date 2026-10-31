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
import { workspaceNavigationAttributes } from "@/lib/workspace-analytics"

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

function setup(workspaceEnabled = false) {
  window.location.href = "https://libraries.global/libraries?q=PRIVATE_QUERY"
  vi.spyOn(document.head, "append").mockImplementation(() => {})
  const controller = installGoogleAnalytics(
    window,
    undefined,
    false,
    workspaceEnabled
  )!
  remove = installAnalyticsClickTracking(window)
  const named = (name: string) =>
    window
      .dataLayer!.filter(
        (entry) => (entry as { event?: string }).event === "lg_analytics"
      )
      .map((entry) => [
        "event",
        (entry as { analytics: { event_name: string } }).analytics.event_name,
        (entry as { analytics: unknown }).analytics,
      ])
      .filter((entry) => entry[1] === name)

  return { controller, named }
}

describe("explicit semantic interactions", () => {
  it("records a workspace menu intent once without its private URL or duplicate public event", () => {
    const { controller, named } = setup(true)
    const link = document.createElement("a")
    link.href = "/staff/PRIVATE_LIBRARY/events?token=PRIVATE_TOKEN"
    Object.entries(
      workspaceNavigationAttributes(link.getAttribute("href")!, "drawer")
    ).forEach(([key, value]) => link.setAttribute(key, value))
    Object.entries(
      analyticsAttributes("navigation_action", {
        interaction_source: "navigation",
        action_type: "open",
        destination: "contribute",
      })
    ).forEach(([key, value]) => link.setAttribute(key, value))
    link.innerHTML = "<span>PRIVATE_LABEL</span>"
    link.addEventListener("click", (event) => event.preventDefault())
    document.body.append(link)
    controller.setConsent(true)
    link.firstElementChild!.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true })
    )
    expect(named("workspace_action")).toHaveLength(1)
    expect(named("navigation_action")).toHaveLength(0)
    expect(named("workspace_action")[0]?.[2]).toMatchObject({
      workspace_area: "staff",
      workspace_section: "events",
      workspace_surface: "drawer",
      action_type: "select",
      action_outcome: "intent",
    })
    expect(JSON.stringify(window.dataLayer)).not.toContain("PRIVATE_")
  })
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
  it("records network facet submissions as bounded filter actions, without field values", () => {
    const { controller, named } = setup()
    controller.setConsent(true)
    const form = document.createElement("form")
    Object.entries(
      analyticsAttributes("search", {
        interaction_source: "network_directory",
        search_type: "networks",
      })
    ).forEach(([key, value]) => form.setAttribute(key, value))
    form.innerHTML =
      '<input name="q" value=""><input name="country" value="PRIVATE_COUNTRY">'
    document.body.append(form)
    form.dispatchEvent(new Event("submit", { bubbles: true }))
    expect(named("search")).toHaveLength(0)
    expect(named("navigation_action")).toHaveLength(1)
    expect(named("navigation_action")[0]?.[2]).toMatchObject({
      interaction_source: "network_directory",
      action_type: "filter",
      destination: "networks",
    })
    expect(JSON.stringify(named("navigation_action"))).not.toContain("PRIVATE_")
  })
})
