// @vitest-environment happy-dom
import type * as NextIntl from "next-intl"
import * as React from "react"
import { createElement } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { StaffTeam } from "@/lib/staff/types"
import { cleanup, fireEvent, render, screen, waitFor } from "@/test/render"

Object.assign(globalThis, { React })

const mocks = vi.hoisted(() => ({
  request: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
}))
const ID = "mob000000000000000000001"

vi.mock("@/lib/staff/client", () => ({ staffRequest: mocks.request }))
vi.mock("@/lib/env-vars", () => ({ getEnvVar: () => {} }))
vi.mock("@iconify/react", () => ({ Icon: () => null }))
vi.mock("next-intl", async (importOriginal) => ({
  ...(await importOriginal<typeof NextIntl>()),
  useLocale: () => "en-GB",
}))
vi.mock("next/navigation", () => ({ usePathname: () => `/staff/${ID}/team` }))
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
    useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }),
    usePathname: () => `/staff/${ID}/team`,
    redirect: vi.fn(),
    formatHref: (href: string) => href,
    isAppLink: () => true,
    routing: { locales: ["cs", "en"], defaultLocale: "en" },
  }
})

const { TeamManager } = await import("../TeamManager")

const data = (over: Partial<StaffTeam> = {}): StaffTeam => ({
  members: [
    {
      affiliationDocumentId: "aff1",
      name: "Ann",
      initials: "A",
      staffRole: "owner",
      canGoLive: true,
      approvedAt: "2026-09-01T00:00:00Z",
      isYou: true,
    },
    {
      affiliationDocumentId: "aff2",
      name: "Bea",
      initials: "B",
      staffRole: "editor",
      canGoLive: false,
      approvedAt: "2026-09-03T00:00:00Z",
      isYou: false,
    },
  ],
  invites: [
    {
      documentId: "inv1",
      emailMasked: "c***@example.org",
      staffRole: "editor",
      status: "pending",
      expiresAt: "2026-10-20T00:00:00Z",
    },
  ],
  audit: [
    {
      at: "2026-09-03T10:00:00Z",
      actorName: "Ann",
      action: "joined",
      subjectName: "Bea",
    },
  ],
  canLeave: true,
  covered: true,
  team: {
    documentId: "t1",
    name: "Kent Libraries",
    verified: true,
    viewerIsOrganiser: true,
    organiserNames: ["Ann"],
  },
  ...over,
})
const manager = (
  props: Partial<Parameters<typeof TeamManager>[0]> = {},
  over: Partial<StaffTeam> = {}
) =>
  createElement(TeamManager, {
    id: ID,
    libraryName: "Kent Mobile Library",
    data: data(over),
    role: "owner",
    full: true,
    mobile: true,
    ...props,
  })

// The uncovered `GET /api/staff/{id}/team` lists members without a level,
// so the viewer's own line comes from the session role the page passes.
const unlevelled = () =>
  data().members.map((m) => ({
    affiliationDocumentId: m.affiliationDocumentId,
    name: m.name,
    initials: m.initials,
    isYou: m.isYou,
  }))

beforeEach(() => {
  mocks.request.mockResolvedValue({})
})
afterEach(() => {
  cleanup()
  mocks.request.mockReset()
  mocks.push.mockReset()
  mocks.refresh.mockReset()
})

