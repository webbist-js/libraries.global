// @vitest-environment happy-dom
import * as React from "react"
import { createElement, useState } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

import type { PublicSuggestion } from "@/lib/community/suggestions"
import { cleanup, fireEvent, render, screen, within } from "@/test/render"

Object.assign(globalThis, { React })

vi.mock("@/components/ds/SelectField", () => ({
  SelectField: ({
    value,
    onValueChange,
    options,
    label,
    name,
    disabled,
  }: {
    value: string
    onValueChange: (value: string) => void
    options: { value: string; label: string }[]
    label: string
    name?: string
    disabled?: boolean
  }) =>
    React.createElement(
      "select",
      {
        value,
        name,
        disabled,
        "aria-label": label,
        onChange: (event: React.ChangeEvent<HTMLSelectElement>) =>
          onValueChange(event.target.value),
      },
      options.map((option) =>
        React.createElement(
          "option",
          { key: option.value, value: option.value },
          option.label
        )
      )
    ),
}))
vi.mock("@iconify/react", () => ({ Icon: () => null }))
vi.mock("@/components/global/GlobalLink", () => ({
  default: ({
    href,
    children,
    ...rest
  }: React.AnchorHTMLAttributes<HTMLAnchorElement>) =>
    createElement("a", { href, ...rest }, children),
}))
afterEach(cleanup)
const { SuggestionsBoard } = await import("../SuggestionsBoard")
const idea = (
  id: string,
  extra: Partial<PublicSuggestion> = {}
): PublicSuggestion => ({
  documentId: id,
  name: id,
  optionKey: "services",
  status: "open",
  publicationStatus: "published",
  votes: 1,
  description: null,
  suggestedByName: null,
  createdAt: "2026-09-01T00:00:00Z",
  decidedAt: null,
  decisionNote: null,
  libraryCount: 0,
  ...extra,
})
const ITEMS = [
  idea("Quiet room", {
    optionKey: "accessibility",
    votes: 36,
    status: "reviewing",
    createdAt: "2026-09-20T00:00:00Z",
  }),
  idea("Seed library", { votes: 29, createdAt: "2026-10-01T00:00:00Z" }),
  idea("Tool lending", { votes: 22 }),
  idea("Toy library", {
    status: "declined",
    votes: 40,
    decidedAt: "2026-10-03T00:00:00Z",
    decisionNote: "Covered by children’s lending.",
  }),
  idea("Hearing loop", {
    status: "accepted",
    decidedAt: "2026-09-02T00:00:00Z",
  }),
  idea("Private draft", { publicationStatus: "pending" }),
]
function Board() {
  const [filter, setFilter] =
    useState<Parameters<typeof SuggestionsBoard>[0]["filter"]>("all")

  return createElement(SuggestionsBoard, {
    items: ITEMS,
    filter,
    onFilterChange: setFilter,
    onVote: async () => null,
    busyId: null,
    error: null,
    signedIn: false,
    optionNames: {
      accessibility: [],
      services: [],
      amenities: [],
      library_types: [],
    },
    now: new Date("2026-10-06T12:00:00Z"),
  })
}
const cardNames = () =>
  screen
    .getAllByRole("article")
    .map((card) => within(card).getByRole("heading", { level: 3 }).textContent)
describe("suggestion board", () => {
  it("separates open votes from decision archives and never includes private intake", () => {
    render(createElement(Board))
    expect(cardNames()).toEqual(["Quiet room", "Seed library", "Tool lending"])
    expect(screen.getByText("Decided in October 2026")).toBeTruthy()
    expect(screen.getByText("Covered by children’s lending.")).toBeTruthy()
    expect(screen.queryByText("Private draft")).toBeNull()
  })
  it("shows counts in category filters and sorts open ideas by newest", () => {
    render(createElement(Board))
    const group = screen.getByRole("group", { name: "Filter by list" })
    const services = within(group).getByRole("button", { name: /Services 2/ })
    fireEvent.click(services)
    expect(services.getAttribute("aria-pressed")).toBe("true")
    expect(cardNames()).toEqual(["Seed library", "Tool lending"])
    fireEvent.change(screen.getByRole("combobox", { name: "Sort" }), {
      target: { value: "new" },
    })
    fireEvent.click(within(group).getByRole("button", { name: /All 3/ }))
    expect(cardNames()).toEqual(["Seed library", "Quiet room", "Tool lending"])
  })
  it("shows a category-specific empty state", () => {
    render(createElement(Board))
    fireEvent.click(screen.getByRole("button", { name: /Library types 0/ }))
    expect(
      screen.getByRole("heading", {
        name: "No Library types ideas are open for voting",
      })
    ).toBeTruthy()
  })
  it("sends signed-out voters to sign in while final decisions have no vote button", () => {
    render(createElement(Board))
    expect(
      screen
        .getByRole("link", { name: "Sign in to vote for Quiet room, 36 votes" })
        .getAttribute("href")
    ).toBe(
      `/auth/signin?callbackUrl=${encodeURIComponent("/community/suggestions")}`
    )
    expect(
      screen.queryByRole("button", { name: /Voting closed for Toy library/ })
    ).toBeNull()
  })
})
