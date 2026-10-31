// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { AnchorHTMLAttributes } from "react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"

import { ProfileDrawerTrigger } from "@/components/profile/ProfileDrawerTrigger"
import type { BetterAuthUser } from "@/lib/auth-server"
import {
  openEditorialDrawer,
  closeEditorialDrawer,
  useEditorialDrawer,
} from "@/lib/editorial/drawer"
import { closeProfileDrawer, openProfileDrawer } from "@/lib/profile-drawer"
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@/test/render"

import ProfileDrawer from "./ProfileDrawer"

const state = vi.hoisted(() => ({
  user: null as BetterAuthUser | null,
  path: "/map",
  error: false,
  contact: vi.fn(),
  tool: vi.fn(),
}))
vi.mock("@iconify/react", () => ({ Icon: () => null }))
vi.mock("@/lib/access-client", () => ({
  useHydratedSession: () => ({
    data: state.user ? { user: state.user } : null,
    isPending: false,
    error: state.error,
  }),
}))
vi.mock("@/lib/navigation", () => ({
  usePathname: () => state.path,
  Link: ({
    publicProfile: _,
    onNavigate,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & {
    publicProfile?: boolean
    onNavigate?: (event: { preventDefault: () => void }) => void
  }) => (
    <a
      {...props}
      onClick={(event) => {
        props.onClick?.(event)
        if (!event.defaultPrevented) onNavigate?.(event)
      }}
    />
  ),
}))
vi.mock("@/components/contact/ContactModalProvider", () => ({
  useContactModal: () => ({ openContact: state.contact }),
}))
vi.mock("@/components/notifications/NotificationProvider", () => ({
  useNotifications: () => ({ unread: 3 }),
}))
vi.mock("@/components/staff/StaffDrawerMenuItem", () => ({
  StaffDrawerMenuItem: ({
    drawer = "staff",
    onOpen,
  }: {
    drawer?: string
    onOpen: (fn: () => void) => void
  }) => (
    <button
      onClick={() => onOpen(() => state.tool(drawer, document.activeElement))}
    >
      {drawer} drawer
    </button>
  ),
}))
vi.mock("@/app/[locale]/profile/[username]/_components/ProfileHero", () => ({
  ProfileHero: () => null,
}))
vi.mock(
  "@/app/[locale]/profile/[username]/_components/sections/OverviewSection",
  () => ({
    OverviewSection: ({ profile }: { profile: { firstName: string } }) => (
      <p>Owner data: {profile.firstName}</p>
    ),
  })
)
vi.mock(
  "@/app/[locale]/profile/[username]/_components/sections/ContributionsSection",
  () => ({ ContributionsSection: () => <p>Contribution history</p> })
)
vi.mock(
  "@/app/[locale]/profile/[username]/_components/sections/FollowingSection",
  () => ({ FollowingSection: () => <p>Followed places and people</p> })
)
vi.mock(
  "@/app/[locale]/profile/[username]/_components/sections/BadgesSection",
  () => ({ BadgesSection: () => <p>Earned recognition</p> })
)
vi.mock("@/app/[locale]/profile/settings/_components/SettingsShell", () => ({
  SettingsShell: ({
    onDirtyChange,
  }: {
    onDirtyChange: (dirty: boolean) => void
  }) => (
    <label>
      Profile name
      <input onChange={() => onDirtyChange(true)} />
    </label>
  ),
}))
vi.mock("@/components/notifications/NotificationInbox", () => ({
  NotificationInbox: () => <p>Notification inbox</p>,
}))
vi.mock("@/components/membership/MembershipDashboard", () => ({
  MembershipDashboard: () => <p>Membership and billing controls</p>,
}))

const reader: BetterAuthUser = {
  id: "reader",
  email: "reader@example.test",
  name: "Reader",
  username: "reader",
  emailVerified: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  capabilities: ["staff.area", "journal.directEdit"],
  plan: "pro",
}
const clients: QueryClient[] = []
function App() {
  return (
    <>
      <ProfileDrawerTrigger user={state.user ?? reader} />
      <ProfileDrawer />
      <ToolState />
      <input aria-label="Atlas search" defaultValue="kept search" />
    </>
  )
}
function ToolState() {
  return (
    <output data-testid="editorial-state">
      {useEditorialDrawer() ? "open" : "closed"}
    </output>
  )
}
function mount() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  clients.push(client)
  const view = render(
    <QueryClientProvider client={client}>
      <App />
    </QueryClientProvider>
  )

  return {
    rerender: () =>
      view.rerender(
        <QueryClientProvider client={client}>
          <App />
        </QueryClientProvider>
      ),
  }
}
beforeEach(() => {
  state.user = { ...reader }
  state.path = "/map"
  state.error = false
  state.contact.mockClear()
  state.tool.mockClear()
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      Response.json({
        actorId: state.user?.id,
        asOf: 1,
        profile: { username: "reader", firstName: "Reader" },
        avatarUrl: "/profile-avatar.png",
        imageUploadsEnabled: false,
        followedDrives: [],
      })
    )
  )
})
afterEach(() => {
  cleanup()
  closeProfileDrawer(true)
  closeEditorialDrawer()
  clients.splice(0).forEach((client) => client.clear())
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})
async function open() {
  const trigger = screen.getByRole("button", { name: "Your profile" })
  fireEvent.click(trigger)
  const dialog = await screen.findByRole("dialog", { name: "Your profile" })
  await within(dialog).findByText("Owner data: Reader")

  return { trigger, dialog }
}

