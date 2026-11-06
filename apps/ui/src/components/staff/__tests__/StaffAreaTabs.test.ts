import { describe, expect, it, vi } from "vitest"

vi.mock("@/components/dashboard/DashboardFrame", () => ({
  useOptionalDashboardOverlay: () => null,
}))
vi.mock("@/components/ds/SectionTabs", () => ({ SectionTabs: () => null }))
import { staffAreaTabs } from "@/components/staff/StaffAreaTabs"

describe("staff discovery navigation", () => {
  it("exposes the relevant introductions without exposing billing or staff-only creation", () => {
    const hrefs = staffAreaTabs((key) => key).map((tab) => tab.href)
    expect(hrefs).toEqual([
      "/staff",
      "/staff/networks",
      "/staff/teams",
      "/staff/teams/widgets",
      "/developers",
      "/staff/claim",
    ])
  })
  it("offers adding to eligible staff and never a billing tab", () => {
    const hrefs = staffAreaTabs((key) => key, "team", true).map(
      (tab) => tab.href
    )
    expect(hrefs).not.toContain("/staff/teams/billing")
    expect(hrefs).toContain("/staff/new")
  })
})
