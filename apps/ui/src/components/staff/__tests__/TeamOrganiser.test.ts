// @vitest-environment happy-dom
import type * as NextIntl from "next-intl"
import * as React from "react"
import { createElement } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { TeamDetail, TeamMemberRow } from "@/lib/staff/types"
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@/test/render"

Object.assign(globalThis, { React })

const mocks = vi.hoisted(() => ({ request: vi.fn(), refresh: vi.fn() }))
const L1 = "lib000000000000000000001"
const L2 = "mob000000000000000000001"

vi.mock("@/lib/access-client", () => ({
  useStaff: () => ({ libraries: [{ id: L1 }], ready: true }),
}))
vi.mock("@/lib/staff/client", () => ({ staffRequest: mocks.request }))
vi.mock("@/lib/env-vars", () => ({ getEnvVar: () => {} }))
vi.mock("@/components/billing/useMembershipRefresh", () => ({
  useMembershipRefresh: () => mocks.refresh,
}))
vi.mock("@iconify/react", () => ({ Icon: () => null }))
vi.mock("next-intl", async (importOriginal) => ({
  ...(await importOriginal<typeof NextIntl>()),
  useLocale: () => "en-GB",
}))
vi.mock("next/navigation", () => ({ usePathname: () => "/staff/team" }))
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
    useRouter: () => ({ push: vi.fn(), refresh: mocks.refresh }),
    usePathname: () => "/staff/team",
    redirect: vi.fn(),
    formatHref: (href: string) => href,
    isAppLink: () => true,
    routing: { locales: ["cs", "en"], defaultLocale: "en" },
  }
})

const { TeamOrganiser } = await import("../TeamOrganiser")

const member = (over: Partial<TeamMemberRow>): TeamMemberRow => ({
  documentId: "m",
  baUserId: "u",
  name: null,
  email: "x@example.org",
  emailMasked: "x***@example.org",
  teamRole: "member",
  status: "active",
  invitedAt: "2026-09-01T00:00:00Z",
  acceptedAt: "2026-09-02T00:00:00Z",
  preassign: null,
  assignments: [],
  pending: [],
  isYou: false,
  ...over,
})
const team = (over: Partial<TeamDetail> = {}): TeamDetail => ({
  documentId: "t1",
  name: "Kent Libraries",
  slug: "kent-libraries",
  seats: 5,
  used: 2,
  status: "active",
  verifiedAt: "2026-09-01T00:00:00Z",
  expiresAt: null,
  libraries: [
    {
      documentId: L1,
      name: "Maidstone Library",
      slug: "maidstone-library",
      libraryType: "Public",
    },
    {
      documentId: L2,
      name: "Kent Mobile Library",
      slug: "kent-mobile-library",
      libraryType: "Mobile",
    },
  ],
  members: [
    member({
      documentId: "m1",
      name: "Ann",
      email: "ann@example.org",
      emailMasked: "a***@example.org",
      teamRole: "organiser",
      isYou: true,
      assignments: [
        {
          affiliationDocumentId: "aff1",
          libraryDocumentId: L1,
          staffRole: "owner",
          canGoLive: false,
        },
      ],
    }),
    member({
      documentId: "m2",
      name: "Bea",
      email: "bea@example.org",
      emailMasked: "b***@example.org",
    }),
    member({
      documentId: "m3",
      baUserId: null,
      email: "cal@example.org",
      emailMasked: "c***@example.org",
      status: "invited",
      acceptedAt: null,
      preassign: { libraryDocumentId: L2, staffRole: "editor" },
    }),
  ],
  viewerRole: "organiser",
  organiserNames: ["Ann"],
  ...over,
})
const organiser = (
  over: Partial<TeamDetail> = {},
  others: { id: string; name: string }[] = []
) => createElement(TeamOrganiser, { team: team(over), others })

beforeEach(() => {
  mocks.request.mockResolvedValue({})
})
afterEach(() => {
  cleanup()
  mocks.request.mockReset()
  mocks.refresh.mockReset()
})

