import { describe, expect, it } from "vitest"

import {
  type CorrectionRecord,
  describeChanges,
  editorFor,
  hasRecordChange,
  recordChanges,
  toCorrectionRecord,
} from "../correction.logic"
import { buildSubmission, EMPTY_DRAFT } from "../wizard.logic"

const LIFT = "acc00000000000000000001"
const LOOP = "acc00000000000000000002"

const record: CorrectionRecord = toCorrectionRecord({
  documentId: "lib00000000000000000001",
  name: "Nailsea Library",
  city: "Nailsea",
  website: "https://old.example.org",
  operationalStatus: "open",
  openingTimes: {
    version: 1,
    days: [
      {
        day: "monday",
        enabled: true,
        timeframes: [
          {
            id: "x",
            startTime: "09:00",
            endTime: "17:00",
            staffing: "staffed",
          },
        ],
      },
    ],
  },
  accessibility: [{ documentId: LOOP, name: "Hearing loop" }],
})

describe("editorFor", () => {
  it("opens a structured editor for record fields, text for the rest", () => {
    expect(editorFor("Opening hours")).toBe("hours")
    expect(editorFor("Accessibility")).toBe("accessibility")
    expect(editorFor("Services and facilities")).toBe("facilities")
    expect(editorFor("Collections")).toBe("text")
    expect(editorFor("Something else")).toBe("text")
  })
})

describe("recordChanges", () => {
  it("sends nothing until something differs, ignoring timeframe ids", () => {
    const same = structuredClone(record.openingTimes!)
    same.days[0]!.timeframes[0]!.id = "different"
    const c = recordChanges("Opening hours", record, { openingTimes: same })
    expect(hasRecordChange(c)).toBe(false)
  })

  it("sends the full week of hours when a day changes", () => {
    const hours = structuredClone(record.openingTimes!)
    hours.days[0]!.timeframes[0]!.endTime = "19:00"
    const c = recordChanges("Opening hours", record, { openingTimes: hours })
    const sent = c.changes.openingTimes as { days: { day: string }[] }
    expect(sent.days).toHaveLength(7)
    expect(sent.days[0]).toMatchObject({ day: "monday" })
  })

  it("turns ticked options into connect and disconnect, plus new names", () => {
    const c = recordChanges("Accessibility", record, {
      accessibility: [LIFT],
      suggested: { accessibility: [" Quiet room "] },
    })
    expect(c.changes).toEqual({
      accessibility: { connect: [LIFT], disconnect: [LOOP] },
    })
    expect(c.suggestedOptions).toEqual({ accessibility: ["Quiet room"] })
    expect(
      describeChanges(c, { [LIFT]: "Lift", [LOOP]: "Hearing loop" })
    ).toEqual(["Add: Lift", "Remove: Hearing loop", "New option: Quiet room"])
  })

  it("only sends this category's fields, and never an empty name", () => {
    const c = recordChanges("Website or catalogue", record, {
      website: " https://new.example.org ",
      name: "Sneaky rename",
    })
    expect(c.changes).toEqual({ website: "https://new.example.org" })
    expect(recordChanges("Name", record, { name: "  " }).changes).toEqual({})
  })
})

describe("buildSubmission for a structured correction", () => {
  it("sends a record correction with the source as evidence, not a field", () => {
    const library = { slug: "nailsea-library", name: "Nailsea Library" }
    const changes = recordChanges("Website or catalogue", record, {
      website: "https://new.example.org",
    })
    const body = buildSubmission(
      "correction",
      library,
      {
        ...EMPTY_DRAFT,
        category: "Website or catalogue",
        text: "They moved",
        source: "https://council.example.gov.uk/libraries",
      },
      changes
    )
    expect(body.fields).toEqual({
      kind: "record",
      category: "Website or catalogue",
      libraryName: "Nailsea Library",
      website: "https://new.example.org",
      previous: { website: "https://old.example.org" },
    })
    expect(body.fields).not.toHaveProperty("sourceUrl")
    expect(body.evidenceUrl).toBe("https://council.example.gov.uk/libraries")
    expect(body.note).toBe("They moved")
  })

  it("keeps a written reference in the note", () => {
    const body = buildSubmission(
      "correction",
      { slug: "x", name: "X" },
      { ...EMPTY_DRAFT, category: "Name", source: "The sign outside" },
      recordChanges("Name", record, { name: "Nailsea Community Library" })
    )
    expect(body.note).toBe("Source: The sign outside")
    expect(body.evidenceUrl).toBeUndefined()
  })
})
