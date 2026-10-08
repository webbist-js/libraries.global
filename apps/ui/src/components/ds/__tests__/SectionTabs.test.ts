// @vitest-environment happy-dom
import { cleanup, render, screen, within } from "@testing-library/react"
import * as React from "react"
import { createElement as h } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

Object.assign(globalThis, { React })

vi.mock("@iconify/react", async () => {
  const { createElement } = await import("react")

  return {
    Icon: ({ icon }: { icon: string }) =>
      createElement("i", { "data-icon": icon, "aria-hidden": "true" }),
  }
})
vi.mock("@/lib/navigation", async () => {
  const { createElement } = await import("react")

  return {
    Link: ({
      href,
      children,
      scroll: _scroll,
      ...rest
    }: {
      href: string
      scroll?: boolean
      children?: React.ReactNode
    }) => createElement("a", { href, ...rest }, children),
  }
})

const { SectionTabs } = await import("../SectionTabs")

afterEach(cleanup)

const tabs = [
  {
    id: "overview",
    label: "Overview",
    href: "/staff/x",
    icon: "mdi:view-dashboard-outline",
  },
  {
    id: "suggestions",
    label: "Suggestions",
    href: "/staff/x#suggestions",
    count: 3,
  },
  { id: "notices", label: "Notices", href: "/staff/x/notices", count: 0 },
  {
    id: "team",
    label: "Team",
    href: "/staff/x/team",
    badge: h(
      "span",
      { "data-tag": "team" },
      h("i", { "data-icon": "mdi:lock-outline", "aria-hidden": "true" }),
      "Team"
    ),
  },
]

describe("SectionTabs", () => {
  it("is a labelled nav of real links, with the active tab marked", () => {
    render(h(SectionTabs, { tabs, activeId: "overview", label: "Staff area" }))
    const nav = screen.getByRole("navigation", { name: "Staff area" })
    const active = within(nav).getByRole("link", { name: /Overview/ })
    expect(active.getAttribute("aria-current")).toBe("page")
    expect(active.getAttribute("href")).toBe("/staff/x")
    expect(
      within(nav)
        .getByRole("link", { name: /Notices/ })
        .getAttribute("aria-current")
    ).toBeNull()
  })

  it("shows a count only when it is above zero", () => {
    render(h(SectionTabs, { tabs, activeId: "overview", label: "Staff area" }))
    const suggestions = screen.getByRole("link", { name: /Suggestions/ })
    expect(within(suggestions).getByText("3")).toBeTruthy()
    const notices = screen.getByRole("link", { name: /Notices/ })
    expect(notices.textContent).toBe("Notices")
    expect(within(notices).queryByText("0")).toBeNull()
  })

  it("renders a tab's badge, such as the lock in a Team tag", () => {
    render(h(SectionTabs, { tabs, activeId: "team", label: "Staff area" }))
    const team = screen.getByRole("link", { name: /^Team/ })
    const tag = team.querySelector("[data-tag='team']")!
    expect(tag.textContent).toBe("Team")
    expect(tag.querySelector<HTMLElement>("[data-icon]")?.dataset.icon).toBe(
      "mdi:lock-outline"
    )
  })

  it("renders nothing for fewer than two tabs", () => {
    const { container } = render(
      h(SectionTabs, {
        tabs: tabs.slice(0, 1),
        activeId: "overview",
        label: "One",
      })
    )
    expect(container.innerHTML).toBe("")
  })
})
