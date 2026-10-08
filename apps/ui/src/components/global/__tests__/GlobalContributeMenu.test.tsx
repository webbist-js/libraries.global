// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
import type React from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const session = vi.hoisted(() => ({
  data: null as null | { user: Record<string, unknown> },
  isPending: false,
}))
vi.mock("@/lib/auth-client", () => ({
  authClient: {
    useSession: () => ({ data: session.data, isPending: session.isPending }),
  },
}))
vi.mock("@iconify/react", () => ({ Icon: () => null }))
vi.mock("next/navigation", () => ({ usePathname: () => "/" }))
vi.mock("@/components/global/GlobalLink", () => {
  function GlobalLink({ href, children, ...props }: React.ComponentProps<"a">) {
    return (
      <a href={href} {...props}>
        {children}
      </a>
    )
  }

  return { default: GlobalLink, GlobalLink }
})

const { GlobalContributeMenu } = await import("../GlobalContributeMenu")

const STAFF_LIBRARIES = [
  {
    id: "lib1",
    role: "owner",
    canGoLive: false,
    name: "Nailsea Library",
    slug: "nailsea-library",
    libraryType: "Public",
  },
  {
    id: "lib2",
    role: "editor",
    canGoLive: false,
    name: "Ealing Central Library",
    slug: "ealing-central-library",
    libraryType: "Public",
  },
]

const responses = new Map<string, unknown>()
const clients: QueryClient[] = []

function renderMenu() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  clients.push(client)

  return render(
    <QueryClientProvider client={client}>
      <GlobalContributeMenu />
    </QueryClientProvider>
  )
}

const openMenu = async () => {
  const trigger = screen.getByRole("button", { name: "Contribute" })
  fireEvent.click(trigger)
  const nav = await screen.findByRole("navigation", {
    name: "Contribute menu",
  })

  return { trigger, nav }
}

beforeEach(() => {
  responses.clear()
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  )
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL) => {
      const url = String(input)
      for (const [prefix, body] of responses)
        if (url.startsWith(prefix))
          return { ok: true, status: 200, json: async () => body }

      return { ok: false, status: 404, json: async () => ({}) }
    })
  )
})

afterEach(() => {
  cleanup()
  clients.splice(0).forEach((client) => client.clear())
  vi.unstubAllGlobals()
  session.data = null
  session.isPending = false
})

describe("GlobalContributeMenu", () => {
  it("opens for a signed-out visitor with a sign-in card and the Everyone cards", async () => {
    responses.set("/api/drives/featured", { data: null })
    renderMenu()
    const trigger = screen.getByRole("button", { name: "Contribute" })
    expect(trigger.getAttribute("aria-expanded")).toBe("false")

    const { nav } = await openMenu()
    expect(trigger.getAttribute("aria-expanded")).toBe("true")
    expect(within(nav).getByText("Contributing is free.")).toBeTruthy()
    expect(
      within(nav).getByRole("link", { name: "Sign in" }).getAttribute("href")
    ).toBe("/auth/signin")
    expect(
      within(nav)
        .getByRole("link", { name: /Add a library/ })
        .getAttribute("href")
    ).toBe("/auth/signin?callbackUrl=%2Fcontribute%2Findex%2Fnew")
    expect(within(nav).queryByText("Your work")).toBeNull()
    expect(within(nav).queryByRole("link", { name: /My submissions/ })).toBe(
      null
    )
    expect(
      within(nav)
        .getByRole("link", { name: /Membership/ })
        .getAttribute("href")
    ).toBe("/contribute/membership")
    expect(within(nav).queryByText(/^Plan:/)).toBeNull()
  })

  it("shows only the Everyone cards while the session loads", async () => {
    session.isPending = true
    responses.set("/api/drives/featured", { data: null })
    renderMenu()
    const { nav } = await openMenu()
    expect(within(nav).getByText("Loading your shortcuts…")).toBeTruthy()
    expect(within(nav).queryByText("Your work")).toBeNull()
    expect(within(nav).getByRole("link", { name: /All drives/ })).toBeTruthy()
    expect(within(nav).queryByRole("link", { name: /Propose a drive/ })).toBe(
      null
    )
    expect(within(nav).queryByText("Contributing is free.")).toBeNull()
  })

  it("stacks a staff Moderator's cards, follows the selected library and loads the counts", async () => {
    session.data = {
      user: {
        id: "u1",
        capabilities: ["submit.correction", "staff.area", "moderate.queue"],
        staffLibraries: STAFF_LIBRARIES,
        teams: [],
        plan: "pro",
      },
    }
    responses.set("/api/drives/featured", {
      data: {
        title: "Opening hours for Alabama",
        slug: "alabama-hours",
        progress: { done: 74, total: 198, percent: 37, unit: "library" },
      },
    })
    responses.set("/api/moderation/stats", {
      data: [
        { queue: "index", status: "pending", count: 9 },
        { queue: "knowledge", status: "pending", count: 5 },
        { queue: "index", status: "approved", count: 3 },
      ],
    })
    responses.set("/api/staff/lib1/drawer", { suggestions: 2 })
    responses.set("/api/staff/lib2/drawer", { suggestions: 0 })
    responses.set("/api/contribute/standing", { pendingCount: 2 })
    renderMenu()
    const { trigger, nav } = await openMenu()

    expect(within(nav).getByText("Your work")).toBeTruthy()
    expect(within(nav).getByText("Everyone")).toBeTruthy()
    const edit = within(nav).getByRole("link", { name: /Edit Nailsea Library/ })
    expect(edit.getAttribute("href")).toBe("/staff/nailsea-library/edit")
    await waitFor(() => expect(edit.textContent).toContain("2 waiting"))

    fireEvent.change(within(nav).getByLabelText("Library"), {
      target: { value: "lib2" },
    })
    expect(
      within(nav)
        .getByRole("link", { name: /Edit Ealing Central Library/ })
        .getAttribute("href")
    ).toBe("/staff/ealing-central-library/edit")
    expect(
      within(nav)
        .getByRole("link", { name: /Event feeds/ })
        .getAttribute("href")
    ).toBe("/staff/ealing-central-library/events")
    await waitFor(() =>
      expect(
        within(nav).getByRole("link", { name: /Edit Ealing Central Library/ })
          .textContent
      ).not.toContain("waiting")
    )

    const queue = within(nav).getByRole("link", { name: /Moderation queue/ })
    expect(queue.getAttribute("href")).toBe("/contribute/moderation")
    await waitFor(() => expect(queue.textContent).toContain("14 waiting"))

    await within(nav).findByText("74 of 198 libraries done")
    expect(
      within(nav)
        .getByRole("link", { name: /Opening hours for Alabama/ })
        .getAttribute("href")
    ).toBe("/community/drives/alabama-hours")
    expect(
      within(nav).getByRole("link", { name: /Propose a drive/ })
    ).toBeTruthy()

    await waitFor(() =>
      expect(
        within(nav).getByRole("link", { name: /My submissions/ }).textContent
      ).toContain("2 in review")
    )
    expect(within(nav).getByText("Plan: Pro")).toBeTruthy()
    expect(within(nav).queryByText("Staff drawer")).toBeNull()

    fireEvent.keyDown(document.activeElement ?? document.body, {
      key: "Escape",
    })
    await waitFor(() =>
      expect(
        screen.queryByRole("navigation", { name: "Contribute menu" })
      ).toBeNull()
    )
    expect(trigger.getAttribute("aria-expanded")).toBe("false")
    expect(document.activeElement).toBe(trigger)
  })
})
