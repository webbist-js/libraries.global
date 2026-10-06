// @vitest-environment happy-dom
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}))

import { ConnectFeedForm } from "../ConnectFeedForm"

const LIBS = [
  { documentId: "lib00000000000000000001", name: "Central Library" },
]

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) =>
      Response.json(
        url.endsWith("/test")
          ? { data: { result: "auth_failed" } }
          : { data: { result: "ok", submissionDocumentId: "s1" } },
        { status: 200 }
      )
    )
  )
})

describe("ConnectFeedForm", () => {
  it("preselects a single library and shows the provider's fields", () => {
    render(<ConnectFeedForm libraries={LIBS} oauth={{ eventbrite: false }} />)
    expect(screen.getByText("Central Library")).toBeTruthy()
    fireEvent.click(screen.getByRole("radio", { name: /Calendar feed/ }))
    expect(screen.getByLabelText(/Calendar address/)).toBeTruthy()
  })

  it("marks secret inputs as passwords that browsers won't autofill", () => {
    render(<ConnectFeedForm libraries={LIBS} oauth={{ eventbrite: false }} />)
    fireEvent.click(screen.getByRole("radio", { name: /TicketSource/ }))
    const input = screen.getByLabelText(/API key/) as HTMLInputElement
    expect(input.type).toBe("password")
    expect(input.autocomplete).toBe("new-password")
  })

  it("shows the test result in plain words and blocks sending on a fixable failure", async () => {
    render(<ConnectFeedForm libraries={LIBS} oauth={{ eventbrite: false }} />)
    fireEvent.click(screen.getByRole("radio", { name: /TicketSource/ }))
    fireEvent.change(screen.getByLabelText(/API key/), {
      target: { value: "ts_live_ABCDEFGHIJ" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Test connection" }))
    await waitFor(() =>
      expect(screen.getByText(/refused these details/)).toBeTruthy()
    )
    expect(
      (
        screen.getByRole("button", {
          name: "Send for review",
        }) as HTMLButtonElement
      ).disabled
    ).toBe(true)
  })
})
