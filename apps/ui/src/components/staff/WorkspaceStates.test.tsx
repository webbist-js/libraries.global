// @vitest-environment happy-dom
import type { AnchorHTMLAttributes } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { ContributeWorkspace } from "@/components/contribute/ContributeWorkspace"
import { DashboardFrame } from "@/components/dashboard/DashboardFrame"
import { StaffWorkspace } from "@/components/staff/StaffWorkspace"
import {
  useStaffWorkspaceRecord,
  type StaffWorkspaceRecord,
} from "@/components/staff/StaffWorkspaceRecord"
import { YourTeamCard } from "@/components/staff/YourTeamCard"
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
  waitFor,
} from "@/test/render"

const state = vi.hoisted(() => ({ path: "/contribute" }))
vi.mock("@iconify/react", () => ({ Icon: () => null }))
vi.mock("@/lib/navigation", () => ({
  usePathname: () => state.path,
  Link: (props: AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props} />,
}))
vi.mock("@/lib/access-client", () => ({
  useStaff: () => ({
    teams: [
      {
        id: "team",
        name: "Team",
        slug: "team",
        role: "member",
        libraryCount: 2,
      },
    ],
    libraries: [],
    ready: true,
  }),
  useHydratedSession: () => ({
    data: { user: { id: "actor" } },
    isPending: false,
  }),
}))
vi.mock("@/components/dashboard/RecordToolbar", () => ({
  RecordToolbar: () => null,
}))
vi.mock("@/components/staff/StaffRecordSummary", () => ({
  StaffRecordSummary: ({ library }: { library: { name: string } }) => (
    <section aria-label="Staff summary">{library.name}</section>
  ),
}))
vi.mock("@/components/global/GlobalLink", () => ({
  default: (props: AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props} />,
}))

const library: StaffWorkspaceRecord = {
  id: "library-one",
  slug: "central-library",
  name: "Central Library",
  libraryType: "Public",
  role: "owner",
  canGoLive: false,
  teamCovered: false,
  suggestions: 2,
}
function ChildRecord({ record = library }: { record?: StaffWorkspaceRecord }) {
  useStaffWorkspaceRecord(record)

  return <h1>{record.name}</h1>
}
function staff(record = library, cached = true) {
  return (
    <DashboardFrame navigation={null}>
      <StaffWorkspace
        libraries={cached ? [record] : []}
        userId="actor"
        adding
        guideHref="/knowledge/staff"
      >
        <ChildRecord record={record} />
      </StaffWorkspace>
    </DashboardFrame>
  )
}
beforeEach(() => {
  state.path = "/contribute"
})
afterEach(cleanup)

describe("Contribute role states", () => {
  it.each([
    ["visitor", false, false, false],
    ["contributor", false, false, false],
    ["staff", false, false, true],
    ["Team member", false, false, false],
    ["Knowledge editor", false, true, false],
    ["Journal editor", false, true, false],
    ["moderator", true, false, false],
    ["editorial board", true, true, false],
    ["combined", true, true, true],
  ])(
    "keeps %s navigation within its granted roles",
    (_role, _moderator, editor, isStaff) => {
      render(
        <DashboardFrame navigation={null}>
          <ContributeWorkspace
            editor={editor}
            userId="actor"
            library={isStaff ? library : undefined}
            guideHref="/knowledge/contribute"
          >
            <h1>Contribution work</h1>
          </ContributeWorkspace>
        </DashboardFrame>
      )
      const nav = screen.getByRole("navigation", { name: "Contribute" })
      expect(
        Boolean(within(nav).queryByRole("link", { name: "Moderation" }))
      ).toBe(false)
      expect(
        within(nav)
          .getByRole("link", { name: "Knowledge editor" })
          .getAttribute("href")
      ).toBe(editor ? "/contribute/knowledge" : "/contribute/knowledge/apply")
      expect(
        Boolean(screen.queryByRole("region", { name: "Staff summary" }))
      ).toBe(isStaff)
      expect(
        within(nav)
          .getByRole("link", { name: "Membership" })
          .getAttribute("href")
      ).toBe("/contribute/membership")
    }
  )
})

describe("Staff record navigation", () => {
  it("morphs for a server-resolved record outside the capped session summary", () => {
    state.path = "/staff/central-library"
    render(staff(library, false))
    const nav = screen.getByRole("navigation", { name: "Staff area" })
    expect(
      within(nav)
        .getByRole("link", { name: "Edit record" })
        .getAttribute("href")
    ).toBe("/staff/central-library/edit")
    expect(
      within(nav).getByRole("link", { name: /Overview/ }).textContent
    ).toContain("2")
    expect(
      within(nav).getByRole("link", { name: /Traffic/ }).textContent
    ).toContain("Team")
    expect(within(nav).queryByRole("link", { name: "Go live" })).toBeNull()
  })
  it("shows mobile-only controls and removes plan locks for a covered library", () => {
    state.path = "/staff/central-library/live"
    render(staff({ ...library, libraryType: "Mobile", teamCovered: true }))
    const nav = screen.getByRole("navigation", { name: "Staff area" })
    expect(
      within(nav)
        .getByRole("link", { name: "Go live" })
        .getAttribute("aria-current")
    ).toBe("page")
    expect(within(nav).getByRole("link", { name: "Traffic" }).textContent).toBe(
      "Traffic"
    )
  })
  it("provides the library identity and parent return path inside the mobile drawer", async () => {
    state.path = "/staff/central-library/notices"
    render(staff())
    const trigger = screen.getByRole("button", {
      name: "Section navigation · Staff area",
    })
    fireEvent.click(trigger)
    const dialog = await screen.findByRole("dialog", { name: "Staff area" })
    expect(
      within(dialog)
        .getByRole("link", { name: "‹ Your libraries" })
        .getAttribute("href")
    ).toBe("/staff")
    expect(
      within(dialog).getByRole("link", { name: "Read the staff guide" })
    ).toBeTruthy()
    fireEvent.keyDown(dialog, { key: "Escape" })
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
    expect(document.activeElement).toBe(trigger)
  })
  it("does not carry a previous library's controls into another section", () => {
    state.path = "/staff/central-library"
    const view = render(staff())
    state.path = "/staff/networks"
    view.rerender(staff())
    const nav = screen.getByRole("navigation", { name: "Staff area" })
    expect(within(nav).queryByRole("link", { name: "Edit record" })).toBeNull()
    expect(
      within(nav)
        .getByRole("link", { name: "Services & networks" })
        .getAttribute("aria-current")
    ).toBe("page")
  })
})

it("does not infer an inactive or unverified Team when its details are unavailable", () => {
  render(<YourTeamCard />)
  expect(screen.getByRole("status").textContent).toContain(
    "couldn’t be refreshed"
  )
  expect(screen.queryByText(/not active/)).toBeNull()
  expect(screen.queryByText("Not yet verified")).toBeNull()
  expect(
    screen
      .getByRole("link", { name: "Members & libraries" })
      .getAttribute("href")
  ).toBe("/staff/teams")
})
