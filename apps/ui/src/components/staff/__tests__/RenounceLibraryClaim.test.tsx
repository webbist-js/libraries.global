// @vitest-environment happy-dom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"

import { RenounceLibraryClaim } from "../RenounceLibraryClaim"

const request = vi.hoisted(() => vi.fn())
vi.mock("@/lib/staff/client", () => ({ staffRequest: request }))
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  request.mockReset()
})
it("requires confirmation and sends only the selected library to the owned leave endpoint", async () => {
  request.mockResolvedValue({})
  const reload = vi
    .spyOn(window.location, "reload")
    .mockImplementation(() => {})
  render(
    <RenounceLibraryClaim
      libraryId="library000000000000000001"
      libraryName="Central"
    />
  )
  fireEvent.click(
    screen.getByRole("button", { name: "Renounce library claim" })
  )
  expect(request).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole("button", { name: "Keep my claim" }))
  expect(request).not.toHaveBeenCalled()
  fireEvent.click(
    screen.getByRole("button", { name: "Renounce library claim" })
  )
  fireEvent.click(screen.getByRole("button", { name: "Confirm renunciation" }))
  await waitFor(() => expect(reload).toHaveBeenCalledOnce())
  expect(request).toHaveBeenCalledExactlyOnceWith(
    "/api/staff/library000000000000000001/leave",
    "POST"
  )
})
it("keeps the confirmation available and reports a failed departure", async () => {
  request.mockRejectedValue(new Error("Your staff access has changed."))
  render(
    <RenounceLibraryClaim
      libraryId="library000000000000000001"
      libraryName="Central"
    />
  )
  fireEvent.click(
    screen.getByRole("button", { name: "Renounce library claim" })
  )
  fireEvent.click(screen.getByRole("button", { name: "Confirm renunciation" }))
  await waitFor(() =>
    expect(screen.getByRole("alert").textContent).toContain(
      "Your staff access has changed."
    )
  )
  expect(screen.getByRole("button", { name: "Keep my claim" })).toBeDefined()
})
