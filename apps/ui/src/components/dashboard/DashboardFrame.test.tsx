// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { AnchorHTMLAttributes } from "react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"

import { FooterNavigationProvider } from "@/components/global/FooterNavigationContext"
import { GLOBAL_NAVIGATION } from "@/components/global/global-navigation"
import { ProfileDrawerTrigger } from "@/components/profile/ProfileDrawerTrigger"
import type { BetterAuthUser } from "@/lib/auth-server"
import {
  openEditorialDrawer,
  closeEditorialDrawer,
} from "@/lib/editorial/drawer"
import { Link } from "@/lib/navigation"
import { openProfileDrawer, closeProfileDrawer } from "@/lib/profile-drawer"
import { closeStaffDrawer } from "@/lib/staff/drawer"
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@/test/render"

import { DashboardFrame } from "./DashboardFrame"
import { DashboardNavigation } from "./DashboardNavigation"
import { DashboardPage } from "./DashboardPage"

const state = vi.hoisted(() => ({
  pathname: "/map",
  actor: "reader",
  contact: vi.fn(),
  extra: {} as Record<string, unknown>,
  pending: false,
  error: null as Error | null,
}))
vi.mock("@iconify/react", () => ({ Icon: () => null }))
vi.mock("@/components/elementary/LocaleSwitcher", () => ({
  default: ({ locale }: { locale: string }) => (
    <button aria-label="Language">{locale}</button>
  ),
}))
vi.mock("next/navigation", () => ({ usePathname: () => state.pathname }))
vi.mock("@/lib/navigation", () => ({
  usePathname: () => state.pathname,
  Link: (props: AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props} />,
}))
vi.mock("@/components/global/GlobalLink", () => ({
  default: (props: AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props} />,
}))
vi.mock("@/lib/access-client", () => ({
  useCapabilities: () => ({ has: () => false }),
  useHydratedSession: () => ({
    data: state.actor
      ? { user: { id: state.actor, capabilities: [], ...state.extra } }
      : null,
    isPending: state.pending,
    error: state.error,
  }),
}))
vi.mock("@/components/contact/ContactModalProvider", () => ({
  useContactModal: () => ({ openContact: state.contact }),
}))
vi.mock("@/components/notifications/NotificationProvider", () => ({
  useNotifications: () => ({ unread: 3 }),
}))

const user: BetterAuthUser = {
  id: "reader",
  email: "reader@example.test",
  name: "Reader",
  emailVerified: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  username: "reader",
  profileLoaded: true,
  capabilities: ["staff.area", "journal.directEdit"],
  plan: "pro",
}
const clients: QueryClient[] = []

function App() {
  return (
    <FooterNavigationProvider
      navigation={{
        sections: [
          {
            key: "explore",
            title: "Explore",
            links: [
              {
                key: "atlas-repeat",
                label: "Repeated footer Atlas",
                href: "/map",
              },
              {
                key: "privacy-repeat",
                label: "Repeated footer privacy",
                href: "/legal/privacy",
              },
              {
                key: "networks",
                label: "Footer library services",
                href: "/library-networks",
              },
            ],
          },
        ],
        links: [
          { key: "privacy", label: "Footer privacy", href: "/legal/privacy" },
          {
            key: "api-repeat",
            label: "Repeated footer API",
            href: "/developers",
          },
        ],
      }}
    >
      <DashboardFrame
        navigation={
          <DashboardNavigation
            links={GLOBAL_NAVIGATION.map((item) => ({
              ...item,
              label: item.label,
            }))}
            auth={<ProfileDrawerTrigger user={user} />}
          />
        }
      >
        <label>
          Workspace query
          <input defaultValue="retained search" />
        </label>
      </DashboardFrame>
    </FooterNavigationProvider>
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

  return { ...view, client }
}

it("closes section navigation when a queue changes only its query string", async () => {
  state.pathname = "/moderation"
  render(
    <DashboardFrame navigation={null}>
      <DashboardPage
        title="Moderation"
        navigation={
          <Link
            href="/moderation?category=claims"
            onClick={(event) => event.preventDefault()}
          >
            Claims queue
          </Link>
        }
      >
        <p>Review workspace</p>
      </DashboardPage>
    </DashboardFrame>
  )
  fireEvent.click(
    screen.getByRole("button", { name: "Section navigation · Moderation" })
  )
  const dialog = screen.getByRole("dialog", { name: "Moderation" })
  fireEvent.click(within(dialog).getByRole("link", { name: "Claims queue" }))
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
  expect(state.pathname).toBe("/moderation")
})

beforeEach(() => {
  state.pathname = "/map"
  state.actor = "reader"
  state.extra = {}
  state.pending = false
  state.error = null
  state.contact.mockClear()
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json({ data: null }))
  )
})
afterEach(() => {
  cleanup()
  clients.splice(0).forEach((client) => client.clear())
  closeEditorialDrawer()
  closeStaffDrawer()
  closeProfileDrawer(true)
  vi.unstubAllGlobals()
})

