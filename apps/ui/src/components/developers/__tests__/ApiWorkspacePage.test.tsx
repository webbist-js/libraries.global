// @vitest-environment happy-dom
import type { ReactNode } from "react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"

import { ApiWorkspacePage } from "@/components/developers/ApiWorkspacePage"
import { cleanup, render, screen } from "@/test/render"

const state = vi.hoisted(() => ({
  access: {
    signedIn: false,
    scope: "guest",
    data: null as null | { teamId: string; active: boolean },
    conflict: false,
    unavailable: false,
  },
}))
vi.mock("next-intl/server", () => ({ getLocale: async () => "fr" }))
vi.mock("@/lib/team-api/workspace", () => ({
  apiWorkspaceAccess: async () => state.access,
}))
vi.mock("@/components/auth/AccountGuard", () => ({
  AccountGuard: ({ children }: { children: ReactNode }) => children,
}))
vi.mock("@/components/dashboard/DashboardPage", () => ({
  DashboardPage: ({
    navigation,
    overview,
  }: {
    navigation: ReactNode
    overview: ReactNode
  }) => (
    <>
      {navigation}
      {overview}
    </>
  ),
}))
vi.mock("@/components/dashboard/WorkspaceNavigation", () => ({
  WorkspaceNavigation: ({
    tabs,
  }: {
    tabs: { href: string; label: string }[]
  }) => (
    <nav>
      {tabs.map((tab) => (
        <a key={tab.href} href={tab.href}>
          {tab.label}
        </a>
      ))}
    </nav>
  ),
}))
vi.mock("@/components/dashboard/WorkspaceHero", () => ({
  WorkspacePageHeader: () => null,
}))
vi.mock("@/components/staff/TeamApiDashboard", () => ({
  TeamApiDashboard: ({ section }: { section: string }) => (
    <div data-testid="private-controls">{section}</div>
  ),
}))
vi.mock("@/components/staff/TeamApiPanels", () => ({
  ApiGuidePanel: () => <h2>Public API reference</h2>,
}))
vi.mock("@/components/developers/ApiPlayground", () => ({
  ApiPlayground: () => <div>Metered API playground</div>,
}))
vi.mock("@/lib/navigation", async () => {
  const { createElement } = await import("react")

  return {
    Link: ({ href, children }: { href: string; children: ReactNode }) =>
      createElement("a", { href }, children),
  }
})

beforeEach(() => {
  state.access = {
    signedIn: false,
    scope: "guest",
    data: null,
    conflict: false,
    unavailable: false,
  }
})
afterEach(cleanup)

it("shows reference docs and a login CTA to guests, without key or usage navigation", async () => {
  render(await ApiWorkspacePage({ section: "reference" }))
  expect(screen.getByText("Public API reference")).toBeTruthy()
  expect(screen.queryByTestId("private-controls")).toBeNull()
  expect(screen.queryByRole("link", { name: "API keys" })).toBeNull()
  expect(screen.queryByRole("link", { name: "Usage" })).toBeNull()
  expect(
    screen
      .getByRole("link", { name: "Log in to your Team" })
      .getAttribute("href")
  ).toContain("%2Ffr%2Fdevelopers%2Freference")
})
it("offers Teams to signed-in personal accounts instead of token controls, even on a direct keys URL", async () => {
  state.access.signedIn = true
  render(await ApiWorkspacePage({ section: "keys" }))
  expect(screen.queryByTestId("private-controls")).toBeNull()
  expect(screen.getByRole("link", { name: "Explore Teams + API" })).toBeTruthy()
  expect(screen.queryByRole("link", { name: "Log in to your Team" })).toBeNull()
})
it("splits authorised Team controls into their requested view", async () => {
  state.access.data = { teamId: "team", active: true }
  render(await ApiWorkspacePage({ section: "usage" }))
  expect(screen.getByTestId("private-controls").textContent).toBe("usage")
  expect(
    screen.getByRole("link", { name: "API keys" }).getAttribute("href")
  ).toBe("/developers/keys")
})
it.each([false, true])(
  "only offers the metered playground with active Team API coverage: %s",
  async (active) => {
    state.access.data = { teamId: "team", active }
    render(await ApiWorkspacePage({ section: "playground" }))
    if (active) expect(screen.getByText("Metered API playground")).toBeTruthy()
    else expect(screen.queryByText("Metered API playground")).toBeNull()
    expect(screen.queryByTestId("private-controls")).toBeNull()
  }
)

it("keeps runnable playground controls away from guests and personal accounts", async () => {
  const view = render(await ApiWorkspacePage({ section: "playground" }))
  expect(screen.queryByText("Metered API playground")).toBeNull()
  expect(screen.getByRole("link", { name: "Log in to your Team" })).toBeTruthy()
  view.unmount()
  state.access.signedIn = true
  render(await ApiWorkspacePage({ section: "playground" }))
  expect(screen.queryByText("Metered API playground")).toBeNull()
  expect(screen.getByRole("link", { name: "Explore Teams + API" })).toBeTruthy()
})
