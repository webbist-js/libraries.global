// @vitest-environment happy-dom
import type { SupporterEntry, SupportersResponse } from "@repo/shared-data"
import * as React from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { cleanup, fireEvent, render, screen, waitFor } from "@/test/render"

Object.assign(globalThis, { React })
const mocks = vi.hoisted(() => ({ push: vi.fn() }))
vi.mock("@iconify/react", () => ({ Icon: () => null }))
vi.mock("@/lib/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }))
vi.mock("@/components/global/GlobalLink", () => ({
  default: (props: React.AnchorHTMLAttributes<HTMLAnchorElement>) =>
    React.createElement("a", props),
}))
const { SupportersDirectory } = await import("../SupportersDirectory")
const entry = (username: string): SupporterEntry => ({
  username,
  displayName: username,
  initials: "LG",
  city: null,
  country: null,
  since: "2026-10-01",
})
const data = (extra: Partial<SupportersResponse> = {}): SupportersResponse => ({
  entries: [entry("first")],
  newThisMonth: [],
  total: 4,
  listed: 3,
  unlisted: 1,
  countries: [],
  matched: 3,
  page: 1,
  pageSize: 1,
  costs: null,
  title: null,
  lead: null,
  ...extra,
})
const fetchMock = vi.fn()
beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal("fetch", fetchMock)
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe("supporters directory", () => {
  it("appends the next page, keeps filters and does not duplicate a repeated profile", async () => {
    fetchMock.mockResolvedValue(
      Response.json({
        data: data({ entries: [entry("first"), entry("second")], page: 2 }),
      })
    )
    render(
      React.createElement(SupportersDirectory, {
        data: data(),
        query: { region: "europe", q: "York", sort: "name" },
        locale: "en",
      })
    )
    fireEvent.click(screen.getByRole("button", { name: "Show more" }))
    await waitFor(() =>
      expect(screen.getByRole("link", { name: /second/ })).toBeTruthy()
    )
    expect(screen.getAllByRole("link", { name: /first/ })).toHaveLength(1)
    expect(fetchMock.mock.calls[0]?.[0]).toContain("region=europe")
    expect(fetchMock.mock.calls[0]?.[0]).toContain("page=2")
    expect(screen.getByRole("link", { name: /first/ })).toBeTruthy()
  })
  it("keeps the current cards after a failed load and permits retry", async () => {
    fetchMock.mockResolvedValue(Response.json({}, { status: 503 }))
    render(
      React.createElement(SupportersDirectory, {
        data: data(),
        query: {},
        locale: "en",
      })
    )
    fireEvent.click(screen.getByRole("button", { name: "Show more" }))
    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy())
    expect(screen.getByRole("link", { name: /first/ })).toBeTruthy()
    expect(
      (screen.getByRole("button", { name: "Show more" }) as HTMLButtonElement)
        .disabled
    ).toBe(false)
  })
  it("submits search and sort together, resets pagination and preserves the region", async () => {
    render(
      React.createElement(SupportersDirectory, {
        data: data(),
        query: { region: "asia", page: "2" },
        locale: "en",
      })
    )
    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "Kyoto" },
    })
    fireEvent.submit(screen.getByRole("searchbox").closest("form")!)
    expect(mocks.push).toHaveBeenCalledWith(expect.stringContaining("q=Kyoto"))
    expect(mocks.push).toHaveBeenCalledWith(
      expect.stringContaining("region=asia")
    )
    expect(mocks.push).toHaveBeenCalledWith(expect.stringContaining("page=1"))
  })
})