it("restores an opener that was not focused by pointer activation", async () => {
  mount()
  expect(screen.queryByRole("link", { name: "api" })).toBeNull()
  const trigger = screen.getByRole("button", {
    name: "Navigation",
  })
  expect(document.activeElement).not.toBe(trigger)
  fireEvent.click(trigger)
  const dialog = await screen.findByRole("dialog", { name: "Navigation" })
  expect(
    within(dialog).getByRole("link", { name: "api" }).getAttribute("href")
  ).toBe("/developers")
  expect(
    within(dialog).queryByRole("link", { name: "Repeated footer API" })
  ).toBeNull()
  expect(
    within(dialog).queryByRole("link", { name: "Repeated footer Atlas" })
  ).toBeNull()
  expect(
    within(dialog).queryByRole("link", { name: "Repeated footer privacy" })
  ).toBeNull()
  const language = within(dialog).getByRole("button", { name: "Language" })
  const footer = language.closest(".dashboard-navigation-footer")
  expect(footer).toBeTruthy()
  expect(footer?.parentElement).toBe(dialog)
  expect(footer?.previousElementSibling?.className).toContain("overflow-y-auto")
  expect(trigger.textContent).not.toContain("More")
  expect(
    within(dialog).queryByRole("link", { name: "Footer library services" })
  ).toBeNull()
  expect(
    within(dialog)
      .getByRole("link", { name: /Plans and pricing/ })
      .getAttribute("href")
  ).toBe("/plans")
  expect(
    within(dialog)
      .getByRole("link", { name: "Footer privacy" })
      .getAttribute("href")
  ).toBe("/legal/privacy")
  fireEvent.keyDown(dialog, { key: "Escape" })
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
  expect(document.activeElement).toBe(trigger)
})

it("reuses contribution controls, focuses the dialog, closes on Escape and retains the workspace", async () => {
  mount()
  const input = screen.getByRole("textbox", { name: "Workspace query" })
  fireEvent.change(input, { target: { value: "reader's current search" } })
  const trigger = screen.getByRole("button", {
    name: "Contribute",
  })
  trigger.focus()
  fireEvent.click(trigger)
  const dialog = await screen.findByRole("dialog", {
    name: "Contribute",
  })
  expect(
    within(dialog)
      .getByRole("link", { name: /Add a library/ })
      .getAttribute("href")
  ).toContain("/contribute/index/new")
  expect(dialog.contains(document.activeElement)).toBe(true)
  expect(input.closest('[aria-hidden="true"]')).not.toBeNull()
  fireEvent.keyDown(document.activeElement!, { key: "Escape" })
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
  expect(document.activeElement).toBe(trigger)
  expect(screen.getByRole("textbox", { name: "Workspace query" })).toBe(input)
  expect((input as HTMLInputElement).value).toBe("reader's current search")
})

it("yields transient shell panels when the full profile workspace opens", async () => {
  mount()
  fireEvent.click(screen.getByRole("button", { name: "Navigation" }))
  await screen.findByRole("dialog", { name: "Navigation" })
  act(() => openProfileDrawer("overview", "reader"))
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
  act(() => closeProfileDrawer(true))
  expect(screen.queryByRole("dialog")).toBeNull()
})

it("does not resurrect a panel after a route or account round trip", async () => {
  const view = mount()
  fireEvent.click(screen.getByRole("button", { name: "Navigation" }))
  await screen.findByRole("dialog", { name: "Navigation" })
  const rerender = () =>
    view.rerender(
      <QueryClientProvider client={view.client}>
        <App />
      </QueryClientProvider>
    )
  state.pathname = "/map/other"
  rerender()
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
  state.pathname = "/map"
  rerender()
  expect(screen.queryByRole("dialog")).toBeNull()
  fireEvent.click(screen.getByRole("button", { name: "Contribute" }))
  await screen.findByRole("dialog", { name: "Contribute" })
  state.actor = "other-reader"
  rerender()
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
  state.actor = "reader"
  state.extra = {}
  state.pending = false
  state.error = null
  rerender()
  expect(screen.queryByRole("dialog")).toBeNull()
})

it("yields a shell panel when an existing workspace keyboard shortcut opens a tool", async () => {
  mount()
  fireEvent.click(screen.getByRole("button", { name: "Navigation" }))
  await screen.findByRole("dialog", { name: "Navigation" })
  act(() => openEditorialDrawer())
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
  act(() => closeEditorialDrawer())
  expect(screen.queryByRole("dialog")).toBeNull()
})

