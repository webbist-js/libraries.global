// @vitest-environment happy-dom
import type * as NextIntl from "next-intl"
import * as React from "react"
import { createElement, Fragment } from "react"
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

type Lib = {
  id: string
  name: string
  slug: string
  libraryType: string
  role: "owner" | "editor"
  canGoLive: boolean
}
const state = vi.hoisted(() => ({
  libraries: [] as Lib[],
  current: null as string | null,
  push: vi.fn(),
  /** Teams the viewer belongs to (a `role: "organiser"` row shows the organiser tile). */
  teams: [] as { id: string; role: "organiser" | "member" }[],
  /** `feature:libraryId` pairs an active Team covers. */
  covered: new Set<string>(),
  /** What the library-name search answers for the page's library. */
  pageHit: null as { documentId: string; name: string; slug: string } | null,
}))

vi.mock("@/hooks/useContributeMenu", () => ({
  useFeaturedDrive: () => ({
    data: { title: "Pinned drive", slug: "pinned-drive" },
  }),
}))
vi.mock("@/lib/access-client", () => ({
  useStaff: () => ({
    libraries: state.libraries,
    ready: true,
    teams: state.teams,
    can: (action: string, id: string) =>
      action === "goLive"
        ? state.libraries.some((l) => l.id === id && l.canGoLive)
        : state.libraries.some((l) => l.id === id),
  }),
  useEntitlements: () => ({
    plan: "free",
    ready: true,
    can: () => false,
    canForLibrary: (feature: string, id: string) =>
      state.covered.has(`${feature}:${id}`),
  }),
}))
vi.mock("@/lib/staff/current-library", () => ({
  useCurrentLibrary: () => state.current,
}))
vi.mock("@/lib/meilisearch", () => ({
  searchLibraryNames: async () => ({
    hits: state.pageHit ? [state.pageHit] : [],
  }),
}))
vi.mock("next-intl", async (importOriginal) => ({
  ...(await importOriginal<typeof NextIntl>()),
  useLocale: () => "en",
}))
vi.mock("@/lib/env-vars", () => ({ getEnvVar: () => {} }))
// The icon's id is kept, so a lock can be told from the tile's own icon.
vi.mock("@iconify/react", async () => {
  const { createElement: h } = await import("react")

  return {
    Icon: ({ icon }: { icon: string }) =>
      h("i", { "data-icon": icon, "aria-hidden": "true" }),
  }
})
vi.mock("@/lib/navigation", async () => {
  const { createElement: h } = await import("react")

  return {
    Link: ({
      href,
      children,
      ...rest
    }: {
      href: string
      children?: React.ReactNode
    }) => h("a", { href, ...rest }, children),
    useRouter: () => ({ push: state.push, refresh: vi.fn() }),
    usePathname: () => "/",
    routing: { locales: ["cs", "en"], defaultLocale: "en" },
  }
})

const { StaffDrawer } = await import("../StaffDrawer")
const {
  closeStaffDrawer,
  DRAWER_LIBRARY_KEY,
  openStaffDrawer,
  useStaffDrawer,
} = await import("@/lib/staff/drawer")

/** The drawer store as a component sees it: "true" or "false" in the DOM. */
function DrawerOpenProbe() {
  const { open } = useStaffDrawer()

  return createElement("output", { "data-testid": "drawer-open" }, String(open))
}

const PUBLIC: Lib = {
  id: "lib000000000000000000001",
  name: "Central Library",
  slug: "central-library",
  libraryType: "Public",
  role: "owner",
  canGoLive: false,
}
const MOBILE: Lib = {
  id: "mob000000000000000000001",
  name: "Kent Mobile Library",
  slug: "kent-mobile-library",
  libraryType: "Mobile",
  role: "editor",
  canGoLive: true,
}
type Data = Record<string, unknown>
const data = new Map<string, Data>()
const payload = (lib: Lib, extra: Data = {}): Data => ({
  library: {
    documentId: lib.id,
    name: lib.name,
    slug: lib.slug,
    path: `/europe/uk/kent/${lib.slug}`,
    libraryType: lib.libraryType,
    role: lib.role,
  },
  suggestions: 0,
  noticesUpcoming: 0,
  live: null,
  drives: [],
  ...extra,
})

