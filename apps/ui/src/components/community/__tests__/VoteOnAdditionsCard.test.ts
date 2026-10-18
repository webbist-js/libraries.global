// @vitest-environment happy-dom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import * as React from "react"
import { createElement } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { PublicSuggestion } from "@/lib/community/suggestions"

// vitest.config has no JSX runtime, so .tsx compiles to React.createElement.
Object.assign(globalThis, { React })

const session = vi.hoisted(() => ({
  value: { data: null, isPending: false } as {
    data: { user: { id: string } } | null
    isPending: boolean
  },
}))

vi.mock("@/lib/auth-client", () => ({
  authClient: { useSession: () => session.value },
}))
vi.mock("@iconify/react", () => ({ Icon: () => null }))
vi.mock("@/components/global/GlobalLink", async () => {
  const { createElement: h } = await import("react")

  return {
    default: ({
      href,
      children,
      ...rest
    }: {
      href: string
      children?: React.ReactNode
    }) => h("a", { href, ...rest }, children),
  }
})

const suggestion = (
  n: number,
  overrides: Partial<PublicSuggestion> = {}
): PublicSuggestion => ({
  documentId: `s${n}`,
  name: `Option ${n}`,
  optionKey: "services",
  status: "open",
  votes: n,
  description: null,
  suggestedByName: null,
  createdAt: "2026-09-01T00:00:00.000Z",
  decidedAt: null,
  decisionNote: null,
  libraryCount: 0,
  ...overrides,
})

beforeEach(() => {
  session.value = { data: null, isPending: false }
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const { VoteOnAdditionsCard } = await import("../VoteOnAdditionsCard")

describe("VoteOnAdditionsCard", () => {
  it("shows the top three votable suggestions, most votes first", () => {
    render(
      createElement(VoteOnAdditionsCard, {
        initial: [
          suggestion(1),
          suggestion(9, { status: "declined" }),
          suggestion(4, { optionKey: "accessibility", status: "planned" }),
          suggestion(3),
          suggestion(2, { status: "accepted" }),
          suggestion(5, { status: "reviewing" }),
        ],
        signInReturnTo: "/community",
      })
    )

    const names = screen
      .getAllByRole("listitem")
      .map((li) => li.textContent ?? "")
    expect(names).toHaveLength(3)
    expect(names[0]).toContain("Option 5")
    expect(names[0]).toContain("Services · Under review")
    expect(names[1]).toContain("Option 4")
    expect(names[1]).toContain("Accessibility · Planned")
    expect(names[2]).toContain("Option 3")
  })

  it("links each vote to sign in when signed out", () => {
    render(
      createElement(VoteOnAdditionsCard, {
        initial: [suggestion(1)],
        signInReturnTo: "/community#vote-on-additions",
      })
    )

    const link = screen.getByRole("link", {
      name: "Sign in to vote for Option 1, 1 vote",
    })
    expect(link.getAttribute("href")).toBe(
      `/auth/signin?callbackUrl=${encodeURIComponent("/community#vote-on-additions")}`
    )
    expect(screen.queryByRole("button")).toBeNull()
  })

  it("votes when signed in and announces the new count", async () => {
    session.value = { data: { user: { id: "u1" } }, isPending: false }
    let hasVoted = false
    const fetchMock = vi.fn(async (url: string) => {
      if (url.endsWith("/vote")) {
        hasVoted = true

        return Response.json({ data: { voted: true, votes: 3 } })
      }

      return Response.json({
        data: [suggestion(2, { voted: hasVoted, votes: hasVoted ? 3 : 2 })],
      })
    })
    vi.stubGlobal("fetch", fetchMock)
    render(
      createElement(VoteOnAdditionsCard, {
        initial: [suggestion(2)],
        signInReturnTo: "/community",
      })
    )

    const button = screen.getByRole("button", {
      name: "Vote for Option 2, 2 votes",
    })
    expect(button.getAttribute("aria-pressed")).toBe("false")
    fireEvent.click(button)

    const voted = await screen.findByRole("button", {
      name: "Remove your vote for Option 2, 3 votes",
    })
    expect(voted.getAttribute("aria-pressed")).toBe("true")
    expect(fetchMock).toHaveBeenCalledWith("/api/option-suggestions/s2/vote", {
      method: "POST",
    })
    await waitFor(() =>
      expect(screen.getByText("Vote added for Option 2. 3 votes.")).toBeTruthy()
    )
  })

  it("invites a suggestion when there is nothing to vote on", () => {
    render(
      createElement(VoteOnAdditionsCard, {
        initial: [suggestion(1, { status: "declined" })],
        signInReturnTo: "/community",
      })
    )

    expect(screen.getByText(/Nothing to vote on yet/)).toBeTruthy()
    expect(
      screen
        .getByRole("link", { name: "Suggest an option the lists are missing." })
        .getAttribute("href")
    ).toBe("/community/suggestions#suggest-option")
  })
})
