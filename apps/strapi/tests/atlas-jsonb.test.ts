import { expect, it } from "vitest"

import {
  atlasArchivePage,
  atlasChanges,
  atlasExportJournal,
} from "../src/utils/atlas-read-store"

const projection = {
  atlas_id: 1,
  documentId: "library",
  name: "Library",
  slug: "library",
  longitude: 0,
  latitude: 1,
  type_group: "public",
  operator_group: "council",
  status: "open",
  access_codes: [],
  facility_codes: [],
}
function database() {
  const state = {
    indexed_through: "2",
    projection_revision: "2",
    journal_floor: "0",
    query_epoch: "epoch",
    dictionary: JSON.stringify({ version: "dictionary", entries: [] }),
    manifest: JSON.stringify({
      buildId: "build",
      builtAgainstQueryEpoch: "epoch",
      sourceStartRevision: "0",
      sourceEndRevision: "1",
    }),
  }
  const db: any = (table: string) => {
    const chain: any = {
      first: async () => (table === "atlas_state" ? state : null),
      pluck: async () => ["library"],
      select: async () =>
        table === "atlas_records"
          ? [{ atlas_id: 1, projection: JSON.stringify(projection) }]
          : [
              {
                document_id: "library",
                old_projection: null,
                new_projection: JSON.stringify(projection),
              },
            ],
    }
    for (const method of [
      "where",
      "whereBetween",
      "whereIn",
      "whereNull",
      "groupBy",
      "orderBy",
      "limit",
      "distinctOn",
    ])
      chain[method] = () => chain

    return chain
  }
  db.transaction = async (job: any) => job(db)
  db.raw = async () => {}

  return db
}

it("returns archive point features from Strapi's text JSONB projections", async () => {
  const result = await atlasArchivePage(database(), 0, 10, 200)
  expect(result.points[0]).toMatchObject({
    id: 1,
    geometry: { coordinates: [0, 1] },
    properties: { i: "library", n: "Library" },
  })
})

it("decodes manifest and journal projections for change patches", async () => {
  const result = await atlasChanges(database(), {
    buildId: "build",
    since: "0",
    bbox: { west: -10, east: 10, south: -10, north: 10 },
  })
  expect(result.status).toBe("complete")
  if (result.status === "complete") {
    expect(result.upserts[0]?.properties.i).toBe("library")
    expect(result.removedIds).toEqual([])
  }
})

it("returns object journal states after validating a text JSONB dictionary", async () => {
  const result = await atlasExportJournal(database(), {
    since: "0",
    through: "2",
    queryEpoch: "epoch",
    dictionaryVersion: "dictionary",
  })
  expect(result).toMatchObject({
    stable: true,
    changes: [
      { old_projection: null, new_projection: { documentId: "library" } },
    ],
  })
})
