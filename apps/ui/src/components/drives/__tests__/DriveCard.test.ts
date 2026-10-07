// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react"
import * as React from "react"
import { createElement } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

import type { DriveView } from "@/lib/drives/drive-view"
import type { Drive } from "@/lib/drives/types"

Object.assign(globalThis, { React })

vi.mock("@iconify/react", async () => {
  const { createElement: h } = await import("react")

  return {
    Icon: ({ icon }: { icon: string }) =>
      h("span", { "data-icon": icon, "aria-hidden": "true" }),
  }
})
vi.mock("@/components/global/GlobalLink", async () => {
  const { createElement: h } = await import("react")

  return {
    default: ({
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

const { DriveCard } = await import("../DriveCard")

const NOW = new Date("2026-10-06T12:00:00.000Z")

const drive = (over: Partial<Drive> = {}): Drive => ({
  documentId: "d2",
  title: "Confirm Welsh libraries *are still open*",
  slug: "welsh-libraries-open",
  summary: "Check each library is still open.",
  focus: { kind: "gaps", gaps: ["photo"] },
  scope: { places: { country: ["wales"] }, source: "welsh-gov" },
  unit: "record",
  startsAt: "2026-09-01T00:00:00.000Z",
  endsAt: "2026-10-11T00:00:00.000Z",
  goalPercent: 100,
  status: "open",
  pinned: false,
  featured: false,
  locale: "en",
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-01T00:00:00.000Z",
  steps: [],
  ...over,
})

const view = (over: Partial<DriveView> = {}): DriveView => ({
  drive: drive(),
  href: "/community/drives/welsh-libraries-open",
  place: "Wales, United Kingdom",
  source: "Welsh Government library list",
  progress: {
    total: 88,
    done: 61,
    todo: 27,
    inReview: 2,
    percent: 69,
    goalMet: false,
  },
  helpers: 38,
  ...over,
})

describe("DriveCard", () => {
  it("links the title to the drive page", () => {
    render(createElement(DriveCard, { view: view(), now: NOW }))

    const link = screen.getByRole("link", {
      name: "Confirm Welsh libraries are still open",
    })
    expect(link.getAttribute("href")).toBe(
      "/community/drives/welsh-libraries-open"
    )
    expect(
      screen.getByRole("heading", {
        name: "Confirm Welsh libraries are still open",
      })
    ).toBeTruthy()
  })

  it("puts the place and 'Records from' on separate lines", () => {
    render(createElement(DriveCard, { view: view(), now: NOW }))

    const place = screen.getByText("Wales, United Kingdom")
    const source = screen.getByText(
      "Records from Welsh Government library list"
    )
    expect(place.tagName).toBe("P")
    expect(source.tagName).toBe("P")
    expect(place).not.toBe(source)
    expect(place.nextElementSibling).toBe(source)
  })

  it("leaves out the source line when the scope has no Dataset", () => {
    render(createElement(DriveCard, { view: view({ source: null }), now: NOW }))

    expect(screen.queryByText(/Records from/)).toBeNull()
  })

  it("shows done of total in the unit, and who's helping", () => {
    const { container } = render(
      createElement(DriveCard, { view: view(), now: NOW })
    )

    expect(container.textContent).toContain("61 of 88 records")
    expect(screen.getByText("38 helping")).toBeTruthy()
  })

  it("shows the focus chip and the dates", () => {
    const { container } = render(
      createElement(DriveCard, { view: view(), now: NOW })
    )

    expect(screen.getByText("Photos")).toBeTruthy()
    expect(container.textContent).toContain("5 days left")
  })

  it("says so honestly when nothing has been counted yet", () => {
    render(
      createElement(DriveCard, {
        view: view({ progress: null, helpers: null }),
        now: NOW,
      })
    )

    expect(screen.getByText("Not counted yet")).toBeTruthy()
    expect(screen.queryByText(/helping/)).toBeNull()
  })
})

describe("DriveCard preview", () => {
  const scheduled = () =>
    view({
      drive: drive({
        status: "scheduled",
        startsAt: "2026-10-13T00:00:00.000Z",
        title: "*Opening hours* for Ealing",
        summary: "Help us add opening hours for libraries in Ealing.",
      }),
      place: "Ealing",
      source: null,
      progress: {
        total: 12,
        done: 0,
        todo: 12,
        inReview: 0,
        percent: 0,
        goalMet: false,
      },
      helpers: null,
    })

  it("draws a drive that doesn't exist yet: no link, the full opening date, its summary", () => {
    const { container } = render(
      createElement(DriveCard, { view: scheduled(), now: NOW, preview: true })
    )

    expect(screen.queryByRole("link")).toBeNull()
    expect(
      screen.getByRole("heading", { name: "Opening hours for Ealing" })
    ).toBeTruthy()
    expect(container.querySelector("em")?.textContent).toBe("Opening hours")
    expect(screen.getByText("Opens 13 Oct 2026")).toBeTruthy()
    expect(
      screen.getByText("Help us add opening hours for libraries in Ealing.")
    ).toBeTruthy()
    expect(container.textContent).toContain("0 of 12 records")
  })

  it("leaves the summary off the Noticeboard's own card", () => {
    render(createElement(DriveCard, { view: scheduled(), now: NOW }))

    expect(
      screen.queryByText("Help us add opening hours for libraries in Ealing.")
    ).toBeNull()
    expect(screen.getByText("Opens 13 Oct")).toBeTruthy()
  })
})
