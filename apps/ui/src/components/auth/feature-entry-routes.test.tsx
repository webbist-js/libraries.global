import type { ReactElement } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const state = vi.hoisted(() => ({
  user: null as null | { id: string; email: string; teams: unknown[] },
  privateRead: vi.fn(),
}))
vi.mock("next/headers", () => ({ headers: async () => new Headers() }))
vi.mock("@/lib/navigation", () => ({
  Link: () => null,
  routing: { locales: ["en", "fr", "cs"], defaultLocale: "en" },
}))
vi.mock("next/navigation", () => ({
  redirect: (href: string) => {
    throw new Error(`REDIRECT:${href}`)
  },
  notFound: () => {
    throw new Error("NOT_FOUND")
  },
}))
vi.mock("next-intl/server", () => ({
  getLocale: async () => "cs",
  getTranslations: async () => copyKey,
}))
vi.mock("@/lib/auth-server", () => ({
  getSessionSSR: async () => (state.user ? { user: state.user } : null),
}))
vi.mock("@/lib/access-server", () => ({
  sessionTeamsOf: (user: { teams?: unknown[] }) => user.teams ?? [],
  preferredTeams: (teams: unknown[]) => teams,
}))
vi.mock("@/lib/staff-proxy", () => ({
  fetchStaff: (...args: unknown[]) => state.privateRead(...args),
}))
vi.mock("@/lib/auth", () => ({ authDbPool: {} }))
vi.mock("@/lib/team-api/dashboard", () => ({
  apiDashboard: (...args: unknown[]) => state.privateRead(...args),
}))
vi.mock("@/lib/team-api/team", () => ({
  requireApiTeam: (...args: unknown[]) => state.privateRead(...args),
}))
vi.mock("@/lib/seo/metadata", () => ({
  privateMetadata: () => ({}),
  getSiteUrl: () => "https://example.test",
}))
vi.mock("@/components/auth/FeatureAccessLanding", () => ({
  FeatureAccessLanding: () => null,
}))
vi.mock("@/components/dashboard/WorkspaceHero", () => ({
  WorkspaceHero: () => null,
  WorkspacePageHeader: () => null,
}))
vi.mock("@/components/ds", () => ({ Badge: () => null }))
vi.mock("@/components/staff/StaffAreaTabs", () => ({
  StaffAreaTabs: () => null,
}))
vi.mock("@/components/staff/TeamOrganiser", () => ({
  TeamOrganiser: () => null,
}))
vi.mock("@/components/staff/TeamApiDashboard", () => ({
  TeamApiDashboard: () => null,
}))
vi.mock("@/components/staff/TeamMembershipConflict", () => ({
  TeamMembershipConflict: () => null,
}))
vi.mock("@/components/staff/knowledge-links", () => ({
  knowledgeHref: async () => null,
  knowledgeLink: async () => null,
  KNOWLEDGE_SLUGS: { staffArea: "staff-area", teams: "teams" },
}))
vi.mock("@/components/networks/NetworkWorkspace", () => ({
  NetworkWorkspace: () => null,
}))
vi.mock("@/components/widgets/WidgetWorkspaceReady", () => ({
  WidgetWorkspaceReady: () => null,
}))
vi.mock("@/components/widgets/WidgetCreate", () => ({
  WidgetCreate: () => null,
}))
vi.mock("@/components/widgets/WidgetEditor", () => ({
  WidgetEditor: () => null,
}))
vi.mock("@/components/widgets/WidgetSelectionEditor", () => ({
  WidgetSelectionEditor: () => null,
}))
vi.mock("@/components/widgets/WidgetsOverview", () => ({
  WidgetsOverview: () => null,
}))
vi.mock("@/components/library-editor/LibraryClaimWorkspace", () => ({
  LibraryClaimWorkspace: () => null,
}))
vi.mock(
  "@/app/[locale]/(dashboard)/contribute/_components/ContributeSectionHeader",
  () => ({ ContributeSectionHeader: () => null })
)

