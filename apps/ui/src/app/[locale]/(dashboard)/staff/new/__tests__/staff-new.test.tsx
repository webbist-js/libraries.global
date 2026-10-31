// @vitest-environment happy-dom
import type * as React from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { cleanup, render, screen } from "@/test/render"

const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  teams: vi.fn(),
  wizard: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`)
  }),
}))
vi.mock("next/headers", () => ({ headers: async () => new Headers() }))
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }))
vi.mock("@/lib/auth-server", () => ({ getSessionSSR: mocks.session }))
vi.mock("@/lib/env-vars", () => ({ getEnvVar: () => {} }))
vi.mock("@/lib/staff-proxy", () => ({ fetchStaff: mocks.teams }))
vi.mock("@iconify/react", () => ({ Icon: () => null }))
vi.mock("@/components/ds/PageHero", () => ({ PageHero: () => null }))
vi.mock("@/lib/navigation", () => ({
  routing: { defaultLocale: "en", locales: ["en"] },
  usePathname: () => "/staff/new",
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}))
vi.mock("@/components/library-editor/IndexRecordWizard", () => ({
  IndexRecordWizard: (props: unknown) => {
    mocks.wizard(props)

    return <div data-testid="wizard" />
  },
}))
vi.mock(
  "@/app/[locale]/(dashboard)/contribute/_components/ContributeSectionHeader",
  () => ({ ContributeSectionHeader: () => null })
)
const { default: staffPage } = await import("../page")
const { default: contributePage } =
  await import("../../../contribute/index/new/page")

const library = {
  id: "lib000000000000000000001",
  name: "Library",
  slug: "library",
  libraryType: "Public",
  role: "owner",
  canGoLive: false,
}
const team = {
  id: "team00000000000000000001",
  name: "County Libraries",
  slug: "county",
  role: "member",
  libraryCount: 0,
  status: "active",
  expiresAt: null,
  verified: true,
  libraryDocumentIds: [],
}
const session = (libraries: unknown[] = [], teams: unknown[] = []) => ({
  user: { id: "u1", profileLoaded: true, staffLibraries: libraries, teams },
})
const query = { searchParams: Promise.resolve({ name: "  New Library  " }) }
beforeEach(() => {
  mocks.teams.mockClear()
  mocks.wizard.mockClear()
  mocks.redirect.mockClear()
  mocks.teams.mockResolvedValue({ status: 200, body: { teams: [team] } })
})
afterEach(cleanup)

describe("new library routing", () => {
  it("lets someone who became staff resume their older ordinary proposal", async () => {
    mocks.session.mockResolvedValue(session([library]))
    render(
      await contributePage({
        searchParams: Promise.resolve({ draft: "contribute" }),
      })
    )
    expect(mocks.wizard.mock.calls.at(-1)?.[0]).toMatchObject({ mode: "new" })
  })
  it("redirects staff adds to the staff area and preserves the suggested name", async () => {
    mocks.session.mockResolvedValue(session([library]))
    await expect(contributePage(query)).rejects.toThrow(
      "REDIRECT:/staff/new?name=New+Library"
    )
    expect(mocks.teams).not.toHaveBeenCalled()
  })
  it("routes a verified active Team's first library through staff creation", async () => {
    mocks.session.mockResolvedValue(session([], [team]))
    await expect(contributePage(query)).rejects.toThrow(
      "REDIRECT:/staff/new?name=New+Library"
    )
  })
  it("keeps ordinary contributions available without staff access", async () => {
    mocks.session.mockResolvedValue(session())
    render(await contributePage(query))
    expect(mocks.wizard.mock.calls.at(-1)?.[0]).toMatchObject({
      mode: "new",
      initialData: { name: "New Library" },
    })
  })
})

describe("staff creation page", () => {
  it("offers the shared editor to free staff", async () => {
    mocks.session.mockResolvedValue(session([library]))
    render(await staffPage(query))
    expect(mocks.wizard.mock.calls.at(-1)?.[0]).toMatchObject({
      mode: "staff-new",
      creationTeams: [],
      initialData: { name: "New Library" },
    })
  })
  it("offers only active unexpired Teams as coverage choices", async () => {
    mocks.session.mockResolvedValue(session([library], [team]))
    mocks.teams.mockResolvedValue({
      status: 200,
      body: {
        teams: [
          team,
          { ...team, id: "expired", expiresAt: "2000-01-01" },
          { ...team, id: "lapsed", status: "lapsed" },
        ],
      },
    })
    render(await staffPage(query))
    expect(mocks.wizard.mock.calls.at(-1)?.[0]).toMatchObject({
      creationTeams: [{ id: team.id, name: team.name }],
    })
  })
  it("doesn't silently drop Team coverage when the Team API fails", async () => {
    mocks.session.mockResolvedValue(session([library], [team]))
    mocks.teams.mockResolvedValue({ status: 503, body: null })
    render(await staffPage(query))
    expect(screen.getByText("Team coverage couldn’t be loaded")).toBeTruthy()
    expect(screen.queryByTestId("wizard")).toBeNull()
  })
  it("requires verified membership for a Team member without any existing staff claim", async () => {
    mocks.session.mockResolvedValue(session([], [team]))
    mocks.teams.mockResolvedValue({
      status: 200,
      body: { teams: [{ ...team, verified: false }] },
    })
    render(await staffPage(query))
    expect(screen.queryByTestId("wizard")).toBeNull()
  })
  it("sends signed-out viewers to sign in", async () => {
    mocks.session.mockResolvedValue(null)
    await expect(staffPage(query)).rejects.toThrow(
      "REDIRECT:/auth/signin?callbackUrl=%2Fstaff%2Fnew"
    )
  })
})

vi.mock("next-intl/server", async () => {
  const { createTranslator } = await import("next-intl")
  const messages = (await import("../../../../../../../locales/en.json"))
    .default

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
