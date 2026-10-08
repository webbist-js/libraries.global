// @vitest-environment happy-dom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
import * as React from "react"
import { createElement } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

Object.assign(globalThis, { React })

const mocks = vi.hoisted(() => ({ refresh: vi.fn() }))

vi.mock("next-intl", () => ({ useLocale: () => "en-GB" }))
vi.mock("@/lib/env-vars", () => ({ getEnvVar: () => {} }))
vi.mock("@iconify/react", () => ({ Icon: () => null }))
vi.mock("@/lib/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: mocks.refresh }),
}))

const { StaffAccessList } = await import("../StaffAccessList")
type Row = Parameters<typeof StaffAccessList>[0]["rows"][number]

const rows: Row[] = [
  {
    affiliationDocumentId: "aff1",
    name: "Ann Archer",
    staffRole: "owner",
    source: "claim",
    approvedAt: "2026-09-01T00:00:00Z",
    canRemove: true,
  },
  {
    affiliationDocumentId: "aff2",
    name: "Bea",
    staffRole: "editor",
    source: "team",
    approvedAt: null,
    canRemove: false,
  },
]
const list = (over: Row[] = rows) =>
  createElement(StaffAccessList, { libraryName: "Central Library", rows: over })

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json({ data: { ok: true } }))
  )
})
afterEach(() => {
  cleanup()
  mocks.refresh.mockReset()
  vi.unstubAllGlobals()
})

describe("StaffAccessList", () => {
  it("lists everyone with access, how they got it and their level", () => {
    render(list())
    expect(screen.getByRole("heading", { name: "Staff (2)" })).toBeTruthy()
    const ann = screen.getByText("Ann Archer").closest("li")!
    expect(ann.textContent).toMatch(/Approved claim · since 1 Sep\w* 2026/)
    expect(within(ann).getByText("Owner")).toBeTruthy()
    const bea = screen.getByText("Bea").closest("li")!
    expect(bea.textContent).toContain("Assigned by a Team")
    expect(bea.textContent).not.toContain("since")
    expect(within(bea).getByText("Editor")).toBeTruthy()
  })

  it("offers Remove only where the route allows it", () => {
    render(list())
    const removes = screen.getAllByRole("button", { name: "Remove from staff" })
    expect(removes.length).toBe(1)
    expect(
      screen.getByText("Ann Archer").closest("li")!.contains(removes[0]!)
    ).toBe(true)
    expect(
      within(screen.getByText("Bea").closest("li")!).queryByRole("button")
    ).toBeNull()
  })

  it("removes through the moderation route after a confirm sheet", async () => {
    render(list())
    fireEvent.click(screen.getByRole("button", { name: "Remove from staff" }))
    const dialog = screen.getByRole("dialog", {
      name: "Remove Ann Archer from Central Library?",
    })
    expect(fetch).not.toHaveBeenCalled()
    fireEvent.click(within(dialog).getByRole("button", { name: "Keep" }))
    expect(screen.queryByRole("dialog")).toBeNull()

    fireEvent.click(screen.getByRole("button", { name: "Remove from staff" }))
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Remove from staff",
      })
    )
    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith("/api/moderation/staff/aff1/remove", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })
    )
    await waitFor(() => expect(screen.queryByText("Ann Archer")).toBeNull())
    expect(screen.getByRole("heading", { name: "Staff (1)" })).toBeTruthy()
    expect(screen.getByRole("status").textContent).toContain(
      "Ann Archer removed from Central Library’s staff"
    )
    expect(mocks.refresh).toHaveBeenCalled()
  })

  it("keeps the person and shows the error when the route refuses", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      Response.json(
        { error: { message: "Outside your scope" } },
        { status: 403 }
      )
    )
    render(list())
    fireEvent.click(screen.getByRole("button", { name: "Remove from staff" }))
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Remove from staff",
      })
    )
    expect(await screen.findByRole("alert")).toBeTruthy()
    expect(screen.getByRole("alert").textContent).toBe("Outside your scope")
    expect(screen.getByText("Ann Archer")).toBeTruthy()
    expect(mocks.refresh).not.toHaveBeenCalled()
  })

  it("says so when nobody has access", () => {
    render(list([]))
    expect(screen.getByRole("heading", { name: "Staff (0)" })).toBeTruthy()
    expect(
      screen.getByText("Nobody has staff access to this library.")
    ).toBeTruthy()
  })
})
