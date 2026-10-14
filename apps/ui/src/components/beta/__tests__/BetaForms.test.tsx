// @vitest-environment happy-dom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { captureAnalyticsEvent } from "@/lib/analytics-events"

import { BetaForms } from "../BetaForms"

vi.mock("@/lib/analytics-events", () => ({ captureAnalyticsEvent: vi.fn() }))
const measured = vi.fn(() => true)

vi.mock("next-intl", () => ({
  useTranslations: () =>
    Object.assign((key: string) => key, { rich: (key: string) => key }),
}))
const fetchMock = vi.fn()
const code = "a".repeat(43)
beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(captureAnalyticsEvent).mockReturnValue(measured)
  vi.stubGlobal("fetch", fetchMock)
  window.location.hash = ""
})
afterEach(() => {
  cleanup()
  window.location.hash = ""
  vi.unstubAllGlobals()
})

describe("beta invitation entrance", () => {
  it("prefills and removes the email fragment without redeeming on page load", () => {
    window.location.hash = `#invite=${code}`
    render(<BetaForms next="/libraries" locale="en" available />)
    expect(
      (screen.getByLabelText("passwordLabel") as HTMLInputElement).value
    ).toBe(code)
    expect(window.location.hash).toBe("")
    expect(fetchMock).not.toHaveBeenCalled()
  })
  it("handles an invitation opened while the entrance is already mounted", () => {
    render(<BetaForms next="/libraries" locale="en" available />)
    window.location.hash = `#invite=${code}`
    fireEvent(window, new Event("hashchange"))
    expect(
      (screen.getByLabelText("passwordLabel") as HTMLInputElement).value
    ).toBe(code)
    expect(fetchMock).not.toHaveBeenCalled()
  })
  it("redeems only when the recipient presses Enter", async () => {
    window.location.hash = `#invite=${code}`
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ next: "/libraries" }),
    })
    render(<BetaForms next="/libraries" locale="en" available />)
    fireEvent.click(screen.getByRole("button", { name: "enter" }))
    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: "acceptedTitle" })
      ).toBeTruthy()
    )
    expect(fetchMock).toHaveBeenCalledOnce()
    expect(JSON.parse(fetchMock.mock.calls[0]![1].body)).toEqual({
      code,
      next: "/libraries",
    })
    expect(captureAnalyticsEvent).not.toHaveBeenCalled()
  })

  it("counts an accepted beta request without sending the email, and ignores rejections", async () => {
    render(<BetaForms next="/libraries" locale="en" available />)
    fireEvent.change(screen.getByRole("textbox", { name: "emailLabel" }), {
      target: { value: "reader@example.org" },
    })
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 503 }))
    fireEvent.click(screen.getByRole("button", { name: "requestAccess" }))
    await screen.findByText("waitlistUnavailable")
    expect(measured).not.toHaveBeenCalled()
    fetchMock.mockResolvedValueOnce(Response.json({ ok: true }))
    fireEvent.click(screen.getByRole("button", { name: "requestAccess" }))
    await waitFor(() => expect(measured).toHaveBeenCalledOnce())
    expect(captureAnalyticsEvent).toHaveBeenLastCalledWith("generate_lead", {
      interaction_source: "beta",
      submission_type: "beta_request",
    })
    expect(
      JSON.stringify(vi.mocked(captureAnalyticsEvent).mock.calls)
    ).not.toContain("reader@example.org")
  })
})
