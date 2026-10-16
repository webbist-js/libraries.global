import { describe, expect, it, vi } from "vitest"

import {
  articleSearchFacets,
  browseArticles,
  publicArticleBrowseItem,
} from "../src/utils/article-browse"

import blogArticleSchema from "../src/api/blog-article/content-types/blog-article/schema.json"
import blogSectionSchema from "../src/api/blog-section/content-types/blog-section/schema.json"
import wikiArticleSchema from "../src/api/wiki-article/content-types/wiki-article/schema.json"
import wikiSectionSchema from "../src/api/wiki-section/content-types/wiki-section/schema.json"

const row = {
  documentId: "story",
  locale: "es",
  slug: "story",
  title: "Library event in Colombia",
  publishedAt: "2026-10-16T12:00:00.000Z",
  readingTimeMinutes: 4,
  publicationOrigin: "community",
  author: "Historical byline",
  body: ["must never be returned"],
  authorProfile: {
    documentId: "private-profile-id",
    username: "writer",
    profileVisibility: "public",
    publicPrefs: { showActivity: true },
    baUserId: "private-auth-id",
    email: "secret@example.test",
  },
  geographyFacet: {
    countries: [
      {
        documentId: "co-id",
        slug: "colombia",
        name: "Colombia",
        credentialId: "secret",
      },
    ],
    continents: [
      { documentId: "sa", slug: "south-america", name: "South America" },
    ],
  },
  libraries: [
    { documentId: "library", name: "Library", credentialId: "secret" },
  ],
  eventMentions: [
    {
      id: 77,
      citationId: "event-citation",
      title: "A reading event",
      eventDocumentId: "expired-event",
      credentialId: "secret",
    },
  ],
}

describe("public article browse projection", () => {
  it("publishes only allowlisted facets and preserves Event citations after deletion", () => {
    const projected = publicArticleBrowseItem(row, "blog")!
    expect(projected.authorUsername).toBe("writer")
    expect(projected.facets.events).toEqual([
      { value: "event-citation", label: "A reading event" },
    ])
    expect(projected.facets.countries).toEqual([
      { value: "co-id", slug: "colombia", label: "Colombia" },
    ])
    expect(projected.readingTimeMinutes).toBe(4)
    expect(JSON.stringify(projected)).not.toMatch(
      /credential|private-profile|private-auth|secret@example|must never/
    )
    expect(articleSearchFacets(row, "blog")).toMatchObject({
      countries_ids: ["co-id"],
      events_ids: ["event-citation"],
      author_username: "writer",
    })
  })

  it.each(["private", "limited", undefined])(
    "never exposes an author filter for %s profiles",
    (profileVisibility) => {
      const projected = publicArticleBrowseItem(
        { ...row, authorProfile: { ...row.authorProfile, profileVisibility } },
        "blog"
      )!
      expect(projected.authorUsername).toBeNull()
      expect(projected.facets.authors).toEqual([])
      expect(projected.author).toBe("Historical byline")
      expect(JSON.stringify(projected)).not.toContain("writer")
    }
  )

  it("honours hidden activity and rejects a raw unpublished row", () => {
    expect(
      publicArticleBrowseItem({ ...row, publishedAt: null }, "blog")
    ).toBeNull()
    expect(
      publicArticleBrowseItem(
        {
          ...row,
          authorProfile: {
            ...row.authorProfile,
            publicPrefs: { showActivity: false },
          },
        },
        "blog"
      )?.authorUsername
    ).toBeNull()
  })

  it("uses frozen geography even after the direct relation changes", () => {
    const projected = publicArticleBrowseItem(
      { ...row, countries: [{ documentId: "gb", name: "United Kingdom" }] },
      "blog"
    )!
    expect(projected.facets.countries?.[0]?.value).toBe("co-id")
  })
})

