// @vitest-environment happy-dom
import { cleanup, render, screen, within } from "@testing-library/react"
import * as React from "react"
import { createElement } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

import type { DriveView } from "@/lib/drives/drive-view"
import type { Drive } from "@/lib/drives/types"

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

const { FinishedDrives } = await import("../FinishedDrives")

const drive = (over: Partial<Drive> = {}): Drive => ({
  documentId: "d9",
  title: "Kent’s libraries *in photos*",
  slug: "kent-photos",
  summary: "Photos for Kent.",
  focus: { kind: "gaps", gaps: ["photo"] },
  scope: { places: { region: ["kent"] } },
  unit: "library",
  startsAt: "2026-08-01T00:00:00.000Z",
  endsAt: "2026-09-30T00:00:00.000Z",
  goalPercent: 100,
  status: "closed",
  closedReason: "goal",
  closedAt: "2026-09-12T08:00:00.000Z",
  pinned: false,
  featured: false,
  locale: "en",
  createdAt: "2026-07-30T00:00:00.000Z",
  updatedAt: "2026-09-12T08:00:00.000Z",
  steps: [],
  final: { total: 52, done: 52, closedGaps: 30, helpers: 14, credits: 33 },
  ...over,
})

const view = (over: Partial<Drive> = {}): DriveView => ({
  drive: drive(over),
  href: `/community/drives/${over.slug ?? "kent-photos"}`,
  place: "Kent, United Kingdom",
  source: null,
  progress: {
    total: 52,
    done: 52,
    todo: 0,
    inReview: 0,
    percent: 100,
    goalMet: true,
  },
  helpers: 14,
})

describe("FinishedDrives", () => {
  it("lists each finished drive with its close date, final count and helpers", () => {
    render(createElement(FinishedDrives, { views: [view()] }))

    expect(
      screen.getByRole("heading", { name: "Recently finished" })
    ).toBeTruthy()
    const row = screen.getByRole("listitem")
    expect(
      within(row)
        .getByRole("link", { name: "Kent’s libraries in photos" })
        .getAttribute("href")
    ).toBe("/community/drives/kent-photos")
    expect(row.textContent).toContain("Closed 12 Sep")
    expect(row.textContent).toContain("52 of 52 libraries")
    expect(row.textContent).toContain("14 helpers")
    expect(row.textContent).toContain("Goal met")
  })

  it("says '1 helper' and leaves out 'Goal met' for a drive that ran out of time", () => {
    const v = view({ closedReason: "ended" })
    render(createElement(FinishedDrives, { views: [{ ...v, helpers: 1 }] }))

    const row = screen.getByRole("listitem")
    expect(row.textContent).toContain("1 helper")
    expect(row.textContent).not.toContain("1 helpers")
    expect(row.textContent).not.toContain("Goal met")
  })

  it("renders nothing with no finished drives", () => {
    const { container } = render(createElement(FinishedDrives, { views: [] }))

    expect(container.innerHTML).toBe("")
  })
})
