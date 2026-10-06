// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react"
import * as React from "react"
import { createElement } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

// vitest.config has no JSX runtime, so .tsx compiles to React.createElement.
Object.assign(globalThis, { React })

vi.mock("@iconify/react", () => ({ Icon: () => null }))
vi.mock("@/lib/env-vars", () => ({ getEnvVar: () => {} }))
vi.mock("@/lib/navigation", async () => {
  const { createElement: h } = await import("react")

  return {
    Link: ({ href, children }: { href: string; children?: React.ReactNode }) =>
      h("a", { href }, children),
  }
})

const { DriveChip } = await import("../DriveChip")

afterEach(cleanup)

describe("DriveChip", () => {
  it("shows 'Drive: <title>' linking to the drive page", () => {
    render(
      createElement(DriveChip, {
        drive: {
          documentId: "drv1",
          slug: "winter-hours",
          title: "Winter hours",
        },
      })
    )
    const link = screen.getByText("Drive: Winter hours").closest("a")
    expect(link?.getAttribute("href")).toBe("/community/drives/winter-hours")
  })
})
