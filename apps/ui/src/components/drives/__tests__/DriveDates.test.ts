// @vitest-environment happy-dom
import * as React from "react"
import { createElement } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { T } from "@/lib/design-tokens"
import { cleanup, render } from "@/test/render"

Object.assign(globalThis, { React })

vi.mock("@iconify/react", async () => {
  const { createElement: h } = await import("react")

  return {
    Icon: ({ icon }: { icon: string }) =>
      h("span", { "data-icon": icon, "aria-hidden": "true" }),
  }
})

afterEach(() => {
  cleanup()
})

const { DriveDates } = await import("../DriveDates")

const NOW = new Date("2026-10-06T12:00:00.000Z")

const renderDates = (drive: Parameters<typeof DriveDates>[0]["drive"]) =>
  render(createElement(DriveDates, { drive, now: NOW }))

describe("DriveDates", () => {
  it("warns within a week with a clock icon plus the text, in the danger colour", () => {
    const { container } = renderDates({
      status: "open",
      startsAt: "2026-09-01T00:00:00.000Z",
      endsAt: "2026-10-11T00:00:00.000Z",
    })

    const root = container.firstElementChild as HTMLElement
    expect(root.textContent).toBe("5 days left")
    expect(
      root.querySelector('[data-icon="mdi:clock-alert-outline"]')
    ).toBeTruthy()
    expect(root.style.color).toBe(T.accent.danger)
    expect(root.dataset.tone).toBe("warn")
  })

  it("shows a plain absolute date further out, with no icon", () => {
    const { container } = renderDates({
      status: "open",
      startsAt: "2026-09-01T00:00:00.000Z",
      endsAt: "2026-11-30T00:00:00.000Z",
    })

    const root = container.firstElementChild as HTMLElement
    expect(root.textContent).toBe("Ends 30 Nov")
    expect(root.querySelector("[data-icon]")).toBeNull()
    expect(root.style.color).toBe(T.ink.dim)
    expect(root.dataset.tone).toBe("plain")
  })

  it("says when a scheduled drive opens and when a finished one closed", () => {
    expect(
      renderDates({
        status: "scheduled",
        startsAt: "2026-10-20T00:00:00.000Z",
        endsAt: "2026-11-30T00:00:00.000Z",
      }).container.textContent
    ).toBe("Opens 20 Oct")
    cleanup()
    expect(
      renderDates({
        status: "closed",
        startsAt: "2026-08-01T00:00:00.000Z",
        endsAt: "2026-09-30T00:00:00.000Z",
        closedAt: "2026-09-12T08:00:00.000Z",
      }).container.textContent
    ).toBe("Closed 12 Sep")
  })
})
