// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from "vitest"

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@/test/render"

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

it("saves 'Don't show this again' for a signed-in reader and keeps the details button", async () => {
  const onHide = vi.fn().mockResolvedValue(true)
  const { rerender } = render(
    <AtlasDataGapNotice key="encounter-1" {...props} signedIn onHide={onHide} />
  )
  const dialog = screen.getByRole("dialog", { name: "Data gap · Population" })
  expect(
    within(dialog).getByText(/turn these explanations back on in Settings/)
  ).toBeTruthy()
  fireEvent.click(
    within(dialog).getByRole("checkbox", { name: "Don’t show this again" })
  )
  fireEvent.click(
    within(dialog).getByRole("button", { name: "Continue with available data" })
  )
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
  expect(onHide).toHaveBeenCalledOnce()

  // The next encounter stays closed but still marks the gap.
  rerender(
    <AtlasDataGapNotice
      key="encounter-2"
      {...props}
      hidden
      signedIn
      onHide={onHide}
    />
  )
  expect(screen.queryByRole("dialog")).toBeNull()
  fireEvent.click(screen.getByRole("button", { name: "Data gap details" }))
  const reopened = screen.getByRole("dialog")
  expect(within(reopened).queryByRole("checkbox")).toBeNull()
  expect(
    within(reopened).getByText(/Automatic explanations are off/)
  ).toBeTruthy()
})

it("stays open with an alert when the choice can't be saved", async () => {
  const onHide = vi.fn().mockResolvedValue(false)
  render(<AtlasDataGapNotice {...props} signedIn onHide={onHide} />)
  fireEvent.click(screen.getByRole("checkbox"))
  fireEvent.click(
    screen.getByRole("button", { name: "Continue with available data" })
  )
  expect((await screen.findByRole("alert")).textContent).toMatch(
    /Couldn’t save your preference/
  )
  expect(screen.getByRole("dialog")).toBeTruthy()
})

it("offers signed-out readers a per-visit choice and only hides on request", async () => {
  const onHide = vi.fn().mockResolvedValue(true)
  render(<AtlasDataGapNotice {...props} onHide={onHide} />)
  expect(
    screen.getByRole("checkbox", { name: "Don’t show again during this visit" })
  ).toBeTruthy()
  expect(screen.getByText(/Sign in to save this choice/)).toBeTruthy()
  fireEvent.click(
    screen.getByRole("button", { name: "Continue with available data" })
  )
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
  expect(onHide).not.toHaveBeenCalled()
})
