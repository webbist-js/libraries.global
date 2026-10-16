import "server-only"

import { createHash } from "node:crypto"

import { articleContentVersion, articleSectionKeys } from "@repo/shared-data"
import type { Locale } from "next-intl"

import type {
  ArticleKind,
  ArticleEventMention,
  ArticleLocale,
  ArticleTag,
  ExistingArticle,
} from "@/components/contribute/article-editor/article.types"
import { isDocumentIdParam } from "@/lib/bridge-params"
import { strapiServiceHeaders } from "@/lib/bridge-user-headers"
import {
  type ArticleForEditing,
  fetchArticleForEditing,
} from "@/lib/strapi-api/content/server"

const STRAPI = process.env.STRAPI_URL ?? "http://127.0.0.1:1337"

/** Strapi's configured locales; English alone when the bridge is down. */
export async function fetchArticleLocales(): Promise<ArticleLocale[]> {
  try {
    const res = await fetch(`${STRAPI}/api/content-moderation/locales`, {
      headers: strapiServiceHeaders(),
      next: { revalidate: 3600 },
    })
    if (!res.ok) throw new Error(String(res.status))
    const json = (await res.json()) as { data?: ArticleLocale[] }
    const locales = (json.data ?? []).filter((l) => l.code && l.name)
    if (locales.length > 0) return locales
  } catch {
    // fall through
  }

  return [{ code: "en", name: "English", isDefault: true }]
}

/** An article as fetched, in the editor's shape. */
export function toExistingArticle(
  kind: ArticleKind,
  article: ArticleForEditing,
  locale: string
): ExistingArticle {
  const tags: ArticleTag[] = [
    ...(article.topics ?? []).flatMap((t) =>
      t.name
        ? [
            {
              kind: "topic" as const,
              label: t.name,
              slug: t.slug ?? undefined,
              documentId: t.documentId,
            },
          ]
        : []
    ),
    ...(article.libraries ?? []).flatMap((l) =>
      l.name
        ? [
            {
              kind: "library" as const,
              label: l.name,
              slug: l.slug ?? undefined,
              documentId: l.documentId,
            },
          ]
        : []
    ),
  ]
  for (const [relation, tagKind] of [
    ["continents", "continent"],
    ["countries", "country"],
    ["regions", "region"],
    ["areas", "area"],
  ] as const)
    for (const place of article[relation] ?? []) {
      if (!place.name) continue
      tags.push({
        kind: tagKind,
        documentId: place.documentId,
        label: place.name,
      })
    }
  const eventMentions = (article.eventMentions ?? []).flatMap((mention) => {
    if (!mention.title) return []
    if (mention.event?.documentId)
      tags.push({
        kind: "event",
        label: mention.title,
        documentId: mention.event.documentId,
      })

    return [
      {
        citationId: mention.citationId,
        title: mention.title,
        startTime: mention.startTime,
        endTime: mention.endTime,
        timezone: mention.timezone,
        url: mention.url,
        libraryDocumentId: mention.library?.documentId ?? null,
        libraryName: mention.library?.name ?? null,
        eventDocumentId:
          mention.event?.documentId ?? mention.eventDocumentId ?? null,
      },
    ]
  })
  const sections =
    kind === "knowledge"
      ? articleSectionKeys({
          section: article.section,
          docsSections: Array.isArray(article.docsSections)
            ? article.docsSections
            : [],
        })
      : article.section?.slug
        ? [article.section.slug]
        : []

  return {
    eventMentions,
    baseRevision: createHash("sha256")
      .update(articleContentVersion(article))
      .digest("hex"),
    documentId: article.documentId,
    slug: article.slug,
    locale: article.locale ?? locale,
    title: article.title ?? "",
    summary: article.summary ?? "",
    body: Array.isArray(article.body) ? article.body : [],
    sections,
    tags,
    availableLocales: [
      article.locale ?? locale,
      ...(article.localizations ?? []).flatMap((l) =>
        l.locale ? [l.locale] : []
      ),
    ],
  }
}

/** Loads an article for the editor, or null when it isn't published in this locale. */
export async function loadArticleForEditor(
  kind: ArticleKind,
  slug: string,
  locale: Locale
): Promise<ExistingArticle | null> {
  const article = await fetchArticleForEditing(kind, slug, locale)

  return article ? toExistingArticle(kind, article, locale) : null
}

/** Validate CTA context against public records; client query labels are never trusted. */
export async function loadArticleWriteContext(
  query: { library?: string; event?: string },
  locale: string
): Promise<{ tags: ArticleTag[]; eventMentions: ArticleEventMention[] }> {
  const token = process.env.STRAPI_REST_READONLY_API_KEY
  const publicGet = async (path: string) => {
    const response = await fetch(`${STRAPI}/api/${path}`, {
      cache: "no-store",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    if (!response.ok) return null

    return response.json()
  }
  const libraryId =
    query.library && isDocumentIdParam(query.library) ? query.library : null
  const eventId =
    query.event && isDocumentIdParam(query.event) ? query.event : null
  try {
    const [libraryResponse, event] = await Promise.all([
      libraryId
        ? publicGet(
            `libraries?filters[documentId][$eq]=${encodeURIComponent(libraryId)}&status=published&locale=${encodeURIComponent(locale)}&fields[0]=name&fields[1]=slug&fields[2]=entityRef&pagination[limit]=1`
          )
        : null,
      eventId ? publicGet(`events/event/${encodeURIComponent(eventId)}`) : null,
    ])
    let library = libraryResponse?.data?.[0] as
      | { documentId: string; name: string; slug?: string; entityRef?: string }
      | undefined
    if (
      event?.libraryEntityRef &&
      event.libraryEntityRef !== library?.entityRef
    ) {
      const related = await publicGet(
        `libraries?filters[entityRef][$eq]=${encodeURIComponent(event.libraryEntityRef)}&status=published&locale=${encodeURIComponent(locale)}&fields[0]=name&fields[1]=slug&pagination[limit]=1`
      )
      library = related?.data?.[0]
    }
    const tags: ArticleTag[] = library
      ? [
          {
            kind: "library",
            documentId: library.documentId,
            label: library.name,
            slug: library.slug,
          },
        ]
      : []
    if (event?.documentId && event.title)
      tags.push({
        kind: "event",
        documentId: event.documentId,
        label: event.title,
      })

    return {
      tags,
      eventMentions:
        event?.documentId && event.title
          ? [
              {
                title: event.title,
                startTime: event.startTime ?? null,
                endTime: event.endTime ?? null,
                timezone: event.timezone ?? null,
                url: event.url ?? null,
                libraryDocumentId: library?.documentId ?? null,
                eventDocumentId: event.documentId,
              },
            ]
          : [],
    }
  } catch {
    return { tags: [], eventMentions: [] }
  }
}