beforeEach(() => {
  data.clear()
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string) => {
      const id = /\/api\/staff\/([^/]+)\/drawer/.exec(String(input))?.[1]
      const body = id ? data.get(decodeURIComponent(id)) : undefined

      return body ? Response.json(body) : new Response("", { status: 404 })
    })
  )
})
afterEach(() => {
  cleanup()
  closeStaffDrawer()
  state.libraries = []
  state.current = null
  state.teams = []
  state.covered.clear()
  state.pageHit = null
  state.push.mockReset()
  localStorage.clear()
  vi.unstubAllGlobals()
})

const tileHref = (label: string) =>
  screen.getByRole("link", { name: label }).getAttribute("href")

describe("StaffDrawer", () => {
  it("groups a building library’s tools without a redundant library selector", async () => {
    state.libraries = [PUBLIC]
    data.set(PUBLIC.id, payload(PUBLIC))
    render(createElement(StaffDrawer))
    expect(screen.getByRole("dialog", { name: "Central Library" })).toBeTruthy()
    expect(screen.getByText("Verified staff")).toBeTruthy()
    expect(screen.getByText("Library owner")).toBeTruthy()
    expect(screen.queryByRole("combobox", { name: "Library" })).toBeNull()
    const base = `/staff/${PUBLIC.slug}`
    expect(tileHref("Staff area")).toBe(base)
    expect(tileHref("Edit record")).toBe(`${base}/edit`)
    expect(tileHref("Notices")).toBe(`${base}/notices`)
    expect(tileHref("Event feeds")).toBe(`${base}/events`)
    expect(tileHref("Add a library")).toBe("/contribute/index/new")
    expect(
      screen.getByRole("link", { name: /Pinned drive/ }).getAttribute("href")
    ).toBe("/community/drives/pinned-drive")
    expect(screen.queryByRole("link", { name: /Timetable/ })).toBeNull()
    expect(screen.queryByRole("link", { name: /Go live/ })).toBeNull()
    expect(screen.queryByRole("region", { name: "Live sharing" })).toBeNull()
    await waitFor(() =>
      expect(tileHref("Public page")).toBe("/europe/uk/kent/central-library")
    )
    expect(screen.getByText("Nothing waiting for review")).toBeTruthy()
    expect(
      screen.getByText("No open drive includes it right now.")
    ).toBeTruthy()
    expect(
      screen.getByRole("link", { name: /All drives/ }).getAttribute("href")
    ).toBe("/community")
    expect(screen.getByText("Alt S")).toBeTruthy()
  })

  it("gives a Mobile library the live strip, the Go live pill and the Mobile tiles", async () => {
    state.libraries = [MOBILE]
    data.set(
      MOBILE.id,
      payload(MOBILE, {
        live: {
          state: "idle",
          nextRoute: { date: "2026-10-07", time: "10:15" },
          currentStop: null,
        },
      })
    )
    render(createElement(StaffDrawer))
    const strip = screen.getByRole("region", { name: "Live sharing" })
    expect(strip.textContent).toContain("Not live")
    await waitFor(() =>
      expect(strip.textContent).toContain("Next route Wed 7 Oct · 10:15")
    )
    // The strip's pill opens the console; the tile opens the Go live tab.
    expect(
      within(strip)
        .getByRole("link", { name: /Go live/ })
        .getAttribute("href")
    ).toBe(`/live/${MOBILE.id}`)
    const tiles = screen
      .getAllByRole("link", { name: /Go live/ })
      .map((a) => a.getAttribute("href"))
    expect(tiles).toContain(`/staff/${MOBILE.slug}/live`)
    expect(
      screen.getByRole("link", { name: /^Timetable/ }).getAttribute("href")
    ).toBe(`/staff/${MOBILE.slug}/edit?step=timetable`)
    expect(screen.getAllByText("Mobile").length).toBe(3)
  })

  it("says Live now and the current stop while a session runs", async () => {
    state.libraries = [MOBILE]
    data.set(
      MOBILE.id,
      payload(MOBILE, {
        live: { state: "live", nextRoute: null, currentStop: "Village hall" },
      })
    )
    render(createElement(StaffDrawer))
    const strip = screen.getByRole("region", { name: "Live sharing" })
    await waitFor(() => expect(strip.textContent).toContain("Live now"))
    expect(strip.textContent).toContain("At Village hall")
  })

  it("counts suggestions waiting for review and lists the drives that include the library", async () => {
    state.libraries = [PUBLIC]
    data.set(
      PUBLIC.id,
      payload(PUBLIC, {
        suggestions: 3,
        drives: [
          {
            slug: "hours-in-kent",
            title: "Hours in Kent",
            need: "Opening hours",
          },
          { slug: "photos", title: "Photos", need: null },
        ],
      })
    )
    render(createElement(StaffDrawer))
    const review = await screen.findByRole("link", {
      name: /3 suggested changes to review/,
    })
    expect(review.getAttribute("href")).toBe(
      `/staff/${PUBLIC.slug}#suggestions`
    )
    expect(review.textContent).toContain("Review them before they go live.")
    expect(screen.queryByText("Nothing waiting for review")).toBeNull()
    const drive = screen.getByRole("link", { name: /Hours in Kent/ })
    expect(drive.getAttribute("href")).toBe("/community/drives/hours-in-kent")
    expect(drive.textContent).toContain("Your library needs: Opening hours")
    expect(
      screen.getByRole("link", { name: /^Photos$/ }).textContent
    ).not.toContain("needs")
  })

  it("combines related and featured drives without duplicating a drive", async () => {
    state.libraries = [PUBLIC]
    data.set(
      PUBLIC.id,
      payload(PUBLIC, {
        noticesUpcoming: 2,
        drives: [
          { slug: "pinned-drive", title: "Pinned drive", need: "Photos" },
        ],
      })
    )
    render(createElement(StaffDrawer))
    const drives = screen.getByRole("region", { name: "Community drives" })
    await within(drives).findByText("Your library needs: Photos")
    expect(
      within(drives).getAllByRole("link", { name: /Pinned drive/ })
    ).toHaveLength(1)
    const tools = screen.getByRole("region", { name: "Your library" })
    expect(within(tools).getByRole("link", { name: /Notices 2/ })).toBeTruthy()
    const team = screen.getByRole("region", { name: "Team and insights" })
    expect(within(team).getByRole("link", { name: /^Traffic/ })).toBeTruthy()
    expect(within(tools).queryByRole("link", { name: /^Traffic/ })).toBeNull()
  })

  it("uses the singular for one suggestion", async () => {
    state.libraries = [PUBLIC]
    data.set(PUBLIC.id, payload(PUBLIC, { suggestions: 1 }))
    render(createElement(StaffDrawer))
    expect(await screen.findByText("1 suggested change to review")).toBeTruthy()
  })

  it("opens on the page's library, remembers it, and switches with the select", async () => {
    state.libraries = [PUBLIC, MOBILE]
    state.current = MOBILE.id
    data.set(PUBLIC.id, payload(PUBLIC))
    data.set(MOBILE.id, payload(MOBILE))
    render(createElement(StaffDrawer))
    expect(
      screen.getByRole("dialog", { name: "Kent Mobile Library" })
    ).toBeTruthy()
    await waitFor(() =>
      expect(localStorage.getItem(DRAWER_LIBRARY_KEY)).toBe(MOBILE.id)
    )
    const select = screen.getByRole("combobox", { name: "Library" })
    expect((select as HTMLSelectElement).value).toBe(MOBILE.id)
    fireEvent.change(select, { target: { value: PUBLIC.id } })
    expect(screen.getByRole("dialog", { name: "Central Library" })).toBeTruthy()
    await waitFor(() =>
      expect(localStorage.getItem(DRAWER_LIBRARY_KEY)).toBe(PUBLIC.id)
    )
    expect(vi.mocked(fetch).mock.calls.map((c) => String(c[0]))).toEqual([
      `/api/staff/${MOBILE.id}/drawer`,
      `/api/staff/${PUBLIC.id}/drawer`,
    ])
  })

  it("prefers the library a menu item asked for, then the last used one", () => {
    state.libraries = [PUBLIC, MOBILE]
    data.set(PUBLIC.id, payload(PUBLIC))
    data.set(MOBILE.id, payload(MOBILE))
    localStorage.setItem(DRAWER_LIBRARY_KEY, MOBILE.id)
    const first = render(createElement(StaffDrawer))
    expect(
      screen.getByRole("dialog", { name: "Kent Mobile Library" })
    ).toBeTruthy()
    first.unmount()
    openStaffDrawer(PUBLIC.id)
    render(createElement(StaffDrawer))
    expect(screen.getByRole("dialog", { name: "Central Library" })).toBeTruthy()
  })

  it("keeps the links working when the summary can't be loaded", async () => {
    // No response for this library: navigation remains available without a summary.
    const fresh: Lib = {
      ...PUBLIC,
      id: "lib000000000000000000009",
      slug: "fresh-library",
    }
    state.libraries = [fresh]
    render(createElement(StaffDrawer))
    expect(await screen.findByRole("status")).toBeTruthy()
    expect(screen.getByRole("status").textContent).toContain(
      "The summary is unavailable right now"
    )
    expect(tileHref("Public page")).toBe("/libraries?q=fresh-library")
    expect(tileHref("Staff area")).toBe(`/staff/${fresh.slug}`)
  })

  it("the footer's Open staff area is a link to the staff area that closes the drawer", () => {
    state.libraries = [PUBLIC]
    data.set(PUBLIC.id, payload(PUBLIC))
    openStaffDrawer()
    render(
      createElement(
        Fragment,
        null,
        createElement(StaffDrawer),
        createElement(DrawerOpenProbe)
      )
    )
    expect(screen.getByTestId("drawer-open").textContent).toBe("true")
    const open = screen.getByRole("link", { name: /Open staff area/ })
    expect(open.getAttribute("href")).toBe(`/staff/${PUBLIC.slug}`)
    fireEvent.click(open)
    expect(state.push).not.toHaveBeenCalled()
    expect(screen.getByTestId("drawer-open").textContent).toBe("false")
  })

  it("locks the Team and Traffic tiles until a Team covers the library", () => {
    state.libraries = [PUBLIC]
    data.set(PUBLIC.id, payload(PUBLIC))
    const { unmount } = render(createElement(StaffDrawer))
    const base = `/staff/${PUBLIC.slug}`
    for (const label of ["Team", "Traffic"]) {
      const tile = screen.getByRole("link", { name: new RegExp(`^${label}`) })
      expect(tile.getAttribute("href")).toBe(`${base}/${label.toLowerCase()}`)
      expect(tile.querySelector<HTMLElement>("[data-icon]")?.dataset.icon).toBe(
        "mdi:lock-outline"
      )
      // The tag reads "Team" (on the Team tile that's the label and the tag).
      expect(within(tile).getAllByText("Team").length).toBe(
        label === "Team" ? 2 : 1
      )
    }
    expect(screen.queryByRole("link", { name: /Team organiser/ })).toBeNull()
    unmount()

    state.covered.add(`library.team:${PUBLIC.id}`)
    state.covered.add(`library.traffic:${PUBLIC.id}`)
    state.teams = [{ id: "t1", role: "organiser" }]
    render(createElement(StaffDrawer))
    const team = screen.getByRole("link", { name: /^Team$/ })
    expect(team.querySelector<HTMLElement>("[data-icon]")?.dataset.icon).toBe(
      "mdi:account-group-outline"
    )
    expect(within(team).getAllByText("Team").length).toBe(1)
    expect(
      screen
        .getByRole("link", { name: /^Traffic$/ })
        .querySelector<HTMLElement>("[data-icon]")?.dataset.icon
    ).toBe("mdi:chart-bar")
    expect(
      screen.getByRole("link", { name: "Team organiser" }).getAttribute("href")
    ).toBe("/staff/team")
  })

  it("says when the page's library isn't one of the viewer's, and offers to claim it", async () => {
    state.libraries = [PUBLIC]
    data.set(PUBLIC.id, payload(PUBLIC))
    state.current = "lib000000000000000000077"
    state.pageHit = {
      documentId: "lib000000000000000000077",
      name: "Other Library",
      slug: "other-library",
    }
    render(createElement(StaffDrawer))
    expect(screen.getByRole("dialog", { name: "Central Library" })).toBeTruthy()
    expect(
      await screen.findByText(
        /You’re not staff of Other Library\. Showing Central Library\./
      )
    ).toBeTruthy()
    expect(
      screen
        .getByRole("link", { name: "Claim Other Library" })
        .getAttribute("href")
    ).toBe(
      "/contribute/claim?librarySlug=other-library&libraryName=Other%20Library&libraryDocumentId=lib000000000000000000077"
    )
  })

  it("keeps the Go live pill from Mobile staff who may not go live", () => {
    state.libraries = [{ ...MOBILE, canGoLive: false }]
    data.set(MOBILE.id, payload(MOBILE))
    render(createElement(StaffDrawer))
    const strip = screen.getByRole("region", { name: "Live sharing" })
    expect(within(strip).queryByRole("link", { name: /Go live/ })).toBeNull()
    expect(strip.textContent).toContain("Live updates: ask an owner")
    // The tile to the staff area's Go live tab stays: it explains the gate.
    expect(
      screen.getByRole("link", { name: /^Go live/ }).getAttribute("href")
    ).toBe(`/staff/${MOBILE.slug}/live`)
  })
})
