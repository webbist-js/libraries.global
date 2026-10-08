// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react"
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

const { EmptyState } = await import("../EmptyState")

afterEach(cleanup)

describe("EmptyState", () => {
  it("shows the lead, the detail line, the icon and the next step", () => {
    render(
      h(EmptyState, {
        lead: "Nothing connected yet",
        detail: "Events appear here within an hour of connecting a feed.",
        icon: "mdi:calendar-blank-outline",
        action: h("a", { href: "/staff/x/events/connect" }, "Connect a feed"),
      })
    )
    expect(screen.getByText("Nothing connected yet")).toBeTruthy()
    expect(
      screen.getByText(
        "Events appear here within an hour of connecting a feed."
      )
    ).toBeTruthy()
    expect(
      screen.getByRole("link", { name: "Connect a feed" }).getAttribute("href")
    ).toBe("/staff/x/events/connect")
    expect(
      document.querySelector<HTMLElement>("[data-icon]")?.dataset.icon
    ).toBe("mdi:calendar-blank-outline")
  })

  it("keeps the older message call as the lead, and a default headline", () => {
    const { unmount } = render(h(EmptyState, { message: "No notices yet" }))
    expect(screen.getByText("No notices yet")).toBeTruthy()
    expect(screen.queryByRole("link")).toBeNull()
    unmount()

    render(h(EmptyState, {}))
    expect(screen.getByText("Nothing here yet")).toBeTruthy()
  })

  it("lead wins over message", () => {
    render(h(EmptyState, { lead: "Nothing waiting", message: "Older copy" }))
    expect(screen.getByText("Nothing waiting")).toBeTruthy()
    expect(screen.queryByText("Older copy")).toBeNull()
  })
})
