// @vitest-environment happy-dom
import type { PlanKey } from "@repo/access"
import type { AnchorHTMLAttributes } from "react"
import { afterEach, expect, it, vi } from "vitest"

import { ContactModalProvider } from "@/components/contact/ContactModalProvider"
import type { BetterAuthUser } from "@/lib/auth-server"
import { cleanup, fireEvent, render, screen, waitFor } from "@/test/render"

import { GlobalLoggedUserMenu } from "../GlobalLoggedUserMenu"

vi.mock("next/navigation", () => ({ usePathname: () => "/libraries" }))
vi.mock("next/dynamic", async () => {
  const { default: ContactModal } =
    await import("@/components/contact/ContactModal")

  return { default: () => ContactModal }
})
vi.mock("@iconify/react", () => ({ Icon: () => null }))
vi.mock("@/components/notifications/NotificationProvider", () => ({
  useNotifications: () => ({ unread: 0 }),
}))
vi.mock("@/components/staff/StaffDrawerMenuItem", () => ({
  StaffDrawerMenuItem: () => null,
}))
vi.mock("@/lib/navigation", () => ({
  Link: (props: AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props} />,
}))

function mount(plan?: PlanKey) {
  const user: BetterAuthUser = {
    id: "member",
    email: "reader@example.org",
    name: "Reader",
    emailVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    capabilities: [],
    plan,
  }
  render(
    <ContactModalProvider>
      <GlobalLoggedUserMenu user={user} />
    </ContactModalProvider>
  )
  const trigger = screen.getByRole("button", {
    name: "Account menu for Reader",
  })
  fireEvent.keyDown(trigger, { key: "ArrowDown" })

  return trigger
}

afterEach(cleanup)

it.each(["supporter", "pro", "team"] as const)(
  "opens membership support for %s and restores focus when closed",
  async (plan) => {
    const trigger = mount(plan)
    const support = await screen.findByRole("menuitem", {
      name: "Membership support",
    })
    expect(support.getAttribute("aria-haspopup")).toBe("dialog")
    fireEvent.click(support)
    const dialog = await screen.findByRole("dialog", {
      name: "How can we help?",
    })
    expect(screen.queryByRole("menu")).toBeNull()
    expect(
      (screen.getByLabelText("What’s your message about?") as HTMLSelectElement)
        .value
    ).toBe("membership_support")
    expect(
      screen.getByRole("textbox", {
        name: /What do you need help with in your membership/,
      })
    ).toBeTruthy()
    fireEvent.keyDown(dialog, { key: "Escape" })
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
    await waitFor(() => expect(document.activeElement).toBe(trigger))
  }
)

it.each(["free", "public", undefined] as const)(
  "hides the membership support action for %s access",
  async (plan) => {
    mount(plan)
    await screen.findByRole("menu")
    expect(
      screen.queryByRole("menuitem", { name: "Membership support" })
    ).toBeNull()
  }
)
