// @vitest-environment happy-dom
import * as React from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

import type { PublicSuggestion } from "@/lib/community/suggestions"
import { cleanup, fireEvent, render, screen } from "@/test/render"

import { SuggestionCard } from "../SuggestionCard"

Object.assign(globalThis, { React })
const discussionMount = vi.hoisted(() => vi.fn())
vi.mock("next/dynamic", () => ({
  default: () =>
    function InlineConversation(props: any) {
      const [draft, setDraft] = React.useState("")
      discussionMount(props)

      return (
        <textarea
          aria-label="Conversation draft"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        />
      )
    },
}))
vi.mock("@iconify/react", () => ({ Icon: () => null }))
vi.mock("@/components/global/GlobalLink", () => ({
  default: ({ href, children, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})
const idea: PublicSuggestion = {
  documentId: "suggestion000000000000001",
  name: "Large-print collection",
  optionKey: "accessibility",
  status: "open",
  votes: 48,
  voted: true,
  description: "Books to borrow",
  suggestedByName: "Writer",
  createdAt: "2026-10-01T10:00:00Z",
  decidedAt: null,
  decisionNote: null,
  libraryCount: 0,
  conversation: {
    count: 6,
    participants: [{ name: "Reader", slug: "reader" }],
  },
}
const card = (initiallyExpanded = false) => (
  <SuggestionCard
    suggestion={idea}
    signedIn
    busy={false}
    onVote={vi.fn()}
    signInHref="/auth/signin"
    now={new Date("2026-10-17T12:00:00Z")}
    initiallyExpanded={initiallyExpanded}
  />
)
describe("suggestion conversation cards", () => {
  it("opens inline on demand and retains the reply draft when hidden", () => {
    render(card())
    expect(discussionMount).not.toHaveBeenCalled()
    expect(
      screen.queryByRole("link", { name: "Large-print collection" })
    ).toBeNull()
    const trigger = screen.getByRole("button", {
      name: /6 replies.*Read conversation/,
    })
    fireEvent.click(trigger)
    const input = screen.getByLabelText(
      "Conversation draft"
    ) as HTMLTextAreaElement
    fireEvent.change(input, { target: { value: "A useful idea" } })
    fireEvent.click(screen.getByRole("button", { name: /6 replies.*Hide/ }))
    expect(input.closest("[hidden]")).toBeTruthy()
    fireEvent.click(
      screen.getByRole("button", { name: /6 replies.*Read conversation/ })
    )
    expect(
      (screen.getByLabelText("Conversation draft") as HTMLTextAreaElement).value
    ).toBe("A useful idea")
    expect(discussionMount.mock.calls.at(-1)?.[0]).toMatchObject({
      variant: "suggestion",
      returnTo: `/community/suggestions?suggestion=${idea.documentId}#suggestion-${idea.documentId}`,
    })
  })
  it("opens a shared link's selected card immediately", () => {
    render(card(true))
    expect(screen.getByLabelText("Conversation draft")).toBeTruthy()
    expect(
      screen
        .getByRole("button", { name: /6 replies.*Hide/ })
        .getAttribute("aria-expanded")
    ).toBe("true")
  })
})