it("loads the owner workspace only on demand, switches sections without changing Atlas and restores focus", async () => {
  mount()
  expect(fetch).not.toHaveBeenCalled()
  const { trigger, dialog } = await open()
  for (const [name, content] of [
    ["Contributions", "Contribution history"],
    ["Following", "Followed places and people"],
    ["Badges & points", "Earned recognition"],
    ["Notifications (3)", "Notification inbox"],
    ["Membership", "Membership and billing controls"],
    ["Settings", "Profile name"],
  ]) {
    fireEvent.click(within(dialog).getByRole("button", { name }))
    expect(within(dialog).getByText(content!)).toBeTruthy()
    expect(
      within(dialog).getByRole("heading", { name: /^Reader$/ })
    ).toBeTruthy()
    expect(within(dialog).getByText("@reader", { exact: true })).toBeTruthy()
    expect(
      dialog.querySelector(".profile-workspace-avatar img")?.getAttribute("src")
    ).toBe("/profile-avatar.png")
    expect(
      within(dialog).getByRole("button", { name: "Edit profile" })
    ).toBeTruthy()
    expect(
      within(dialog).getByRole("link", { name: "View public profile" })
    ).toBeTruthy()
  }
  expect(
    within(dialog)
      .getByRole("link", { name: /View public profile/ })
      .getAttribute("href")
  ).toBe("/profile/reader")
  fireEvent.keyDown(dialog, { key: "Escape" })
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
  expect(document.activeElement).toBe(trigger)
  expect(
    (screen.getByLabelText("Atlas search") as HTMLInputElement).value
  ).toBe("kept search")
})
it("opens the notification shortcut directly and restores focus to its count button", async () => {
  mount()
  const badge = screen.getByRole("button", { name: "3 unread notifications" })
  fireEvent.click(badge)
  const dialog = await screen.findByRole("dialog", { name: "Your profile" })
  await within(dialog).findByText("Notification inbox")
  expect(within(dialog).queryByText("Owner data: Reader")).toBeNull()
  fireEvent.keyDown(dialog, { key: "Escape" })
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
  expect(document.activeElement).toBe(badge)
})
it("keeps unsaved settings when dismissal or tab navigation is declined", async () => {
  mount()
  const { dialog } = await open()
  fireEvent.click(within(dialog).getByRole("button", { name: "Edit profile" }))
  fireEvent.change(screen.getByLabelText("Profile name"), {
    target: { value: "Unsaved" },
  })
  const confirm = vi.fn().mockReturnValue(false)
  vi.stubGlobal("confirm", confirm)
  fireEvent.keyDown(dialog, { key: "Escape" })
  expect(screen.getByRole("dialog")).toBeTruthy()
  fireEvent.click(within(dialog).getByRole("button", { name: "Membership" }))
  expect(
    (screen.getByLabelText("Profile name") as HTMLInputElement).value
  ).toBe("Unsaved")
  expect(confirm).toHaveBeenCalledTimes(2)
  confirm.mockReturnValue(true)
  fireEvent.keyDown(dialog, { key: "Escape" })
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
})
it("keeps the account header and actions available before a community profile is completed", async () => {
  vi.mocked(fetch).mockResolvedValue(
    Response.json({
      actorId: reader.id,
      asOf: 1,
      profile: null,
      avatarUrl: null,
      imageUploadsEnabled: false,
      followedDrives: [],
    })
  )
  mount()
  fireEvent.click(screen.getByRole("button", { name: "Your profile" }))
  const dialog = await screen.findByRole("dialog", { name: "Your profile" })
  await within(dialog).findByText(
    "Complete your profile to see your activity here."
  )
  expect(within(dialog).getByRole("heading", { name: /^Reader$/ })).toBeTruthy()
  expect(
    within(dialog).getByRole("button", { name: "Edit profile" })
  ).toBeTruthy()
  expect(within(dialog).getByRole("link", { name: "Sign out" })).toBeTruthy()
  expect(
    within(dialog).queryByRole("link", { name: "View public profile" })
  ).toBeNull()
})
it.each(["supporter", "pro", "team"] as const)(
  "hands %s support off once after restoring focus",
  async (plan) => {
    state.user!.plan = plan
    mount()
    const { trigger, dialog } = await open()
    fireEvent.click(within(dialog).getByRole("button", { name: "Support" }))
    await waitFor(() =>
      expect(state.contact).toHaveBeenCalledExactlyOnceWith(
        "membership_support"
      )
    )
    expect(screen.queryByRole("dialog")).toBeNull()
    expect(document.activeElement).toBe(trigger)
  }
)
it("gates tools and support using the current session, and hands authorized tools off after close", async () => {
  const view = mount()
  let opened = await open()
  fireEvent.click(
    within(opened.dialog).getByRole("button", { name: "editorial drawer" })
  )
  await waitFor(() =>
    expect(state.tool).toHaveBeenCalledExactlyOnceWith(
      "editorial",
      opened.trigger
    )
  )
  state.user = { ...reader, plan: "free", capabilities: [] }
  view.rerender()
  opened = await open()
  expect(
    within(opened.dialog).queryByRole("button", { name: "Support" })
  ).toBeNull()
  expect(
    within(opened.dialog).queryByRole("button", { name: /drawer/ })
  ).toBeNull()
})
it.each(["account", "route", "session error"])(
  "closes on %s changes without resurrecting the old owner workspace",
  async (change) => {
    const view = mount()
    await open()
    if (change === "account") state.user = { ...reader, id: "other" }
    if (change === "route") state.path = "/europe"
    if (change === "session error") state.error = true
    view.rerender()
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
    state.user = reader
    state.path = "/map"
    state.error = false
    view.rerender()
    expect(screen.queryByRole("dialog")).toBeNull()
  }
)
it("rejects a response scoped to another account and offers retry for an unavailable profile", async () => {
  vi.mocked(fetch).mockResolvedValue(
    Response.json({ actorId: "other", profile: { firstName: "Private other" } })
  )
  mount()
  act(() => openProfileDrawer("overview", "reader"))
  await screen.findByRole("alert")
  expect(screen.queryByText(/Private other/)).toBeNull()
  expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy()
})

