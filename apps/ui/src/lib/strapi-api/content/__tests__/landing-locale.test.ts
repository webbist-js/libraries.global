import { beforeEach, expect, it, vi } from "vitest"

const { fetchAPI } = vi.hoisted(() => ({ fetchAPI: vi.fn() }))
vi.mock("@/lib/strapi-api", () => ({ PublicStrapiClient: { fetchAPI } }))
vi.mock("@/lib/logging", () => ({ logNonBlockingError: vi.fn() }))
vi.mock("next/headers", () => ({
  draftMode: async () => ({ isEnabled: false }),
}))
vi.mock("@/lib/navigation", () => ({
  routing: { defaultLocale: "en", locales: ["en", "fr", "zh-TW"] },
}))

const { fetchBlogLanding, fetchBlogSections, fetchWikiLanding } =
  await import("../server")

beforeEach(() => {
  fetchAPI.mockReset()
  fetchAPI.mockImplementation(
    async (path: string, { locale }: { locale: string }) => ({
      data:
        locale === "en"
          ? { heroTitle: `${path} English` }
          : locale === "fr" && path === "/blog-landing"
            ? { heroTitle: "Journal français" }
            : null,
    })
  )
})

it("uses English CMS copy when a Journal or Knowledge landing is missing", async () => {
  const blog = await fetchBlogLanding("zh-TW")
  const wiki = await fetchWikiLanding("fr")

  expect(blog?.data?.heroTitle).toBe("/blog-landing English")
  expect(wiki?.data?.heroTitle).toBe("/wiki-landing English")
  expect(blog?.localeFallback).toBe(true)
  expect(wiki?.localeFallback).toBe(true)
})

it("keeps a published translation when it exists", async () => {
  const blog = await fetchBlogLanding("fr")

  expect(blog?.data?.heroTitle).toBe("Journal français")
  expect(blog?.localeFallback).toBe(false)
  expect(fetchAPI).toHaveBeenCalledTimes(1)
})

it("fills untranslated Journal sections from English by document", async () => {
  fetchAPI.mockImplementation(async (_path: string, { locale }) => ({
    data:
      locale === "fr"
        ? [{ documentId: "news", name: "Actualités", slug: "news" }]
        : [
            { documentId: "news", name: "News", slug: "news" },
            { documentId: "data", name: "Data", slug: "data" },
          ],
  }))

  const sections = await fetchBlogSections("fr")

  expect(sections.data).toEqual([
    { documentId: "news", name: "Actualités", slug: "news" },
    { documentId: "data", name: "Data", slug: "data" },
  ])
  expect(fetchAPI).toHaveBeenCalledTimes(2)
})
