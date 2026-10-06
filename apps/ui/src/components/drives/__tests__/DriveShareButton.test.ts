// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import * as React from "react"
import { createElement } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

Object.assign(globalThis, { React })

vi.mock("@iconify/react", () => ({ Icon: () => null }))

const writeText = vi.fn()

beforeEach(() => {
  writeText.mockReset()
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText },
  })
})

afterEach(() => {
  cleanup()
})

const { DriveShareButton } = await import("../DriveShareButton")

describe("DriveShareButton", () => {
  it("copies the page's address and announces it", async () => {
    writeText.mockResolvedValue(undefined)
    render(createElement(DriveShareButton, { title: "Ohio hours" }))

    const status = screen.getByRole("status")
    expect(status.textContent).toBe("")

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Share this drive" }))
    })

    expect(writeText).toHaveBeenCalledWith(window.location.href)
    expect(status.textContent).toBe("Link copied")
  })

  it("says so when the clipboard refuses", async () => {
    writeText.mockRejectedValue(new Error("denied"))
    render(createElement(DriveShareButton, { title: "Ohio hours" }))

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Share this drive" }))
    })

    expect(screen.getByRole("status").textContent).toBe(
      "Couldn’t copy the link. Copy it from the address bar."
    )
  })
})
