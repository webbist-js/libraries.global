// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react"
import * as React from "react"
import { createElement } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

Object.assign(globalThis, { React })

const nav = vi.hoisted(() => ({ path: "/profile/ada" }))

vi.mock("@iconify/react", async () => {
  const { createElement: h } = await import("react")

  return {
    Icon: ({ icon }: { icon: string }) =>
      h("span", { "data-icon": icon, "aria-hidden": "true" }),
  }
})
vi.mock("next/navigation", () => ({ usePathname: () => nav.path }))
vi.mock("@/lib/navigation", async () => {
  const { createElement: h } = await import("react")

  return {
    Link: ({
      href,
      children,
      ...rest
    }: {
      href: string
      children?: React.ReactNode
    }) => h("a", { href, ...rest }, children),
  }
})

afterEach(() => {
  cleanup()
})

const { ProfileTabNav } = await import("../ProfileTabNav")

describe("ProfileTabNav", () => {
  it("has a Following tab, not Libraries, at /following", () => {
    render(createElement(ProfileTabNav, { username: "ada" }))

    const tab = screen.getByRole("link", { name: /Following/ })
    expect(tab.getAttribute("href")).toBe("/profile/ada/following")
    expect(tab.querySelector('[data-icon="mdi:heart-outline"]')).toBeTruthy()
    expect(screen.queryByRole("link", { name: /^Libraries/ })).toBeNull()
  })

  it("marks Following as the current tab on its page, with its count", () => {
    nav.path = "/profile/ada/following"
    render(
      createElement(ProfileTabNav, {
        username: "ada",
        counts: { following: 7 },
      })
    )

    const tab = screen.getByRole("link", { name: /Following/ })
    expect(tab.getAttribute("aria-current")).toBe("page")
    expect(tab.textContent).toContain("7")
  })
})