it("shows the Staff masthead destination only for hydrated staff or Team membership", async () => {
  state.extra = {
    capabilities: ["moderate.queue"],
    teams: [
      {
        id: "team",
        slug: "team",
        name: "Team",
        role: "member",
        libraryCount: 0,
      },
    ],
  }
  state.pathname = "/staff/teams"
  const view = mount()
  const main = screen.getByRole("navigation", { name: "Main" })
  const staff = screen.getByRole("link", { name: "Staff area" })
  expect(main.contains(staff)).toBe(false)
  const workspaces = staff.closest(".dashboard-workspace-links")!
  expect(workspaces.nextElementSibling).toBe(
    screen.getByRole("button", { name: "Navigation" })
  )
  expect(
    within(workspaces as HTMLElement)
      .getAllByRole("link")
      .map((link) => link.getAttribute("href"))
  ).toEqual(["/staff", "/moderation"])
  expect(staff.getAttribute("aria-current")).toBe("page")
  fireEvent.click(screen.getByRole("button", { name: "Navigation" }))
  const dialog = await screen.findByRole("dialog", { name: "Navigation" })
  expect(
    within(dialog)
      .getByRole("link", { name: "Staff area" })
      .getAttribute("href")
  ).toBe("/staff")
  fireEvent.keyDown(dialog, { key: "Escape" })
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
  state.extra = { capabilities: ["moderate.queue"], plan: "pro" }
  view.rerender(
    <QueryClientProvider client={view.client}>
      <App />
    </QueryClientProvider>
  )
  expect(screen.queryByRole("link", { name: "Staff area" })).toBeNull()
})

it.each(["loading", "error"])(
  "hides membership shortcuts while session state is %s",
  (stateName) => {
    state.extra = {
      teams: [
        {
          id: "team",
          slug: "team",
          name: "Team",
          role: "organiser",
          libraryCount: 1,
        },
      ],
    }
    state.extra.capabilities = ["moderate.queue"]
    state.pending = stateName === "loading"
    state.error = stateName === "error" ? new Error("unavailable") : null
    mount()
    expect(screen.queryByRole("link", { name: "Staff area" })).toBeNull()
    expect(screen.queryByRole("link", { name: "Moderation" })).toBeNull()
  }
)

it("shows a scoped moderator's masthead and menu shortcut and marks child queues active", async () => {
  state.extra = {
    capabilities: ["moderate.queue"],
    moderationScopes: [{ queue: "articles", locale: "fr" }],
  }
  state.pathname = "/moderation/suggestions"
  mount()
  const main = screen.getByRole("navigation", { name: "Main" })
  const shortcut = screen.getByRole("link", { name: "Moderation" })
  expect(main.contains(shortcut)).toBe(false)
  expect(shortcut.closest(".dashboard-workspace-links")).toBeTruthy()
  expect(shortcut.getAttribute("href")).toBe("/moderation")
  expect(shortcut.getAttribute("aria-current")).toBe("page")
  expect(within(main).queryByRole("link", { name: "Staff area" })).toBeNull()
  fireEvent.click(screen.getByRole("button", { name: "Navigation" }))
  const dialog = await screen.findByRole("dialog", { name: "Navigation" })
  expect(
    within(dialog)
      .getByRole("link", { name: "Moderation" })
      .getAttribute("href")
  ).toBe("/moderation")
})

it.each(["reader", "guest", "editor"])(
  "does not show the moderation shortcut to a %s",
  (role) => {
    state.actor = role === "guest" ? "" : role
    state.extra = { capabilities: role === "editor" ? ["docs.directEdit"] : [] }
    mount()
    expect(screen.queryByRole("link", { name: "Moderation" })).toBeNull()
  }
)

it.each([false, true])(
  "measures the content toolbar for sticky rails, including mobile section navigation (%s)",
  (sections) => {
    let toolbarHeight = 61
    let combinedHeight = 0
    const observed = new Map<Element, ResizeObserverCallback>()
    const bounds = vi
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockImplementation(function (this: HTMLElement) {
        return {
          height: this.classList.contains("record-toolbar")
            ? toolbarHeight
            : this.classList.contains("dashboard-record-toolbar")
              ? combinedHeight
              : 0,
        } as DOMRect
      })
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(private callback: ResizeObserverCallback) {}
        observe(element: Element) {
          observed.set(element, this.callback)
        }

        disconnect() {}
      }
    )
    const view = render(
      <DashboardPage
        title="New drive"
        toolbar={<div className="record-toolbar">Page controls</div>}
        mobileSections={
          sections ? [{ href: "#details", label: "Details" }] : undefined
        }
      >
        <aside>Drive preview</aside>
      </DashboardPage>
    )
    const page = view.container.querySelector<HTMLElement>(".dashboard-page")!
    const toolbar = page.querySelector(".record-toolbar")!
    try {
      expect(
        page.style.getPropertyValue("--dashboard-record-header-height")
      ).toBe("61px")
      toolbarHeight = 98
      act(() => observed.get(toolbar)!([], {} as ResizeObserver))
      expect(
        page.style.getPropertyValue("--dashboard-record-header-height")
      ).toBe("98px")
      if (sections) {
        combinedHeight = 148
        act(() =>
          observed.get(page.querySelector(".dashboard-record-toolbar")!)!(
            [],
            {} as ResizeObserver
          )
        )
        expect(
          page.style.getPropertyValue("--dashboard-record-header-height")
        ).toBe("148px")
      }
      view.rerender(
        <DashboardPage title="Page without a toolbar">
          <aside>Preview</aside>
        </DashboardPage>
      )
      expect(
        page.style.getPropertyValue("--dashboard-record-header-height")
      ).toBe("0px")
    } finally {
      bounds.mockRestore()
    }
  }
)
