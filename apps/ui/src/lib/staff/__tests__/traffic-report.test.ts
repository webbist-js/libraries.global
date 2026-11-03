import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  config: null as null | { propertyId: string },
  fetchMany: vi.fn(),
  batch: vi.fn(),
}))

vi.mock("@/lib/strapi-api", () => ({
  PublicStrapiClient: { fetchMany: mocks.fetchMany },
}))
vi.mock("../ga4-data-api", async (importOriginal) => ({
  ...(await importOriginal<typeof Ga4Module>()),
  ga4Config: () => mocks.config,
  batchRunReports: mocks.batch,
}))

import type * as Ga4Module from "../ga4-data-api"
import { Ga4Error } from "../ga4-data-api"
import { getTrafficReport } from "../traffic-report"

const library = {
  slug: "lib",
  continent: { slug: "europe" },
  country: { slug: "uk" },
  region: { slug: "london" },
}

beforeEach(() => {
  mocks.config = { propertyId: "558992450" }
  mocks.fetchMany.mockResolvedValue({ data: [library] })
  mocks.batch.mockResolvedValue([{}, {}, {}, {}])
})
afterEach(() => vi.clearAllMocks())

describe("getTrafficReport", () => {
  it("does nothing without configuration", async () => {
    mocks.config = null
    expect(await getTrafficReport("doc-unconfigured", 30)).toEqual({
      status: "unconfigured",
    })
    expect(mocks.fetchMany).not.toHaveBeenCalled()
    expect(mocks.batch).not.toHaveBeenCalled()
  })

  it("filters by the library's own server-resolved paths", async () => {
    const report = await getTrafficReport("doc-paths", 7)
    expect(report.status).toBe("ready")
    expect(mocks.fetchMany.mock.calls[0]![1].filters).toEqual({
      documentId: { $eq: "doc-paths" },
    })
    const filter = JSON.stringify(mocks.batch.mock.calls[0]![1])
    expect(filter).toContain('"/europe/uk/london/lib"')
    expect(filter).toContain('"/fr/europe/uk/london/lib"')
  })

  it("caches per library and range", async () => {
    await getTrafficReport("doc-cache", 30)
    await getTrafficReport("doc-cache", 30)
    expect(mocks.batch).toHaveBeenCalledTimes(1)
    await getTrafficReport("doc-cache", 7)
    await getTrafficReport("doc-other", 30)
    expect(mocks.batch).toHaveBeenCalledTimes(3)
  })

  it("reports a library without a published page", async () => {
    mocks.fetchMany.mockResolvedValue({ data: [] })
    expect(await getTrafficReport("doc-missing", 30)).toEqual({
      status: "no-page",
    })
    expect(mocks.batch).not.toHaveBeenCalled()
  })

  it("turns provider failures into an unavailable state, never numbers", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    mocks.batch.mockRejectedValueOnce(new Ga4Error("quota", "x"))
    expect(await getTrafficReport("doc-quota", 30)).toEqual({
      status: "unavailable",
      reason: "quota",
    })
    mocks.batch.mockRejectedValueOnce(new Error("timeout"))
    expect(await getTrafficReport("doc-error", 30)).toEqual({
      status: "unavailable",
      reason: "error",
    })
    // Failures aren't cached.
    expect((await getTrafficReport("doc-error", 30)).status).toBe("ready")
  })
})
