// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import * as React from "react"
import { createElement as h } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

Object.assign(globalThis, { React })

const { Switch } = await import("../Switch")

afterEach(cleanup)

describe("Switch", () => {
  it("is a labelled switch that reports its state", () => {
    const onChange = vi.fn()
    render(
      h(Switch, {
        label: "Can go live",
        description: "Start and run live sharing from the console.",
        checked: false,
        onChange,
      })
    )
    const control = screen.getByRole("switch", {
      name: /Can go live/,
    }) as HTMLInputElement
    expect(control.checked).toBe(false)
    expect(
      screen.getByText("Start and run live sharing from the console.")
    ).toBeTruthy()
    fireEvent.click(control)
    expect(onChange).toHaveBeenCalledWith(true)
  })

  it("reads as on when checked, and ignores clicks while disabled", () => {
    const onChange = vi.fn()
    render(
      h(Switch, {
        label: "Term time only",
        checked: true,
        disabled: true,
        onChange,
        inline: true,
      })
    )
    const control = screen.getByRole("switch", {
      name: "Term time only",
    }) as HTMLInputElement
    expect(control.checked).toBe(true)
    expect(control.disabled).toBe(true)
    fireEvent.click(control)
    expect(onChange).not.toHaveBeenCalled()
  })

  it("gives the control a 44 px hit area", () => {
    render(
      h(Switch, { label: "Can go live", checked: false, onChange: vi.fn() })
    )
    const control = screen.getByRole("switch")
    // The input fills its 44 px (h-11) wrapper, so the tap target is the row's height.
    const wrapper = control.parentElement!
    expect(wrapper.className).toMatch(/\bh-11\b/)
    expect(control.className).toMatch(/\bsize-full\b/)
    expect(control.closest("label")!.className).toMatch(/\bmin-h-11\b/)
  })

  it("uses the id it is given", () => {
    render(
      h(Switch, {
        id: "live-switch",
        label: "Live",
        checked: false,
        onChange: vi.fn(),
      })
    )
    expect(screen.getByRole("switch").id).toBe("live-switch")
    expect(screen.getByText("Live").closest("label")!.getAttribute("for")).toBe(
      "live-switch"
    )
  })
})
