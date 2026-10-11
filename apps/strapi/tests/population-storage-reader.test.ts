import { createRequire } from "node:module"

import { describe, expect, it } from "vitest"

const requireLocal = createRequire(import.meta.url)
const { readPopulationEstimates } = requireLocal(
  "../database/migrations/shared/population-storage.js"
)

function catalogue(rows: Record<string, unknown>[]) {
  return () => {
    let selected = [...rows]
    const query = {
      where(
        field: string | Record<string, unknown>,
        operator?: string,
        value?: unknown
      ) {
        selected = selected.filter((row) =>
          typeof field === "object"
            ? Object.entries(field).every(
                ([key, expected]) => row[key] === expected
              )
            : operator === ">" && Number(row[field]) > Number(value)
        )

        return query
      },
      whereNotNull(field: string) {
        selected = selected.filter((row) => row[field] != null)

        return query
      },
      select(..._fields: string[]) {
        return query
      },
      orderBy(field: string) {
        selected.sort((a, b) => Number(a[field]) - Number(b[field]))

        return query
      },
      limit(count: number) {
        return Promise.resolve(selected.slice(0, count))
      },
    }

    return query
  }
}

const observation = (key: string) => ({
  key,
  level: "area",
  reportingCode: key,
  iso2: "GB",
  name: key,
  population: 1000,
  year: 2024,
  source: "ONS",
  sourceUrl: "https://www.ons.gov.uk/",
  licence: "OGL v3.0",
  retrievedAt: "2026-10-11T00:00:00.000Z",
  method: "direct",
})
const place = (id: number, estimate: unknown) => ({
  id,
  locale: "en",
  published_at: "2026-10-11",
  population_estimates: [estimate],
})

describe("population catalogue reader", () => {
  it("reads matching observations after more than 1,024 unrelated published places", async () => {
    const rows = Array.from({ length: 1300 }, (_, i) =>
      place(i + 1, observation(`other:${i}`))
    )
    rows.push(place(1500, observation("ons:area:last")))
    const result = await readPopulationEstimates(
      catalogue(rows),
      ["areas"],
      (row: any) => row.key.startsWith("ons:area:")
    )
    expect(result.map((row: any) => row.key)).toEqual(["ons:area:last"])
  })
  it("keeps published English observations and deduplicates identical estimates across pages", async () => {
    const estimate = observation("ons:area:shared")
    const rows = Array.from({ length: 1030 }, (_, i) => place(i + 1, estimate))
    rows.push(
      { ...place(2000, observation("draft")), published_at: null },
      { ...place(2001, observation("french")), locale: "fr" }
    )
    expect(
      await readPopulationEstimates(catalogue(rows), ["areas"], () => true)
    ).toHaveLength(1)
  })
  it("rejects conflicting estimates even when the conflict is on a later page", async () => {
    const estimate = observation("ons:area:shared")
    const rows = Array.from({ length: 1030 }, (_, i) => place(i + 1, estimate))
    rows.push(place(2000, { ...estimate, population: 2000 }))
    await expect(
      readPopulationEstimates(catalogue(rows), ["areas"], () => true)
    ).rejects.toThrow("Conflicting population estimate")
  })
})
