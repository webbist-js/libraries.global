// @vitest-environment happy-dom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import * as React from "react"
import { createElement } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// vitest.config has no JSX runtime, so .tsx compiles to React.createElement.
Object.assign(globalThis, { React })

const refresh = vi.fn()
vi.mock("@/lib/navigation", () => ({
  useRouter: () => ({ refresh, push: vi.fn(), replace: vi.fn() }),
}))
vi.mock("@iconify/react", () => ({ Icon: () => null }))

const fetchMock = vi.fn(async () => Response.json({ data: {} }))

const { ReviewDecisionForm } = await import("../ReviewDecisionForm")

const DOC = "abcdefghijklmnopqrstuvwx"
const renderForm = (over: Record<string, unknown> = {}) =>
  render(
    createElement(ReviewDecisionForm, {
      documentId: DOC,
      status: "pending",
      canPublish: false,
      ...over,
    })
  )
const sent = () => {
  const [url, init] = fetchMock.mock.calls[0] as unknown as [
    string,
    RequestInit,
  ]

  return { url, method: init.method, body: JSON.parse(String(init.body)) }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal("fetch", fetchMock)
})
afterEach(cleanup)

describe("ReviewDecisionForm", () => {
  it.each([
    ["Reject", "rejected"],
    ["Needs changes", "needs_info"],
  ])("%s needs a note before it is sent", async (button, status) => {
    renderForm()
    fireEvent.click(screen.getByRole("button", { name: button }))
    expect(fetchMock).not.toHaveBeenCalled()
    expect(screen.getByRole("alert").textContent).toMatch(/note/i)

    fireEvent.change(screen.getByLabelText(/Note to the contributor/), {
      target: { value: "Please add a source." },
    })
    fireEvent.click(screen.getByRole("button", { name: button }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    expect(sent()).toEqual({
      url: `/api/moderation/submissions/${DOC}/status`,
      method: "PUT",
      body: { status, note: "Please add a source." },
    })
  })

  it("approves without a note", async () => {
    renderForm()
    fireEvent.click(screen.getByRole("button", { name: "Approve" }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    expect(sent().body).toEqual({ status: "approved" })
    await waitFor(() => expect(refresh).toHaveBeenCalled())
  })

  it("offers Approve and publish only when canPublish", () => {
    renderForm({ canPublish: false })
    expect(
      screen.queryByRole("button", { name: "Approve and publish" })
    ).toBeNull()
    cleanup()
    renderForm({ canPublish: true })
    expect(
      screen.getByRole("button", { name: "Approve and publish" })
    ).toBeTruthy()
  })

  it("asks for confirmation before approving and publishing", async () => {
    renderForm({ canPublish: true })
    fireEvent.click(screen.getByRole("button", { name: "Approve and publish" }))
    expect(fetchMock).not.toHaveBeenCalled()
    expect(screen.getByText(/readers see it straight away/i)).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: /Confirm and publish/ }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    expect(sent().body).toEqual({ status: "approved", publish: true })
  })

  it("shows Strapi's refusal inline with the spec copy", async () => {
    fetchMock.mockResolvedValueOnce(
      Response.json(
        {
          error: {
            status: 409,
            name: "apply_refused",
            reason: "no_hierarchy",
            message: "x",
          },
        },
        { status: 409 }
      )
    )
    renderForm({ canPublish: true })
    fireEvent.click(screen.getByRole("button", { name: "Approve" }))
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toMatch(
        /continent, country and region/
      )
    )
    expect(refresh).not.toHaveBeenCalled()
  })

  it("announces the outcome after the page refreshes to the decided state", async () => {
    const { rerender } = renderForm()
    fireEvent.click(screen.getByRole("button", { name: "Approve" }))
    await waitFor(() => expect(refresh).toHaveBeenCalled())
    rerender(
      createElement(ReviewDecisionForm, {
        documentId: DOC,
        status: "approved",
        canPublish: false,
      })
    )
    const live = document.querySelector("[aria-live]")
    expect(live?.textContent).toBe("Approved.")
  })

  it("is read-only once decided", () => {
    renderForm({ status: "approved" })
    expect(screen.queryByRole("button", { name: "Approve" })).toBeNull()
    expect(screen.getByText(/decisions are final/i)).toBeTruthy()
  })
})
