// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from "vitest"

import type { UserProfile } from "@/lib/types/profile"
import { cleanup, fireEvent, render, screen, waitFor } from "@/test/render"

import { NotificationsSection } from "../NotificationsSection"

vi.mock("@/hooks/useProfile", () => ({
  useProfile: () => ({ saving: false, updateNotifications: vi.fn() }),
}))
vi.mock("@/components/notifications/NotificationProvider", () => ({
  useNotifications: () => ({ refresh: vi.fn(), previewSound: vi.fn() }),
}))
vi.mock("@/components/notifications/NewsletterPreference", () => ({
  NewsletterPreference: () => null,
}))
vi.mock("@/lib/navigation", () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}))
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }))

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

it("hides the playground warning preference for accounts without an active Team", () => {
  render(<NotificationsSection profile={null} hasTeam={false} />)
  expect(
    screen.queryByRole("switch", { name: "API playground usage warning" })
  ).toBeNull()
  expect(
    screen.getByRole("switch", {
      name: "Invitation to contribute on the Atlas",
    })
  ).toBeTruthy()
})

it("lets Team members re-enable a warning dismissed in the playground", async () => {
  const fetch = vi.fn().mockResolvedValue(Response.json({ ok: true }))
  vi.stubGlobal("fetch", fetch)
  render(
    <NotificationsSection
      hasTeam
      profile={
        {
          dismissedPrompts: ["api-playground-usage", "find-contribute"],
        } as UserProfile
      }
    />
  )
  const toggle = screen.getByRole("switch", {
    name: "API playground usage warning",
  })
  expect(toggle.getAttribute("aria-checked")).toBe("false")
  fireEvent.click(toggle)
  await waitFor(() =>
    expect(fetch).toHaveBeenCalledExactlyOnceWith(
      "/api/profile/me/prompts",
      expect.objectContaining({
        body: JSON.stringify({
          prompt: "api-playground-usage",
          dismissed: false,
        }),
      })
    )
  )
  expect(toggle.getAttribute("aria-checked")).toBe("true")
  expect(
    screen
      .getByRole("switch", {
        name: "Invitation to contribute on Find libraries",
      })
      .getAttribute("aria-checked")
  ).toBe("false")
})

it("restores the saved switch state when saving fails", async () => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")))
  render(<NotificationsSection profile={null} hasTeam />)
  const toggle = screen.getByRole("switch", {
    name: "API playground usage warning",
  })
  fireEvent.click(toggle)
  await waitFor(() => expect(toggle.getAttribute("aria-checked")).toBe("true"))
})
