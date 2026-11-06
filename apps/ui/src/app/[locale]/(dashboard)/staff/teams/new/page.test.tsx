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
it("keeps the chosen service through sign-in", async () => {
  f.session.mockResolvedValue(null)
  await expect(
    NewTeamPage({ searchParams: Promise.resolve({ network: "service-id" }) })
  ).rejects.toThrow("/auth/signin")
  const url = new URL(f.redirect.mock.calls[0]![0], "https://example.test")
  expect(url.searchParams.get("callbackUrl")).toBe(
    "/staff/teams/new?network=service-id"
  )
})
it("offers free Team creation without seats or payment", async () => {
  f.session.mockResolvedValue({
    user: {
      name: "Person",
      email: "person@example.test",
      emailVerified: true,
      teams: [],
    },
  })
  render(await NewTeamPage({ searchParams: Promise.resolve({}) }))
  const props = f.signup.mock.calls[0]![0]
  expect(props).toMatchObject({ verified: true })
  expect(props).not.toHaveProperty("initialSeats")
  expect(props).not.toHaveProperty("available")
})
it("sends an account that already has a Team to its workspace", async () => {
  f.session.mockResolvedValue({
    user: {
      teams: [
        {
          id: "team-a",
          name: "Team",
          slug: "team",
          role: "organiser",
          libraryCount: 0,
        },
      ],
    },
  })
  await expect(
    NewTeamPage({ searchParams: Promise.resolve({}) })
  ).rejects.toThrow("/staff/teams")
})