describe("TeamManager without Team cover", () => {
  it("only says who has access, with Leave and Report", () => {
    render(
      manager({ full: false, mobile: false }, { covered: false, team: null })
    )
    expect(
      screen.getByRole("heading", { name: "Who has staff access" })
    ).toBeTruthy()
    expect(screen.getByText("Ann")).toBeTruthy()
    expect(screen.getByText("Bea")).toBeTruthy()
    expect(
      screen.getByText(
        /Each person claimed access on their own and a moderator checked it/
      )
    ).toBeTruthy()
    expect(screen.queryByRole("heading", { name: "Send invite" })).toBeNull()
    expect(screen.queryByRole("heading", { name: "Recent changes" })).toBeNull()
    expect(screen.queryByRole("combobox")).toBeNull()
    expect(screen.queryByRole("button", { name: /Remove/ })).toBeNull()
    // The viewer's own line and actions sit in the card's footer row.
    expect(screen.getByText("Your access").parentElement?.textContent).toMatch(
      /^Your access · /
    )
    expect(
      screen.getByRole("button", { name: "Leave this library" })
    ).toBeTruthy()
    expect(
      screen.getByRole("button", { name: /^Report a problem$/ })
    ).toBeTruthy()
  })

  it("reads an owner's access from the session role when the list carries none", () => {
    render(
      manager(
        { full: false, mobile: false, role: "owner" },
        { covered: false, team: null, canLeave: false, members: unlevelled() }
      )
    )
    expect(screen.getByText("Your access").parentElement?.textContent).toBe(
      "Your access · Owner · The last owner can’t leave"
    )
    expect(
      screen.queryByRole("button", { name: "Leave this library" })
    ).toBeNull()
  })

  it("never tells an editor that the last owner can't leave", () => {
    render(
      manager(
        { full: false, mobile: false, role: "editor" },
        { covered: false, team: null, canLeave: false, members: unlevelled() }
      )
    )
    expect(screen.getByText("Your access").parentElement?.textContent).toBe(
      "Your access · Editor"
    )
  })
})

