// @vitest-environment happy-dom
import * as React from "react"
import { createElement as h } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

import type { DriveTask } from "@/lib/drives/types"
import { cleanup, fireEvent, render, screen } from "@/test/render"

Object.assign(globalThis, { React })

vi.mock("@iconify/react", () => ({ Icon: () => null }))

const { DriveTaskRow } = await import("../DriveTaskRow")

afterEach(() => {
  cleanup()
})

const task: DriveTask = {
  documentId: "lib00000000000000000001",
  slug: "northwest",
  name: "Worthington Libraries, Northwest",
  city: "Columbus",
  region_name: "Ohio",
  href: "/north-america/united-states/ohio/northwest",
  inReview: false,
}

const show = (props: Partial<Parameters<typeof DriveTaskRow>[0]> = {}) => {
  const onSelect = vi.fn()
  render(
    h(
      "ul",
      null,
      h(DriveTaskRow, {
        task,
        verb: "Add hours",
        selected: false,
        inReview: false,
        onSelect,
        ...props,
      })
    )
  )

  return onSelect
}

describe("DriveTaskRow", () => {
  it("names its action after the library", () => {
    const onSelect = show()
    const button = screen.getByRole("button", {
      name: "Add hours for Worthington Libraries, Northwest",
    })
    expect(button.getAttribute("aria-pressed")).toBe("false")
    expect(screen.getByText("Columbus, Ohio")).toBeTruthy()
    fireEvent.click(button)
    expect(onSelect).toHaveBeenCalledWith(task)
  })

  it("says when it's the one being worked on", () => {
    show({ selected: true })
    expect(
      screen
        .getByRole("button", {
          name: "Add hours for Worthington Libraries, Northwest",
        })
        .getAttribute("aria-pressed")
    ).toBe("true")
  })

  it("shows the distance when the list is sorted near you", () => {
    show({ task: { ...task, distanceKm: 1.24 } })
    expect(screen.getByText("1.2 km away")).toBeTruthy()
  })

  it("is “In review” once sent, and can't be picked again", () => {
    const onSelect = show({ inReview: true })
    const button = screen.getByRole("button", {
      name: "Add hours for Worthington Libraries, Northwest",
    })
    expect(button.getAttribute("aria-disabled")).toBe("true")
    const status = screen.getByText("In review")
    expect(button.getAttribute("aria-describedby")).toContain(status.id)
    fireEvent.click(button)
    expect(onSelect).not.toHaveBeenCalled()
  })
})
