import {
  aggregateArticleBrowse,
  parseArticleBrowseQuery,
  type ArticleBrowseItem,
  type ArticleFacetKey,
  type ArticleFacetValue,
} from "@repo/shared-data"

import {
  ARTICLE_PROFILE_FIELDS,
  publicArticleProfile,
} from "./article-attribution"

type Rec = Record<string, unknown>
const record = (value: unknown): Rec =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Rec)
    : {}
const string = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value : null
const array = (value: unknown): unknown[] => (Array.isArray(value) ? value : [])
type Facet = Omit<ArticleFacetValue, "count">

function relationFacet(value: unknown): Facet | null {
  const row = record(value)
  const id = string(row.documentId)
  const slug = string(row.slug)
  const label = string(row.name) ?? string(row.title)
  if (!id || !label) return null

  return {
    value: id,
    label,
    ...(slug ? { slug } : {}),
    ...(string(row.iso2) ? { code: String(row.iso2).toUpperCase() } : {}),
  }
}
const relationFacets = (value: unknown): Facet[] =>
  array(value)
    .map(relationFacet)
    .filter((facet): facet is Facet => !!facet)

/** Allowlisted projection; populated account rows and article bodies never leave this function. */
export function publicArticleBrowseItem(
  value: unknown,
  kind: "blog" | "wiki"
): ArticleBrowseItem | null {
  const article = record(value)
  const documentId = string(article.documentId)
  const locale = string(article.locale)
  const publishedAt = string(article.publishedAt)
  const slug = string(article.slug)
  if (!documentId || !locale || !publishedAt || !slug) return null
  const section = record(article.section)
  const sectionSlug = string(section.slug)
  const sectionSlugs = [
    ...new Set([
      ...(sectionSlug ? [sectionSlug] : []),
      ...array(article.docsSections).filter(
        (value): value is string =>
          typeof value === "string" && /^[a-z0-9-]+$/.test(value)
      ),
    ]),
  ]
  const profile = publicArticleProfile(article.authorProfile)
  // Restricted profiles never contribute filter identities, IDs or names.
  const authorUsername = string(profile?.username)
  const facets: ArticleBrowseItem["facets"] = {
    languages: [{ value: locale, label: locale }],
    sections: sectionSlugs.map((value) => ({
      value,
      slug: value,
      label:
        value === sectionSlug
          ? (string(section.name) ?? value)
          : value.replaceAll("-", " "),
    })),
    libraries: relationFacets(article.libraries),
    topics: relationFacets(article.topics),
    authors: authorUsername
      ? [{ value: authorUsername, label: `@${authorUsername}` }]
      : [],
  }
  const geography = record(article.geographyFacet)
  for (const key of ["continents", "countries", "regions", "areas"] as const) {
    // Once stamped, historical context wins over mutable Library geography.
    facets[key] = relationFacets(geography[key] ?? article[key])
  }
  const publicationOrigin =
    kind === "blog"
      ? article.publicationOrigin === "index"
        ? "index"
        : "community"
      : null
  if (publicationOrigin)
    facets.origins = [
      {
        value: publicationOrigin,
        label:
          publicationOrigin === "index"
            ? "From the Index"
            : "Community Journal",
      },
    ]
  facets.events =
    kind === "blog"
      ? array(article.eventMentions).flatMap((value, index) => {
          const mention = record(value)
          const title = string(mention.title)

          // A durable occurrence key survives deletion of the optional live event.
          return title
            ? [
                {
                  value:
                    string(mention.citationId) ??
                    string(mention.eventDocumentId) ??
                    `${documentId}:${mention.id ?? index}`,
                  label: title,
                },
              ]
            : []
        })
      : []
  const media = record(article.heroImage)
  const url = string(media.url)
  const local = facets.areas?.[0]?.label ?? facets.regions?.[0]?.label
  const country = facets.countries?.[0]?.label
  const place =
    [
      ...new Set([local, country].filter((value): value is string => !!value)),
    ].join(", ") || null
  const minutes = Number(article.readingTimeMinutes)

  return {
    documentId,
    locale,
    publishedAt,
    slug,
    title: string(article.title) ?? slug,
    summary: string(article.summary),
    author: string(article.author),
    authorUsername,
    publicationOrigin,
    updatedAt: string(article.updatedAt),
    featured: article.featured === true,
    readingTimeMinutes:
      Number.isFinite(minutes) && minutes > 0 ? Math.ceil(minutes) : 1,
    place,
    sectionSlugs,
    section: sectionSlug
      ? {
          documentId: string(section.documentId) ?? sectionSlug,
          slug: sectionSlug,
          name: string(section.name) ?? sectionSlug,
          ...(string(section.icon) ? { icon: String(section.icon) } : {}),
          ...(string(section.tint) ? { tint: String(section.tint) } : {}),
        }
      : null,
    heroImage: url
      ? { url, alternativeText: string(media.alternativeText) }
      : null,
    facets,
  }
}

