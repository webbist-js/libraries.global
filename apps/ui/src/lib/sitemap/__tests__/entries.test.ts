import { beforeEach, describe, expect, it, vi } from "vitest"

const source = vi.hoisted(() => ({
  sourceCount: vi.fn(),
  sourceRows: vi.fn(),
  knowledgeSections: vi.fn(),
  sitemapJson: vi.fn(),
}))
vi.mock("../source", () => source)
vi.mock("@/lib/env-vars", () => ({
  getEnvVar: () => "https://libraries.global",
}))
vi.mock("@/lib/general-helpers", () => ({
  isProduction: () => true,
  isDevelopment: () => false,
}))
vi.mock("@/lib/navigation", () => ({ routing: { defaultLocale: "en" } }))

import { GET as indexGET } from "@/app/sitemap.xml/route"
import { GET as fileGET } from "@/app/sitemaps/[file]/route"

import { pathFor, sitemapEntries, sitemapFiles } from "../entries"

beforeEach(() => {
  vi.clearAllMocks()
  source.sourceCount.mockImplementation(async (segment: string) =>
    segment === "libraries"
      ? 2_900_000
      : segment === "journal" || segment === "knowledge"
        ? 10_001
        : 0
  )
  source.sourceRows.mockResolvedValue([])
  source.knowledgeSections.mockResolvedValue([{ slug: "getting-started" }])
  source.sitemapJson.mockResolvedValue({ data: { "": true, journal: true } })
})

describe("sitemap coverage", () => {
  it("sizes all content types without loading their records", async () => {
    const files = await sitemapFiles()
    expect(files.filter((file) => file.segment === "libraries")).toHaveLength(
      290
    )
    expect(files.filter((file) => file.segment === "journal")).toHaveLength(2)
    expect(files.filter((file) => file.segment === "knowledge")).toHaveLength(2)
    expect(source.sourceRows).not.toHaveBeenCalled()
  })

  it("reads only the requested Journal file with modification dates", async () => {
    source.sourceRows.mockResolvedValue([
      {
        id: 10_001,
        slug: "library-story",
        updatedAt: "2026-10-08T00:00:00Z",
        section: { slug: "stories" },
      },
    ])
    expect(
      await sitemapEntries({ segment: "journal", locale: "en", page: 2 })
    ).toEqual([
      {
        url: "https://libraries.global/journal/stories/library-story",
        lastModified: "2026-10-08T00:00:00Z",
      },
    ])
    expect(source.sourceRows).toHaveBeenCalledWith(
      "journal",
      "en",
      10_000,
      10_000
    )
  })

  it("uses the actual home section for unfiled Knowledge articles", () => {
    expect(
      pathFor("knowledge", { id: 1, slug: "guide" }, [
        { slug: "getting-started" },
      ])
    ).toBe("/knowledge/getting-started/guide")
    expect(
      pathFor(
        "knowledge",
        { id: 1, slug: "guide", docsSections: ["getting-started"] },
        [{ slug: "getting-started" }]
      )
    ).toBe("/knowledge/getting-started/guide")
  })

  it("excludes CMS noindex landing pages and all private workflows", async () => {
    source.sitemapJson.mockResolvedValue({ data: { "": true, journal: false } })
    const entries = await sitemapEntries({
      segment: "pages",
      locale: "en",
      page: 1,
    })
    expect(entries?.map((e) => e.url)).not.toContain(
      "https://libraries.global/journal"
    )
    expect(
      entries?.some((e) =>
        /\/(auth|staff|live|profile\/settings)\b/.test(e.url)
      )
    ).toBe(false)
    expect(entries?.some((e) => e.url.endsWith("/contribute/membership"))).toBe(
      true
    )
  })

  it("answers 503 on failure and 404 for invalid or exhausted files", async () => {
    source.sourceCount.mockRejectedValue(new Error("CMS down"))
    expect((await indexGET()).status).toBe(503)
    source.sourceRows.mockRejectedValueOnce(new Error("CMS down"))
    const request = new Request(
      "https://libraries.global/sitemaps/libraries-en-1.xml"
    )
    const response = await fileGET(request, {
      params: Promise.resolve({ file: "libraries-en-1.xml" }),
    })
    expect(response.status).toBe(503)
    expect(response.headers.get("Retry-After")).toBe("3600")
    expect(
      (
        await fileGET(request, {
          params: Promise.resolve({ file: "libraries-en-999.xml" }),
        })
      ).status
    ).toBe(404)
    expect(
      (
        await fileGET(request, {
          params: Promise.resolve({ file: "libraries-cs-1.xml" }),
        })
      ).status
    ).toBe(404)
  })
})
