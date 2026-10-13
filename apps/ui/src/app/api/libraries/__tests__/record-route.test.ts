import { describe, expect, it, vi } from "vitest"

const fetchLibrary = vi.hoisted(() => vi.fn())
vi.mock("@/lib/strapi-api/content/server", () => ({ fetchLibrary }))
vi.mock("@/components/library/library-page.helpers", () => ({
  toLatLng: () => ({ lat: 51.5, lng: -0.1 }),
}))
vi.mock("@/lib/library-helpers", () => ({
  buildLibraryPath: () => "/europe/uk/london/test-library",
}))
vi.mock("@/lib/seo/metadata", () => ({
  absoluteUrl: (path: string) => `https://libraries.global/${path}`,
}))
vi.mock("@/lib/strapi-api/content/datasets", () => ({
  fetchDataset: vi.fn().mockResolvedValue({
    key: "example",
    publisher: "Publisher",
    licence: "CC0",
    attribution: "Dataset credit",
  }),
}))
const { GET } = await import("../[slug]/record/route")
const library = {
  slug: "test-library",
  name: 'Library, "Central"',
  entityRef: "LIB:GB:TST:01",
  sourceRecords: [
    {
      dataset: "example",
      label: "Original catalogue",
      recordId: "KEEP",
      url: "https://source.example",
      role: "origin",
    },
  ],
  updatedAt: "2026-10-08",
  country: { name: "United Kingdom", iso2: "GB" },
}
const call = (format: string) =>
  GET(
    new Request(
      `https://libraries.global/api/libraries/test-library/record?format=${format}`
    ),
    { params: Promise.resolve({ slug: "test-library" }) }
  )

describe("public library record downloads", () => {
  it("returns a JSON record with licence and source without a session", async () => {
    fetchLibrary.mockResolvedValue({ data: library })
    const res = await call("json")
    expect(res.status).toBe(200)
    expect(res.headers.get("Content-Disposition")).toContain(
      "test-library.json"
    )
    expect(await res.json()).toMatchObject({
      name: library.name,
      sourceRecords: [
        expect.objectContaining({
          recordId: "KEEP",
          label: "Original catalogue",
          publisher: "Publisher",
          licence: "CC0",
          attribution: "Dataset credit",
        }),
      ],
      licence: "CC BY-SA 4.0",
      attribution: expect.stringContaining("contributors"),
    })
  })
  it("returns an escaped CSV with source, attribution and licence", async () => {
    fetchLibrary.mockResolvedValue({ data: library })
    const res = await call("csv")
    expect(res.status).toBe(200)
    expect(res.headers.get("Content-Type")).toContain("text/csv")
    const csv = await res.text()
    expect(csv).toContain('"Library, ""Central"""')
    expect(csv).toContain("Original catalogue")
    expect(csv).toContain("CC BY-SA 4.0")
    expect(csv).toContain("Libraries Global contributors")
  })
  it("returns 404 for missing or unpublished records", async () => {
    fetchLibrary.mockResolvedValue({ data: null })
    expect((await call("json")).status).toBe(404)
  })
})