import ContributeClaim from "@/app/[locale]/(dashboard)/contribute/claim/page"
import Claim from "@/app/[locale]/(dashboard)/staff/claim/page"
import Networks from "@/app/[locale]/(dashboard)/staff/networks/page"
import Api from "@/app/[locale]/(dashboard)/staff/teams/api/page"
import Teams from "@/app/[locale]/(dashboard)/staff/teams/page"
import { FeatureAccessLanding } from "@/components/auth/FeatureAccessLanding"
import { WidgetsStaffPage } from "@/components/widgets/WidgetsStaffPage"

function copyKey(key: string) {
  return key
}

beforeEach(() => {
  state.user = null
  state.privateRead.mockReset()
  state.privateRead.mockImplementation(() => {
    throw new Error("Unexpected private read")
  })
})
const teams = () =>
  Teams({
    params: Promise.resolve({ locale: "en" }),
    searchParams: Promise.resolve({}),
  })
const api = () => Api({ searchParams: Promise.resolve({}) })
const expectLanding = (
  element: ReactElement,
  feature: string,
  signedIn = false
) => {
  expect(element.type).toBe(FeatureAccessLanding)
  expect(element.props).toMatchObject({
    feature,
    ...(signedIn ? { signedIn: true } : {}),
  })
  expect(state.privateRead).not.toHaveBeenCalled()
}

describe("staff discovery routes before private reads", () => {
  it("keeps a guest on networks and preserves the requested network/request", async () => {
    const element = await Networks({
      searchParams: Promise.resolve({ network: "network", request: "request" }),
    })
    expectLanding(element, "networks")
    expect(element.props).toMatchObject({
      returnTo: "/staff/networks?network=network&request=request",
    })
  })
  it("offers guest introductions for Teams, widgets and API", async () => {
    expectLanding(await teams(), "teams")
    await expect(api()).rejects.toThrow("REDIRECT:/cs/developers")
    expectLanding(await WidgetsStaffPage({ mode: "overview" }), "widgets")
    expect(state.privateRead).not.toHaveBeenCalled()
  })
  it("explains access to members without a Team rather than bouncing them elsewhere", async () => {
    state.user = { id: "member", email: "member@example.test", teams: [] }
    expectLanding(await teams(), "teams", true)
    await expect(api()).rejects.toThrow("REDIRECT:/cs/developers")
    expectLanding(await WidgetsStaffPage({ mode: "overview" }), "widgets", true)
    expect(state.privateRead).not.toHaveBeenCalled()
  })
  it("retains locale and selected library through the claim invitation", async () => {
    const element = await Claim({
      searchParams: Promise.resolve({
        librarySlug: "central",
        libraryDocumentId: "public-library",
      }),
    })
    expectLanding(element, "claim")
    expect((element.props as { signInHref: string }).signInHref).toContain(
      "%2Fcs%2Fstaff%2Fclaim%3FlibraryDocumentId%3Dpublic-library%26librarySlug%3Dcentral"
    )
    const contributionClaim = await ContributeClaim({
      searchParams: Promise.resolve({
        librarySlug: "central",
        libraryDocumentId: "public-library",
      }),
    })
    expectLanding(contributionClaim, "claim")
    expect(
      (contributionClaim.props as { signInHref: string }).signInHref
    ).toContain("%2Fcs%2Fcontribute%2Fclaim")
  })
  it("keeps individual widget builders and existing private widget records behind authentication", async () => {
    await expect(WidgetsStaffPage({ mode: "new" })).rejects.toThrow(
      "REDIRECT:/auth/signin"
    )
    await expect(
      WidgetsStaffPage({ mode: "manage", id: "private-widget" })
    ).rejects.toThrow("REDIRECT:/auth/signin")
    expect(state.privateRead).not.toHaveBeenCalled()
  })
  it("still lets a signed-in account request network affiliation without buying a Team", async () => {
    state.user = { id: "member", email: "member@example.test", teams: [] }
    const element = await Networks({ searchParams: Promise.resolve({}) })
    expect(element.type).not.toBe(FeatureAccessLanding)
    expect(state.privateRead).not.toHaveBeenCalled()
  })
})
