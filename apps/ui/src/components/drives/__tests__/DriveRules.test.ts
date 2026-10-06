// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react"
import * as React from "react"
import { createElement } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

import type { Drive } from "@/lib/drives/types"

Object.assign(globalThis, { React })

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

const { DriveRules } = await import("../DriveRules")

const drive = (over: Partial<Drive> = {}): Drive => ({
  documentId: "d1",
  title: "Ohio",
  slug: "ohio-hours",
  summary: "Add hours.",
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
  steps: [],
  whereToLook: {
    name: "Each library’s own website",
    url: "https://example.org/libraries",
    licenceNote: "Facts from a library’s own site are fine.",
  },
  ...over,
})

/** The `dd` paired with a `dt`. */
const rule = (label: string) =>
  screen.getByText(label, { selector: "dt" }).nextElementSibling

describe("DriveRules", () => {
  it("sits at the #rules anchor under a 'Rules' heading", () => {
    const { container } = render(
      createElement(DriveRules, { drive: drive(), source: null })
    )

    expect(container.querySelector("#rules")).toBeTruthy()
    expect(screen.getByRole("heading", { name: "Rules" })).toBeTruthy()
  })

  it("lists the focus, where to look with its licence note, and the end date", () => {
    render(createElement(DriveRules, { drive: drive(), source: null }))

    expect(rule("Focus")?.textContent).toBe("Opening hours")
    const where = rule("Where to look")
    expect(where?.querySelector("a")?.getAttribute("href")).toBe(
      "https://example.org/libraries"
    )
    expect(where?.querySelector("a")?.getAttribute("rel")).toContain("noopener")
    expect(where?.textContent).toContain(
      "Facts from a library’s own site are fine."
    )
    expect(rule("Ends")?.textContent).toBe("31 Oct 2026")
  })

  it("shows the source Dataset and a goal below 100% only when set", () => {
    render(
      createElement(DriveRules, {
        drive: drive({ goalPercent: 80 }),
        source: "IMLS Public Libraries Survey",
      })
    )

    expect(rule("Records from")?.textContent).toBe(
      "IMLS Public Libraries Survey"
    )
    expect(rule("Goal")?.textContent).toBe("80% of the drive’s branches")
    cleanup()

    render(createElement(DriveRules, { drive: drive(), source: null }))
    expect(screen.queryByText("Records from", { selector: "dt" })).toBeNull()
    expect(screen.queryByText("Goal", { selector: "dt" })).toBeNull()
  })

  it("always says every task is reviewed", () => {
    render(createElement(DriveRules, { drive: drive(), source: null }))

    expect(screen.getByText(/checked by a moderator/)).toBeTruthy()
  })
})
