// @vitest-environment happy-dom
import * as React from "react"
import { createElement } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { cleanup, render } from "@/test/render"

Object.assign(globalThis, { React })

vi.mock("@/components/dashboard/WorkspaceHero", async () => {
  const { createElement: h } = await import("react")

  return {
    WorkspaceHero: ({
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
  it("leaves the Noticeboard breadcrumb to the shared toolbar", () => {
    const { container } = render(
      createElement(CommunitySectionHeader, { title: "The *noticeboard.*" })
    )

    expect(crumbsOf(container)).toBeNull()
  })

  it("leaves the section breadcrumb to the shared toolbar", () => {
    const { container } = render(
      createElement(CommunitySectionHeader, {
        title: "Leaderboard",
        section: "Leaderboard",
      })
    )

    expect(crumbsOf(container)).toBeNull()
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
      { label: "Community", href: "/community" },
      { label: "Drives", href: "/community#drives" },
      { label: "Ohio hours" },
    ])
    expect(getByText("Chips")).toBeTruthy()
  })
})
