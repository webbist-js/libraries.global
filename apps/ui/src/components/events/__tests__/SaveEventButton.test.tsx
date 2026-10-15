// @vitest-environment happy-dom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { SaveEventButton } from "@/components/events/SaveEventButton"
import { captureAnalyticsEvent } from "@/lib/analytics-events"

vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }))
vi.mock("@iconify/react", () => ({ Icon: () => <span aria-hidden="true" /> }))
vi.mock("@/lib/analytics-events", () => ({ captureAnalyticsEvent: vi.fn() }))
const measured = vi.fn(() => true)
const fetchMock = vi.fn()
beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(captureAnalyticsEvent).mockReturnValue(measured)
  vi.stubGlobal("fetch", fetchMock)
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe("confirmed event saves", () => {
  it("counts successful save and unsave outcomes, with only the public event ID", async () => {
    fetchMock.mockResolvedValueOnce(Response.json([]))
    render(<SaveEventButton documentId="public_event" />)
    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce())
    fetchMock.mockResolvedValueOnce(
      Response.json({ documentId: "private_saved_record" })
    )
    fireEvent.click(screen.getByRole("button", { name: "save" }))
    await screen.findByRole("button", { name: "saved" })
    expect(measured).toHaveBeenCalledOnce()
    expect(captureAnalyticsEvent).toHaveBeenLastCalledWith("event_action", {
      interaction_source: "event_save",
      action_type: "save",
      content_id: "public_event",
    })
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }))
    fireEvent.click(screen.getByRole("button", { name: "saved" }))
    await screen.findByRole("button", { name: "save" })
    expect(measured).toHaveBeenCalledTimes(2)
    expect(captureAnalyticsEvent).toHaveBeenLastCalledWith("event_action", {
      interaction_source: "event_save",
      action_type: "unsave",
      content_id: "public_event",
    })
    expect(
      JSON.stringify(vi.mocked(captureAnalyticsEvent).mock.calls)
    ).not.toContain("private_saved_record")
  })

  it("keeps a saved event and does not count a rejected deletion or failed network request", async () => {
    fetchMock.mockResolvedValueOnce(
      Response.json([
        { documentId: "saved_record", eventDocumentId: "public_event" },
      ])
    )
    render(<SaveEventButton documentId="public_event" />)
    const button = await screen.findByRole("button", { name: "saved" })
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 503 }))
    fireEvent.click(button)
    await waitFor(() =>
      expect((button as HTMLButtonElement).disabled).toBe(false)
    )
    expect(screen.getByRole("button", { name: "saved" })).toBeTruthy()
    expect(measured).not.toHaveBeenCalled()
    fetchMock.mockRejectedValueOnce(new Error("offline"))
    fireEvent.click(button)
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3))
    await waitFor(() =>
      expect((button as HTMLButtonElement).disabled).toBe(false)
    )
    expect(measured).not.toHaveBeenCalled()
    expect(screen.getByRole("button", { name: "saved" })).toBeTruthy()
  })

  it("does not count a rejected or malformed save response", async () => {
    fetchMock.mockResolvedValueOnce(Response.json([]))
    render(<SaveEventButton documentId="public_event" />)
    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce())
    const button = screen.getByRole("button", { name: "save" })
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 401 }))
    fireEvent.click(button)
    await waitFor(() =>
      expect((button as HTMLButtonElement).disabled).toBe(false)
    )
    fetchMock.mockResolvedValueOnce(Response.json({}))
    fireEvent.click(button)
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3))
    await waitFor(() =>
      expect((button as HTMLButtonElement).disabled).toBe(false)
    )
    expect(measured).not.toHaveBeenCalled()
    expect(screen.getByRole("button", { name: "save" })).toBeTruthy()
  })
})
