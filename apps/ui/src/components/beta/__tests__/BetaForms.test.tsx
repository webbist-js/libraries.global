// @vitest-environment happy-dom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { BetaForms } from "../BetaForms"

vi.mock("next-intl", () => ({
  useTranslations: () =>
    Object.assign((key: string) => key, { rich: (key: string) => key }),
}))
const fetchMock = vi.fn()
const code = "a".repeat(43)
beforeEach(() => {
  vi.clearAllMocks()
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
    fireEvent.click(screen.getByRole("button", { name: "enter", exact: true }))
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
  })
})
