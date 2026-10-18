// @vitest-environment happy-dom
import * as React from "react"
import { createElement, useState } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

import {
  suggestionMatchScore,
  type PublicSuggestion,
  type OptionCatalogue,
} from "@/lib/community/suggestions"
import { cleanup, fireEvent, render, screen, waitFor } from "@/test/render"

Object.assign(globalThis, { React })
vi.mock("@iconify/react", () => ({ Icon: () => null }))
vi.mock("@/components/global/GlobalLink", () => ({
  default: ({
    href,
    children,
    ...rest
  }: React.AnchorHTMLAttributes<HTMLAnchorElement>) =>
    createElement("a", { href, ...rest }, children),
}))
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})
const { SuggestOptionForm, nameIssue, EMPTY_NAME, DUPLICATE_NAME } =
  await import("../SuggestOptionForm")
const catalogue: OptionCatalogue = {
  accessibility: [],
  amenities: [],
  services: [{ documentId: "printing", name: "Printing" }],
  library_types: [],
}
const names = {
  accessibility: [],
  amenities: [],
  services: ["Printing"],
  library_types: [],
}
const idea = (extra: Partial<PublicSuggestion> = {}): PublicSuggestion => ({
  documentId: "idea1",
  name: "Large-print collection",
  optionKey: "accessibility",
  status: "open",
  publicationStatus: "published",
  votes: 47,
  description: null,
  suggestedByName: null,
  createdAt: "2026-10-01T00:00:00Z",
  decidedAt: null,
  decisionNote: null,
  libraryCount: 0,
  ...extra,
})
function Harness({
  initial = [idea()],
  signedIn = true,
  onVote = vi.fn(async () => ({ voted: true, votes: 48 })),
  onPosted = vi.fn(),
}: {
  initial?: PublicSuggestion[]
  signedIn?: boolean
  onVote?: Parameters<typeof SuggestOptionForm>[0]["onVote"]
  onPosted?: (s: PublicSuggestion) => void
}) {
  const [items, setItems] = useState(initial)

  return createElement(SuggestOptionForm, {
    signedIn,
    optionNames: names,
    optionCatalogue: catalogue,
    suggestions: items,
    busyId: null,
    voteError: null,
    onPosted: (s) => {
      setItems((old) => [s, ...old])
      onPosted(s)
    },
    onVote: async (s) => {
      const result = await onVote(s)
      if (result)
        setItems((old) =>
          old.map((x) =>
            x.documentId === s.documentId ? { ...x, ...result } : x
          )
        )

      return result
    },
  })
}
const typeName = (name: string) =>
  fireEvent.change(
    screen.getByRole("textbox", { name: "What were you looking for?" }),
    {
      target: { value: name },
    }
  )
const send = () => fireEvent.submit(document.getElementById("suggest-option")!)
describe("suggestion composer", () => {
  it("matches hyphens, partial words and cross-category names without declaring a duplicate", () => {
    expect(
      suggestionMatchScore("Large print", "Large-print collection")
    ).toBeGreaterThan(0)
    expect(suggestionMatchScore("Large print", "Printing")).toBeGreaterThan(0)
    expect(nameIssue("", "services", names, [])).toBe(EMPTY_NAME)
    expect(nameIssue(" printing ", "services", names, [])).toBe(DUPLICATE_NAME)
    expect(
      nameIssue("Large print", "accessibility", names, [idea()])
    ).toBeNull()
  })
  it("shows separate checklist and proposal matches, and updates the inline vote", async () => {
    const onVote = vi.fn(async () => ({ voted: true, votes: 48 }))
    render(createElement(Harness, { onVote }))
    typeName("Large print")
    expect(screen.getByText("Already on every checklist")).toBeTruthy()
    expect(screen.getByText("Someone already suggested")).toBeTruthy()
    expect(
      screen
        .getByRole("link", { name: "Add to its conversation" })
        .getAttribute("href")
    ).toBe("/community/suggestions?suggestion=idea1#suggestion-idea1")
    fireEvent.click(
      screen.getByRole("button", { name: /Vote for this instead/ })
    )
    await waitFor(() =>
      expect(
        screen
          .getByRole("button", { name: /You voted/ })
          .getAttribute("aria-pressed")
      ).toBe("true")
    )
    expect(screen.getByText(/48 votes/)).toBeTruthy()
    expect(onVote).toHaveBeenCalledWith(idea())
  })
  it("keeps an exact existing proposal from being posted twice", () => {
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)
    render(createElement(Harness))
    typeName("Large-print collection")
    send()
    expect(fetchMock).not.toHaveBeenCalled()
    expect(
      screen.getByText(/This already exists or has been suggested/)
    ).toBeTruthy()
  })
  it("posts a distinct explanation and displays its owner-only pending row", async () => {
    const posted = idea({
      documentId: "new",
      name: "Large print",
      votes: 1,
      voted: true,
      publicationStatus: "pending",
    })
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ data: posted }, { status: 201 }))
    )
    const onPosted = vi.fn()
    render(createElement(Harness, { onPosted }))
    typeName("Large print")
    fireEvent.change(
      screen.getByRole("textbox", {
        name: "How is it different?",
      }),
      { target: { value: "Larger text available to borrow." } }
    )
    send()
    await waitFor(() => expect(onPosted).toHaveBeenCalledWith(posted))
    expect(screen.getByText("Only you can see this for now")).toBeTruthy()
    expect(
      (
        screen.getByRole("textbox", {
          name: "What were you looking for?",
        }) as HTMLInputElement
      ).value
    ).toBe("")
    expect(screen.queryByText("Someone already suggested")).toBeNull()
  })
  it("shows server errors without clearing the draft", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({ error: "Too many requests." }, { status: 429 })
      )
    )
    render(createElement(Harness))
    typeName("Tool lending")
    send()
    expect(await screen.findByText("Too many requests.")).toBeTruthy()
    expect(
      (
        screen.getByRole("textbox", {
          name: "What were you looking for?",
        }) as HTMLInputElement
      ).value
    ).toBe("Tool lending")
  })
  it("allows browsing but requires sign-in for suggestion and voting", () => {
    render(
      createElement(Harness, {
        signedIn: false,
        initial: [idea({ publicationStatus: "pending" })],
      })
    )
    typeName("Large print")
    expect(
      screen.getByRole("link", { name: "Sign in to suggest an option" })
    ).toBeTruthy()
    expect(screen.queryByText("Only you can see this for now")).toBeNull()
    expect(screen.queryByRole("button", { name: /Suggest “/ })).toBeNull()
  })
  it("uses monthly popularity and selecting a chip opens its matches", () => {
    render(createElement(Harness, { initial: [idea({ votesThisMonth: 3 })] }))
    fireEvent.click(
      screen.getByRole("button", { name: "Large-print collection" })
    )
    expect(screen.getByText("Someone already suggested")).toBeTruthy()
  })
})
