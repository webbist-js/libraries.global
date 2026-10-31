import { describe, expect, it } from "vitest"

import { installGoogleAnalytics } from "../google-analytics"
import { sanitizeWorkspaceEvent, workspaceRoute } from "../workspace-analytics"

function fixture(pathname = "/staff/private-library/events") {
  const browser = {
    location: {
      origin: "https://libraries.global",
      pathname,
      search: "?email=SECRET_EMAIL",
      hash: "#SECRET_HASH",
    },
    document: {
      title: "SECRET_TITLE",
      referrer: "https://libraries.global/moderation/SECRET_REFERRER",
      createElement: () => ({}),
      head: { append: () => {} },
    },
  } as unknown as Window
  const controller = installGoogleAnalytics(browser)!
  const events = () =>
    (browser.dataLayer ?? []).filter(
      (row) => (row as { event?: string }).event === "lg_analytics"
    ) as { analytics: Record<string, string> }[]

  return { browser, controller, events }
}

describe("bounded workspace metrics", () => {
  it.each([
    [
      "/fr/staff/SECRET_ID/events/SECRET_FEED/replace?token=SECRET_TOKEN",
      "staff",
      "events",
    ],
    ["/staff/teams/widgets/SECRET_WIDGET/publish", "staff", "widget_publish"],
    ["/contribute/knowledge/SECRET_DRAFT", "contribute", "article_editor"],
    ["/moderation/SECRET_SUBMISSION", "moderation", "review"],
    ["/profile/SECRET_USERNAME/following", "account", "following"],
    ["/profile/SECRET_USERNAME", "account", "public_profile"],
    ["/community/discussions/moderation", "moderation", "discussions"],
  ])("classifies %s without keeping its identifiers", (path, area, section) => {
    expect(workspaceRoute(path)).toEqual({
      workspace_area: area,
      workspace_section: section,
      workspace_surface: "page",
    })
    expect(JSON.stringify(workspaceRoute(path))).not.toContain("SECRET")
  })

  it.each([
    "/live/SECRET_ID",
    "/api/staff",
    "/auth/reset",
    "/staff/teams/join/SECRET_TOKEN",
    "/staff/teams/api",
    "/developers",
    "/developers/keys",
    "/developers/usage",
    "/developers/playground",
    "/staff/teams/billing",
    "/staff/teams/new",
    "/contribute/membership/checkout",
    "/profile/membership",
    "/staff/team/SECRET_ID",
    "/contribute/unknown",
  ])("leaves %s outside workspace collection", (path) =>
    expect(workspaceRoute(path)).toBeUndefined()
  )

  it("only accepts registered categories and removes every unregistered field", () => {
    const context = {
      workspace_area: "moderation",
      workspace_section: "review",
      workspace_surface: "page",
    }
    expect(
      sanitizeWorkspaceEvent("workspace_view", {
        ...context,
        note: "SECRET",
        content_id: "SECRET",
        email: "SECRET",
      })
    ).toEqual(context)
    expect(
      sanitizeWorkspaceEvent("workspace_view", {
        ...context,
        workspace_section: "SECRET",
      })
    ).toBeUndefined()
    expect(
      sanitizeWorkspaceEvent("workspace_view", {
        ...context,
        workspace_area: "__proto__",
      })
    ).toBeUndefined()
    expect(
      sanitizeWorkspaceEvent("workspace_view", {
        ...context,
        workspace_surface: ["page"],
      })
    ).toBeUndefined()
    expect(
      sanitizeWorkspaceEvent("workspace_action", {
        ...context,
        action_type: "approve",
        action_outcome: "SECRET",
      })
    ).toBeUndefined()
    expect(
      sanitizeWorkspaceEvent("workspace_action", {
        ...context,
        action_type: "approve",
        action_outcome: "success",
        note: "SECRET",
      })
    ).toEqual({ ...context, action_type: "approve", action_outcome: "success" })
  })

  it("requires consent, sends one route view and never sends private IDs through public events", () => {
    const { browser, controller, events } = fixture()
    controller.pageView()
    expect(events()).toHaveLength(0)
    controller.setConsent(true)
    controller.setConsent(true)
    controller.pageView()
    expect(events()).toHaveLength(1)
    expect(events()[0]?.analytics).toMatchObject({
      event_name: "workspace_view",
      page_location: "https://libraries.global/workspace/staff/page/events",
      page_referrer: "",
      workspace_area: "staff",
      workspace_section: "events",
    })
    expect(
      controller.track("select_content", {
        interaction_source: "navigation",
        content_type: "library",
        content_id: "SECRET_ID",
      })
    ).toBe(false)
    expect(JSON.stringify(browser.dataLayer)).not.toContain("SECRET")
    controller.setConsent(false)
    expect(
      controller.trackWorkspace!(
        "workspace_view",
        workspaceRoute(browser.location.pathname)
      )
    ).toBe(false)
    expect(events()).toHaveLength(1)
  })

  it("drops an async action if consent or route changes, and completes a response only once", () => {
    const { controller, browser, events } = fixture(
      "/moderation/SECRET_SUBMISSION"
    )
    const input = {
      ...workspaceRoute(browser.location.pathname),
      action_type: "approve",
    }
    const unconsented = controller.prepareWorkspace!(input)
    controller.setConsent(true)
    expect(unconsented("success")).toBe(false)
    const withdrawn = controller.prepareWorkspace!(input)
    controller.setConsent(false)
    controller.setConsent(true)
    expect(withdrawn("success")).toBe(false)
    const navigated = controller.prepareWorkspace!(input)
    browser.location.pathname = "/moderation/ANOTHER_SUBMISSION"
    expect(navigated("success")).toBe(false)
    const complete = controller.prepareWorkspace!(input)
    expect(complete("success")).toBe(true)
    expect(complete("success")).toBe(false)
    expect(
      events().filter(
        (event) => event.analytics.event_name === "workspace_action"
      )
    ).toHaveLength(1)
    expect(JSON.stringify(browser.dataLayer)).not.toContain("SECRET")
  })

  it("clears workspace context before public navigation and never uses a private referrer", () => {
    const { browser, controller, events } = fixture()
    controller.setConsent(true)
    browser.location.pathname = "/knowledge"
    controller.pageView()
    expect(events().at(-1)?.analytics).toMatchObject({
      event_name: "page_view",
      page_location: "https://libraries.global/knowledge",
      page_referrer: "",
    })
    expect(events().at(-1)?.analytics.workspace_area).toBeUndefined()
  })
})
