// @vitest-environment happy-dom
import type { LibraryNotice } from "@repo/shared-data"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import * as React from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@/test/render"

Object.assign(globalThis, { React })
const refresh = vi.hoisted(() => vi.fn())
vi.mock("@/lib/navigation", () => ({
  routing: { defaultLocale: "en" },
  useRouter: () => ({ refresh }),
  Link: ({ children, ...props }: React.ComponentProps<"a">) => (
    <a {...props}>{children}</a>
  ),
}))
vi.mock("@/lib/workspace-analytics", () => ({
  captureWorkspaceAction: () => vi.fn(),
}))
vi.mock("@iconify/react", () => ({ Icon: () => null }))
const { StaffNotices, noticeDates } = await import("../StaffNotices")
const current: LibraryNotice = {
  id: "current",
  type: "service",
  scope: "library",
  scopeDay: null,
  scopeWeek: null,
  stopId: null,
  reason: null,
  endedAt: null,
  from: "2026-11-12",
  to: "2026-11-20",
  message: "Study area closed for refurbishment.",
}
const past: LibraryNotice = {
  ...current,
  id: "past",
  type: "closure",
  from: "2025-12-01",
  to: "2025-12-02",
  endedAt: "2025-12-01T12:00:00Z",
  message: "Closed for maintenance.",
}
const initial = {
  data: [current, past],
  today: "2026-11-14",
  timezone: "Europe/London",
  stops: [],
  cycleWeeks: 1,
}
const renderNotices = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <StaffNotices id="library" mobile={false} initial={initial} />
    </QueryClientProvider>
  )
const reply = (notice: LibraryNotice) =>
  vi.mocked(fetch).mockResolvedValue(Response.json({ notice }))
const formSubmit = () =>
  fireEvent.submit(screen.getByRole("dialog").querySelector("form")!)

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal("fetch", vi.fn())
  Element.prototype.scrollIntoView = vi.fn()
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe("notice management", () => {
  it("opens the shared drawer to post, then adds the saved notice to the list", async () => {
    renderNotices()
    expect(screen.queryByRole("textbox")).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "Post a new notice" }))
    expect(
      screen.getByRole("dialog", { name: "Post a new notice" })
    ).toBeTruthy()
    expect(screen.getByRole("combobox", { name: "Type" })).toBeTruthy()
    fireEvent.change(screen.getByRole("textbox", { name: /Message/ }), {
      target: { value: "Closed today." },
    })
    reply({
      ...current,
      id: "new",
      message: "Closed today.",
      from: initial.today,
      to: null,
    })
    formSubmit()
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
    expect(fetch).toHaveBeenCalledWith(
      "/api/staff/library/notices",
      expect.objectContaining({ method: "POST" })
    )
    expect(
      within(
        screen.getByRole("region", { name: "Current & upcoming" })
      ).getByText("Closed today.")
    ).toBeTruthy()
    expect(refresh).toHaveBeenCalledOnce()
  })
  it("prefills a past notice but resets its dates, then moves it into current notices", async () => {
    renderNotices()
    fireEvent.click(screen.getByRole("button", { name: "Reactivate" }))
    expect((screen.getByLabelText("From") as HTMLInputElement).value).toBe(
      initial.today
    )
    expect((screen.getByLabelText(/Until/) as HTMLInputElement).value).toBe("")
    expect(
      (screen.getByRole("textbox", { name: /Message/ }) as HTMLTextAreaElement)
        .value
    ).toBe(past.message)
    reply({ ...past, from: initial.today, to: null, endedAt: null })
    formSubmit()
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
    const [url, options] = vi.mocked(fetch).mock.calls[0]!
    expect(url).toBe("/api/staff/library/notices/past/reactivate")
    expect(options?.method).toBe("POST")
    expect(JSON.parse(options?.body as string)).toMatchObject({
      from: initial.today,
      to: null,
      message: past.message,
      type: "closure",
    })
    expect(
      within(
        screen.getByRole("region", { name: "Current & upcoming" })
      ).getByText(past.message)
    ).toBeTruthy()
    expect(
      within(screen.getByRole("region", { name: "Past notices" })).queryByText(
        past.message
      )
    ).toBeNull()
  })
  it("keeps edits on failure and uses PATCH when saving a current notice", async () => {
    renderNotices()
    fireEvent.click(screen.getByRole("button", { name: "Edit" }))
    expect((screen.getByLabelText("From") as HTMLInputElement).value).toBe(
      current.from
    )
    fireEvent.change(screen.getByRole("textbox", { name: /Message/ }), {
      target: { value: "Updated message." },
    })
    vi.mocked(fetch).mockResolvedValue(
      Response.json({ error: { message: "Please retry." } }, { status: 503 })
    )
    formSubmit()
    await screen.findByRole("alert")
    expect(screen.getByRole("alert").textContent).toContain("Please retry.")
    expect(
      (screen.getByRole("textbox", { name: /Message/ }) as HTMLTextAreaElement)
        .value
    ).toBe("Updated message.")
    expect(fetch).toHaveBeenCalledWith(
      "/api/staff/library/notices/current",
      expect.objectContaining({ method: "PATCH" })
    )
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }))
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
  })
  it("moves an ended notice into the reusable history after confirmation", async () => {
    renderNotices()
    fireEvent.click(screen.getByRole("button", { name: "End now" }))
    expect(fetch).not.toHaveBeenCalled()
    reply({ ...current, endedAt: "2026-11-14T12:00:00Z" })
    fireEvent.click(screen.getByRole("button", { name: "End notice" }))
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
    expect(
      within(screen.getByRole("region", { name: "Past notices" })).getByText(
        current.message
      )
    ).toBeTruthy()
    expect(screen.getAllByRole("button", { name: "Reactivate" })).toHaveLength(
      2
    )
  })
  it("uses locale-aware ranges and includes years for older history", () => {
    const dates = { from: "2026-11-12", to: "2026-11-20" }
    expect(noticeDates(dates, "en-US")).toMatch(/^Nov 12/)
    expect(noticeDates(dates, "en-GB")).toMatch(/^12/)
    expect(noticeDates(past, "en-GB", true)).toContain("2025")
  })
})
