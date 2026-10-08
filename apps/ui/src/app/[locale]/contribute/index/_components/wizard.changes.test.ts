import { emptyTimetable, timetableHash } from "@repo/shared-data"
import { describe, expect, it } from "vitest"

import {
  blocksToPlainText,
  changedFieldKeys,
  changedSteps,
  recordChangesPayload,
} from "./wizard.changes"
import { EMPTY_FORM, type FormData } from "./wizard.types"

const base: FormData = {
  ...EMPTY_FORM,
  name: "Radlett Library",
  city: "Radlett",
}

describe("changedFieldKeys", () => {
  it("lists only library fields that differ, ignoring whitespace and metadata", () => {
    const current = {
      ...base,
      name: " Radlett Library ",
      website: "https://x",
      editSummary: "Added website",
      evidenceUrl: "https://src",
    }
    expect(changedFieldKeys(base, current)).toEqual(["website"])
  })
  it("compares arrays and objects by value", () => {
    expect(changedFieldKeys(base, { ...base, services: ["a"] })).toEqual([
      "services",
    ])
    expect(
      changedFieldKeys(
        { ...base, services: ["a"] },
        { ...base, services: ["a"] }
      )
    ).toEqual([])
  })
  it("sends both coordinates when one changes", () => {
    expect(changedFieldKeys(base, { ...base, lat: "51.6" })).toEqual([
      "lat",
      "lng",
    ])
  })
})

describe("recordChangesPayload", () => {
  it("keeps the timetable before value and its separate stale-check hash", () => {
    const before = emptyTimetable("2026-10-05"),
      after = { ...before, cycle: { ...before.cycle, weeks: 2 as const } }
    const payload = recordChangesPayload(
      { ...base, libraryType: "Mobile", mobileTimetable: before },
      { ...base, libraryType: "Mobile", mobileTimetable: after }
    )
    expect(payload).toEqual({
      kind: "record",
      mobileTimetable: after,
      previous: { mobileTimetable: before },
      previousHash: timetableHash(before),
    })
  })
  it("tags the payload and keeps the values being replaced", () => {
    expect(
      recordChangesPayload(base, { ...base, city: "Watford", note: "hi" })
    ).toEqual({
      kind: "record",
      city: "Watford",
      previous: { city: "Radlett" },
    })
  })
})

describe("changedSteps", () => {
  it("maps fields to their wizard step", () => {
    expect(changedSteps(["city", "foundedYear", "services"])).toEqual([2, 3, 5])
  })
})

describe("blocksToPlainText", () => {
  it("joins paragraph text and tolerates junk", () => {
    expect(
      blocksToPlainText([
        { type: "paragraph", children: [{ type: "text", text: "One" }] },
        { type: "paragraph", children: [{ type: "text", text: "Two" }] },
        "junk",
      ])
    ).toBe("One\n\nTwo")
    expect(blocksToPlainText(null)).toBe("")
  })
})
