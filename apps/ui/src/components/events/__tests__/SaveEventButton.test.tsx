// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from "vitest"

import { cleanup, fireEvent, render, screen, waitFor } from "@/test/render"

import { SaveEventButton } from "../SaveEventButton"

vi.mock("@iconify/react", () => ({ Icon: () => null }))
vi.mock("@/lib/analytics-events", () => ({
  captureAnalyticsEvent: () => vi.fn(),
}))
const request = vi.fn()
beforeEach(() => vi.stubGlobal("fetch", request.mockReset()))
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})
it("offers a retry after an unavailable read, then preserves a confirmed state after a failed write", async () => {
  request
    .mockResolvedValueOnce(new Response("", { status: 503 }))
    .mockResolvedValueOnce(Response.json([]))
    .mockResolvedValueOnce(new Response("", { status: 503 }))
  render(<SaveEventButton documentId="event-1" />)
  const retry = await screen.findByRole("button", { name: "Try again" })
  expect(screen.getByRole("status").textContent).toContain("unavailable")
  fireEvent.click(retry)
  const save = await screen.findByRole("button", { name: "Save" })
  await waitFor(() => expect(save.hasAttribute("disabled")).toBe(false))
  fireEvent.click(save)
  await waitFor(() =>
    expect(screen.getByRole("status").textContent).toContain(
      "could not be saved"
    )
  )
  expect(save.getAttribute("aria-pressed")).toBe("false")
})
it("keeps a saved event selected when removal fails", async () => {
  request
    .mockResolvedValueOnce(
      Response.json([{ documentId: "saved-1", eventDocumentId: "event-1" }])
    )
    .mockRejectedValueOnce(new Error("offline"))
  render(<SaveEventButton documentId="event-1" />)
  const saved = await screen.findByRole("button", { name: "Saved" })
  fireEvent.click(saved)
  await screen.findByRole("status")
  expect(saved.getAttribute("aria-pressed")).toBe("true")
})
