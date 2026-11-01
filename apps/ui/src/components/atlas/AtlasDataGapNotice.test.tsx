// @vitest-environment happy-dom
import { afterEach, expect, it } from "vitest"

import { cleanup, fireEvent, render, screen } from "@/test/render"

import { AtlasDataGapNotice } from "./AtlasDataGapNotice"

afterEach(cleanup)
const gap = { id: "missing", reasons: ["missingPopulation"] as const }
const props = {
  gap: { ...gap, reasons: [...gap.reasons] },
  layer: "Population",
  scope: "Ireland · Regions",
}
it("explains the specific gap, dismisses without looping, and permits reopening", () => {
  const { rerender } = render(<AtlasDataGapNotice {...props} />)
  expect(
    screen.getByRole("dialog", { name: "Data gap · Population" })
  ).toBeTruthy()
  expect(
    screen.getByText(/Population data is missing for the selected location/)
  ).toBeTruthy()
  fireEvent.click(
    screen.getByRole("button", { name: "Continue with available data" })
  )
  rerender(<AtlasDataGapNotice {...props} gap={{ ...props.gap }} />)
  expect(screen.queryByRole("dialog")).toBeNull()
  fireEvent.click(screen.getByRole("button", { name: "Data gap details" }))
  expect(screen.getByRole("dialog")).toBeTruthy()
})
it("explains a repeated encounter again and supports keyboard dismissal", () => {
  const { rerender } = render(
    <AtlasDataGapNotice key="encounter-1" {...props} />
  )
  fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" })
  expect(screen.queryByRole("dialog")).toBeNull()
  rerender(<AtlasDataGapNotice key="encounter-2" {...props} />)
  expect(screen.getByRole("dialog")).toBeTruthy()
})
