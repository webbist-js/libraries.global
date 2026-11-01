// @vitest-environment happy-dom
import { useState } from "react"
import { afterEach, expect, it } from "vitest"

import { cleanup, fireEvent, render, screen } from "@/test/render"

import { AtlasMobileSheet, type AtlasSheetSize } from "../AtlasMobileSheet"

afterEach(cleanup)

function Fixture({ initial = "half" }: { readonly initial?: AtlasSheetSize }) {
  const [size, setSize] = useState<AtlasSheetSize>(initial)

  return (
    <AtlasMobileSheet size={size} onSizeChange={setSize}>
      <input aria-label="Search" />
    </AtlasMobileSheet>
  )
}

const handle = () => screen.getByRole("button", { name: /^Panel size:/ })
function drag(to: number) {
  fireEvent.pointerDown(handle(), {
    pointerId: 1,
    button: 0,
    clientY: 100,
    isPrimary: true,
  })
  fireEvent.pointerMove(handle(), {
    pointerId: 1,
    clientY: to,
    isPrimary: true,
  })
}

it("restores the previous height when a touch gesture is cancelled", () => {
  render(<Fixture />)
  drag(250)
  expect(screen.getByRole("region").style.height).not.toBe("54%")
  fireEvent.pointerCancel(handle(), { pointerId: 1 })
  expect(screen.getByRole("region").style.height).toBe("54%")
})

it("does not treat the click generated after a drag as a second resize", () => {
  render(<Fixture />)
  drag(350)
  fireEvent.pointerUp(handle(), { pointerId: 1, clientY: 350 })
  fireEvent.click(handle(), { detail: 1 })
  expect(handle().getAttribute("aria-label")).toContain("peek")
  // Keyboard activation still works after a pointer gesture.
  fireEvent.click(handle(), { detail: 0 })
  expect(handle().getAttribute("aria-label")).toContain("full")
})

it("keeps entered search text when hiding and reopening, and returns keyboard focus", () => {
  render(<Fixture />)
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "Leeds" } })
  const hide = screen.getByRole("button", { name: "Hide Atlas controls" })
  hide.focus()
  fireEvent.click(hide)
  expect(screen.queryByRole("textbox")).toBeNull()
  const open = screen.getByRole("button", { name: "Show Atlas controls" })
  expect(document.activeElement).toBe(open)
  fireEvent.click(open)
  expect(document.activeElement).toBe(handle())
  expect((screen.getByRole("textbox") as HTMLInputElement).value).toBe("Leeds")
})

it("supports keyboard collapse through peek to the map and direct Escape", () => {
  render(<Fixture />)
  fireEvent.keyDown(handle(), { key: "ArrowDown" })
  expect(handle().getAttribute("aria-label")).toContain("peek")
  fireEvent.keyDown(handle(), { key: "ArrowDown" })
  expect(screen.queryByRole("region")).toBeNull()
  fireEvent.click(screen.getByRole("button", { name: "Show Atlas controls" }))
  fireEvent.keyDown(handle(), { key: "ArrowUp" })
  expect(handle().getAttribute("aria-label")).toContain("full")
  fireEvent.keyDown(handle(), { key: "Escape" })
  expect(screen.queryByRole("region")).toBeNull()
})

it("can close from full height in one long downward swipe", () => {
  render(<Fixture initial="full" />)
  drag(900)
  fireEvent.pointerUp(handle(), { pointerId: 1, clientY: 900 })
  expect(screen.queryByRole("region")).toBeNull()
  expect(
    screen.getByRole("button", { name: "Show Atlas controls" })
  ).toBeTruthy()
})

it("leaves scrolling inside the panel to its content", () => {
  render(<Fixture />)
  const field = screen.getByRole("textbox")
  fireEvent.pointerDown(field, { pointerId: 1, button: 0, clientY: 100 })
  fireEvent.pointerMove(field, { pointerId: 1, clientY: 600 })
  fireEvent.pointerUp(field, { pointerId: 1, clientY: 600 })
  expect(handle().getAttribute("aria-label")).toContain("half")
})