describe("TeamOrganiser (organiser)", () => {
  it("shows the team, its seats, the libraries covered and where the viewer is staff", () => {
    render(organiser({}, [{ id: "t2", name: "Sussex Libraries" }]))
    expect(screen.getByRole("heading", { name: "Team details" })).toBeTruthy()
    expect(screen.getByText("Seats").parentElement?.textContent).toContain(
      "2 of 5"
    )
    expect(screen.getByText("Verified team")).toBeTruthy()
    // The team and both active members carry an Active badge.
    expect(screen.getAllByText("Active").length).toBe(3)
    expect(screen.getByText("Organisers").parentElement?.textContent).toContain(
      "Ann"
    )
    expect(screen.getByText("Runs until").parentElement?.textContent).toContain(
      "Open ended"
    )
    expect(
      screen.getByRole("heading", { name: "Libraries covered" })
    ).toBeTruthy()
    expect(
      screen.getByRole("link", { name: "Open Staff area" }).getAttribute("href")
    ).toBe("/staff/maidstone-library")
    expect(screen.getByText("You’re not assigned here")).toBeTruthy()
    expect(
      screen
        .getByRole("link", { name: "Sussex Libraries" })
        .getAttribute("href")
    ).toBe("/staff/team?team=t2")
  })

  it("lists members with their role, status, assignments and actions", () => {
    render(organiser())
    expect(screen.getByRole("heading", { name: "Members" })).toBeTruthy()
    expect(screen.getByText("(you)")).toBeTruthy()
    // The organiser's own role isn't editable; others' are.
    expect(
      screen.queryByRole("combobox", { name: "Team role for Ann" })
    ).toBeNull()
    expect(
      screen.getAllByText("Organiser").some((el) => el.tagName !== "OPTION")
    ).toBe(true)
    expect(
      (
        screen.getByRole("combobox", {
          name: "Team role for Bea",
        }) as HTMLSelectElement
      ).value
    ).toBe("member")
    expect(
      screen.getByText(/bea@example.org · joined 2 Sep\w* 2026/)
    ).toBeTruthy()
    expect(screen.getAllByText("Invited").length).toBe(1)
    expect(screen.getByRole("button", { name: "Resend" })).toBeTruthy()
    expect(screen.getByRole("button", { name: "Revoke" })).toBeTruthy()
    const chip = screen.getByText(/· on acceptance/)
    expect(chip.textContent).toContain("Kent Mobile Library")
    expect(chip.textContent).toContain("Editor")
    expect(screen.getByText("No libraries yet")).toBeTruthy()
    expect(
      screen.getByRole("button", { name: "Remove Bea from the team" })
    ).toBeTruthy()
    // Assignments open a sheet: "Assign" for a first library, "Change" after.
    expect(
      screen.getByRole("button", { name: "Assign to a library for Bea" })
    ).toBeTruthy()
    expect(
      screen.getByRole("button", { name: "Change libraries for Ann" })
    ).toBeTruthy()
  })

  it("assigns a member to a library with a level from the sheet", async () => {
    render(organiser())
    fireEvent.click(
      screen.getByRole("button", { name: "Assign to a library for Bea" })
    )
    const sheet = within(
      screen.getByRole("dialog", { name: "Libraries for Bea" })
    )
    expect(sheet.getByText("No libraries yet.")).toBeTruthy()
    const save = sheet.getByRole("button", { name: "Save changes" })
    expect((save as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(sheet.getByLabelText("Add a library"), {
      target: { value: L2 },
    })
    fireEvent.click(sheet.getByRole("radio", { name: "Owner" }))
    fireEvent.click(sheet.getByRole("button", { name: "Add" }))
    expect(
      sheet.getByText("Kent Mobile Library", { selector: "strong" })
    ).toBeTruthy()
    expect(mocks.request).not.toHaveBeenCalled()
    expect((save as HTMLButtonElement).disabled).toBe(false)
    fireEvent.click(save)
    await waitFor(() =>
      expect(mocks.request).toHaveBeenCalledWith(
        "/api/staff/team/t1/members/m2",
        "PUT",
        {
          assignments: [{ libraryDocumentId: L2, staffRole: "owner" }],
        }
      )
    )
    expect(mocks.refresh).toHaveBeenCalled()
  })

  it("invites by email, with an optional pre-assignment, while seats remain", async () => {
    render(organiser())
    expect(
      screen.getByRole("heading", { name: "Invite a colleague" })
    ).toBeTruthy()
    expect(screen.getByText("3 seats left")).toBeTruthy()
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "dee@example.org" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Send invite" }))
    await waitFor(() =>
      expect(mocks.request).toHaveBeenCalledWith(
        "/api/staff/team/t1/invites",
        "POST",
        {
          email: "dee@example.org",
          teamRole: "member",
        }
      )
    )
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "eve@example.org" },
    })
    fireEvent.change(screen.getByLabelText("Give access to (optional)"), {
      target: { value: L1 },
    })
    const form = within(screen.getByLabelText("Email").closest("form")!)
    expect(form.getByRole("radio", { name: "Editor" })).toBeTruthy()
    expect(form.getByRole("radio", { name: "Owner" })).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Send invite" }))
    await waitFor(() =>
      expect(mocks.request).toHaveBeenLastCalledWith(
        "/api/staff/team/t1/invites",
        "POST",
        {
          email: "eve@example.org",
          teamRole: "member",
          preassign: { libraryDocumentId: L1, staffRole: "editor" },
        }
      )
    )
  })

  it("says when every seat is taken", () => {
    render(organiser({ used: 5 }))
    expect(screen.getByText("0 seats left")).toBeTruthy()
    expect(screen.getByText(/Every available seat is taken/)).toBeTruthy()
    expect(screen.queryByLabelText("Email")).toBeNull()
  })

  it("removes a member only after confirmation", async () => {
    render(organiser())
    fireEvent.click(
      screen.getByRole("button", { name: "Remove Bea from the team" })
    )
    expect(
      screen.getByRole("dialog", { name: "Remove Bea from Kent Libraries?" })
    ).toBeTruthy()
    expect(mocks.request).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name: "Yes, go ahead" }))
    await waitFor(() =>
      expect(mocks.request).toHaveBeenCalledWith(
        "/api/staff/team/t1/members/m2",
        "DELETE",
        undefined
      )
    )
  })

  it("explains that an unverified team's assignments go to a moderator", () => {
    render(organiser({ verifiedAt: null }))
    expect(screen.getByText("Not yet verified")).toBeTruthy()
    expect(
      screen.getByText(/Until the site team verifies Kent Libraries/)
    ).toBeTruthy()
  })

  it("warns when the team has lapsed", () => {
    render(organiser({ status: "lapsed" }))
    expect(screen.getByText("This team isn't active")).toBeTruthy()
    expect(screen.getByText(/It has lapsed/)).toBeTruthy()
    expect(screen.getByText("Lapsed")).toBeTruthy()
  })
})

describe("TeamOrganiser (member)", () => {
  it("is read only: no invites, no controls, masked emails, and who to ask", () => {
    render(
      organiser({
        viewerRole: "member",
        members: team().members.map((m) => ({
          ...m,
          isYou: m.documentId === "m2",
        })),
      })
    )
    expect(
      screen.queryByRole("heading", { name: "Invite a colleague" })
    ).toBeNull()
    expect(screen.queryByRole("combobox")).toBeNull()
    expect(screen.queryByRole("button", { name: /^Remove/ })).toBeNull()
    expect(
      screen.queryByRole("button", { name: /Assign to a library/ })
    ).toBeNull()
    expect(screen.queryByRole("button", { name: "Revoke" })).toBeNull()
    expect(screen.getByText(/a\*\*\*@example.org/)).toBeTruthy()
    expect(screen.queryByText(/ann@example.org/)).toBeNull()
    expect(screen.getByText("Ask Ann to change your access.")).toBeTruthy()
    expect(screen.getAllByText("Member").length).toBeGreaterThan(0)
  })
})
