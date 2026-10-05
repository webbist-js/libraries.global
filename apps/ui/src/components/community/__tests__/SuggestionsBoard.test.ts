// @vitest-environment happy-dom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
import * as React from "react"
import { createElement } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

import type {
  PublicSuggestion,
  SuggestionList,
} from "@/lib/community/suggestions"

// vitest.config has no JSX runtime, so .tsx compiles to React.createElement.
Object.assign(globalThis, { React })

// Signed out on the client, so useSuggestions keeps the initial list.
vi.mock("@/lib/auth-client", () => ({
  authClient: { useSession: () => ({ data: null, isPending: false }) },
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

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const { SuggestionsWorkspace } = await import("../SuggestionsWorkspace")

const NOW = "2026-10-06T12:00:00.000Z"

const suggestion = (
  id: string,
  overrides: Partial<PublicSuggestion> = {}
): PublicSuggestion => ({
  documentId: id,
  name: `Option ${id}`,
  optionKey: "services",
  status: "open",
  votes: 1,
  description: null,
  suggestedByName: null,
  createdAt: "2026-09-01T00:00:00.000Z",
  decidedAt: null,
  decisionNote: null,
  libraryCount: 0,
  ...overrides,
})

const ITEMS = [
  suggestion("a", {
    name: "Toy library",
    status: "declined",
    votes: 40,
    decisionNote: "Covered by Children’s lending.",
    suggestedByName: "Sam O.",
    createdAt: "2026-08-01T00:00:00.000Z",
  }),
  suggestion("b", {
    name: "Quiet room",
    optionKey: "accessibility",
    status: "reviewing",
    votes: 36,
    createdAt: "2026-09-20T00:00:00.000Z",
  }),
  suggestion("c", {
    name: "Seed library",
    votes: 29,
    description: "Borrow seeds in spring.",
    createdAt: "2026-10-01T00:00:00.000Z",
  }),
  suggestion("d", {
    name: "Tool lending",
    votes: 22,
    libraryCount: 3,
    createdAt: "2026-09-29T00:00:00.000Z",
  }),
  suggestion("e", {
    name: "Hearing loop",
    optionKey: "accessibility",
    status: "accepted",
    votes: 50,
    decidedAt: "2026-09-02T00:00:00.000Z",
  }),
]

const optionNames: Record<SuggestionList, string[]> = {
  accessibility: ["Hearing loop"],
  amenities: [],
  services: ["Printing"],
  library_types: ["Public"],
}

function renderBoard(signedIn = false) {
  render(
    createElement(SuggestionsWorkspace, {
      initial: ITEMS,
      optionNames,
      signedIn,
      now: NOW,
    })
  )
}

const cardNames = () =>
  screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent)

describe("SuggestionsWorkspace board", () => {
  it("lists every status but accepted, most votes first and declined last", () => {
    renderBoard()

    expect(cardNames()).toEqual([
      "Quiet room",
      "Seed library",
      "Tool lending",
      "Toy library",
    ])
    expect(screen.getByText("Board note:").parentElement?.textContent).toBe(
      "Board note: Covered by Children’s lending."
    )
    expect(
      screen.getByText("Services · Suggested by Sam O. · 2 months ago")
    ).toBeTruthy()
    expect(
      screen.getByText("Asked for in corrections to 3 libraries.")
    ).toBeTruthy()
  })

  it("filters by list and sorts by newest", () => {
    renderBoard()
    const group = screen.getByRole("group", { name: "Filter by list" })

    const services = within(group).getByRole("button", { name: "Services" })
    fireEvent.click(services)
    expect(services.getAttribute("aria-pressed")).toBe("true")
    expect(
      within(group)
        .getByRole("button", { name: "All" })
        .getAttribute("aria-pressed")
    ).toBe("false")
    expect(cardNames()).toEqual(["Seed library", "Tool lending", "Toy library"])

    fireEvent.change(screen.getByRole("combobox", { name: "Sort" }), {
      target: { value: "new" },
    })
    expect(cardNames()).toEqual(["Seed library", "Tool lending", "Toy library"])

    fireEvent.click(within(group).getByRole("button", { name: "All" }))
    expect(cardNames()).toEqual([
      "Seed library",
      "Tool lending",
      "Quiet room",
      "Toy library",
    ])
  })

  it("shows an empty state under a filter with nothing in it", () => {
    renderBoard()

    fireEvent.click(screen.getByRole("button", { name: "Library types" }))

    expect(
      screen.getByRole("heading", { name: "No library types suggestions yet" })
    ).toBeTruthy()
  })

  it("locks votes on declined suggestions and links others to sign in", () => {
    renderBoard()

    const locked = screen.getByRole("button", {
      name: "Voting closed for Toy library, 40 votes",
    }) as HTMLButtonElement
    expect(locked.disabled).toBe(true)
    expect(
      screen
        .getByRole("link", { name: "Sign in to vote for Quiet room, 36 votes" })
        .getAttribute("href")
    ).toBe(
      `/auth/signin?callbackUrl=${encodeURIComponent("/community/suggestions")}`
    )
  })

  it("puts a posted suggestion on top of All", async () => {
    const posted = suggestion("new", {
      name: "Makerspace",
      optionKey: "amenities",
      votes: 1,
      voted: true,
      createdAt: NOW,
    })
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ data: posted }, { status: 201 }))
    )
    renderBoard(true)

    fireEvent.click(screen.getByRole("button", { name: "Accessibility" }))
    fireEvent.change(screen.getByRole("combobox", { name: "Sort" }), {
      target: { value: "new" },
    })
    fireEvent.change(screen.getByRole("textbox", { name: /Option name/ }), {
      target: { value: "Makerspace" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Post suggestion" }))

    await waitFor(() => expect(cardNames()[0]).toBe("Makerspace"))
    expect(
      screen.getByRole("button", { name: "All" }).getAttribute("aria-pressed")
    ).toBe("true")
    expect(
      screen
        .getByRole("button", {
          name: "Remove your vote for Makerspace, 1 vote",
        })
        .getAttribute("aria-pressed")
    ).toBe("true")
  })
})
