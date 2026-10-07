// @vitest-environment happy-dom
import { cleanup, render, screen, within } from "@testing-library/react"
import * as React from "react"
import { createElement } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

import type { DriveView } from "@/lib/drives/drive-view"
import type { Drive } from "@/lib/drives/types"
import type { FollowedLibrary } from "@/lib/types/profile"

Object.assign(globalThis, { React })

vi.mock("@iconify/react", () => ({ Icon: () => null }))
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
vi.mock("@/lib/strapi-helpers", () => ({
  formatStrapiMediaUrl: (url?: string | null) => url ?? null,
}))
// DriveCard has its own tests; a stand-in shows which drive each card is.
vi.mock("@/components/drives/DriveCard", async () => {
  const { createElement: h } = await import("react")

  return {
    DriveCard: ({ view }: { view: DriveView }) =>
      h("article", { "data-href": view.href }, view.drive.title),
  }
})

afterEach(() => {
  cleanup()
})

const { FollowingSection } = await import("../sections/FollowingSection")

const drive = (over: Partial<Drive>): Drive => ({
  documentId: "d1",
  title: "Ohio hours",
  slug: "ohio-hours",
  summary: "Add opening hours.",
  focus: { kind: "gaps", gaps: ["hours"] },
  scope: { places: { region: ["ohio"] } },
  unit: "library",
  startsAt: "2026-09-01T00:00:00.000Z",
  endsAt: "2026-10-30T00:00:00.000Z",
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

const view = (over: Partial<Drive>): DriveView => {
  const d = drive(over)

  return {
    drive: d,
    href: `/community/drives/${d.slug}`,
    place: null,
    source: null,
    progress: null,
    helpers: null,
  }
}

const LIBRARY: FollowedLibrary = {
  id: 1,
  documentId: "lib1",
  name: "Bodleian Library",
  slug: "bodleian-library",
  path: "/europe/united-kingdom/oxfordshire/bodleian-library",
}

const headings = () =>
  screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)

describe("FollowingSection", () => {
  it("reads Stewards, Libraries, Drives, People", () => {
    render(
      createElement(FollowingSection, {
        username: "ada",
        followedLibraries: [LIBRARY],
        followedDrives: [view({})],
        claimedLibraries: [
          {
            entityRef: "GB-BL-001",
            documentId: "lib2",
            name: "British Library",
            slug: "british-library",
            libraryType: "National",
          },
        ],
      })
    )

    expect(headings()).toEqual(["Stewards", "Libraries", "Drives", "People"])
  })

  it("shows each followed drive as a card, with a count", () => {
    render(
      createElement(FollowingSection, {
        username: "ada",
        followedLibraries: [],
        followedDrives: [
          view({}),
          view({
            documentId: "d2",
            title: "Welsh photos",
            slug: "welsh-photos",
            status: "closed",
          }),
        ],
      })
    )

    const section = screen.getByRole("region", { name: "Drives" })
    expect(within(section).getByText("2 drives")).toBeTruthy()
    const cards = within(section).getAllByRole("article")
    expect(cards.map((c) => c.textContent)).toEqual([
      "Ohio hours",
      "Welsh photos",
    ])
    expect(cards[0]!.dataset.href).toBe("/community/drives/ohio-hours")
    expect(within(section).queryByText(/Not following any drives/)).toBeNull()
  })

  it("says one drive in the singular", () => {
    render(
      createElement(FollowingSection, {
        username: "ada",
        followedLibraries: [],
        followedDrives: [view({})],
      })
    )

    expect(
      within(screen.getByRole("region", { name: "Drives" })).getByText(
        "1 drive"
      )
    ).toBeTruthy()
  })

  it("explains how to follow a drive when there are none", () => {
    render(
      createElement(FollowingSection, {
        username: "ada",
        followedLibraries: [LIBRARY],
      })
    )

    const section = screen.getByRole("region", { name: "Drives" })
    expect(section.textContent).toContain(
      "Not following any drives yet. Follow one from its page to keep an eye on it."
    )
    expect(
      within(section)
        .getByRole("link", { name: "See the drives" })
        .getAttribute("href")
    ).toBe("/community")
    expect(within(section).queryByRole("article")).toBeNull()
  })
})
