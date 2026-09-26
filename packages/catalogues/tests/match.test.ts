import { describe, expect, it } from "vitest"

import {
  branchSimilarity,
  matchBranch,
  normaliseBranchName,
} from "../src/match"

const libs = [
  { id: 1, name: "Airyhall Library" },
  { id: 2, name: "Aberdeen Central Library" },
  { id: 3, name: "Bridge of Don Library" },
  { id: 4, name: "Kensington Central Library" },
  { id: 5, name: "Cove Bay Library" },
]
const nameOf = (l: { name: string }) => l.name

describe("normaliseBranchName", () => {
  it("drops shelf suffixes and punctuation", () => {
    expect(
      normaliseBranchName(
        "Kensington Central Library - F9 - Children's Library"
      )
    ).toBe("kensington central library")
    expect(normaliseBranchName("St. John’s Wood & Maida Vale")).toBe(
      "st john s wood and maida vale"
    )
  })
})

describe("matchBranch", () => {
  it("is confident on identical significant tokens", () => {
    expect(matchBranch("Airyhall", libs, nameOf)).toMatchObject({
      candidate: { id: 1 },
      status: "confident",
    })
    expect(
      matchBranch("Bridge of Don Library", libs, nameOf).candidate?.id
    ).toBe(3)
  })

  it("strips Aspen-style shelf locations", () => {
    expect(
      matchBranch(
        "Kensington Central Library - FAN - Adult lending",
        libs,
        nameOf
      ).candidate?.id
    ).toBe(4)
  })

  it("sends partial matches to review rather than auto-linking", () => {
    expect(
      matchBranch("Central Lending Library", libs, nameOf).status
    ).not.toBe("confident")
    expect(matchBranch("Cove Library", libs, nameOf).status).toBe("review")
  })

  it("returns none for unrelated names", () => {
    expect(matchBranch("Bolinda BorrowBox", libs, nameOf)).toMatchObject({
      candidate: null,
      status: "none",
    })
    expect(matchBranch("Mobile Library", libs, nameOf).status).toBe("none")
  })

  it("doesn't pair look-alike names with no word in common", () => {
    const glasgow = [
      { id: 1, name: "Greenhill Community Library" },
      { id: 2, name: "Coatbridge Library" },
    ]
    expect(matchBranch("Govanhill Library", glasgow, nameOf).status).toBe(
      "none"
    )
    expect(matchBranch("Library at the Bridge", glasgow, nameOf).status).toBe(
      "none"
    )
    expect(matchBranch("Airyhal Library", libs, nameOf).candidate?.id).toBe(1)
  })

  it("scores symmetric-ish", () => {
    expect(branchSimilarity("Airyhall Library", "Airyhall")).toBe(1)
  })
})
