// @vitest-environment happy-dom
import * as React from "react"
import { createElement } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { cleanup, fireEvent, render, screen } from "@/test/render"

import type { OptionSuggestion } from "../submissionMeta"

// vitest.config has no JSX runtime, so .tsx compiles to React.createElement.
Object.assign(globalThis, { React })

vi.mock("@iconify/react", () => ({ Icon: () => null }))
vi.mock("@/lib/env-vars", () => ({ getEnvVar: () => {} }))
vi.mock("@/lib/navigation", async () => {
  const { createElement: h } = await import("react")

  return {
    Link: ({ href, children }: { href: string; children?: React.ReactNode }) =>
      h("a", { href }, children),
    useRouter: () => ({ replace: vi.fn(), refresh: vi.fn(), push: vi.fn() }),
    formatHref: (href?: string | null) => href || "#",
    isAppLink: () => true,
  }
})

const fetchMock = vi.fn(async () => Response.json({ data: {} }))

const { OptionSuggestionsBoard: Board } =
  await import("../OptionSuggestionsBoard")
function OptionSuggestionsBoard(props: Parameters<typeof Board>[0]) {
  return createElement(Board, {
    round: {
      documentId: "round",
      version: 0,
      opensAt: "2026-10-01T00:00:00Z",
      cutoffAt: "2026-11-03T00:00:00Z",
      reviewAt: "2026-11-03T00:00:00Z",
      capacity: 5,
      state: "voting",
      shortlist: [],
      snapshotAt: null,
    },
    ...props,
  })
}

function suggestion(over: Partial<OptionSuggestion> = {}): OptionSuggestion {
  return {
    documentId: "doc1",
    name: "Braille signage",
    optionKey: "accessibility",
    status: "open",
    requests: 2,
    votes: 5,
    libraries: [],
    unlinkedLibraries: [],
    description: null,
    suggestedByName: null,
    decidedAt: null,
    decidedBy: null,
    decisionNote: null,
    ...over,
  }
}

const sentBody = () => {
  const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]

  return JSON.parse(String(init.body))
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal("fetch", fetchMock)
})
afterEach(cleanup)

describe("OptionSuggestionsBoard", () => {
  it("only lists undecided suggestions and filters by status", () => {
    render(
      createElement(OptionSuggestionsBoard, {
        initial: [
          suggestion({ documentId: "a", name: "Open one", status: "open" }),
          suggestion({
            documentId: "b",
            name: "Reviewing one",
            status: "reviewing",
          }),
          suggestion({
            documentId: "c",
            name: "Accepted one",
            status: "accepted",
          }),
        ],
      })
    )
    expect(screen.queryByText("Accepted one")).toBeNull()
    expect(screen.getByText("Open one")).toBeTruthy()
    expect(screen.getByText("Reviewing one")).toBeTruthy()

    fireEvent.click(screen.getByRole("button", { name: /^New/ }))
    expect(screen.getByText("Open one")).toBeTruthy()
    expect(screen.queryByText("Reviewing one")).toBeNull()
  })

  it("shows only the actions valid for the suggestion's status", () => {
    render(
      createElement(OptionSuggestionsBoard, {
        initial: [suggestion({ documentId: "a", status: "planned" })],
      })
    )
    expect(
      screen.queryByRole("button", { name: "Mark under review" })
    ).toBeNull()
    expect(screen.queryByRole("button", { name: "Mark planned" })).toBeNull()
    expect(screen.getByRole("button", { name: "Accept" })).toBeTruthy()
    expect(screen.getByRole("button", { name: "Decline" })).toBeTruthy()
    expect(screen.getByRole("button", { name: "Remove" })).toBeTruthy()
  })

  it("requires a note before declining, and sends it once added", async () => {
    render(
      createElement(OptionSuggestionsBoard, {
        initial: [suggestion({ documentId: "a" })],
      })
    )
    fireEvent.click(screen.getByRole("button", { name: "Decline" }))
    expect(fetchMock).not.toHaveBeenCalled()
    expect(screen.getByRole("alert").textContent).toMatch(
      /explain the decision/i
    )

    fireEvent.change(screen.getByLabelText("Public explanation"), {
      target: { value: "Spam name." },
    })
    fireEvent.click(screen.getByRole("button", { name: "Decline" }))
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    expect(sentBody()).toMatchObject({
      decision: "decline",
      note: "Spam name.",
    })
  })

  it("shows a confirm step before removing a suggestion", async () => {
    render(
      createElement(OptionSuggestionsBoard, {
        initial: [suggestion({ documentId: "a" })],
      })
    )
    fireEvent.click(screen.getByRole("button", { name: "Remove" }))
    expect(fetchMock).not.toHaveBeenCalled()
    expect(screen.getByRole("alert").textContent).toMatch(/can.t be undone/i)

    fireEvent.click(screen.getByRole("button", { name: "Yes, remove" }))
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    expect(sentBody()).toMatchObject({ decision: "remove" })
  })

  it("moves a suggestion to Under review without removing it from the list", async () => {
    render(
      createElement(OptionSuggestionsBoard, {
        initial: [suggestion({ documentId: "a", name: "Hearing loop" })],
      })
    )
    fireEvent.click(screen.getByRole("button", { name: "Mark under review" }))
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    expect(sentBody()).toMatchObject({ decision: "review" })
    await vi.waitFor(() => {
      expect(screen.getByText("Hearing loop")).toBeTruthy()
      expect(
        screen.queryByRole("button", { name: "Mark under review" })
      ).toBeNull()
    })
  })

  it("supports editable library types with feature details and a public explanation", () => {
    render(
      createElement(OptionSuggestionsBoard, {
        initial: [suggestion({ optionKey: "library_types" })],
      })
    )
    expect(screen.getByLabelText("Feature summary")).toBeTruthy()
    expect(screen.getByLabelText("Public explanation")).toBeTruthy()
    expect(screen.getByRole("button", { name: "Accept" })).toBeTruthy()
  })
})
