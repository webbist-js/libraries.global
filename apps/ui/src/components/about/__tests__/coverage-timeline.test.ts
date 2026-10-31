import { expect, it } from "vitest"

import {
  COVERAGE_ROW_PAUSE,
  coverageFrame,
  coverageTimeline,
} from "../coverage-timeline"

it("never races continents and leaves a settling beat between them", () => {
  const plan = coverageTimeline([
    { total: 100, countries: [40, 60] },
    { total: 20, countries: [20] },
  ])
  expect(plan[1]!.start - plan[0]!.end).toBe(COVERAGE_ROW_PAUSE)
  for (let time = 0; time < plan[1]!.end + 100; time += 17) {
    expect(
      plan.filter((row) => coverageFrame(row, time).state === "active").length
    ).toBeLessThanOrEqual(1)
  }
})
it("adds the same displayed country counts into each total, without overshoot", () => {
  const row = coverageTimeline([
    { total: 1000, countries: [600, 300, 100] },
  ])[0]!
  let previous = 0
  for (let time = 0; time <= row.end; time += 11) {
    const sample = coverageFrame(row, time)
    expect(sample.total).toBe(
      sample.countries.reduce((sum, country) => sum + country.value, 0)
    )
    expect(sample.total).toBeGreaterThanOrEqual(previous)
    expect(sample.total).toBeLessThanOrEqual(1000)
    expect(
      sample.countries.filter(
        (country) => country.progress > 0 && country.progress < 1
      ).length
    ).toBeLessThanOrEqual(1)
    previous = sample.total
  }
  expect(coverageFrame(row, row.end).total).toBe(1000)
  expect(
    coverageFrame(row, row.end).countries.map((country) => country.value)
  ).toEqual([600, 300, 100])
})
it("retains the published total when a country breakdown is partial or absent", () => {
  for (const countries of [[60], []]) {
    const row = coverageTimeline([{ total: 100, countries }])[0]!
    expect(coverageFrame(row, row.end).total).toBe(100)
  }
  expect(
    coverageTimeline([
      { total: 0, countries: [] },
      { total: 20, countries: [30] },
    ])
  ).toEqual([])
})
