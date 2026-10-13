import { expect, it, vi } from "vitest"

import {
  buildLibraryRecordData,
  changedFields,
} from "../../src/plugins/content-moderation/server/utils/library-record"
import { applyToPublished } from "../../src/plugins/content-moderation/server/utils/publish-guard"

const uid = "api::library.library"
const origin = {
  dataset: "imls",
  recordId: "KEEP",
  role: "origin",
  url: "https://imls.gov",
}
const addition = { role: "reference", url: "https://library.example/hours" }

it("retains both references when two PostgreSQL approvals overlap", async () => {
  let saved = { sourceRecords: [origin] as any[] }
  let lock = Promise.resolve()
  const docs = {
    findOne: vi.fn(async () => structuredClone(saved)),
    update: vi.fn(async ({ data }) => {
      saved = structuredClone(data)
    }),
  }
  const strapi = {
    documents: () => docs,
    db: {
      dialect: { client: "pg" },
      transaction: async (callback: (tx: any) => Promise<unknown>) => {
        let release = () => {}
        try {
          return await callback({
            trx: {
              raw: async () => {
                const previous = lock
                lock = new Promise<void>((resolve) => {
                  release = resolve
                })
                await previous
              },
            },
          })
        } finally {
          release()
        }
      },
    },
  }
  const other = { role: "reference", url: "https://library.example/access" }
  await Promise.all([
    applyToPublished(
      strapi,
      uid,
      "library",
      { sourceRecords: [addition] },
      { fields: [] }
    ),
    applyToPublished(
      strapi,
      uid,
      "library",
      { sourceRecords: [other] },
      { fields: [] }
    ),
  ])
  expect(saved.sourceRecords).toEqual([
    expect.objectContaining(origin),
    addition,
    other,
  ])
})

it("appends an approved reference without losing an import identity", async () => {
  const docs = {
    findOne: vi.fn().mockResolvedValue({
      documentId: "library",
      name: "Library",
      sourceRecords: [origin],
    }),
    update: vi.fn(),
  }
  const strapi = { documents: () => docs, log: { info: vi.fn() } }
  expect(
    await applyToPublished(
      strapi,
      uid,
      "library",
      { sourceRecords: [addition] },
      { fields: ["name"] }
    )
  ).toEqual({ mode: "published" })
  expect(docs.update.mock.calls[0][0].data.sourceRecords).toEqual([
    expect.objectContaining(origin),
    addition,
  ])
})
it("keeps unpublished citations unpublished and appends to that draft only", async () => {
  const privateDraft = { role: "reference", url: "https://draft.example" }
  const docs = {
    findOne: vi
      .fn()
      .mockResolvedValueOnce({
        name: "Library",
        sourceRecords: [{ id: 1, ...origin }],
      })
      .mockResolvedValueOnce({
        name: "Library",
        sourceRecords: [{ id: 2, ...origin }, privateDraft],
      }),
    update: vi.fn(),
  }
  const strapi = { documents: () => docs, log: { info: vi.fn() } }
  expect(
    await applyToPublished(
      strapi,
      uid,
      "library",
      { sourceRecords: [addition] },
      { fields: ["name"] }
    )
  ).toEqual({ mode: "draft_only", divergentKeys: ["sourceRecords"] })
  expect(docs.update.mock.calls[0][0]).toMatchObject({
    status: "draft",
    data: {
      sourceRecords: [
        expect.objectContaining(origin),
        expect.objectContaining(privateDraft),
        addition,
      ],
    },
  })
})
it("ignores component IDs in publication comparison and duplicate references in scoring", async () => {
  const docs = {
    findOne: vi
      .fn()
      .mockResolvedValueOnce({ sourceRecords: [{ id: 1, ...origin }] })
      .mockResolvedValueOnce({ sourceRecords: [{ id: 2, ...origin }] }),
    update: vi.fn(),
  }
  expect(
    await applyToPublished(
      { documents: () => docs },
      uid,
      "library",
      { name: "New" },
      { fields: [] }
    )
  ).toEqual({ mode: "published" })
  expect(
    changedFields(
      { sourceRecords: [addition] },
      { sourceRecords: [origin, addition] }
    )
  ).toEqual([])
  expect(
    buildLibraryRecordData({
      source: "overwrite",
      sourceUrl: "https://bad.test",
      sourceRecords: [{ ...addition, dataset: "fake", recordId: "fake" }],
    })
  ).toEqual({
    sourceRecords: [
      { ...addition, url: "https://library.example/hours", fields: undefined },
    ],
  })
})
