import { describe, expect, it } from "vitest"

import { stepProgress } from "./wizard.progress"
import { EMPTY_FORM, type FormData } from "./wizard.types"

const doneSteps = (f: FormData, improving = false) =>
  stepProgress(f, improving)
    .filter((s) => s.done)
    .map((s) => s.n)

describe("stepProgress", () => {
  it("marks Identity, Location and Sources required, the rest optional", () => {
    expect(
      stepProgress(EMPTY_FORM, false)
        .filter((s) => s.required)
        .map((s) => s.n)
    ).toEqual([1, 2, 7])
  })

  it("ticks nothing on an empty form", () => {
    expect(doneSteps(EMPTY_FORM)).toEqual([])
  })

  it("ticks a required step only once every required field is filled", () => {
    const partial = { ...EMPTY_FORM, name: "Radlett Library", city: "Radlett" }
    expect(doneSteps(partial)).toEqual([])

    const identity = {
      ...partial,
      libraryType: "Public",
      operationalStatus: "open",
      country: "  ",
    }
    expect(doneSteps(identity)).toEqual([1])
  })

  it("needs a summary on the Sources step only when improving", () => {
    const sourced = {
      ...EMPTY_FORM,
      evidenceType: "institutional_url",
      evidenceUrl: "https://example.org",
    }
    expect(doneSteps(sourced, false)).toEqual([7])
    expect(doneSteps(sourced, true)).toEqual([])
    expect(doneSteps({ ...sourced, editSummary: "New hours" }, true)).toEqual([
      7,
    ])
  })

  it("ticks Visit for a link, hours or visiting notes", () => {
    expect(doneSteps({ ...EMPTY_FORM, website: "https://x.org" })).toEqual([3])
    expect(doneSteps({ ...EMPTY_FORM, visitNotes: "Ring the bell" })).toEqual([
      3,
    ])
    const days = EMPTY_FORM.openingTimes.days.map((d, i) =>
      i === 0
        ? {
            ...d,
            enabled: true,
            timeframes: [
              {
                id: "a",
                startTime: "09:00",
                endTime: "17:00",
                staffing: "staffed" as const,
              },
            ],
          }
        : d
    )
    expect(
      doneSteps({
        ...EMPTY_FORM,
        openingTimes: { ...EMPTY_FORM.openingTimes, days },
      })
    ).toEqual([3])
  })

  it("ticks Collections, History and Photo from their main field", () => {
    expect(
      doneSteps({
        ...EMPTY_FORM,
        collectionSize: "2.4 million volumes",
        foundedYear: "1753",
        uploadedImages: [{ strapiId: 1, url: "/uploads/a.jpg", isHero: true }],
      })
    ).toEqual([4, 5, 6])
  })
})
