// @vitest-environment happy-dom
import * as React from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { SuggestionsWorkspace } from "@/components/community/SuggestionsWorkspace"
import type { PublicSuggestion } from "@/lib/community/suggestions"
import { cleanup, fireEvent, render, screen, waitFor } from "@/test/render"

Object.assign(globalThis, { React })
const actor = vi.hoisted(() => ({ signedIn: true, scope: "writer" }))
vi.mock("../useSuggestions", () => ({
  useSuggestions: (initial: PublicSuggestion[]) => ({
    items: initial,
    setItems: vi.fn(),
    vote: vi.fn(),
    busyId: null,
    error: null,
    round: null,
    viewerScope: actor.scope,
    signedIn: actor.signedIn,
  }),
}))
vi.mock("@/components/global/GlobalLink", () => ({
  default: ({
    href,
    children,
  }: {
    href: string
    children: React.ReactNode
  }) => <a href={href}>{children}</a>,
}))
vi.mock("@iconify/react", () => ({ Icon: () => <span aria-hidden /> }))
vi.mock("@/components/ds/SelectField", () => ({
  SelectField: ({
    value,
    onValueChange,
    options,
    label,
    name,
  }: {
    value: string
    onValueChange: (value: string) => void
    options: { value: string; label: string }[]
    label: string
    name?: string
  }) => (
    <select
      value={value}
      name={name}
      aria-label={label}
      onChange={(event) => onValueChange(event.target.value)}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  ),
}))

const returned: PublicSuggestion = {
  documentId: "returned",
  name: "Easy-read opening times",
  optionKey: "services",
  status: "open",
  publicationStatus: "rejected",
  votes: 1,
  libraryCount: 0,
  createdAt: "2026-10-01T09:00:00Z",
  decidedAt: null,
  suggestedByName: null,
  description: "Plain-language opening times checked by staff.",
  decisionNote: "Explain how this differs from existing information options.",
  comparison: {
    documentId: "printing",
    name: "Printing",
    explanation:
      "This explains visiting hours, rather than printing documents.",
  },
}
const props = {
  initial: [returned],
  signedIn: true,
  now: "2026-10-18T09:00:00Z",
  optionNames: {
    accessibility: [],
    services: ["Printing"],
    amenities: [],
    library_types: [],
  },
  optionCatalogue: {
    accessibility: [],
    services: [{ documentId: "printing", name: "Printing" }],
    amenities: [],
    library_types: [],
  },
}
beforeEach(() => {
  actor.signedIn = true
  actor.scope = "writer"
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe("returned suggestion revision", () => {
  it("restores the complete proposal locally, focuses the form and sends only the author's edited proposal for review", async () => {
    const fetch = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) =>
      Response.json(
        { data: { ...returned, publicationStatus: "pending" } },
        { status: 201 }
      )
    )
    vi.stubGlobal("fetch", fetch)
    render(<SuggestionsWorkspace {...props} />)
    expect(screen.getByText("Needs changes")).toBeTruthy()
    expect(
      screen.getByText("Only you and reviewers can see this.")
    ).toBeTruthy()
    fireEvent.click(
      screen.getByRole("button", { name: "Revise Easy-read opening times" })
    )
    const name = screen.getByRole("textbox", {
      name: "What were you looking for?",
    }) as HTMLInputElement
    expect(name.value).toBe(returned.name)
    expect(document.activeElement).toBe(name)
    const description = screen.getByPlaceholderText(
      "Who would it help, and how would someone check a library has it?"
    ) as HTMLTextAreaElement
    expect(description.value).toBe(returned.description)
    expect(
      (screen.getByRole("combobox", { name: "Category" }) as HTMLSelectElement)
        .value
    ).toBe("services")
    expect(fetch).not.toHaveBeenCalled()
    fireEvent.change(description, {
      target: {
        value:
          "Visiting hours written in plain language and checked with staff.",
      },
    })
    fireEvent.submit(
      screen.getByRole("form", { name: "Suggest something for the checklist" })
    )
    await waitFor(() => expect(fetch).toHaveBeenCalledOnce())
    expect(JSON.parse(fetch.mock.calls[0]![1]!.body as string)).toEqual({
      name: returned.name,
      optionKey: "services",
      description:
        "Visiting hours written in plain language and checked with staff.",
      comparison: {
        documentId: "printing",
        explanation: returned.comparison!.explanation,
      },
    })
    await waitFor(() => expect(name.value).toBe(""))
    expect(screen.queryByText("Revising “Easy-read opening times”")).toBeNull()
  })

  it("clears private feedback and the revision draft when the account scope changes", () => {
    const view = render(<SuggestionsWorkspace {...props} />)
    fireEvent.click(
      screen.getByRole("button", { name: "Revise Easy-read opening times" })
    )
    expect(screen.getAllByText(returned.decisionNote!)).toHaveLength(2)
    actor.signedIn = false
    actor.scope = "anonymous"
    view.rerender(<SuggestionsWorkspace {...props} />)
    expect(screen.queryByText(returned.decisionNote!)).toBeNull()
    expect(screen.queryByText("Revising “Easy-read opening times”")).toBeNull()
    expect(
      screen.queryByRole("region", { name: "Your submissions needing changes" })
    ).toBeNull()
    expect(
      (
        screen.getByRole("textbox", {
          name: "What were you looking for?",
        }) as HTMLInputElement
      ).value
    ).toBe("")
  })
})
