// @vitest-environment happy-dom
import { NextIntlClientProvider } from "next-intl"
import { afterEach, beforeEach, expect, it, vi } from "vitest"

import { cleanup, fireEvent, render, screen, waitFor } from "@/test/render"

import { NotificationInbox } from "../NotificationInbox"

let state: any
vi.mock("../NotificationProvider", () => ({ useNotifications: () => state }))
vi.mock("@/lib/navigation", () => ({
  Link: ({ children, ...props }: any) => <a {...props}>{children}</a>,
}))
beforeEach(() => {
  state = {
    items: [],
    unread: 0,
    loading: false,
    error: false,
    refresh: vi.fn(async () => {}),
  }
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true }))
  )
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

it("shows a loading state without claiming the inbox is empty or read", () => {
  state.loading = true
  render(<NotificationInbox />)
  expect(screen.getByRole("status").textContent).toContain(
    "Loading your updates"
  )
  expect(
    screen.queryByRole("heading", { name: "No notifications yet" })
  ).toBeNull()
  expect(screen.queryByText("All read")).toBeNull()
})

it("offers a retry without showing an empty inbox when loading fails", () => {
  state.error = true
  render(<NotificationInbox />)
  expect(screen.getByRole("alert").textContent).toContain("Could not load")
  expect(
    screen.queryByRole("heading", { name: "No notifications yet" })
  ).toBeNull()
  expect(screen.queryByText("All read")).toBeNull()
  fireEvent.click(screen.getByRole("button", { name: "Try again" }))
  expect(state.refresh).toHaveBeenCalledOnce()
})

it("marks all notifications read through the existing bulk action", async () => {
  state.items = [
    {
      documentId: "a",
      title: "An update",
      kind: "announcement",
      body: "News",
      createdAt: new Date().toISOString(),
      readAt: null,
    },
  ]
  state.unread = 1
  render(<NotificationInbox />)
  fireEvent.click(screen.getByRole("button", { name: "Mark all as read" }))
  await waitFor(() => expect(state.refresh).toHaveBeenCalledOnce())
  expect(fetch).toHaveBeenCalledWith(
    "/api/notifications",
    expect.objectContaining({ method: "POST", body: '{"documentId":"all"}' })
  )
})

it("keeps this week's updates visible when the group label is translated", () => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date("2026-10-21T12:00:00Z"))
  state.items = [
    {
      documentId: "a",
      title: "An update from Tuesday",
      kind: "announcement",
      body: "News",
      createdAt: "2026-10-20T12:00:00Z",
      readAt: null,
    },
  ]
  render(
    <NextIntlClientProvider
      locale="fr"
      timeZone="Europe/London"
      messages={{
        ui: {
          notifications: "Notifications",
          your_notifications: "Vos notifications",
          settings: "Paramètres",
          filter_notifications: "Filtrer les notifications",
          this_week: "Cette semaine",
        },
      }}
    >
      <NotificationInbox />
    </NextIntlClientProvider>
  )
  expect(screen.getByRole("heading", { name: "Cette semaine" })).toBeTruthy()
  expect(
    screen.getByRole("heading", { name: "An update from Tuesday" })
  ).toBeTruthy()
})
it("offers useful next actions in the empty inbox", () => {
  render(<NotificationInbox />)
  expect(
    screen.getByRole("heading", { name: "No notifications yet" })
  ).toBeTruthy()
  expect(
    screen.getByRole("link", { name: "Follow libraries" }).getAttribute("href")
  ).toBe("/libraries")
  expect(
    screen
      .getByRole("link", { name: "Make a contribution" })
      .getAttribute("href")
  ).toBe("/contribute")
  expect(
    screen.getByRole("link", { name: "Settings" }).getAttribute("href")
  ).toBe("/profile/settings#notifications")
})
it("filters loaded categories and unread entries, and can clear an empty filter", () => {
  state.items = [
    {
      documentId: "a",
      title: "Followed library changed",
      kind: "library_update",
      body: "Hours updated",
      createdAt: new Date().toISOString(),
      readAt: null,
    },
    {
      documentId: "b",
      title: "Contribution accepted",
      kind: "submission_review",
      body: "Thank you",
      createdAt: "2020-01-01",
      readAt: "2020-01-02",
    },
  ]
  state.unread = 1
  render(<NotificationInbox />)
  fireEvent.click(screen.getByRole("button", { name: "Contributions 1" }))
  expect(
    screen.queryByRole("heading", { name: "Followed library changed" })
  ).toBeNull()
  expect(
    screen.getByRole("heading", { name: "Contribution accepted" })
  ).toBeTruthy()
  fireEvent.click(screen.getByRole("button", { name: "Unread 1" }))
  expect(
    screen.queryByRole("heading", { name: "Contribution accepted" })
  ).toBeNull()
  fireEvent.click(screen.getByRole("button", { name: "Community 0" }))
  fireEvent.click(
    screen.getByRole("button", { name: "Show all notifications" })
  )
  expect(
    screen.getByRole("heading", { name: "Contribution accepted" })
  ).toBeTruthy()
  expect(screen.getByRole("heading", { name: "Earlier" })).toBeTruthy()
})
it("keeps entries visible when a read action fails, then refreshes after a successful retry", async () => {
  state.items = [
    {
      documentId: "a",
      title: "An update",
      kind: "announcement",
      body: "News",
      createdAt: new Date().toISOString(),
      readAt: null,
      href: "//evil.example",
    },
  ]
  state.unread = 1
  vi.mocked(fetch).mockResolvedValueOnce({ ok: false } as Response)
  render(<NotificationInbox />)
  expect(screen.queryByRole("link", { name: "Read more" })).toBeNull()
  fireEvent.click(
    screen.getByRole("button", { name: "Mark as read: An update" })
  )
  await waitFor(() =>
    expect(screen.getByRole("alert").textContent).toContain("Could not mark")
  )
  expect(screen.getByRole("heading", { name: "An update" })).toBeTruthy()
  fireEvent.click(
    screen.getByRole("button", { name: "Mark as read: An update" })
  )
  await waitFor(() => expect(state.refresh).toHaveBeenCalledOnce())
  expect(fetch).toHaveBeenCalledWith(
    "/api/notifications",
    expect.objectContaining({ body: '{"documentId":"a"}' })
  )
})
