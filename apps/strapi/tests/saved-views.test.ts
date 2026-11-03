import { describe, expect, it } from "vitest"

import {
  normaliseSavedQuery,
  savedLimitOf,
  savedViewInput,
} from "../src/utils/saved-views"

describe("saved views", () => {
  it("keeps a page's URL state without empty values", () => {
    expect(normaliseSavedQuery("?q=leeds&type=&view=map")).toBe(
      "q=leeds&view=map"
    )
    expect(normaliseSavedQuery("")).toBe("")
    expect(normaliseSavedQuery(42)).toBeNull()
    expect(normaliseSavedQuery(`q=${"x".repeat(5000)}`)).toBeNull()
  })

  it("accepts a named view or search and rejects anything else", () => {
    expect(
      savedViewInput({
        kind: "search",
        name: "  Leeds   libraries ",
        query: "q=leeds",
      })
    ).toEqual({ kind: "search", name: "Leeds libraries", query: "q=leeds" })
    expect(savedViewInput({ kind: "view", name: "", query: "" })).toBeNull()
    expect(savedViewInput({ kind: "map", name: "x", query: "" })).toBeNull()
    expect(
      savedViewInput({ kind: "view", name: "x".repeat(81), query: "" })
    ).toBeNull()
  })

  it("reads the plan limit Next sends, capped and never negative", () => {
    expect(savedLimitOf("3")).toBe(3)
    expect(savedLimitOf("5000")).toBe(1000)
    expect(savedLimitOf("-1")).toBe(0)
    expect(savedLimitOf(undefined)).toBe(0)
    expect(savedLimitOf("2.5")).toBe(0)
  })
})
