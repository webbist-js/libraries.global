import { describe, expect, it } from "vitest"

import { makeFakeStrapi } from "./helpers/fake-strapi"
import { communityWeek } from "../src/utils/weekly-community-report"

const LIBRARY = "api::library.library"
const LIBRARY_CHANGE = "api::library-change.library-change"

const start = new Date("2026-11-02T00:00:00.000Z")
const end = new Date("2026-11-09T00:00:00.000Z")
const during = "2026-11-04T10:00:00.000Z"

const library = (documentId: string, publishedAt: string | null = during) => ({
  documentId,
  locale: "en",
  name: documentId,
  publishedAt,
})

let id = 0
const change = (libraryDocumentId: string, row: Record<string, unknown>) => ({
  id: ++id,
  documentId: `change${id}`,
  batchId: `batch-${libraryDocumentId}-${id}`,
  libraryDocumentId,
  versionStatus: "published",
  field: "*",
  previous: null,
  next: null,
  source: "submission",
  changedAt: during,
  ...row,
})

describe("communityWeek: newly published libraries", () => {
  it("counts first public versions this week without consulting earlier history", async () => {
    const { strapi } = makeFakeStrapi({
      [LIBRARY]: [
        library("approved"),
        library("republished"),
        library("edited"),
        library("imported"),
        library("draft", null),
      ],
      [LIBRARY_CHANGE]: [
        // An approved new library: its first publish is an `update` with a snapshot.
        change("approved", { action: "update", next: { name: "approved" } }),
        // An existing (imported) library published again with no change.
        change("republished", { action: "publish" }),
        // An existing library whose admin publish changed one field.
        change("edited", {
          action: "publish",
          field: "name",
          previous: '"Old"',
          next: '"New"',
          source: "admin",
        }),
        // Import rows never count.
        change("imported", {
          action: "update",
          next: { name: "imported" },
          source: "import",
        }),
        // A first version of a library that isn't public now.
        change("draft", { action: "publish", next: { name: "draft" } }),
        // Last week's first publish is out of the window.
        change("approved", {
          action: "publish",
          next: { name: "approved" },
          changedAt: "2026-10-28T10:00:00.000Z",
        }),
      ],
    })

    const week = await communityWeek(strapi, start, end)

    expect(week.newLibraries).toBe(1)
    expect(week.updatedLibraries).toBe(2)
    expect(week.edits).toBe(1)
  })
})
