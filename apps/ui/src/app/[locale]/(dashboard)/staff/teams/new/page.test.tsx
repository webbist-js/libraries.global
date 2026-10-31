// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from "vitest"

import { cleanup, render } from "@/test/render"

const f = vi.hoisted(() => ({
  session: vi.fn(),
  signup: vi.fn((_props: Record<string, unknown>) => null),
  redirect: vi.fn((url: string) => {
    throw new Error(url)
  }),
}))
vi.mock("next/headers", () => ({ headers: async () => new Headers() }))
vi.mock("next/navigation", () => ({ redirect: f.redirect }))
vi.mock("@/lib/auth-server", () => ({ getSessionSSR: f.session }))
vi.mock("@/lib/team-billing/config", () => ({
  teamBillingConfig: () => ({ purchasing: true, mode: "sandbox" }),
}))
vi.mock("@/lib/staff-proxy", () => ({
  fetchStaff: async () => ({ body: { affiliations: [] } }),
}))
vi.mock("@/components/dashboard/WorkspaceHero", () => ({
  WorkspacePageHeader: () => null,
}))
vi.mock("@/components/elementary/Container", () => ({
  Container: ({ children }: { children: React.ReactNode }) => children,
}))
vi.mock("@/components/staff/TeamSignup", () => ({ TeamSignup: f.signup }))
import NewTeamPage from "./page"

beforeEach(() => vi.clearAllMocks())
afterEach(cleanup)
it("keeps seats, API and service preferences through sign-in", async () => {
  f.session.mockResolvedValue(null)
  await expect(
    NewTeamPage({
      searchParams: Promise.resolve({
        seats: "7",
        api: "1",
        service: "public",
        network: "service-id",
      }),
    })
  ).rejects.toThrow("/auth/signin")
  const url = new URL(f.redirect.mock.calls[0]![0], "https://example.test")
  expect(url.searchParams.get("callbackUrl")).toBe(
    "/staff/teams/new?seats=7&api=1&service=public&network=service-id"
  )
})
it("prefills the authenticated signup while leaving eligibility approval to the server", async () => {
  f.session.mockResolvedValue({
    user: {
      name: "Person",
      email: "person@example.test",
      emailVerified: true,
      teams: [],
    },
  })
  render(
    await NewTeamPage({
      searchParams: Promise.resolve({
        seats: "7",
        api: "1",
        service: "public",
      }),
    })
  )
  expect(f.signup.mock.calls[0]![0]).toMatchObject({
    initialSeats: 7,
    initialApiAddon: true,
    initialPublicService: true,
  })
})
it("returns an existing Team to billing to resume the selected API journey", async () => {
  f.session.mockResolvedValue({
    user: {
      teams: [
        {
          id: "team-a",
          name: "Team",
          slug: "team",
          role: "organiser",
          libraryCount: 0,
          status: "lapsed",
        },
      ],
    },
  })
  await expect(
    NewTeamPage({ searchParams: Promise.resolve({ api: "1" }) })
  ).rejects.toThrow("/staff/teams/billing?api=1")
})
