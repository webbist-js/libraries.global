import { expect, it } from "vitest"

import { boundedLibraryQuery } from "../library-query"

it.each([
  { filters: { name: { $containsi: "town" } } },
  { filters: { country: { users: { id: 1 } } } },
  { filters: { $or: Array.from({ length: 11 }, () => ({ id: 1 })) } },
  { filters: { id: { $in: Array.from({ length: 101 }, (_, i) => i) } } },
  { sort: "random()" },
  { pagination: { pageSize: 101 } },
  { pagination: { page: 202, pageSize: 100 } },
  { pagination: { limit: -1 } },
  { pagination: { pageSize: 1, limit: 99999 } },
  { pagination: { start: "NaN" } },
  { locale: "all" },
])("rejects unbounded or non-indexed catalogue queries", (input) => {
  expect(() => boundedLibraryQuery(input)).toThrow("invalid_library_query")
})
it("preserves bounded lookups and supplies a default page limit", () => {
  expect(
    boundedLibraryQuery({
      filters: { documentId: { $in: ["a", "b"] } },
      sort: "name:asc",
      locale: "en",
    })
  ).toMatchObject({ pagination: { pageSize: 100 } })
})
