import { createRequire } from "node:module"

import { expect, it } from "vitest"

const { sourcePlan } = createRequire(import.meta.url)(
  "../database/migrations/shared/library-sources"
)

it("fills a matching import's missing URL without changing its ID or date", () => {
  const record = {
    dataset: "imls",
    record_id: "KEEP",
    retrieved_at: "2025-01-01",
    url: null,
  }
  expect(
    sourcePlan({ source: "imls", source_url: "https://imls.gov" }, [record])
  ).toEqual([{ ...record, url: "https://imls.gov", role: "origin" }])
})
it("keeps a conflicting URL and every secondary dataset", () => {
  const records = [
    { dataset: "a", record_id: "1", url: "https://one.test" },
    { dataset: "b", record_id: "2", url: "https://two.test" },
  ]
  const plan = sourcePlan(
    { source: "a", source_url: "https://other.test" },
    records
  )
  expect(plan.slice(0, 2)).toEqual(
    records.map((r) => ({ ...r, role: "reference" }))
  )
  expect(plan[2]).toMatchObject({
    dataset: "a",
    url: "https://other.test",
    role: "origin",
    record_id: null,
  })
  expect(
    sourcePlan({ source: "a", source_url: "https://other.test" }, plan)
  ).toEqual(plan)
})
