import { describe, expect, it } from "vitest"

import {
  nextBoardReview,
  relativeAge,
  sortSuggestions,
  type PublicSuggestion,
} from "../suggestions"

function suggestion(
  overrides: Partial<PublicSuggestion> & { documentId: string }
): PublicSuggestion {
  return {
    documentId: overrides.documentId,
    name: overrides.name ?? "Braille signage",
    optionKey: overrides.optionKey ?? "accessibility",
    status: overrides.status ?? "open",
    votes: overrides.votes ?? 0,
    description: overrides.description ?? null,
    suggestedByName: overrides.suggestedByName ?? null,
    createdAt: overrides.createdAt ?? "2026-01-01T00:00:00.000Z",
    decidedAt: overrides.decidedAt ?? null,
    decisionNote: overrides.decisionNote ?? null,
    libraryCount: overrides.libraryCount ?? 1,
    ...(overrides.voted !== undefined ? { voted: overrides.voted } : {}),
  }
}

describe("sortSuggestions", () => {
  it("top: puts declined last, then orders by votes descending", () => {
    const list = [
      suggestion({ documentId: "a", name: "Low votes", votes: 2 }),
      suggestion({
        documentId: "b",
        name: "Declined but popular",
        votes: 100,
        status: "declined",
      }),
      suggestion({ documentId: "c", name: "High votes", votes: 10 }),
    ]

    expect(sortSuggestions(list, "top").map((s) => s.documentId)).toEqual([
      "c",
      "a",
      "b",
    ])
  })

  it("top: breaks a votes tie by age, then stable identity", () => {
    const list = [
      suggestion({
        documentId: "a",
        name: "Zebra crossing",
        votes: 5,
        createdAt: "2026-01-02T00:00:00.000Z",
      }),
      suggestion({ documentId: "b", name: "Audio loop", votes: 5 }),
    ]

    expect(sortSuggestions(list, "top").map((s) => s.documentId)).toEqual([
      "b",
      "a",
    ])
  })

  it("new: orders by createdAt descending", () => {
    const list = [
      suggestion({
        documentId: "a",
        createdAt: "2026-01-01T00:00:00.000Z",
      }),
      suggestion({
        documentId: "b",
        createdAt: "2026-03-01T00:00:00.000Z",
      }),
      suggestion({
        documentId: "c",
        createdAt: "2026-02-01T00:00:00.000Z",
      }),
    ]

    expect(sortSuggestions(list, "new").map((s) => s.documentId)).toEqual([
      "b",
      "c",
      "a",
    ])
  })

  it("does not mutate the input array", () => {
    const list = [
      suggestion({ documentId: "a", votes: 1 }),
      suggestion({ documentId: "b", votes: 2 }),
    ]
    sortSuggestions(list, "top")
    expect(list.map((s) => s.documentId)).toEqual(["a", "b"])
  })
})

describe("nextBoardReview", () => {
  it("2026-10-05 (Monday) -> 2026-10-06 (this month's first Tuesday)", () => {
    const result = nextBoardReview(new Date(2026, 9, 5))
    expect(result.getFullYear()).toBe(2026)
    expect(result.getMonth()).toBe(9)
    expect(result.getDate()).toBe(6)
  })

  it("2026-10-06 (the review day itself) -> 2026-10-06", () => {
    const result = nextBoardReview(new Date(2026, 9, 6))
    expect(result.getFullYear()).toBe(2026)
    expect(result.getMonth()).toBe(9)
    expect(result.getDate()).toBe(6)
  })

  it("2026-10-07 (day after review) -> 2026-11-03 (next month's first Tuesday)", () => {
    const result = nextBoardReview(new Date(2026, 9, 7))
    expect(result.getFullYear()).toBe(2026)
    expect(result.getMonth()).toBe(10)
    expect(result.getDate()).toBe(3)
  })

  it("2026-12-02 -> 2027-01-05 (rolls into the next year)", () => {
    const result = nextBoardReview(new Date(2026, 11, 2))
    expect(result.getFullYear()).toBe(2027)
    expect(result.getMonth()).toBe(0)
    expect(result.getDate()).toBe(5)
  })
})

describe("relativeAge", () => {
  const now = new Date("2026-10-05T12:00:00.000Z")

  it("just now for a moment ago", () => {
    expect(relativeAge("2026-10-05T11:59:45.000Z", now)).toBe("just now")
  })

  it("5 days ago", () => {
    expect(relativeAge("2026-09-30T12:00:00.000Z", now)).toBe("5 days ago")
  })

  it("3 weeks ago", () => {
    expect(relativeAge("2026-09-14T12:00:00.000Z", now)).toBe("3 weeks ago")
  })

  it("2 months ago", () => {
    expect(relativeAge("2026-08-06T12:00:00.000Z", now)).toBe("2 months ago")
  })
})
