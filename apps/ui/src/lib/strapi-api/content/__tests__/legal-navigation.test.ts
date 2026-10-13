import { beforeEach, expect, it, vi } from "vitest"

const { fetchAPI } = vi.hoisted(() => ({ fetchAPI: vi.fn() }))
vi.mock("@/lib/strapi-api", () => ({ PublicStrapiClient: { fetchAPI } }))
vi.mock("@/lib/logging", () => ({ logNonBlockingError: vi.fn() }))
vi.mock("next/headers", () => ({
  draftMode: async () => ({ isEnabled: false }),
}))
vi.mock("@/lib/navigation", () => ({
  routing: { defaultLocale: "en", locales: ["en", "cs", "fr"] },
}))

const { fetchLegalDocuments, fetchLegalDocument } = await import("../server")
const beta = {
  documentId: "beta-doc",
  slug: "beta",
  title: "Beta terms & privacy",
}
const membership = {
  documentId: "membership-doc",
  slug: "membership",
  title: "Membership terms",
}
beforeEach(() => {
  fetchAPI.mockReset()
  fetchAPI.mockImplementation(
    async (path: string, { locale }: { locale: string }) => {
      if (path === "/legal-documents/nav")
        return {
          data:
            locale === "en"
              ? [membership, beta]
              : [{ ...beta, title: "Translated beta" }],
        }

      return { data: locale === "en" ? beta : null }
    }
  )
})

it.each(["en", "cs", "fr"] as const)(
  "keeps the temporary notice out of %s site/footer navigation, including fallback",
  async (locale) => {
    expect((await fetchLegalDocuments(locale, "published")).data).toEqual([
      membership,
    ])
  }
)
it.each(["en", "cs", "fr"] as const)(
  "keeps the beta notice directly readable in %s",
  async (locale) => {
    const result = await fetchLegalDocument("beta", locale)
    expect(result?.data).toEqual(beta)
    expect(result?.localeFallback).toBe(locale !== "en")
  }
)
