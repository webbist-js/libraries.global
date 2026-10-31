// @vitest-environment happy-dom
import * as React from "react"
import { createElement } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

import type { StaffLibrarySummary } from "@/lib/access-server"
import type { StaffLibraryMeta } from "@/lib/staff/server"
import type { StaffOverview } from "@/lib/staff/types"
import { cleanup, render, screen, within } from "@/test/render"

Object.assign(globalThis, { React })

const nav = vi.hoisted(() => ({ pathname: "/staff/kent-mobile-library" }))

vi.mock("next/navigation", () => ({ usePathname: () => nav.pathname }))
vi.mock("@/lib/env-vars", () => ({ getEnvVar: () => {} }))
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
    useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
    usePathname: () => nav.pathname,
    redirect: vi.fn(),
    formatHref: (href: string) => href,
    isAppLink: () => true,
    routing: { locales: ["cs", "en"], defaultLocale: "en" },
  }
})

const { StaffShell, staffHeroTitle } = await import("../StaffShell")

const ID = "mob000000000000000000001"
const SLUG = "kent-mobile-library"
const overview = (
  libraryType = "Mobile",
  name = "Kent Mobile Library"
): StaffOverview => ({
  library: {
    documentId: ID,
    name,
    slug: "kent-mobile-library",
    libraryType,
    path: "/europe/united-kingdom/kent/kent-mobile-library",
  },
  role: "owner",
  health: [],
  counts: { suggestions: 2, noticesUpcoming: 0 },
})
const libraries: StaffLibrarySummary[] = [
  {
    id: ID,
    name: "Kent Mobile Library",
    slug: "kent-mobile-library",
    libraryType: "Mobile",
    role: "owner",
    canGoLive: true,
  },
]
const meta: StaffLibraryMeta = {
  operatorName: "Kent County Council",
  homeLibrary: {
    name: "Maidstone Library",
    path: "/europe/united-kingdom/kent/maidstone-library",
  },
}
const shell = (props: Partial<Parameters<typeof StaffShell>[0]> = {}) =>
  createElement(StaffShell, {
    overview: overview(),
    libraries,
    meta,
    plan: "free",
    teamCovered: false,
    ...props,
  })
const tabs = () => screen.getByRole("navigation", { name: "Staff area" })
// A tab's label followed by its count or tag (the gap is CSS, not text).
const tabNames = () =>
  within(tabs())
    .getAllByRole("link")
    .map((a) => a.textContent?.replaceAll(/\s+/g, "").trim())

afterEach(() => {
  cleanup()
  nav.pathname = `/staff/${SLUG}`
})

describe("staffHeroTitle", () => {
  it("italicises the type words at the end of the name, else the last word", () => {
    expect(staffHeroTitle("Kent Mobile Library")).toBe("Kent *Mobile Library*")
    expect(staffHeroTitle("Bodleian Library")).toBe("Bodleian *Library*")
    expect(staffHeroTitle("Biblioteca Nacional de España")).toBe(
      "Biblioteca Nacional de *España*"
    )
    expect(staffHeroTitle("Bodleian")).toBe("Bodleian")
    expect(staffHeroTitle("Library")).toBe("Library")
    // Stray markup in a name is stripped before the rule runs.
    expect(staffHeroTitle("Kent *Mobile* Library")).toBe(
      "Kent *Mobile Library*"
    )
  })
})

describe("StaffShell", () => {
  it("shows the breadcrumb, the pills, the italic title and the meta line", () => {
    render(shell())
    expect(
      screen.getByRole("link", { name: "Staff area" }).getAttribute("href")
    ).toBe("/staff")
    expect(screen.getByText("Library staff")).toBeTruthy()
    expect(screen.getByText("Mobile library")).toBeTruthy()
    const title = screen.getByRole("heading", { level: 1 })
    expect(title.textContent).toBe("Kent Mobile Library")
    expect(title.querySelector("em")?.textContent).toBe("Mobile Library")
    expect(screen.getByText("Kent County Council")).toBeTruthy()
    expect(screen.getByText(/Based at/).textContent).toContain(
      "Maidstone Library"
    )
    expect(
      screen
        .getByRole("link", { name: "Maidstone Library" })
        .getAttribute("href")
    ).toBe(meta.homeLibrary!.path)
    expect(
      screen
        .getByRole("link", { name: /View public page/ })
        .getAttribute("href")
    ).toBe("/europe/united-kingdom/kent/kent-mobile-library")
    expect(screen.getByText("Staff access · free")).toBeTruthy()
    expect(screen.getByText("Your libraries (1)")).toBeTruthy()
    expect(
      screen
        .getByRole("link", { name: /Claim another library/ })
        .getAttribute("href")
    ).toBe("/staff/claim")
  })

  it("gives a Mobile library every tab, the Mobile tags and the suggestions count", () => {
    render(shell())
    expect(tabNames()).toEqual([
      "Overview2",
      "Editrecord",
      "GoliveMobile",
      "Notices",
      "Eventfeeds",
      "TrafficTeam",
      "TeamTeam",
    ])
    const links = within(tabs()).getAllByRole("link")
    expect(links.map((a) => a.getAttribute("href"))).toEqual([
      `/staff/${SLUG}`,
      `/staff/${SLUG}/edit`,
      `/staff/${SLUG}/live`,
      `/staff/${SLUG}/notices`,
      `/staff/${SLUG}/events`,
      `/staff/${SLUG}/traffic`,
      `/staff/${SLUG}/team`,
    ])
    expect(links[0]?.getAttribute("aria-current")).toBe("page")
  })

  it("leaves the Mobile tabs out for other types and names the type pill", () => {
    render(shell({ overview: overview("Public", "Maidstone Library") }))
    expect(screen.getByText("Public library")).toBeTruthy()
    expect(tabNames()).toEqual([
      "Overview2",
      "Editrecord",
      "Notices",
      "Eventfeeds",
      "TrafficTeam",
      "TeamTeam",
    ])
    expect(
      screen.getByRole("heading", { level: 1 }).querySelector("em")?.textContent
    ).toBe("Library")
    expect(screen.queryByText(/Based at/)).toBeNull()
  })

  it("drops the Team locks and shows the Team plan chip when the library is covered", () => {
    render(shell({ plan: "pro", teamCovered: true }))
    expect(screen.getByText("Team plan")).toBeTruthy()
    expect(screen.queryByText("Staff access · free")).toBeNull()
    expect(tabNames().slice(-2)).toEqual(["Traffic", "Team"])
  })

  it("marks the current section from the path", () => {
    nav.pathname = `/staff/${SLUG}/team`
    render(shell())
    const current = within(tabs()).getByRole("link", { current: "page" })
    expect(current.getAttribute("href")).toBe(`/staff/${SLUG}/team`)
  })
})
