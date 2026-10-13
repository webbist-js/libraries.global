import { afterEach, describe, expect, it, vi } from "vitest"

const { fetchStaff } = vi.hoisted(() => ({ fetchStaff: vi.fn() }))
vi.mock("@/lib/staff-proxy", () => ({ fetchStaff }))
import { requireApiTeam } from "../team"

const teamId = "team00000000000000000001"
const user = { id: "user", email: "user@example.invalid", name: "User" }
afterEach(() => vi.resetAllMocks())
describe("Team API management authorization", () => {
  it("rechecks membership on every operation and denies ordinary members' mutations", async () => {
    fetchStaff.mockResolvedValue({
      status: 200,
      body: { status: "active", expiresAt: null, viewerRole: "member" },
    })
    await requireApiTeam(teamId, user)
    await expect(requireApiTeam(teamId, user, true)).rejects.toThrow(
      "organiser_required"
    )
    fetchStaff.mockResolvedValue({ status: 404, body: null })
    await expect(requireApiTeam(teamId, user)).rejects.toThrow("team_not_found")
    expect(fetchStaff).toHaveBeenCalledTimes(3)
  })
  it("requires an active Team for creation but preserves revoke and billing recovery", async () => {
    fetchStaff.mockResolvedValue({
      status: 200,
      body: { status: "lapsed", expiresAt: null, viewerRole: "organiser" },
    })
    await expect(requireApiTeam(teamId, user, true)).rejects.toThrow(
      "team_inactive"
    )
    await expect(
      requireApiTeam(teamId, user, true, false)
    ).resolves.toMatchObject({ status: "lapsed" })
  })
})
