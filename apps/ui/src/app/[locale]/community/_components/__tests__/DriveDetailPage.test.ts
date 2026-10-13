// @vitest-environment happy-dom
import * as React from "react"
import { createElement } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

import type { DriveView } from "@/lib/drives/drive-view"
import type { Drive, DriveLeaderboardEntry } from "@/lib/drives/types"
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
vi.mock("@/components/ds", async () => {
  const { createElement: h } = await import("react")

  return {
    Notice: ({
      title,
      children,
    }: {
      title: string
      children?: React.ReactNode
    }) => h("div", { role: "note" }, h("p", null, title), children),
  }
})
// The task area is a client island with its own tests (DriveTaskArea.test).
vi.mock("@/components/drives/DriveTaskArea", async () => {
  const { createElement: h } = await import("react")

  return {
    DriveTaskArea: ({ drive }: { drive: { slug: string } }) =>
      h("div", { "data-testid": "task-area" }, `Tasks for ${drive.slug}`),
  }
})
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
// The follow button is a client island with its own tests (DriveFollowButton.test).
vi.mock("@/components/drives/DriveFollowButton", async () => {
  const { createElement: h } = await import("react")

  return {
    DriveFollowButton: ({ driveDocumentId }: { driveDocumentId: string }) =>
      h("button", { "data-drive": driveDocumentId }, "Follow drive"),
  }
})
vi.mock("../CommunitySectionHeader", async () => {
  const { createElement: h } = await import("react")

  return {
    CommunitySectionHeader: ({
      title,
      crumbs,
      children,
    }: {
      title: string
      crumbs?: { label: string }[]
      children?: React.ReactNode
    }) =>
      h(
        "header",
        { "data-crumbs": crumbs?.map((c) => c.label).join(" › ") },
        h("h1", null, title),
        children
      ),
  }
})

afterEach(() => {
  cleanup()
})

const { DriveDetailPage } = await import("../DriveDetailPage")

const drive = (over: Partial<Drive> = {}): Drive => ({
  documentId: "d1",
  title: "Ohio’s public libraries *need opening hours.*",
  slug: "ohio-hours",
  summary: "Add a week of hours.",
  focus: { kind: "gaps", gaps: ["hours"] },
  scope: { places: { region: ["ohio"] } },
  unit: "branch",
  startsAt: "2026-10-01T00:00:00.000Z",
  endsAt: "2026-10-31T00:00:00.000Z",
  goalPercent: 100,
  status: "open",
  pinned: true,
  featured: true,
  locale: "en",
  createdAt: "2026-09-30T00:00:00.000Z",
  updatedAt: "2026-09-30T00:00:00.000Z",
  steps: [
    { id: 1, text: "Open the branch’s website." },
    { id: 2, text: "Add its week of hours." },
  ],
  ...over,
})

const view = (d: Drive): DriveView => ({
  drive: d,
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
})

const HELPERS: DriveLeaderboardEntry[] = [
  {
    rank: 1,
    credits: 12,
    username: "morag",
    displayName: "Morag Reid",
    avatarUrl: null,
  },
  {
    rank: 2,
    credits: 3,
    username: null,
    displayName: "A contributor",
    avatarUrl: null,
  },
]

const renderPage = (d: Drive) =>
  render(
    createElement(DriveDetailPage, {
      drive: d,
      view: view(d),
      week: HELPERS,
      all: HELPERS,
    })
  )

describe("DriveDetailPage", () => {
  it("leads with the trail Drives › title and the hero's chips and share button", () => {
    const { container } = renderPage(drive())

    expect(container.querySelector("header")?.dataset.crumbs).toBe(
      "Drives › Ohio’s public libraries need opening hours."
    )
    expect(screen.getByText("Pinned drive")).toBeTruthy()
    expect(screen.getByText("Ohio, United States")).toBeTruthy()
    expect(
      screen.getByRole("button", { name: "Share this drive" })
    ).toBeTruthy()
  })

  it("offers to follow the drive in the hero, finished or not", () => {
    for (const status of [
      "open",
      "scheduled",
      "closed",
      "cancelled",
    ] as const) {
      renderPage(drive({ status, pinned: false }))
      const follow = screen.getByRole("button", { name: "Follow drive" })
      expect(follow.dataset.drive).toBe("d1")
      expect(follow.closest("header")).toBeTruthy()
      cleanup()
    }
  })

  it("shows an open drive's progress, steps, helpers and rules", () => {
    renderPage(drive())

    expect(screen.getByRole("heading", { name: "Progress" })).toBeTruthy()
    expect(
      screen.getByRole("img", {
        name: "142 of 251 branches have hours, 9 in review",
      })
    ).toBeTruthy()
    expect(screen.getByRole("heading", { name: "How to help" })).toBeTruthy()
    expect(screen.getByText("Add its week of hours.")).toBeTruthy()
    expect(screen.getByRole("list", { name: "This week" })).toBeTruthy()
    expect(screen.getByRole("heading", { name: "Rules" })).toBeTruthy()
  })

  it("puts the task list and panel on an open drive only", () => {
    renderPage(drive())
    expect(screen.getByTestId("task-area").textContent).toBe(
      "Tasks for ohio-hours"
    )
    cleanup()
    for (const status of ["scheduled", "closed", "cancelled"] as const) {
      renderPage(drive({ status, pinned: false }))
      expect(screen.queryByTestId("task-area")).toBeNull()
      cleanup()
    }
  })

  it("shows a finished drive's final numbers and public helpers, with no steps", () => {
    renderPage(
      drive({
        status: "closed",
        closedReason: "goal",
        closedAt: "2026-10-20T00:00:00.000Z",
        final: {
          total: 251,
          done: 251,
          closedGaps: 109,
          helpers: 41,
          credits: 120,
        },
      })
    )

    expect(screen.getByText("This drive has finished. Thank you")).toBeTruthy()
    expect(
      screen.getByText(
        "It met its goal. 109 gaps filled by 41 helpers, from 120 accepted tasks."
      )
    ).toBeTruthy()
    expect(screen.getByRole("heading", { name: "Final numbers" })).toBeTruthy()
    expect(screen.getByText("Finished")).toBeTruthy()
    expect(screen.queryByRole("heading", { name: "How to help" })).toBeNull()
    expect(screen.queryByRole("list", { name: "This week" })).toBeNull()
    expect(screen.queryByText("A contributor")).toBeNull()
    expect(screen.getByText("Morag Reid")).toBeTruthy()
  })

  it("says a cancelled drive was cancelled, without helpers or steps", () => {
    renderPage(drive({ status: "cancelled", pinned: false, featured: false }))

    expect(screen.getByText("This drive was cancelled")).toBeTruthy()
    expect(screen.getByText("Cancelled")).toBeTruthy()
    expect(screen.queryByRole("heading", { name: "Helpers" })).toBeNull()
    expect(screen.queryByRole("heading", { name: "How to help" })).toBeNull()
  })

  it("tells a scheduled drive's visitors it hasn't opened", () => {
    renderPage(drive({ status: "scheduled", pinned: false }))

    expect(screen.getByText("This drive hasn’t opened yet")).toBeTruthy()
    expect(screen.getByText("Opens soon")).toBeTruthy()
    expect(screen.getByRole("heading", { name: "How to help" })).toBeTruthy()
  })
})
