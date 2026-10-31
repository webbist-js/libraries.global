import { beforeEach, expect, it, vi } from "vitest"

const f = vi.hoisted(() => ({
  session: vi.fn(),
  team: vi.fn(),
  dashboard: vi.fn(),
}))
vi.mock("next/headers", () => ({ headers: async () => new Headers() }))
vi.mock("@/lib/auth-server", () => ({ getSessionSSR: f.session }))
vi.mock("@/lib/contribution-account-scope", () => ({
  contributionAccountScope: (user: { id?: string } | undefined) =>
    user?.id ?? "guest",
}))
vi.mock("@/lib/auth", () => ({ authDbPool: {} }))
vi.mock("@/lib/access-server", () => ({
  sessionTeamsOf: (user: { teams?: unknown[] } | undefined) =>
    user?.teams ?? [],
  preferredTeams: (teams: unknown[]) => teams,
}))
vi.mock("@/lib/team-api/team", () => ({ requireApiTeam: f.team }))
vi.mock("@/lib/team-api/dashboard", () => ({ apiDashboard: f.dashboard }))

import { apiWorkspaceAccess } from "@/lib/team-api/workspace"

beforeEach(() => vi.resetAllMocks())
it("loads public docs without reading private controls for guests and non-Team users", async () => {
  f.session.mockResolvedValue(null)
  expect(await apiWorkspaceAccess()).toMatchObject({
    signedIn: false,
    data: null,
  })
  f.session.mockResolvedValue({ user: { id: "personal", teams: [] } })
  expect(await apiWorkspaceAccess()).toMatchObject({
    signedIn: true,
    data: null,
  })
  expect(f.team).not.toHaveBeenCalled()
  expect(f.dashboard).not.toHaveBeenCalled()
})
it("rechecks current Team access before reading the dashboard", async () => {
  const user = { id: "member", teams: [{ id: "team" }] }
  f.session.mockResolvedValue({ user })
  f.team.mockResolvedValue({ documentId: "team", viewerRole: "member" })
  f.dashboard.mockResolvedValue({
    teamId: "team",
    active: true,
    organiser: false,
  })
  expect(await apiWorkspaceAccess()).toMatchObject({
    data: { active: true, organiser: false },
    showUsageWarning: true,
  })
  expect(f.team).toHaveBeenCalledWith("team", user)
})
it("respects the saved playground warning preference", async () => {
  f.session.mockResolvedValue({
    user: {
      id: "member",
      teams: [{ id: "team" }],
      dismissedPrompts: ["api-playground-usage"],
    },
  })
  f.team.mockResolvedValue({ documentId: "team" })
  f.dashboard.mockResolvedValue({ teamId: "team", active: true })
  expect(await apiWorkspaceAccess()).toMatchObject({ showUsageWarning: false })
})
it("keeps private controls unavailable when membership is stale or the service fails", async () => {
  f.session.mockResolvedValue({
    user: { id: "member", teams: [{ id: "team" }] },
  })
  f.team.mockRejectedValue(new Error("team_not_found"))
  expect(await apiWorkspaceAccess()).toMatchObject({
    data: null,
    unavailable: true,
  })
  expect(f.dashboard).not.toHaveBeenCalled()
})
it("fails closed for conflicting Team memberships", async () => {
  f.session.mockResolvedValue({
    user: { id: "member", teams: [{ id: "a" }, { id: "b" }] },
  })
  expect(await apiWorkspaceAccess()).toMatchObject({
    data: null,
    conflict: true,
  })
  expect(f.team).not.toHaveBeenCalled()
})
