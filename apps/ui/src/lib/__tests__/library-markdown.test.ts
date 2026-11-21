import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const { published, dataset } = vi.hoisted(() => ({
  published: vi.fn(),
  dataset: vi.fn(),
}))
vi.mock("@/lib/strapi-api/content/server", () => ({
  fetchPublishedLibrary: published,
}))
vi.mock("@/lib/strapi-api/content/datasets", () => ({
  fetchDataset: dataset,
}))

import { GET } from "@/app/[locale]/(dashboard)/[continent]/[country]/[region]/[library]/markdown/route"
import { renderLibraryMarkdown } from "@/lib/library-markdown"
import type { PopulatedLibraryData } from "@/lib/strapi-api/content/server"

const library = {
  name: "Central [Library]",
  slug: "central-library",
  summary: "A public library in the city centre.",
  continent: { slug: "europe" },
  country: { slug: "england", name: "England" },
  region: { slug: "london", name: "London" },
  city: "London",
  streetAddress: "Library Street",
  location: { lat: 51.5, lng: -0.1 },
  updatedAt: "2026-11-01T10:00:00Z",
  lastVerifiedAt: "2026-10-01T10:00:00Z",
  openingTimes: {
    days: [
      {
        day: "monday",
        enabled: true,
        timeframes: [{ startTime: "09:00", endTime: "17:00" }],
      },
    ],
  },
  website: "https://example.org/library",
  services: [{ name: "Study space" }],
  sourceRecords: [
    {
      dataset: "council",
      label: "Council open data",
      url: "https://example.org/source",
      role: "origin",
      recordId: "ABC-1",
    },
  ],
} as unknown as PopulatedLibraryData

const params = (
  overrides: Record<string, string> = {}
): Promise<{
  locale: string
  continent: string
  country: string
  region: string
  library: string
}> =>
  Promise.resolve({
    locale: "en",
    continent: "europe",
    country: "england",
    region: "london",
    library: "central-library",
    ...overrides,
  })

beforeEach(() => {
  vi.resetAllMocks()
  vi.stubEnv("PUBLIC_CANONICAL_ORIGIN", "https://libraries.global")
  published.mockResolvedValue({ data: library, localeFallback: false })
  dataset.mockResolvedValue({
    key: "council",
    name: "Council data",
    attribution: "Example Council",
    licence: "Open Government Licence",
    licenceUrl: "https://example.org/licence",
    redistribution: "permitted_with_attribution",
  })
  vi.spyOn(console, "error").mockImplementation(vi.fn())
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe("library Markdown export", () => {
  it("includes published facts, hours and dataset credits without Markdown injection", () => {
    const body = renderLibraryMarkdown(library, {
      canonicalUrl:
        "https://libraries.global/europe/england/london/central-library",
      locale: "en",
      datasets: [awaitedDataset()],
    })
    expect(body).toContain(String.raw`# Central \[Library\]`)
    expect(body).toContain("Monday: 09:00–17:00")
    expect(body).toContain("Study space")
    expect(body).toContain("Open Government Licence")
    expect(body).toContain("Example Council")
    expect(body).toContain("Record updated:")
    expect(body).toContain("Last verified:")
  })

  it("serves the published record with canonical and discovery links", async () => {
    const response = await GET(
      new Request(
        "https://libraries.global/europe/england/london/central-library.md"
      ),
      { params: params() }
    )
    expect(response.status).toBe(200)
    expect(response.headers.get("content-type")).toBe(
      "text/markdown; charset=utf-8"
    )
    expect(response.headers.get("content-language")).toBe("en")
    expect(response.headers.get("link")).toContain(
      '<https://libraries.global/llms.txt>; rel="describedby"'
    )
    expect(published).toHaveBeenCalledWith("central-library", "en")
    expect(dataset).toHaveBeenCalledWith("council")
  })

  it("labels a locale fallback with its actual content language", async () => {
    published.mockResolvedValueOnce({ data: library, localeFallback: true })
    const response = await GET(
      new Request(
        "https://libraries.global/fr/europe/england/london/central-library.md"
      ),
      { params: params({ locale: "fr" }) }
    )
    expect(response.headers.get("content-language")).toBe("en")
    expect(await response.text()).toContain("Language: en")
  })

  it("keeps unknown dataset terms visible instead of implying free reuse", () => {
    const body = renderLibraryMarkdown(library, {
      canonicalUrl:
        "https://libraries.global/europe/england/london/central-library",
      locale: "en",
      datasets: [],
    })
    expect(body).toContain("dataset terms unavailable here")
  })

  it("redirects an old path to the published canonical Markdown URL", async () => {
    const response = await GET(
      new Request(
        "https://libraries.global/europe/england/old-region/central-library.md"
      ),
      { params: params({ region: "old-region" }) }
    )
    expect(response.status).toBe(308)
    expect(response.headers.get("location")).toBe(
      "https://libraries.global/europe/england/london/central-library.md"
    )
    expect(dataset).not.toHaveBeenCalled()
  })

  it("returns 404 for an unpublished record and 503 for an unavailable source", async () => {
    published.mockResolvedValueOnce({ data: null, localeFallback: false })
    expect(
      (
        await GET(new Request("https://libraries.global/missing.md"), {
          params: params(),
        })
      ).status
    ).toBe(404)
    published.mockRejectedValueOnce(new Error("CMS unavailable"))
    expect(
      (
        await GET(new Request("https://libraries.global/missing.md"), {
          params: params(),
        })
      ).status
    ).toBe(503)
  })
})

function awaitedDataset() {
  return {
    documentId: "dataset",
    key: "council",
    name: "Council data",
    attribution: "Example Council",
    licence: "Open Government Licence",
    licenceUrl: "https://example.org/licence",
    redistribution: "permitted_with_attribution" as const,
  }
}
