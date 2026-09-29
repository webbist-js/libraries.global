import { describe, expect, it } from "vitest"

import { ACTION_GROUPS, ACTIONS } from "../actions"
import {
  isHandoff,
  STEP_HINTS,
  STEP_LABELS,
  STEP_TITLES,
} from "../wizard.logic"

describe("hub actions", () => {
  it("puts every action in a known group, index edits first", () => {
    const groups = new Set(ACTION_GROUPS.map((g) => g.id))
    for (const a of ACTIONS) expect(groups.has(a.group)).toBe(true)
    expect(ACTIONS.filter((a) => a.group === "index").map((a) => a.id)).toEqual(
      ["add", "correction", "photo", "source"]
    )
    expect(ACTIONS.filter((a) => a.group === "write").map((a) => a.id)).toEqual(
      ["journal", "knowledge"]
    )
  })

  it("gives every action a tip and three labelled, hinted, titled steps", () => {
    for (const a of ACTIONS) {
      expect(a.tip.trim()).not.toBe("")
      for (const map of [STEP_LABELS, STEP_HINTS, STEP_TITLES]) {
        expect(map[a.id]).toHaveLength(3)
        for (const text of map[a.id]) expect(text.trim()).not.toBe("")
      }
    }
  })

  it("sends every handoff action somewhere, and only those", () => {
    for (const a of ACTIONS) {
      expect(Boolean(a.handoff)).toBe(isHandoff(a.id))
      if (a.handoff) expect(a.handoff.href).toMatch(/^\/contribute\//)
    }
  })
})
