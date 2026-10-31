// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from "vitest"

import type { BetterAuthUser } from "@/lib/auth-server"
import { closeProfileDrawer, useProfileDrawer } from "@/lib/profile-drawer"
import { cleanup, fireEvent, render, screen } from "@/test/render"

import { ProfileDrawerTrigger } from "./ProfileDrawerTrigger"

const notifications = vi.hoisted(() => ({ unread: 3 }))
vi.mock("@/components/notifications/NotificationProvider", () => ({
  useNotifications: () => notifications,
}))
const user: BetterAuthUser = {
  id: "reader",
  name: "Reader",
  email: "reader@example.test",
  emailVerified: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  capabilities: [],
  plan: "free",
}
function State() {
  const state = useProfileDrawer()

  return (
    <output>{state.open ? `${state.actor}:${state.section}` : "closed"}</output>
  )
}
beforeEach(() => {
  notifications.unread = 3
})
afterEach(() => {
  cleanup()
  closeProfileDrawer(true)
})
it("opens the full profile workspace without a popover", () => {
  render(
    <>
      <ProfileDrawerTrigger user={user} />
      <State />
    </>
  )
  const button = screen.getByRole("button", { name: /Your profile/ })
  expect(button.textContent).not.toContain("Profile")
  expect(button.classList.contains("dashboard-square")).toBe(true)
  fireEvent.click(button)
  expect(screen.getByText("reader:overview")).toBeTruthy()
  expect(screen.queryByRole("menu")).toBeNull()
})
it("opens Notifications independently while the avatar still opens Overview", () => {
  render(
    <>
      <ProfileDrawerTrigger user={user} />
      <State />
    </>
  )
  const avatar = screen.getByRole("button", { name: /Your profile/ })
  const badge = screen.getByRole("button", { name: "3 unread notifications" })
  expect(badge.textContent).toBe("3")
  expect(badge.closest(".profile-trigger")).toBeNull()
  fireEvent.click(badge)
  expect(screen.getByText("reader:notifications")).toBeTruthy()
  expect(badge.getAttribute("aria-expanded")).toBe("true")
  fireEvent.click(avatar)
  expect(screen.getByText("reader:overview")).toBeTruthy()
  expect(badge.getAttribute("aria-expanded")).toBe("false")
})
it("caps the visible count but announces the full unread total", () => {
  notifications.unread = 120
  render(<ProfileDrawerTrigger user={user} />)
  expect(
    screen.getByRole("button", { name: "120 unread notifications" }).textContent
  ).toBe("99+")
})
it("omits the unread shortcut when there are no unread notifications", () => {
  notifications.unread = 0
  render(<ProfileDrawerTrigger user={user} />)
  expect(screen.getAllByRole("button")).toHaveLength(1)
  expect(screen.getByRole("button", { name: /Your profile/ })).toBeTruthy()
})
