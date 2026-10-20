// @vitest-environment happy-dom
import * as React from "react"
import { createElement } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { TeamInvitePreview } from "@/lib/staff/types"
import { cleanup, fireEvent, render, screen, waitFor } from "@/test/render"

Object.assign(globalThis, { React })

const mocks = vi.hoisted(() => ({ request: vi.fn(), refresh: vi.fn() }))

vi.mock("@/lib/staff/client", () => ({ staffRequest: mocks.request }))
vi.mock("@/lib/env-vars", () => ({ getEnvVar: () => {} }))
vi.mock("@iconify/react", () => ({ Icon: () => null }))
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
  }
})

const { TeamJoin } = await import("../TeamJoin")

const LIB = "lib000000000000000000001"
const invite = (over: Partial<TeamInvitePreview> = {}): TeamInvitePreview => ({
  teamName: "Kent Libraries",
  teamRole: "member",
  invitedByName: "Ann",
  emailMasked: "b***@example.org",
  emailMatches: true,
  status: "open",
  preassign: { libraryDocumentId: LIB, staffRole: "editor" },
  ...over,
})
const join = (over: Partial<TeamInvitePreview> = {}, emailVerified = true) =>
  createElement(TeamJoin, {
    token: "tok1",
    invite: invite(over),
    emailVerified,
  })

beforeEach(() => {
  mocks.request.mockResolvedValue({
    team: {
      id: "t1",
      name: "Kent Libraries",
      slug: "kent-libraries",
      role: "member",
      libraryCount: 2,
      status: "active",
      expiresAt: null,
      verified: true,
      organiserName: "Ann",
      libraryDocumentIds: [LIB],
    },
  })
})
afterEach(() => {
  cleanup()
  mocks.request.mockReset()
  mocks.refresh.mockReset()
})

describe("TeamJoin", () => {
  it("names the pre-assigned library and opens it after joining", async () => {
    render(
      join({
        preassign: {
          libraryDocumentId: LIB,
          staffRole: "editor",
          libraryName: "Maidstone Library",
          librarySlug: "maidstone-library",
        } as TeamInvitePreview["preassign"],
      })
    )
    expect(
      screen.getByText("Library access on joining").nextElementSibling
        ?.textContent
    ).toBe("Maidstone Library · Editor")
    const button = screen.getByRole("button", {
      name: "Join Kent Libraries",
    }) as HTMLButtonElement
    expect(button.disabled).toBe(false)
    fireEvent.click(button)
    await waitFor(() =>
      expect(mocks.request).toHaveBeenCalledWith(
        "/api/staff/team/join/tok1/accept",
        "POST"
      )
    )
    const done = await screen.findByRole("status")
    expect(done.textContent).toContain("You’re on Kent Libraries")
    expect(done.textContent).toContain(
      "You now have editor access to Maidstone Library"
    )
    expect(document.activeElement).toBe(done)
    expect(
      screen
        .getByRole("link", { name: /Open Maidstone Library/ })
        .getAttribute("href")
    ).toBe("/staff/maidstone-library")
    expect(
      screen
        .getByRole("link", { name: /Open your Staff area/ })
        .getAttribute("href")
    ).toBe("/staff")
  })

  it("keeps the success confirmation when the accepted invite can no longer be loaded", async () => {
    mocks.request.mockResolvedValueOnce({
      team: { id: "t1", name: "Kent Libraries", role: "organiser" },
    })
    const { rerender } = render(
      join({ teamRole: "organiser", preassign: null })
    )
    // A route refresh re-runs the server preview after acceptance has consumed
    // its single-use token, replacing this component with the unavailable view.
    mocks.refresh.mockImplementation(() =>
      rerender(
        createElement("p", { role: "alert" }, "This invite is unavailable")
      )
    )

    fireEvent.click(screen.getByRole("button", { name: "Join Kent Libraries" }))

    const done = await screen.findByRole("status")
    expect(done.textContent).toContain("You’re on Kent Libraries")
    expect(
      screen
        .getByRole("link", { name: "Open the Team organiser" })
        .getAttribute("href")
    ).toBe("/staff/team")
    expect(screen.queryByRole("alert")).toBeNull()
  })

  it("falls back to the library's id when the API sends no name", () => {
    render(join())
    expect(
      screen.getByText("Library access on joining").nextElementSibling
        ?.textContent
    ).toBe(`library ${LIB} · Editor`)
  })

  it("asks a mismatched account to sign out, and blocks joining", () => {
    render(join({ emailMatches: false }))
    expect(screen.getByText("Sign in with the invited email")).toBeTruthy()
    expect(
      screen.getByText(/This invite went to b\*\*\*@example.org/)
    ).toBeTruthy()
    expect(
      screen.getByRole("link", { name: /Sign out/ }).getAttribute("href")
    ).toBe("/auth/signout")
    expect(
      (
        screen.getByRole("button", {
          name: "Join Kent Libraries",
        }) as HTMLButtonElement
      ).disabled
    ).toBe(true)
  })

  it("blocks an expired invite and an unverified email, each with its own line", () => {
    const { unmount } = render(join({ status: "expired" }))
    expect(screen.getByText("This invite has expired")).toBeTruthy()
    expect(screen.getByText(/Ask Ann to send a new one/)).toBeTruthy()
    expect(
      (
        screen.getByRole("button", {
          name: "Join Kent Libraries",
        }) as HTMLButtonElement
      ).disabled
    ).toBe(true)
    unmount()

    render(join({}, false))
    expect(screen.getByText("Verify your email first")).toBeTruthy()
    expect(
      screen.getByRole("link", { name: /Email settings/ }).getAttribute("href")
    ).toBe("/profile/settings")
    expect(
      (
        screen.getByRole("button", {
          name: "Join Kent Libraries",
        }) as HTMLButtonElement
      ).disabled
    ).toBe(true)
  })
})
