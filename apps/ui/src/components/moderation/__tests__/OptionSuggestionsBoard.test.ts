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
const defaultRound = {
  documentId: "round",
  version: 0,
  opensAt: "2026-10-01T00:00:00Z",
  cutoffAt: "2026-11-03T00:00:00Z",
  reviewAt: "2026-11-03T00:00:00Z",
  capacity: 5,
  state: "voting" as const,
  shortlist: [],
  snapshotAt: null,
}
function OptionSuggestionsBoard(props: Parameters<typeof Board>[0]) {
  return createElement(Board, {
    round: defaultRound,
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

  it("keeps advanced feature fields in a disclosure and uses a multiline public explanation", () => {
    render(createElement(OptionSuggestionsBoard, { initial: [suggestion()] }))
    expect(screen.getByLabelText("Public explanation").tagName).toBe("TEXTAREA")
    const details = screen
      .getByText("Feature details and matching items")
      .closest("details")!
    expect(details.open).toBe(false)
    expect(screen.getByLabelText("Feature summary").closest("details")).toBe(
      details
    )
  })

  it("keeps publication feedback private and retains the publication decision actions", () => {
    render(
      createElement(OptionSuggestionsBoard, {
        initial: [suggestion({ publicationStatus: "pending" })],
      })
    )
    expect(screen.getByLabelText("Private feedback").tagName).toBe("TEXTAREA")
    expect(screen.queryByLabelText("Public explanation")).toBeNull()
    expect(
      screen.getByText("Visible only to the contributor and reviewers.")
    ).toBeTruthy()
    expect(
      screen.getByRole("button", { name: "Approve publication" })
    ).toBeTruthy()
    expect(
      screen.getByRole("button", { name: "Reject publication" })
    ).toBeTruthy()
  })

  it("restores the queue from an empty status filter", () => {
    render(
      createElement(OptionSuggestionsBoard, {
        initial: [suggestion({ status: "planned" })],
      })
    )
    fireEvent.click(screen.getByRole("button", { name: /^New/ }))
    expect(
      screen.getByRole("heading", { name: "No suggestions match this filter." })
    ).toBeTruthy()
    fireEvent.click(
      screen.getByRole("button", { name: "Show all suggestions" })
    )
    expect(
      screen.getByRole("heading", { name: "Braille signage" })
    ).toBeTruthy()
  })

  it("saves the review schedule with its version, capacity and UTC dates", async () => {
    fetchMock.mockResolvedValueOnce(
      Response.json({ data: { ...defaultRound, version: 1, capacity: 6 } })
    )
    render(createElement(OptionSuggestionsBoard, { initial: [] }))
    fireEvent.change(
      screen.getByRole("spinbutton", { name: "Shortlist places" }),
      { target: { value: "6" } }
    )
    fireEvent.click(screen.getByRole("button", { name: "Save schedule" }))
    await vi.waitFor(() =>
      expect(screen.getByText("Review round saved.")).toBeTruthy()
    )
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/moderation/suggestion-round",
      expect.objectContaining({ method: "PUT" })
    )
    expect(sentBody()).toMatchObject({
      action: "schedule",
      version: 0,
      capacity: 6,
      cutoffAt: "2026-11-03T00:00:00.000Z",
      reviewAt: "2026-11-03T00:00:00.000Z",
    })
  })
})