describe("TeamManager with Team cover", () => {
  it("lists the staff with levels, verification, live permission, invites and the audit", () => {
    render(manager())
    expect(screen.getByRole("heading", { name: "Staff (2)" })).toBeTruthy()
    expect(screen.getByText("Kent Libraries · Verified team")).toBeTruthy()
    expect(
      screen.getByText(/Verified 1 Sep\w* 2026 · Can go live/)
    ).toBeTruthy()
    expect(
      screen.getByText(/Verified 3 Sep\w* 2026 · Can’t go live/)
    ).toBeTruthy()
    expect(
      (
        screen.getByRole("combobox", {
          name: "Level for Bea",
        }) as HTMLSelectElement
      ).value
    ).toBe("editor")
    // The only owner can't be demoted, and nobody removes themselves.
    expect(
      (
        screen.getByRole("combobox", {
          name: "Level for Ann",
        }) as HTMLSelectElement
      ).disabled
    ).toBe(true)
    // Remove is a quiet link naming the person; nobody removes themselves.
    const removes = screen.getAllByRole("button", { name: /^Remove / })
    expect(removes.map((b) => b.textContent)).toEqual([
      "Remove Bea from the staff",
    ])
    expect(screen.getAllByRole("switch", { name: "Can go live" }).length).toBe(
      2
    )
    const staffCard = screen
      .getByRole("heading", { name: "Staff (2)" })
      .closest("section")
    expect(
      staffCard?.contains(screen.getByRole("button", { name: "Send invite" }))
    ).toBe(true)
    // Invitees are listed under the staff, with the seat they hold.
    const invitees = screen.getByRole("list", {
      name: "Invited, not yet accepted",
    })
    const invitee = screen
      .getByText(/c\*\*\*@example.org/, { selector: "p" })
      .closest("li") as HTMLElement
    expect(invitees.contains(invitee)).toBe(true)
    expect(invitee.textContent).toContain(
      "Editor · holds a seat until 20 Oct 2026"
    )
    expect(invitee.textContent).toContain("Invited")
    expect(
      screen.getByRole("button", { name: /^Revoke the invite for c/ })
    ).toBeTruthy()
    expect(screen.getByRole("heading", { name: "Recent changes" })).toBeTruthy()
    const audit = screen
      .getByRole("heading", { name: "Recent changes" })
      .closest("section")
    expect(audit?.textContent).toContain("joined the staff")
    expect(audit?.textContent).toContain("Bea")
  })

  it("lets an organiser invite to the Team with a pre-assignment to this library", async () => {
    render(manager())
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "dee@example.org" },
    })
    fireEvent.change(screen.getByLabelText("Level"), {
      target: { value: "owner" },
    })
    expect(
      screen.getByText(
        /get owner access to Kent Mobile Library as soon as they accept/
      )
    ).toBeTruthy()
    expect(
      screen.getByRole("link", { name: "Team organiser" }).getAttribute("href")
    ).toBe("/staff/team")
    fireEvent.click(screen.getByRole("button", { name: "Send invite" }))
    await waitFor(() =>
      expect(mocks.request).toHaveBeenCalledWith(
        "/api/staff/team/t1/invites",
        "POST",
        {
          email: "dee@example.org",
          teamRole: "member",
          preassign: { libraryDocumentId: ID, staffRole: "owner" },
        }
      )
    )
  })

  it("tells a non-organiser to ask the team organiser instead", () => {
    render(
      manager(
        {},
        {
          team: {
            documentId: "t1",
            name: "Kent Libraries",
            verified: true,
            viewerIsOrganiser: false,
            organiserNames: ["Ann"],
          },
        }
      )
    )
    expect(
      screen.getByText(
        /Ask your team organiser, Ann, to invite them or change who has access/
      )
    ).toBeTruthy()
    expect(screen.queryByLabelText("Email")).toBeNull()
    expect(screen.queryByRole("button", { name: /^Revoke/ })).toBeNull()
  })

  it("changes a level after confirmation and toggles who can go live", async () => {
    render(manager())
    fireEvent.change(screen.getByRole("combobox", { name: "Level for Bea" }), {
      target: { value: "owner" },
    })
    expect(screen.getByText("Make Bea an owner?")).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }))
    await waitFor(() =>
      expect(mocks.request).toHaveBeenCalledWith(
        `/api/staff/${ID}/team/members/aff2`,
        "PUT",
        { staffRole: "owner" }
      )
    )
    fireEvent.click(screen.getAllByRole("switch", { name: "Can go live" })[1]!)
    await waitFor(() =>
      expect(mocks.request).toHaveBeenLastCalledWith(
        `/api/staff/${ID}/team/members/aff2`,
        "PUT",
        { canGoLive: true }
      )
    )
  })

  it("shows editors the levels as badges with no controls, and no live switch off Mobile", () => {
    render(manager({ role: "editor", mobile: false }))
    expect(screen.queryByRole("combobox", { name: /Level for/ })).toBeNull()
    const badge = (text: string) =>
      screen.getAllByText(text).some((el) => el.tagName !== "OPTION")
    expect(badge("Owner")).toBe(true)
    expect(badge("Editor")).toBe(true)
    expect(screen.queryByRole("switch")).toBeNull()
    expect(screen.queryByRole("button", { name: /^Remove / })).toBeNull()
  })

  it("keeps the last owner from leaving", () => {
    render(manager({}, { canLeave: false }))
    expect(
      screen.queryByRole("button", { name: "Leave this library" })
    ).toBeNull()
    expect(screen.getByText(/The last owner can’t leave/)).toBeTruthy()
  })

  it("removes a member only after a danger confirm", async () => {
    render(manager())
    fireEvent.click(screen.getByRole("button", { name: /^Remove Bea/ }))
    expect(
      screen.getByRole("dialog", {
        name: "Remove Bea from Kent Mobile Library?",
      })
    ).toBeTruthy()
    expect(mocks.request).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name: "Yes, go ahead" }))
    await waitFor(() =>
      expect(mocks.request).toHaveBeenCalledWith(
        `/api/staff/${ID}/team/members/aff2`,
        "DELETE",
        undefined
      )
    )
  })

  it("leaving goes back to the staff index after confirmation", async () => {
    render(manager())
    fireEvent.click(screen.getByRole("button", { name: "Leave this library" }))
    expect(
      screen.getByRole("dialog", { name: "Leave Kent Mobile Library?" })
    ).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Yes, go ahead" }))
    await waitFor(() =>
      expect(mocks.request).toHaveBeenCalledWith(
        `/api/staff/${ID}/leave`,
        "POST",
        undefined
      )
    )
    expect(mocks.push).toHaveBeenCalledWith("/staff")
  })
})
