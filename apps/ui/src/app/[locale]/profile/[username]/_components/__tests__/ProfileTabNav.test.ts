// @vitest-environment happy-dom
import * as React from "react"
import { createElement } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { cleanup, render, screen } from "@/test/render"

Object.assign(globalThis, { React })

const nav = vi.hoisted(() => ({ path: "/profile/ada" }))

vi.mock("@iconify/react", async () => {
  const { createElement: h } = await import("react")

  return {
    Icon: ({ icon }: { icon: string }) =>
      h("span", { "data-icon": icon, "aria-hidden": "true" }),
  }
})
vi.mock("@/lib/navigation", async () => {
  const { createElement: h } = await import("react")

  return {
    usePathname: () => nav.path,
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
  nav.path = "/profile/ada"
})

const { ProfileTabNav } = await import("../ProfileTabNav")

describe("ProfileTabNav", () => {
  it("has a Following tab, not Libraries, at /following", () => {
    render(createElement(ProfileTabNav, { username: "ada" }))

    const tab = screen.getByRole("link", { name: /Following/ })
    expect(tab.getAttribute("href")).toBe("/profile/ada/following")
    expect(tab.querySelector('[data-icon="mdi:heart-outline"]')).toBeTruthy()
    expect(screen.queryByRole("link", { name: /^Libraries/ })).toBeNull()
    expect(screen.queryByRole("link", { name: "Membership" })).toBeNull()
  })

  it("shows the private Membership tab only on your own profile and marks it active", () => {
    nav.path = "/profile/membership"
    render(
      createElement(ProfileTabNav, { username: "ada", isOwnProfile: true })
    )
    const tab = screen.getByRole("link", { name: "Membership" })
    expect(tab.getAttribute("href")).toBe("/profile/membership")
    expect(tab.getAttribute("aria-current")).toBe("page")
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