describe("CMS browse adapter", () => {
  it("passes interface locale preference to a translated editorial pick without restricting collection languages", async () => {
    const findMany = vi
      .fn()
      .mockResolvedValue(
        ["cs", "en", "fr"].map((locale) => ({ ...row, locale }))
      )
    const findFirst = vi
      .fn()
      .mockResolvedValue({ featuredArticle: { documentId: row.documentId } })
    const strapi = {
      documents: (uid: string) =>
        uid === "api::blog-landing.blog-landing" ? { findFirst } : { findMany },
    }
    const result = await browseArticles(strapi, "blog", {
      preferredLocale: "en",
      origin: "community",
    })
    expect(result.total).toBe(3)
    expect(result.editorPick?.locale).toBe("en")
    expect(result.appliedFilters.languages).toBeUndefined()
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ locale: "en" })
    )
  })

  it.each(["blog", "wiki"] as const)(
    "uses schema-valid %s card and section fields without losing Journal tint",
    async (kind) => {
      const articleSchema =
        kind === "blog" ? blogArticleSchema : wikiArticleSchema
      const sectionSchema =
        kind === "blog" ? blogSectionSchema : wikiSectionSchema
      const section = {
        documentId: "section",
        name: "Reports",
        slug: "reports",
        icon: "mdi:book",
        ...(kind === "blog" ? { tint: "green" } : {}),
      }
      const metadata = new Set([
        "documentId",
        "locale",
        "publishedAt",
        "updatedAt",
      ])
      const findMany = vi.fn(
        async (options: {
          fields: string[]
          populate: { section: { fields: string[] } }
        }) => {
          // Strapi rejects nonexistent populate fields before returning any data.
          // Read the actual schemas so a shared projection cannot mask differences.
          for (const field of options.fields)
            expect(
              metadata.has(field) ||
                Object.hasOwn(articleSchema.attributes, field),
              `Invalid article key ${field}`
            ).toBe(true)
          for (const field of options.populate.section.fields)
            expect(
              Object.hasOwn(sectionSchema.attributes, field),
              `Invalid section key ${field}`
            ).toBe(true)
          expect(options.populate.section.fields.includes("tint")).toBe(
            kind === "blog"
          )

          return [{ ...row, section }]
        }
      )
      const result = await browseArticles(
        { documents: () => ({ findMany }) },
        kind,
        {}
      )
      expect(result.total).toBe(1)
      expect(result.items[0]?.section).toEqual(section)
    }
  )

  it("uses one published all-locale read with no body and ignores injected CMS options", async () => {
    const findMany = vi.fn().mockResolvedValue([row])
    const strapi = { documents: vi.fn(() => ({ findMany })) }
    const result = await browseArticles(strapi, "blog", {
      lang: "es",
      country: "colombia",
      event: "event-citation",
      status: "draft",
      populate: "*",
      pageSize: "999",
    })
    expect(result.total).toBe(1)
    expect(result.items[0]?.locale).toBe("es")
    expect(findMany).toHaveBeenCalledTimes(1)
    expect(findMany.mock.calls[0]?.[0]).toMatchObject({
      locale: "*",
      status: "published",
      start: 0,
      limit: 500,
      sort: ["documentId:asc", "locale:asc"],
    })
    expect(findMany.mock.calls[0]?.[0].populate).not.toHaveProperty("body")
    expect(findMany.mock.calls[0]?.[0].fields).not.toContain("body")
  })

  it("keeps the default collection multilingual independently of interface language and preserves explicit language filters", async () => {
    const strapi = {
      documents: () => ({
        findMany: async () => [
          row,
          {
            ...row,
            documentId: "index-en",
            locale: "en",
            publicationOrigin: "index",
          },
        ],
      }),
    }
    for (const kind of ["blog", "wiki"] as const) {
      const result = await browseArticles(strapi, kind, {
        preferredLocale: "en",
        ...(kind === "blog" ? { origin: "community" } : {}),
      })
      expect(result.appliedFilters.languages).toBeUndefined()
      expect(result.items.some((item) => item.locale === "es")).toBe(true)
    }
    expect(
      (
        await browseArticles(strapi, "blog", {
          preferredLocale: "en",
          lang: "fr",
        })
      ).items
    ).toEqual([])
    expect(
      (
        await browseArticles(strapi, "blog", {
          preferredLocale: "en",
          lang: "all",
        })
      ).appliedFilters.languages
    ).toBeUndefined()
  })

  it("fails explicitly at the configured catalogue limit rather than publishing inaccurate counts", async () => {
    const findMany = vi
      .fn()
      .mockResolvedValueOnce(
        Array.from({ length: 500 }, (_, index) => ({
          ...row,
          documentId: `story-${index}`,
        }))
      )
      .mockResolvedValueOnce([row])
    const strapi = {
      documents: () => ({ findMany }),
      config: { get: () => 500 },
    }
    await expect(browseArticles(strapi, "blog", {})).rejects.toMatchObject({
      status: 503,
    })
  })
})
