import { mkdtempSync, rmSync } from "node:fs"
import os from "node:os"
import path from "node:path"

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { executeDirectoryIngest } from "../../scripts/ingests/_shared/directory"

const mocks = vi.hoisted(() => ({
  areas: [] as Record<string, unknown>[],
  post: vi.fn(),
  destroy: vi.fn(),
}))

vi.mock("../../scripts/strapi-client", () => ({
  StrapiClient: class {
    post = mocks.post
    async findAll(type: string) {
      if (type === "countries")
        return [
          {
            documentId: "mexico",
            iso2: "MX",
            continent: { documentId: "north-america" },
          },
        ]
      if (type === "regions")
        return [
          {
            documentId: "state",
            name: "México",
            country: { documentId: "mexico" },
          },
        ]
      if (type === "areas") return mocks.areas

      return []
    }

    async librariesBySourceRecord() {
      return new Map()
    }
  },
}))

vi.mock("../../scripts/ingests/_shared/population", () => ({
  ingestDatabase: () =>
    Object.assign(
      () => ({
        where: () => ({
          first: mexicoIdentity,
        }),
        whereIn: selectIdentities,
      }),
      { destroy: mocks.destroy }
    ),
}))

function documentIdentity(document_id: string) {
  return { document_id }
}
async function mexicoIdentity() {
  return { document_id: "mexico", iso_2: "MX" }
}

let directory: string
beforeEach(() => {
  directory = mkdtempSync(path.join(os.tmpdir(), "directory-geography-"))
  mocks.areas = []
  mocks.post.mockClear()
  mocks.destroy.mockClear()
  vi.spyOn(console, "log").mockImplementation(() => {})
})
afterEach(() => {
  vi.restoreAllMocks()
  rmSync(directory, { recursive: true, force: true })
})

function runPreflight() {
  return executeDirectoryIngest({
    args: { "check-cms": "true" },
    directory,
    dataset: "mx-sic-rnbp",
    inputs: [],
    retrievedAt: "2026-10-24T12:00:00Z",
    sourceCount: 1,
    skipped: [],
    libraries: [
      {
        recordId: "123",
        countryCode: "MX",
        regionName: "México",
        areaName: "Emiliano Zapata",
        warnings: [],
        data: {
          name: "Example library",
          slug: "example-library-mx-123",
          libraryType: "Public",
        },
      },
    ],
  })
}

function area(id: string, region: string) {
  return {
    documentId: id,
    name: "Emiliano Zapata",
    country: { documentId: "mexico" },
    region: { documentId: region },
  }
}

describe("directory geography preflight", () => {
  it("quarantines a wrong-parent area even when its name occurs in multiple other regions", async () => {
    mocks.areas = [
      area("tabasco-area", "tabasco"),
      area("tlaxcala-area", "tlaxcala"),
    ]
    const report = await runPreflight()
    expect(report).toMatchObject({
      cmsChecked: true,
      geographyConflicts: 1,
      mapped: 0,
      skipped: 1,
      toCreate: 0,
      counts: { skipped: 1 },
    })
    expect(mocks.post).not.toHaveBeenCalled()
    expect(mocks.destroy).toHaveBeenCalledOnce()
  })
  it("chooses only a unique match under the requested parent", async () => {
    mocks.areas = [
      area("correct-area", "state"),
      area("tabasco-area", "tabasco"),
      area("tlaxcala-area", "tlaxcala"),
    ]
    const report = await runPreflight()
    expect(report).toMatchObject({
      geographyConflicts: 0,
      mapped: 1,
      toCreate: 1,
      placement: [
        {
          recordId: "123",
          country: "mexico",
          region: "state",
          area: "correct-area",
        },
      ],
    })
    expect(mocks.post).not.toHaveBeenCalled()
  })
  it("still rejects ambiguous matches within the selected parent", async () => {
    mocks.areas = [area("first", "state"), area("second", "state")]
    await expect(runPreflight()).rejects.toThrow(/Ambiguous place/)
    expect(mocks.post).not.toHaveBeenCalled()
  })
})

function selectIdentities(_field: string, ids: string[]) {
  return { distinct: async () => ids.map(documentIdentity) }
}
