import { createHash } from "node:crypto"

import { articleContentVersion, normalizeArticleBody } from "@repo/shared-data"

import { defaultLocale } from "../plugins/content-moderation/server/utils/locales"

export const ARTICLE_BODY_POPULATE = {
  on: {
    "content.rich-text": true,
    "content.image-block": {
      populate: { image: { fields: ["id", "url", "alternativeText"] } },
    },
    "content.code-block": true,
    "content.quote-block": true,
    "content.callout": true,
  },
}

const ARTICLE_PUBLIC_LIBRARY = {
  fields: ["name", "slug"],
  populate: {
    continent: { fields: ["slug"] },
    country: { fields: ["slug"] },
    region: { fields: ["slug"] },
  },
}

export const ARTICLE_CONTEXT_POPULATE = {
  topics: { fields: ["name", "slug"] },
  libraries: ARTICLE_PUBLIC_LIBRARY,
  continents: { fields: ["name", "slug"] },
  countries: { fields: ["name", "slug"] },
  regions: { fields: ["name", "slug"] },
  areas: { fields: ["name", "slug"] },
}

export const ARTICLE_EVENTS_POPULATE = {
  populate: {
    library: ARTICLE_PUBLIC_LIBRARY,
    event: { fields: ["title"] },
  },
}

export function articleRevision(article: {
  sources?: unknown
  title?: unknown
  summary?: unknown
  body?: unknown
  updatedAt?: unknown
}): string {
  return createHash("sha256")
    .update(articleContentVersion(article))
    .digest("hex")
}

export const ARTICLE_UIDS = new Set([
  "api::wiki-article.wiki-article",
  "api::blog-article.blog-article",
])

export function articleSnapshotPopulate(uid: string): Record<string, unknown> {
  const refs = { fields: ["documentId"] }

  return {
    body: ARTICLE_BODY_POPULATE,
    heroImage: { fields: ["id"] },
    section: refs,
    category: refs,
    relatedArticles: refs,
    contributors: refs,
    topics: refs,
    libraries: refs,
    continents: refs,
    countries: refs,
    regions: refs,
    areas: refs,
    seo: {
      populate: {
        metaImage: { fields: ["id"] },
        openGraph: { populate: { ogImage: { fields: ["id"] } } },
      },
    },
    ...(uid === "api::blog-article.blog-article"
      ? {
          sources: true,
          authorProfile: refs,
          authorAvatar: { fields: ["id"] },
          eventMentions: { populate: { library: refs, event: refs } },
        }
      : {}),
  }
}

export function articleSnapshotValue(key: string, value: unknown): unknown {
  if (value == null) return null
  if (
    key === "body" ||
    key === "seo" ||
    key === "eventMentions" ||
    key === "sources"
  )
    return normalizeArticleBody(value)
  if (["heroImage", "authorAvatar"].includes(key))
    return (value as any)?.id ?? value
  if (Array.isArray(value))
    return value
      .map((entry) =>
        typeof entry === "object" && entry
          ? ((entry as any).documentId ?? normalizeArticleBody(entry))
          : entry
      )
      .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))
  if (typeof value === "object" && (value as any).documentId)
    return (value as any).documentId

  return value
}

/**
 * Draft Document Service population hides links bound to a published fallback variant.
 * The review guard needs the stored identities, including component citations, rather
 * than a public projection filtered to the source publication status. No caller DTO uses this read.
 */
export async function storedArticleComparisonRelations(
  strapi: any,
  uid: string,
  documentId: string,
  status: "draft" | "published",
  locale?: string | null
): Promise<Record<string, unknown> | null> {
  if (!ARTICLE_UIDS.has(uid)) return null
  const refs = { select: ["documentId"] }
  const populate: Record<string, unknown> = Object.fromEntries(
    Object.keys(articleSnapshotPopulate(uid))
      .filter(
        (key) =>
          ![
            "body",
            "heroImage",
            "authorAvatar",
            "seo",
            "eventMentions",
            "sources",
          ].includes(key)
      )
      .map((key) => [key, refs])
  )
  if (uid === "api::blog-article.blog-article") {
    populate.eventMentions = { populate: { library: refs, event: refs } }
    populate.sources = true
  }
  const row = await strapi.db.query(uid).findOne({
    where: {
      documentId,
      locale: locale ?? (await defaultLocale(strapi)),
      publishedAt:
        status === "published" ? { $notNull: true } : { $null: true },
    },
    select: ["id"],
    populate,
  })
  if (!row || !Number.isSafeInteger(row.id) || row.id <= 0) return null

  return Object.fromEntries(
    Object.keys(populate)
      .filter((key) => key in row)
      .map((key) => [key, row[key]])
  )
}
