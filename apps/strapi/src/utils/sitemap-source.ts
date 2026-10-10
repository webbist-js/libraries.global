import type { Core } from "@strapi/strapi"

import { publicEventFilters } from "../plugins/events/server/utils/query"

/** Public URL discovery only: no bodies, media, credentials or account data. */
const SOURCES = {
  libraries: {
    uid: "api::library.library",
    fields: ["slug", "updatedAt"],
    populate: {
      continent: { fields: ["slug"] },
      country: { fields: ["slug"] },
      region: { fields: ["slug"] },
    },
    published: true,
    localized: true,
    seo: true,
  },
  continents: {
    uid: "api::continent.continent",
    fields: ["slug"],
    published: true,
    localized: true,
    seo: true,
  },
  countries: {
    uid: "api::country.country",
    fields: ["slug"],
    populate: { continent: { fields: ["slug"] } },
    published: true,
    localized: true,
    seo: true,
  },
  regions: {
    uid: "api::region.region",
    fields: ["slug"],
    populate: {
      continent: { fields: ["slug"] },
      country: {
        fields: ["slug"],
        populate: { continent: { fields: ["slug"] } },
      },
    },
    published: true,
    localized: true,
    seo: true,
  },
  journal: {
    uid: "api::blog-article.blog-article",
    fields: ["slug", "updatedAt"],
    populate: { section: { fields: ["slug"] } },
    published: true,
    localized: true,
    seo: true,
  },
  knowledge: {
    uid: "api::wiki-article.wiki-article",
    fields: ["slug", "docsSections", "updatedAt"],
    populate: { section: { fields: ["slug"] } },
    published: true,
    localized: true,
    seo: true,
  },
  legal: {
    uid: "api::legal-document.legal-document",
    fields: ["slug", "updatedAt"],
    published: true,
    localized: true,
    seo: true,
  },
  drives: {
    uid: "api::drive.drive",
    fields: ["slug", "updatedAt"],
    localized: true,
  },
  events: {
    uid: "plugin::events.event",
    fields: ["documentId"],
  },
  profiles: {
    uid: "api::user-profile.user-profile",
    fields: ["username", "updatedAt"],
  },
} as const

export type SitemapSource = keyof typeof SOURCES
export const SITEMAP_BATCH_SIZE = 1000

export function isSitemapSource(value: string): value is SitemapSource {
  return Object.hasOwn(SOURCES, value)
}

const nonempty = { $notNull: true, $ne: "" }

/** Count and range reads share exactly the same visibility predicate. */
export function sitemapQuery(source: SitemapSource, locale: string) {
  const config = SOURCES[source]
  const filters: Record<string, unknown>[] = []
  if ("seo" in config) {
    filters.push({
      $or: [
        { seo: { metaRobots: { $null: true } } },
        {
          seo: {
            metaRobots: {
              $notContainsi: "noindex",
            },
          },
        },
      ],
    })
    filters.push({
      $or: [
        { seo: { metaRobots: { $null: true } } },
        { seo: { metaRobots: { $notContainsi: "none" } } },
      ],
    })
  }
  if (source === "profiles") {
    filters.push({ profileVisibility: "public", username: nonempty })
  } else if (source === "events") {
    filters.push(publicEventFilters())
  } else {
    filters.push({ slug: nonempty })
  }
  if (source === "drives") filters.push({ status: { $in: ["open", "closed"] } })
  if (source === "continents") {
    filters.push({
      countries: { libraries: { publishedAt: { $notNull: true }, locale } },
    })
  }
  if (source === "countries" || source === "regions") {
    // Only locations with a published Library in this language are indexable.
    filters.push({ libraries: { publishedAt: { $notNull: true }, locale } })
  }
  if (source === "libraries") {
    filters.push({
      continent: { slug: nonempty },
      country: { slug: nonempty },
      region: { slug: nonempty },
    })
  }
  if (source === "countries" || source === "regions") {
    filters.push({ continent: { slug: nonempty } })
  }
  if (source === "regions") filters.push({ country: { slug: nonempty } })

  return {
    ...("published" in config ? { status: "published" as const } : {}),
    ...("localized" in config ? { locale } : {}),
    filters: { $and: filters },
  }
}

export async function sitemapCount(
  strapi: Core.Strapi,
  source: SitemapSource,
  locale: string
) {
  return strapi
    .documents(SOURCES[source].uid)
    .count(sitemapQuery(source, locale) as never)
}

export async function sitemapRows(
  strapi: Core.Strapi,
  source: SitemapSource,
  locale: string,
  window: { after: number; start: number; limit: number }
) {
  const config = SOURCES[source]
  const query = sitemapQuery(source, locale)
  const rows = await strapi.documents(config.uid).findMany({
    ...query,
    filters: {
      $and: [
        query.filters,
        ...(window.after ? [{ id: { $gt: window.after } }] : []),
      ],
    },
    fields: [...config.fields],
    ...("populate" in config ? { populate: config.populate } : {}),
    sort: "id:asc",
    start: window.start,
    limit: window.limit,
  } as never)
  // Project again: Document Service results also contain implicit system fields.
  // In particular, public profile discovery must never expose private attributes.
  return rows.map((row) => {
    const record = row as unknown as Record<string, unknown>
    const keys = [
      "id",
      ...config.fields,
      ...("populate" in config ? Object.keys(config.populate) : []),
    ]

    return Object.fromEntries(keys.map((key) => [key, record[key]]))
  })
}
