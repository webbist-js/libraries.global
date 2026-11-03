// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from "vitest"

import { cleanup, fireEvent, render, screen } from "@/test/render"

import { YearRange } from "../atlas-ui"

afterEach(cleanup)

it("commits a founded range once the drag ends, not on every step", () => {
  const onChange = vi.fn()
  render(
    <YearRange min={1800} max={2026} value={[1800, 2026]} onChange={onChange} />
  )
  const from = screen.getAllByRole("slider")[0]!
  fireEvent.change(from, { target: { value: "1850" } })
  fireEvent.change(from, { target: { value: "1900" } })
  expect(onChange).not.toHaveBeenCalled()
  expect((from as HTMLInputElement).value).toBe("1900")
  fireEvent.pointerUp(from)
  expect(onChange).toHaveBeenCalledTimes(1)
  expect(onChange).toHaveBeenCalledWith([1900, 2026])
})