export const ARTICLE_BROWSE_FIELDS = [
  "documentId",
  "locale",
  "title",
  "slug",
  "summary",
  "author",
  "featured",
  "publishedAt",
  "updatedAt",
  "readingTimeMinutes",
  "geographyFacet",
]
export const ARTICLE_BROWSE_POPULATE = {
  section: { fields: ["name", "slug", "icon"] },
  heroImage: { fields: ["url", "alternativeText"] },
  libraries: { fields: ["name", "slug"] },
  topics: { fields: ["name", "slug"] },
}
export const JOURNAL_BROWSE_POPULATE = {
  ...ARTICLE_BROWSE_POPULATE,
  section: { fields: [...ARTICLE_BROWSE_POPULATE.section.fields, "tint"] },
  authorProfile: { fields: ARTICLE_PROFILE_FIELDS },
  eventMentions: { fields: ["title", "citationId", "eventDocumentId"] },
}

/**
 * CMS aggregate adapter. Batch lean published projections across every locale;
 * this avoids the old per-language/per-section count requests and body payloads.
 * Fail explicitly if the catalogue exceeds the operator's bound, never return
 * silently incomplete counts. A search adapter can replace this seam at scale.
 */
export async function browseArticles(
  strapi: any,
  kind: "blog" | "wiki",
  input: Record<string, unknown>
) {
  const query = parseArticleBrowseQuery(input)
  const uid =
    kind === "blog"
      ? "api::blog-article.blog-article"
      : "api::wiki-article.wiki-article"
  const items: ArticleBrowseItem[] = []
  const batchSize = 500
  const ceiling = Math.max(
    500,
    Math.min(
      100_000,
      Number(strapi.config?.get?.("api.articleBrowseMaxEntries", 10_000)) ||
        10_000
    )
  )
  const fields = [
    ...ARTICLE_BROWSE_FIELDS,
    ...(kind === "blog" ? ["publicationOrigin"] : ["docsSections"]),
  ]
  for (let start = 0; start <= ceiling; start += batchSize) {
    const rows = await strapi.documents(uid).findMany({
      fields,
      status: "published",
      locale: "*",
      start,
      limit: batchSize,
      sort: ["documentId:asc", "locale:asc"],
      populate:
        kind === "blog" ? JOURNAL_BROWSE_POPULATE : ARTICLE_BROWSE_POPULATE,
    })
    if (start + rows.length > ceiling) {
      const error = new Error(
        "Article catalogue exceeds the configured discovery aggregation limit"
      )
      Object.assign(error, { status: 503 })
      throw error
    }
    for (const row of rows) {
      const item = publicArticleBrowseItem(row, kind)
      if (item) items.push(item)
    }
    if (rows.length < batchSize) break
  }
  let featuredDocumentId: string | null = null
  const preferred =
    typeof input.preferredLocale === "string" &&
    /^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(input.preferredLocale)
      ? input.preferredLocale
      : "en"
  if (kind === "blog") {
    const available = new Set(items.map((item) => item.locale))
    const pickLocale =
      [query.filters.languages?.[0], preferred, "en", ...available].find(
        (value) => value && available.has(value)
      ) ?? "en"
    const landing = await strapi
      .documents("api::blog-landing.blog-landing")
      .findFirst?.({
        status: "published",
        locale: pickLocale,
        fields: ["documentId"],
        populate: { featuredArticle: { fields: ["documentId"] } },
      })
    featuredDocumentId = string(
      record(record(landing).featuredArticle).documentId
    )
  }

  return aggregateArticleBrowse(items, query, featuredDocumentId, preferred)
}

/** Shared search projection uses exactly the browse facet identities. */
export function articleSearchFacets(
  entry: unknown,
  kind: "blog" | "wiki"
): Record<string, unknown> {
  const item = publicArticleBrowseItem(entry, kind)
  const keys: ArticleFacetKey[] = [
    "continents",
    "countries",
    "regions",
    "areas",
    "libraries",
    "topics",
    "authors",
    "events",
    "origins",
    "sections",
  ]

  return {
    readingTimeMinutes: item?.readingTimeMinutes ?? 1,
    publicationOrigin: item?.publicationOrigin ?? null,
    author_username: item?.authorUsername ?? null,
    ...Object.fromEntries(
      keys.map((key) => [
        `${key}_ids`,
        (item?.facets[key] ?? []).map((facet) => facet.value),
      ])
    ),
    geographyFacet: item
      ? Object.fromEntries(
          ["continents", "countries", "regions", "areas"].map((key) => [
            key,
            item.facets[key as ArticleFacetKey] ?? [],
          ])
        )
      : {},
  }
}
