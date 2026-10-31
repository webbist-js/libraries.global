// @vitest-environment happy-dom
import * as React from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { cleanup, render, screen, within } from "@/test/render"

Object.assign(globalThis, { React })

const mocks = vi.hoisted(() => ({
  getSessionSSR: vi.fn(),
  fetchStaff: vi.fn(),
  submissions: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`)
  }),
}))

vi.mock("next/navigation", () => ({
  redirect: (url: string) => mocks.redirect(url),
}))
vi.mock("next/headers", () => ({ headers: async () => new Headers() }))
vi.mock("@/lib/env-vars", () => ({ getEnvVar: () => {} }))
vi.mock("@/lib/auth-server", () => ({
  getSessionSSR: (...args: unknown[]) => mocks.getSessionSSR(...args),
}))
vi.mock("@/lib/staff-proxy", () => ({
  fetchStaff: (...args: unknown[]) => mocks.fetchStaff(...args),
}))
vi.mock("@/lib/role-application-server", () => ({
  fetchMySubmissionsResult: (...args: unknown[]) => mocks.submissions(...args),
}))
vi.mock("@/components/staff/YourTeamCard", () => ({
  YourTeamCard: () => null,
}))
vi.mock("@iconify/react", () => ({ Icon: () => null }))
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
  }
})

const { default: StaffLibrariesPage } = await import("../page")

const PUBLIC = {
  id: "lib000000000000000000001",
  name: "Central Library",
  slug: "central-library",
  libraryType: "Public",
  role: "owner",
  canGoLive: false,
}
const MOBILE = {
  id: "mob000000000000000000001",
  name: "Kent Mobile Library",
  slug: "kent-mobile-library",
  libraryType: "Mobile",
  role: "editor",
  canGoLive: true,
}
const overview = (lib: typeof PUBLIC) => ({
  status: 200,
  body: {
    library: {
      documentId: lib.id,
      name: lib.name,
      slug: lib.slug,
      libraryType: lib.libraryType,
      path: `/europe/uk/kent/${lib.slug}`,
    },
    role: lib.role,
    health: [{ key: "hours", label: "Hours", note: "", status: "ok" }],
    counts: { suggestions: 0, noticesUpcoming: 0 },
  },
})
const session = (libraries: (typeof PUBLIC)[]) => ({
  user: { id: "u1", profileLoaded: true, staffLibraries: libraries, teams: [] },
})
const page = (query: Record<string, string> = {}) =>
  StaffLibrariesPage({ searchParams: Promise.resolve(query) })

beforeEach(() => {
  mocks.submissions.mockResolvedValue([])
  mocks.fetchStaff.mockImplementation(async (_user: unknown, path: string) => {
    const id = /^libraries\/([^/]+)\/overview$/.exec(path)?.[1]
    const lib = [PUBLIC, MOBILE].find((l) => l.id === id)

    return lib ? overview(lib) : { status: 404, body: null }
  })
})
afterEach(() => {
  cleanup()
  mocks.getSessionSSR.mockReset()
  mocks.fetchStaff.mockReset()
  mocks.submissions.mockReset()
  mocks.redirect.mockClear()
})

describe("/staff", () => {
  it("offers the claim page to a signed-out viewer", async () => {
    mocks.getSessionSSR.mockResolvedValue(null)
    render(await page())
    expect(
      screen.getByRole("heading", { name: "Your library. Your knowledge." })
    ).toBeTruthy()
    expect(mocks.fetchStaff).not.toHaveBeenCalled()
  })

  it("shows the workspace overview even for a single library", async () => {
    mocks.getSessionSSR.mockResolvedValue(session([PUBLIC]))
    render(await page())
    expect(mocks.redirect).not.toHaveBeenCalled()
    expect(
      screen.getByRole("link", { name: "Central Library" }).getAttribute("href")
    ).toBe(`/staff/${PUBLIC.slug}`)
  })

  it("stays to show an OAuth failure, with a way back to Event feeds", async () => {
    mocks.getSessionSSR.mockResolvedValue(session([PUBLIC]))
    render(await page({ oauth: "failed" }))
    expect(mocks.redirect).not.toHaveBeenCalled()
    expect(screen.getByText("Eventbrite sign-in didn’t finish")).toBeTruthy()
    expect(
      screen.getByText(/Nothing was connected\. Open the library’s Event feeds/)
    ).toBeTruthy()
    expect(
      screen
        .getByRole("link", { name: /Open Event feeds/ })
        .getAttribute("href")
    ).toBe(`/staff/${PUBLIC.slug}/events`)
  })

  it("lists each library with its quick links: Event feeds always, Go live for Mobile staff who may", async () => {
    mocks.getSessionSSR.mockResolvedValue(session([PUBLIC, MOBILE]))
    render(await page())
    const cards = screen
      .getAllByRole("list")
      .find((list) => list.classList.contains("staff-libraries-grid"))!
      .querySelectorAll<HTMLElement>(":scope > li")
    expect(cards.length).toBe(2)
    const central = within(cards[0]!)
    expect(central.getByText("Central Library")).toBeTruthy()
    expect(
      central.getByRole("link", { name: "Event feeds" }).getAttribute("href")
    ).toBe(`/staff/${PUBLIC.slug}/events`)
    expect(
      central
        .getByRole("link", { name: /Open Staff area/ })
        .getAttribute("href")
    ).toBe(`/staff/${PUBLIC.slug}`)
    expect(central.queryByRole("link", { name: /Go live/ })).toBeNull()
    expect(central.queryByRole("link", { name: "Edit timetable" })).toBeNull()
    const mobile = within(cards[1]!)
    expect(
      mobile.getByRole("link", { name: /Go live/ }).getAttribute("href")
    ).toBe(`/live/${MOBILE.id}`)
    expect(
      mobile.getByRole("link", { name: "Edit timetable" }).getAttribute("href")
    ).toBe(`/staff/${MOBILE.slug}/edit?step=timetable`)
    expect(
      mobile.getByRole("link", { name: "Event feeds" }).getAttribute("href")
    ).toBe(`/staff/${MOBILE.slug}/events`)
  })

  it("hides Go live from Mobile staff who may not go live", async () => {
    mocks.getSessionSSR.mockResolvedValue(
      session([PUBLIC, { ...MOBILE, canGoLive: false }])
    )
    render(await page())
    expect(screen.queryByRole("link", { name: /Go live/ })).toBeNull()
  })

  it("invites a reader with no libraries to claim one", async () => {
    mocks.getSessionSSR.mockResolvedValue(session([]))
    render(await page())
    expect(
      within(
        screen
          .getByRole("heading", { name: "Connect a library" })
          .closest("section")!
      )
        .getByRole("link", { name: "Claim a library" })
        .getAttribute("href")
    ).toBe("/staff/claim")
    expect(mocks.fetchStaff).not.toHaveBeenCalled()
  })

  it("shows recorded claim progress instead of first-library onboarding", async () => {
    mocks.getSessionSSR.mockResolvedValue(session([]))
    mocks.submissions.mockResolvedValue([
      {
        documentId: "pending",
        submissionType: "library_claim",
        status: "pending",
        fields: { name: "Central Library" },
      },
      {
        documentId: "draft",
        submissionType: "library_claim",
        status: "draft",
        targetLabel: "Mobile Library",
      },
      {
        documentId: "info",
        submissionType: "library_claim",
        status: "needs_info",
        fields: { name: "Cove Library" },
      },
      {
        documentId: "approved",
        submissionType: "library_claim",
        status: "approved",
        fields: { name: "Old claim" },
      },
    ])
    render(await page())
    expect(
      screen.getByRole("heading", { level: 1, name: "Your libraries" })
    ).toBeTruthy()
    expect(screen.getByText("Central Library")).toBeTruthy()
    expect(screen.getByText("Library access: Awaiting review")).toBeTruthy()
    expect(screen.getByText("Library access: Draft claim")).toBeTruthy()
    expect(
      screen.getByText("Library access: More information needed")
    ).toBeTruthy()
    expect(
      screen.queryByRole("heading", { name: "Connect a library" })
    ).toBeNull()
    expect(screen.queryByText("Old claim")).toBeNull()
    expect(
      screen
        .getByRole("link", { name: "View your access requests" })
        .getAttribute("href")
    ).toBe("/contribute/submissions")
    expect(
      screen.getByRole("link", { name: "Claim another library" })
    ).toBeTruthy()
  })

  it("does not invent an empty state when requests are unavailable", async () => {
    mocks.getSessionSSR.mockResolvedValue(session([]))
    mocks.submissions.mockResolvedValue(null)
    render(await page())
    expect(screen.getByRole("status").textContent).toContain(
      "couldn’t be refreshed"
    )
    expect(
      screen.queryByRole("heading", { name: "Connect a library" })
    ).toBeNull()
    expect(screen.queryByText("Library access: Awaiting review")).toBeNull()
    expect(
      screen.getByRole("link", { name: "View your access requests" })
    ).toBeTruthy()
  })
})

vi.mock("next-intl/server", async () => {
  const { createTranslator } = await import("next-intl")
  const messages = (await import("../../../../../../locales/en.json")).default

  return {
    getLocale: async () => "en",
    getTranslations: async (config: string | { namespace?: string }) =>
      createTranslator({
        locale: "en",
        messages,
        namespace: (typeof config === "string" ? config : config.namespace) as
          | keyof typeof messages
          | undefined,
      }),
  }
})
