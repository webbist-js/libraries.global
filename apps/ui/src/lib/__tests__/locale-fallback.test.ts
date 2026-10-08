import { beforeEach, describe, expect, it, vi } from "vitest"

const { fetchOneBySlug, fetchAPI } = vi.hoisted(() => ({
  fetchOneBySlug: vi.fn(),
  fetchAPI: vi.fn(),
}))

vi.mock("next/headers", () => ({
  draftMode: async () => ({ isEnabled: false }),
}))
vi.mock("@/lib/navigation", () => ({
  routing: { defaultLocale: "en", locales: ["cs", "en"] },
}))
vi.mock("@/lib/logging", () => ({ logNonBlockingError: vi.fn() }))
vi.mock("@/lib/strapi-api", () => ({
  PublicStrapiClient: { fetchOneBySlug, fetchAPI },
}))

const {
  fetchBlogArticle,
  fetchLibrary,
  fetchLibraryForEditing,
  fetchWikiArticle,
} = await import("@/lib/strapi-api/content/server")

type Params = { locale?: string }

/** A Strapi that only has the given locales of the document. */
function strapiWith(locales: string[]) {
  const respond = (params: Params | undefined) =>
    params?.locale && locales.includes(params.locale)
      ? { data: { documentId: "doc-1", locale: params.locale }, meta: {} }
      : { data: null, meta: {} }
  fetchOneBySlug.mockImplementation(
    async (_uid: string, _slug: string, params?: Params) => respond(params)
  )
  fetchAPI.mockImplementation(async (path: string, params?: Params) => {
    // `/libraries/by-slug/:slug` is a list: empty for a missing locale.
    if (path.startsWith("/libraries/by-slug/")) {
      const one = respond(params)

      return { data: one.data ? [one.data] : [], meta: {} }
    }
    // The article detail routes 404 for a missing locale; the client throws.
    if (!params?.locale || !locales.includes(params.locale))
      throw new Error("404")

    return respond(params)
  })
}

beforeEach(() => {
  fetchOneBySlug.mockReset()
  fetchAPI.mockReset()
})

describe.each([
  ["fetchLibrary", fetchLibrary],
  ["fetchLibraryForEditing", fetchLibraryForEditing],
  ["fetchWikiArticle", fetchWikiArticle],
  ["fetchBlogArticle", fetchBlogArticle],
] as const)("%s locale fallback", (_name, fetcher) => {
  it("returns the requested locale when it exists", async () => {
    strapiWith(["en", "cs"])
    const res = await fetcher("slug", "cs")
    expect(res?.data).toMatchObject({ locale: "cs" })
    expect(res?.localeFallback).toBe(false)
  })

  it("falls back to the default locale when the translation is missing", async () => {
    strapiWith(["en"])
    const res = await fetcher("slug", "cs")
    expect(res?.data).toMatchObject({ locale: "en" })
    expect(res?.localeFallback).toBe(true)
  })

  it("does not fall back from the default locale", async () => {
    strapiWith([])
    const res = await fetcher("slug", "en")
    expect(res?.data ?? null).toBeNull()
    expect(res?.localeFallback ?? false).toBe(false)
    const calls = fetchOneBySlug.mock.calls.length + fetchAPI.mock.calls.length
    expect(calls).toBe(1)
  })

  it("reports no document when neither locale exists", async () => {
    strapiWith([])
    const res = await fetcher("slug", "cs")
    expect(res?.data ?? null).toBeNull()
  })
})

describe("fallback copy", async () => {
  const { languageName, notTranslatedText } =
    await import("@/lib/locale-fallback")

  it("names a locale in English", () => {
    expect(languageName("cs")).toBe("Czech")
    expect(notTranslatedText("cs")).toBe("Not yet translated into Czech.")
  })

  it("prefers Strapi's configured name without the region suffix", () => {
    expect(languageName("cs", [{ code: "cs", name: "Czech (cs)" }])).toBe(
      "Czech"
    )
  })

  it("falls back to the code for an unknown locale", () => {
    expect(languageName("not a locale")).toBe("not a locale")
  })
})
