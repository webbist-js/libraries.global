// @vitest-environment happy-dom
import * as React from "react"
import { createElement } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { cleanup, render } from "@/test/render"

Object.assign(globalThis, { React })

vi.mock("@/components/ds", async () => {
  const { createElement: h } = await import("react")

  return {
    PageHero: ({
      breadcrumb,
      children,
    }: {
      breadcrumb?: { label: string; href?: string }[]
      children?: React.ReactNode
    }) => h("div", { "data-crumbs": JSON.stringify(breadcrumb) }, children),
  }
})
vi.mock("../CommunityNavBar", () => ({ CommunityNavBar: () => null }))

afterEach(() => {
  cleanup()
})

const { CommunitySectionHeader } = await import("../CommunitySectionHeader")

const crumbsOf = (container: HTMLElement) =>
  JSON.parse(
    (container.firstElementChild as HTMLElement).dataset.crumbs ?? "null"
  )

describe("CommunitySectionHeader", () => {
  it("ends at Community on the Noticeboard", () => {
    const { container } = render(
      createElement(CommunitySectionHeader, { title: "The *noticeboard.*" })
    )

    expect(crumbsOf(container)).toEqual([
      { label: "Home", href: "/" },
      { label: "Community" },
    ])
  })

  it("adds one leaf for a section", () => {
    const { container } = render(
      createElement(CommunitySectionHeader, {
        title: "Leaderboard",
        section: "Leaderboard",
      })
    )

    expect(crumbsOf(container)).toEqual([
      { label: "Home", href: "/" },
      { label: "Community", href: "/community" },
      { label: "Leaderboard" },
    ])
  })

  it("takes a longer trail from crumbs, ahead of section, and keeps its slot", () => {
    const { container, getByText } = render(
      createElement(
        CommunitySectionHeader,
        {
          title: "Ohio *hours*",
          section: "Ignored",
          crumbs: [
            { label: "Drives", href: "/community#drives" },
            { label: "Ohio hours" },
          ],
        },
        createElement("p", null, "Chips")
      )
    )

    expect(crumbsOf(container)).toEqual([
      { label: "Home", href: "/" },
      { label: "Community", href: "/community" },
      { label: "Drives", href: "/community#drives" },
      { label: "Ohio hours" },
    ])
    expect(getByText("Chips")).toBeTruthy()
  })
})
