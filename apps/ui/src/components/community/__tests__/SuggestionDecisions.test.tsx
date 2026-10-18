// @vitest-environment happy-dom
import * as React from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { SuggestionDecisions } from "@/components/community/SuggestionDecisions"
import type { PublicSuggestion } from "@/lib/community/suggestions"
import { cleanup, render, screen, within } from "@/test/render"

Object.assign(globalThis, { React })
vi.mock("@/components/global/GlobalLink", () => ({
  default: ({
    href,
    children,
  }: {
    href: string
    children: React.ReactNode
  }) => <a href={href}>{children}</a>,
}))
afterEach(cleanup)

const idea = (
  documentId: string,
  extra: Partial<PublicSuggestion> = {}
): PublicSuggestion => ({
  documentId,
  name: documentId,
  optionKey: "services",
  status: "accepted",
  publicationStatus: "published",
  votes: 52,
  commentCount: 8,
  description: null,
  suggestedByName: null,
  libraryCount: 0,
  createdAt: "2026-10-01T12:00:00Z",
  decidedAt: "2026-10-06T12:00:00Z",
  decisionKind: "add",
  decisionNote:
    "A clearly described service that visitors can verify with a library.",
  ...extra,
})

describe("suggestion decision archive", () => {
  it("groups by decision month, places accepted items first and shows one explanation with conversation counts", () => {
    render(
      <SuggestionDecisions
        items={[
          idea("Fast Wi-Fi", {
            status: "declined",
            decisionKind: "decline",
            votes: 31,
            commentCount: 5,
            decidedAt: "2026-10-07T12:00:00Z",
            decisionNote: "Speed changes too often to check.",
          }),
          idea("Library equipment orientation"),
          idea("Earlier idea", { decidedAt: "2026-09-01T12:00:00Z" }),
        ]}
      />
    )
    const october = within(
      screen.getByRole("region", { name: "Decided in October 2026" })
    )
    expect(
      october
        .getAllByRole("heading", { level: 3 })
        .map((heading) => heading.textContent)
    ).toEqual(["Library equipment orientation", "Fast Wi-Fi"])
    expect(october.getAllByText("Not added")).toHaveLength(1)
    expect(october.queryByText("Added to the checklist")).toBeNull()
    expect(october.getByText("52 votes · Services · 8 replies")).toBeTruthy()
    expect(october.getByText("31 votes · Services · 5 replies")).toBeTruthy()
    expect(
      october
        .getByRole("link", { name: "Library equipment orientation" })
        .getAttribute("href")
    ).toBe(
      "/community/suggestions?suggestion=Library%20equipment%20orientation#suggestion-Library%20equipment%20orientation"
    )
    expect(
      screen.getByRole("region", { name: "Decided in September 2026" })
    ).toBeTruthy()
  })

  it("excludes private intake and incomplete decisions, with a fallback for legacy explanations", () => {
    render(
      <SuggestionDecisions
        items={[
          idea("Private pending", { publicationStatus: "pending" }),
          idea("Private rejected", { publicationStatus: "rejected" }),
          idea("Still open", { status: "open" }),
          idea("Invalid date", { decidedAt: "invalid" }),
          idea("Undated", { decidedAt: null }),
          idea("Legacy decision", {
            decisionNote: null,
            commentCount: undefined,
            conversation: { count: 1, participants: [] },
          }),
        ]}
      />
    )
    expect(screen.getAllByRole("heading", { level: 3 })).toHaveLength(1)
    expect(
      screen.getByText(
        "No public explanation was recorded for this earlier decision."
      )
    ).toBeTruthy()
    expect(screen.getByText("52 votes · Services · 1 reply")).toBeTruthy()
  })
})
