// @vitest-environment happy-dom
import * as React from "react"
import { createElement as h } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { DriveTask } from "@/lib/drives/types"
import { act, cleanup, fireEvent, render, screen } from "@/test/render"

Object.assign(globalThis, { React })

vi.mock("@iconify/react", () => ({ Icon: () => null }))

const { DriveTaskList } = await import("../DriveTaskList")

const task = (id: string, name: string): DriveTask => ({
  documentId: id,
  slug: id,
  name,
  href: null,
  inReview: false,
})

const TASKS = [task("a", "Alpha Library"), task("b", "Beta Library")]

const handlers = () => ({
  onSearch: vi.fn(),
  onNear: vi.fn(),
  onMore: vi.fn(),
  onRandom: vi.fn(),
  onSelect: vi.fn(),
})

function show(props: Partial<Parameters<typeof DriveTaskList>[0]> = {}) {
  const on = handlers()
  render(
    h(DriveTaskList, {
      tasks: TASKS,
      verb: "Add hours",
      selectedId: null,
      doneIds: new Set<string>(),
      loading: false,
      error: null,
      hasMore: false,
      near: false,
      query: "",
      ...on,
      ...props,
    })
  )

  return on
}

beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe("DriveTaskList", () => {
  it("lists each library as an action, marking the sent ones", () => {
    show({ selectedId: "a", doneIds: new Set(["b"]) })
    const list = screen.getByRole("list", { name: "Libraries to do" })
    expect(list.querySelectorAll("li")).toHaveLength(2)
    expect(
      screen
        .getByRole("button", { name: "Add hours for Alpha Library" })
        .getAttribute("aria-pressed")
    ).toBe("true")
    expect(
      screen
        .getByRole("button", { name: "Add hours for Beta Library" })
        .getAttribute("aria-disabled")
    ).toBe("true")
    expect(screen.getByRole("status").textContent).toBe("Showing 2 libraries")
  })

  it("searches by town or county once typing pauses", () => {
    const on = show()
    const input = screen.getByRole("searchbox", { name: "Town or county" })
    fireEvent.change(input, { target: { value: "Colum" } })
    fireEvent.change(input, { target: { value: " Columbus " } })
    expect(on.onSearch).not.toHaveBeenCalled()
    act(() => {
      vi.advanceTimersByTime(350)
    })
    expect(on.onSearch).toHaveBeenCalledTimes(1)
    expect(on.onSearch).toHaveBeenCalledWith("Columbus")
  })

  it("asks for a location only when “Near me” is pressed", () => {
    const getCurrentPosition = vi.fn((ok: PositionCallback) =>
      ok({
        coords: { latitude: 40.1, longitude: -83.1 },
      } as GeolocationPosition)
    )
    vi.stubGlobal("navigator", {
      ...navigator,
      geolocation: { getCurrentPosition },
    })
    const on = show()
    expect(getCurrentPosition).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name: "Near me" }))
    expect(on.onNear).toHaveBeenCalledWith({ lat: 40.1, lng: -83.1 })
  })

  it("turns “Near me” off again, and says when the location fails", () => {
    const on = show({ near: true })
    const near = screen.getByRole("button", { name: "Near me" })
    expect(near.getAttribute("aria-pressed")).toBe("true")
    fireEvent.click(near)
    expect(on.onNear).toHaveBeenCalledWith(null)
    cleanup()

    vi.stubGlobal("navigator", {
      ...navigator,
      geolocation: {
        getCurrentPosition: (
          _ok: PositionCallback,
          fail: PositionErrorCallback
        ) => fail({ code: 1 } as GeolocationPositionError),
      },
    })
    const again = show()
    fireEvent.click(screen.getByRole("button", { name: "Near me" }))
    expect(again.onNear).not.toHaveBeenCalled()
    expect(
      screen.getByText(
        "We couldn’t find where you are. Search by town instead."
      )
    ).toBeTruthy()
  })

  it("shows more, and picks one at random", () => {
    const on = show({ hasMore: true })
    fireEvent.click(screen.getByRole("button", { name: "Show more" }))
    expect(on.onMore).toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name: "Give me a library" }))
    expect(on.onRandom).toHaveBeenCalled()
    cleanup()
    show({ hasMore: false })
    expect(screen.queryByRole("button", { name: "Show more" })).toBeNull()
  })

  it("is honest when nothing matches", () => {
    show({ tasks: [], query: "Nowhere" })
    expect(screen.getByRole("status").textContent).toBe(
      "No libraries in this drive match “Nowhere”."
    )
    cleanup()
    show({ tasks: [] })
    expect(screen.getByRole("status").textContent).toBe(
      "Every library in this drive is done or in review."
    )
  })
})
