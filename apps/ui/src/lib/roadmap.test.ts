import { describe, expect, it } from "vitest"

import {
  activityAge,
  filterFeatures,
  importProgress,
  normaliseRoadmap,
  usedAreas,
} from "./roadmap"

const raw = {
  title: "Roadmap",
  features: [
    {
      key: "save-views",
      title: "Save views and searches",
      description: "Keep an Atlas view.",
      stage: "now",
      area: "atlas",
      plans: [
        { plan: "free", detail: "3 saved" },
        { plan: "contributor", detail: "unlimited" },
        { plan: "nonsense" },
      ],
      noteKind: "target",
      note: "Aiming for December",
    },
    { key: "broken", title: "No stage", area: "atlas" },
    {
      key: "embed",
      title: "Embeddable library finder",
      stage: "later",
      area: "widgets",
      plans: [{ plan: "staff" }],
    },
  ],
  dataImports: [
    {
      key: "germany",
      place: "Germany",
      code: "de",
      source: "Deutsche Bibliotheksstatistik",
      fields: [{ text: "Opening hours" }, { text: "" }],
      libraries: -1,
      stage: "validating",
    },
    {
      key: "old-stage",
      place: "Spain",
      code: "ES",
      source: "Directorio",
      stage: "matching",
    },
  ],
}

describe("roadmap content", () => {
  it("keeps well-formed items and drops malformed ones", () => {
    const content = normaliseRoadmap(raw)!
    expect(content.features.map((f) => f.key)).toEqual(["save-views", "embed"])
    expect(content.features[0]!.plans).toEqual([
      { plan: "free", detail: "3 saved" },
      { plan: "contributor", detail: "unlimited" },
    ])
    expect(content.dataImports[0]).toMatchObject({
      code: "DE",
      fields: ["Opening hours"],
      libraries: null,
      stage: "validating",
    })
    expect(content.dataImports).toHaveLength(1)
    expect(normaliseRoadmap({ features: [] })).toBeNull()
  })

  it("filters by area and by plan", () => {
    const { features } = normaliseRoadmap(raw)!
    expect(usedAreas(features)).toEqual(["atlas", "widgets"])
    expect(
      filterFeatures(features, { area: "widgets", plan: "any" }).map(
        (f) => f.key
      )
    ).toEqual(["embed"])
    expect(
      filterFeatures(features, { area: "all", plan: "free" }).map((f) => f.key)
    ).toEqual(["save-views"])
  })

  it("measures import progress and recent activity", () => {
    expect(importProgress("listed")).toEqual({ done: 0, current: null })
    expect(importProgress("exploring")).toEqual({ done: 0, current: 0 })
    expect(importProgress("licensing")).toEqual({ done: 2, current: 2 })
    expect(importProgress("ingesting")).toEqual({ done: 3, current: 3 })
    expect(importProgress("ingested")).toEqual({ done: 4, current: null })
    const now = new Date(2026, 10, 2, 15).getTime()
    expect(activityAge(new Date(2026, 10, 2, 1).toISOString(), now)).toBe(0)
    expect(activityAge(new Date(2026, 10, 1, 23).toISOString(), now)).toBe(1)
    expect(activityAge(new Date(2026, 8, 1).toISOString(), now)).toBeNull()
    expect(activityAge(null, now)).toBeNull()
  })
})