it("uses the same dirty-edit guard for a workspace keyboard shortcut and defers its opening", async () => {
  mount()
  const { dialog } = await open()
  fireEvent.click(within(dialog).getByRole("button", { name: "Settings" }))
  fireEvent.change(screen.getByLabelText("Profile name"), {
    target: { value: "Unsaved" },
  })
  const confirm = vi.fn().mockReturnValue(false)
  vi.stubGlobal("confirm", confirm)
  act(() => openEditorialDrawer())
  expect(screen.getByTestId("editorial-state").textContent).toBe("closed")
  expect(screen.getByRole("dialog")).toBeTruthy()
  confirm.mockReturnValue(true)
  act(() => openEditorialDrawer())
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
  expect(screen.getByTestId("editorial-state").textContent).toBe("open")
})

it.each([/View public profile/, /Sign out/])(
  "guards unsaved edits before leaving through %s",
  async (name) => {
    mount()
    const { dialog } = await open()
    fireEvent.click(within(dialog).getByRole("button", { name: "Settings" }))
    fireEvent.change(screen.getByLabelText("Profile name"), {
      target: { value: "Unsaved" },
    })
    const confirm = vi.fn().mockReturnValue(false)
    vi.stubGlobal("confirm", confirm)
    const link = within(dialog).getByRole("link", { name })
    fireEvent.click(link)
    expect(confirm).toHaveBeenCalledOnce()
    expect(screen.getByLabelText("Profile name")).toBeTruthy()
    confirm.mockReturnValue(true)
    fireEvent.click(link)
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
  }
)
