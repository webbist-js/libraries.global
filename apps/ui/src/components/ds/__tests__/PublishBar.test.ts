// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import * as React from "react"
import { createElement as h } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

Object.assign(globalThis, { React })

vi.mock("@iconify/react", () => ({ Icon: () => null }))

const { PublishBar } = await import("../PublishBar")

afterEach(cleanup)

describe("PublishBar", () => {
  it("with nothing to publish is a quiet line with no buttons", () => {
    render(h(PublishBar, { count: 0, onDiscard: vi.fn(), onPublish: vi.fn() }))
    expect(screen.getByText("No unpublished changes")).toBeTruthy()
    expect(screen.queryByRole("button")).toBeNull()
    // The live region is always mounted, so a later count is announced.
    expect(
      screen.getByText("No unpublished changes").getAttribute("aria-live")
    ).toBe("polite")
  })

  it("shows the last status in place of the count, still with no buttons", () => {
    render(
      h(PublishBar, {
        count: 0,
        status: "Timetable published.",
        onDiscard: vi.fn(),
        onPublish: vi.fn(),
      })
    )
    expect(screen.getByText("Timetable published.")).toBeTruthy()
    expect(screen.queryByText("No unpublished changes")).toBeNull()
    expect(screen.queryByRole("button")).toBeNull()
  })

  it("with changes counts them and offers Discard and Publish", () => {
    const onDiscard = vi.fn()
    const onPublish = vi.fn()
    render(h(PublishBar, { count: 2, onDiscard, onPublish }))
    expect(screen.getByText("2 unpublished changes")).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Discard" }))
    fireEvent.click(screen.getByRole("button", { name: "Publish changes" }))
    expect(onDiscard).toHaveBeenCalledTimes(1)
    expect(onPublish).toHaveBeenCalledTimes(1)
  })

  it("uses the singular and a custom publish label", () => {
    render(
      h(PublishBar, {
        count: 1,
        publishLabel: "Publish timetable",
        onDiscard: vi.fn(),
        onPublish: vi.fn(),
      })
    )
    expect(screen.getByText("1 unpublished change")).toBeTruthy()
    expect(
      screen.getByRole("button", { name: "Publish timetable" })
    ).toBeTruthy()
  })

  it("while publishing keeps the bar, disables both and says so", () => {
    render(
      h(PublishBar, {
        count: 2,
        busy: true,
        onDiscard: vi.fn(),
        onPublish: vi.fn(),
      })
    )
    const publishing = screen.getByRole("button", {
      name: "Publishing…",
    }) as HTMLButtonElement
    expect(publishing.disabled).toBe(true)
    expect(
      (screen.getByRole("button", { name: "Discard" }) as HTMLButtonElement)
        .disabled
    ).toBe(true)
  })
})
