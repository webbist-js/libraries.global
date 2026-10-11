// @vitest-environment happy-dom
import * as React from "react"
import { createElement } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

import type { DriveView } from "@/lib/drives/drive-view"
import type { Drive } from "@/lib/drives/types"
import { cleanup, render, screen } from "@/test/render"

Object.assign(globalThis, { React })

vi.mock("@iconify/react", () => ({ Icon: () => null }))
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

const { FeaturedDrive } = await import("../FeaturedDrive")

const NOW = new Date("2026-10-06T12:00:00.000Z")

const drive = (over: Partial<Drive> = {}): Drive => ({
  documentId: "d1",
  title: "Ohio’s public libraries *need opening hours.*",
  slug: "ohio-hours",
  summary: "Imported from the IMLS survey without hours.",
  focus: { kind: "gaps", gaps: ["hours"] },
  scope: { places: { region: ["ohio"] } },
  unit: "branch",
  startsAt: "2026-10-01T00:00:00.000Z",
  endsAt: "2026-10-18T00:00:00.000Z",
  goalPercent: 100,
  status: "open",
  pinned: true,
  featured: true,
  locale: "en",
  createdAt: "2026-09-30T00:00:00.000Z",
  updatedAt: "2026-09-30T00:00:00.000Z",
  steps: [],
  ...over,
})

const view = (over: Partial<Drive> = {}, rest: Partial<DriveView> = {}) => ({
  drive: drive(over),
  href: "/community/drives/ohio-hours",
  place: "Ohio, United States",
  source: null,
  progress: {
    total: 251,
    done: 142,
    todo: 109,
    inReview: 9,
    percent: 57,
    goalMet: false,
  },
  helpers: 38,
  ...rest,
})

const renderCard = (
  v: DriveView,
  props: Partial<Parameters<typeof FeaturedDrive>[0]> = {}
) =>
  render(
    createElement(FeaturedDrive, {
      view: v,
      howHref: "/knowledge/community/how-drives-work",
      now: NOW,
      ...props,
    })
  )

describe("FeaturedDrive", () => {
  it("chips a pinned drive 'Pinned drive', with its focus and place", () => {
    renderCard(view())

    expect(screen.getByText("Pinned drive")).toBeTruthy()
    expect(screen.queryByText("Featured drive")).toBeNull()
    expect(screen.getByText("Opening hours")).toBeTruthy()
    expect(screen.getByText("Ohio, United States")).toBeTruthy()
  })

  it("chips an unpinned drive 'Featured drive'", () => {
    renderCard(view({ pinned: false, featured: false }))

    expect(screen.getByText("Featured drive")).toBeTruthy()
    expect(screen.queryByText("Pinned drive")).toBeNull()
  })

  it("shows the days left, the title, summary and progress", () => {
    const { container } = renderCard(view())

    expect(container.textContent).toContain("12 days left")
    expect(
      screen.getByRole("heading", {
        level: 2,
        name: "Ohio’s public libraries need opening hours.",
      })
    ).toBeTruthy()
    expect(
      screen.getByText("Imported from the IMLS survey without hours.")
    ).toBeTruthy()
    expect(container.textContent).toContain("142 of 251 branches done")
    expect(screen.getByText("57% · 38 people helping")).toBeTruthy()
    expect(
      screen.getByRole("img", {
        name: "142 of 251 branches have hours, 9 in review",
      })
    ).toBeTruthy()
  })

  it("says '1 person helping' for one helper, and leaves helpers out when unknown", () => {
    renderCard(view({}, { helpers: 1 }))
    expect(screen.getByText("57% · 1 person helping")).toBeTruthy()
    cleanup()

    renderCard(view({}, { helpers: null }))
    expect(screen.getByText("57%")).toBeTruthy()
  })

  it("links 'Join this drive' to the drive page and 'How drives work' to its guide", () => {
    renderCard(view())

    expect(
      screen.getByRole("link", { name: "Join this drive" }).getAttribute("href")
    ).toBe("/community/drives/ohio-hours")
    expect(
      screen.getByRole("link", { name: "How drives work" }).getAttribute("href")
    ).toBe("/knowledge/community/how-drives-work")
  })

  it("falls back to the drive page's rules without a Knowledge article", () => {
    renderCard(view(), { howHref: null })

    expect(
      screen.getByRole("link", { name: "How drives work" }).getAttribute("href")
    ).toBe("/community/drives/ohio-hours#rules")
  })

  it("renders its task slot", () => {
    renderCard(view(), {
      children: createElement("p", null, "Task list goes here"),
    })

    expect(screen.getByText("Task list goes here")).toBeTruthy()
  })

  it("says nothing has been counted rather than showing a zero bar", () => {
    renderCard(view({}, { progress: null }))

    expect(screen.queryByRole("img")).toBeNull()
    expect(
      screen.getByText(/Progress shows once the drive is counted/)
    ).toBeTruthy()
  })
})
