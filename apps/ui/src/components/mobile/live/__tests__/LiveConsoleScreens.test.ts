// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react"
import * as React from "react"
import { createElement } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

Object.assign(globalThis, { React })

vi.mock("@iconify/react", () => ({ Icon: () => null, addCollection: () => {} }))
vi.mock("@/lib/navigation", async () => {
  const { createElement: h } = await import("react")

  return {
    Link: ({ href, children }: { href: string; children?: React.ReactNode }) =>
      h("a", { href }, children),
  }
})

const { BeforeYouStartScreen } = await import("../LiveConsoleScreens")

afterEach(cleanup)

describe("BeforeYouStartScreen", () => {
  it("lets the route card wrap: the summary keeps its width and Change route takes its own row at phone width", () => {
    render(
      createElement(BeforeYouStartScreen, {
        routeLabel: "Thursday, Week 2 · 4 stops",
        routeTimes: "09:30–23:55",
        onChangeRoute: () => {},
        mode: "checkins",
        onMode: () => {},
        allowApproximate: false,
        preview: null,
        checklist: [],
        startLabel: "Go live",
        onStart: () => {},
      })
    )
    const button = screen.getByRole("button", { name: "Change route" })
    const card = button.parentElement as HTMLElement
    const summary = button.previousElementSibling as HTMLElement

    expect(card.className).toMatch(/\bflex-wrap\b/)
    expect(summary.textContent).toContain("Thursday, Week 2 · 4 stops")
    expect(summary.className).toMatch(/\bmin-w-0\b/)
    // `.live-button` carries the 56 px target and is full width by default;
    // only the important override lets it sit beside the text from `sm`.
    expect(button.className).toMatch(/\blive-button\b/)
    expect(button.className).toMatch(/\bw-full\b/)
    expect(button.className).toMatch(/\bshrink-0\b/)
    expect(button.className).toMatch(/\bsm:!w-auto\b/)
    expect(button.className.split(" ")).not.toContain("w-auto")
  })
})
