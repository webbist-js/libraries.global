// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from "vitest"

import type { ProfileForm } from "@/components/profile-form/useProfileForm"
import type { BetterAuthUser } from "@/lib/auth-server"
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@/test/render"

import { SettingsShell } from "../SettingsShell"

const { save, push, refresh } = vi.hoisted(() => ({
  save: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
}))
vi.mock("@/hooks/useProfile", () => ({
  useProfile: () => ({ saving: false, updateProfile: save }),
}))
vi.mock("@/hooks/useMounted", () => ({ useMounted: () => true }))
vi.mock("@/lib/navigation", () => ({ useRouter: () => ({ push, refresh }) }))
vi.mock("@/components/profile-form/ProfileSections", () => ({
  IdentitySection: ({ form }: { form: ProfileForm }) => (
    <label>
      Display name
      <input
        value={form.firstName}
        onChange={(event) => form.setFirstName(event.target.value)}
      />
    </label>
  ),
  AffiliationSection: () => null,
  InterestsSection: () => null,
  LinksSection: () => null,
}))
vi.mock("@/components/profile-form/ProfileProgress", () => ({
  ProfileProgress: () => null,
}))
vi.mock("@/components/membership/MembershipSettingsLink", () => ({
  MembershipSettingsLink: () => null,
}))
vi.mock("../PrivacySection", () => ({ PrivacySection: () => null }))
vi.mock("../NotificationsSection", () => ({ NotificationsSection: () => null }))
vi.mock("../SignInSecuritySection", () => ({
  SignInSecuritySection: () => null,
}))
vi.mock("../DataAccountSection", () => ({ DataAccountSection: () => null }))

const user = {
  id: "reader",
  name: "Reader",
  email: "reader@example.test",
  emailVerified: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  capabilities: [],
  plan: "free",
} satisfies BetterAuthUser
let footer: HTMLElement
beforeEach(() => {
  footer = document.createElement("footer")
  document.body.append(footer)
  save.mockReset().mockResolvedValue(true)
  push.mockClear()
  refresh.mockClear()
})
afterEach(() => {
  cleanup()
  footer.remove()
})
function show() {
  const onSaved = vi.fn(),
    onDirtyChange = vi.fn()
  const view = render(
    <div data-testid="settings-content">
      <SettingsShell
        profile={null}
        sessionUser={user}
        avatarUrl={null}
        embedded
        saveActionsTarget={footer}
        onSaved={onSaved}
        onDirtyChange={onDirtyChange}
      />
    </div>
  )

  return { ...view, onSaved, onDirtyChange }
}

it("saves the current form values from the footer and removes its action when Settings unmounts", async () => {
  const view = show()
  const button = within(footer).getByRole("button", {
    name: "Save profile",
  }) as HTMLButtonElement
  expect(button.disabled).toBe(true)
  expect(
    within(screen.getByTestId("settings-content")).queryByRole("button")
  ).toBeNull()
  fireEvent.change(screen.getByLabelText("Display name"), {
    target: { value: "First edit" },
  })
  fireEvent.change(screen.getByLabelText("Display name"), {
    target: { value: "Latest edit" },
  })
  expect(button.disabled).toBe(false)
  expect(within(footer).getByRole("status").textContent).toBe("Unsaved changes")
  expect(view.onDirtyChange).toHaveBeenLastCalledWith(true)
  fireEvent.click(button)
  await waitFor(() => expect(view.onSaved).toHaveBeenCalledOnce())
  expect(save).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({ firstName: "Latest edit" })
  )
  expect(save.mock.calls[0]?.[0]).not.toHaveProperty("profileVisibility")
  expect(button.disabled).toBe(true)
  expect(view.onDirtyChange).toHaveBeenLastCalledWith(false)
  expect(push).not.toHaveBeenCalled()
  expect(refresh).not.toHaveBeenCalled()
  view.unmount()
  expect(footer.children).toHaveLength(0)
})

it("keeps unsaved edits available for retry after a failed footer save", async () => {
  save.mockResolvedValueOnce(false)
  const view = show()
  fireEvent.change(screen.getByLabelText("Display name"), {
    target: { value: "Keep this edit" },
  })
  const button = within(footer).getByRole("button", {
    name: "Save profile",
  }) as HTMLButtonElement
  fireEvent.click(button)
  await waitFor(() => expect(save).toHaveBeenCalledOnce())
  expect(view.onSaved).not.toHaveBeenCalled()
  expect(button.disabled).toBe(false)
  expect(within(footer).getByRole("status").textContent).toBe("Unsaved changes")
  fireEvent.click(button)
  await waitFor(() => expect(view.onSaved).toHaveBeenCalledOnce())
  expect(save).toHaveBeenCalledTimes(2)
  expect(button.disabled).toBe(true)
})
