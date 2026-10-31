import "server-only"

import type { Locale } from "next-intl"
import { getTranslations } from "next-intl/server"

import {
  buildLibraryPath,
  meiliClient,
  searchLocale,
  searchLocaleFilter,
} from "@/lib/meilisearch"
import {
  SITE_SEARCH_GROUPS,
  type SiteSearchGroup,
  type SiteSearchItem,
  type SiteSearchResponse,
} from "@/lib/site-search"
import { PublicStrapiClient } from "@/lib/strapi-api"

type Row = Record<string, unknown>
const str = (value: unknown) => (typeof value === "string" ? value : "")
const LIMIT = 6
const INDEX: Partial<Record<SiteSearchGroup, string>> = {
  libraries: "library",
  journal: "blog-article",
  knowledge: "wiki-article",
  events: "event",
}
const FIELDS: Record<string, string[]> = {
  libraries: [
    "documentId",
    "name",
    "slug",
    "shortName",
    "libraryType",
    "city",
    "continent_slug",
    "country_slug",
    "country_name",
    "region_slug",
  ],
  journal: [
    "documentId",
    "title",
    "slug",
    "summary",
    "section_slug",
    "section_name",
    "locale",
  ],
  knowledge: [
    "documentId",
    "title",
    "slug",
    "summary",
    "section_slug",
    "section_name",
    "locale",
  ],
  events: [
    "documentId",
    "title",
    "summary",
    "library_name",
    "startTime",
    "timezone",
  ],
}
function result(
  group: SiteSearchGroup,
  row: Row,
  locale: string
): SiteSearchItem | null {
  const title = str(group === "libraries" ? row.name : row.title)
  let href: string | null = null
  let summary = str(row.summary)
  if (group === "libraries") {
    href = buildLibraryPath({
      slug: str(row.slug),
      continent_slug: str(row.continent_slug),
      country_slug: str(row.country_slug),
      region_slug: str(row.region_slug),
    })
    // Mobile/digital records without a place hierarchy still have a useful index destination.
    href ??= `/libraries?q=${encodeURIComponent(title)}`
    summary = [str(row.libraryType), str(row.city), str(row.country_name)]
      .filter(Boolean)
      .join(" · ")
  } else if (group === "events") {
    href = row.documentId
      ? `/events/${encodeURIComponent(str(row.documentId))}`
      : null
    summary = [str(row.library_name), str(row.startTime).slice(0, 10)]
      .filter(Boolean)
      .join(" · ")
  } else if (row.slug) {
    href = `/${group}/${encodeURIComponent(str(row.section_slug) || "general")}/${encodeURIComponent(str(row.slug))}`
    if (str(row.locale) && row.locale !== locale)
      href += `?contentLang=${encodeURIComponent(str(row.locale))}`
    summary = [str(row.section_name), summary].filter(Boolean).join(" · ")
  }

  return title && href
    ? {
        id: `${group}:${str(row.documentId) || href}`,
        group,
        title: title.slice(0, 240),
        summary: summary.slice(0, 200),
        href,
      }
    : null
}
async function indexed(group: SiteSearchGroup, q: string, locale: string) {
  try {
    const data = await meiliClient.index(INDEX[group]!).search<Row>(
      q,
      {
        limit: LIMIT,
        filter:
          group === "events"
            ? `status IN ["upcoming", "ongoing"]`
            : searchLocaleFilter(locale),
        attributesToRetrieve: FIELDS[group],
        ...(!q && group === "libraries"
          ? { sort: ["featured:desc", "name:asc"] }
          : {}),
      },
      { signal: AbortSignal.timeout(5000) }
    )

    return {
      items: data.hits.flatMap((row) => result(group, row, locale) ?? []),
      total: data.estimatedTotalHits ?? data.hits.length,
      estimated: (data.estimatedTotalHits ?? 0) > 0,
    }
  } catch (error) {
    // A genuinely absent event index is an empty installation, not a search outage.
    if (
      group === "events" &&
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "index_not_found"
    )
      return { items: [], total: 0, estimated: false }
    throw error
  }
}
type Place = {
  documentId?: string
  name?: string
  slug?: string
  continent?: Place
  country?: Place
  region?: Place
}
async function places(q: string, locale: string) {
  const related = { fields: ["name", "slug"] }
  const levels = [
    { endpoint: "continents", level: "continent", populate: undefined },
    {
      endpoint: "countries",
      level: "country",
      populate: { continent: related },
    },
    {
      endpoint: "regions",
      level: "region",
      populate: { continent: related, country: related },
    },
    {
      endpoint: "areas",
      level: "area",
      populate: {
        country: { ...related, populate: { continent: related } },
        region: related,
      },
    },
  ]
  const responses = await Promise.all(
    levels.map(async (level) => {
      const res = (await PublicStrapiClient.fetchAPI(
        `/${level.endpoint}`,
        {
          locale: searchLocale(locale) as Locale,
          status: "published",
          filters: { name: { $containsi: q } },
          fields: ["name", "slug"],
          populate: level.populate,
          pagination: { pageSize: LIMIT, withCount: false },
          sort: ["name:asc"],
        },
        { signal: AbortSignal.timeout(5000) }
      )) as { data?: Place[] }

      return (res.data ?? []).flatMap((row) => {
        const country = row.country,
          continent = row.continent ?? country?.continent
        const parts =
          level.level === "continent"
            ? [row.slug]
            : level.level === "country"
              ? [continent?.slug, row.slug]
              : [
                  continent?.slug,
                  country?.slug,
                  level.level === "area" ? row.region?.slug : row.slug,
                ]
        if (
          !row.name ||
          !row.slug ||
          (level.level !== "area" && parts.some((part) => !part))
        )
          return []
        let href = `/${parts.map((part) => encodeURIComponent(part!)).join("/")}`
        if (level.level === "area")
          href = `/libraries?area=${encodeURIComponent(row.slug)}`

        return [
          {
            id: `place:${level.level}:${row.documentId ?? row.slug}`,
            group: "places" as const,
            title: row.name,
            summary: [row.region?.name, country?.name ?? continent?.name]
              .filter(Boolean)
              .join(" · "),
            href,
          },
        ]
      })
    })
  )

  return {
    items: responses.flat().slice(0, LIMIT),
    total: responses.flat().length,
    estimated: responses.flat().length >= LIMIT,
  }
}

export async function searchSite(
  q: string,
  locale: Locale
): Promise<SiteSearchResponse> {
  const t = await getTranslations({ locale, namespace: "siteSearch" })
  const catalogue = [
    ["home", "/", "home start overview"],
    ["atlas", "/map", "map analysis density access"],
    ["libraries", "/libraries", "find browse index"],
    ["journal", "/journal", "stories articles"],
    ["knowledge", "/knowledge", "help docs guides documentation"],
    ["community", "/community", "drives noticeboard contribute"],
    ["leaderboard", "/community/leaderboard", "points ranking contributors"],
    ["suggestions", "/community/suggestions", "vote checklist"],
    ["discussions", "/community/discussions", "forum conversations"],
    ["supporters", "/community/supporters", "support membership"],
    ["events", "/events", "calendar what's on"],
    ["plans", "/plans", "pricing pro team"],
    ["networks", "/library-networks", "services networks"],
    ["contribute", "/contribute", "add library edit correct"],
  ] as const
  const matchingPages: SiteSearchItem[] = catalogue.flatMap(
    ([key, href, keywords]) => {
      const title = t(key!)

      return !q ||
        `${title} ${keywords}`
          .toLocaleLowerCase(locale)
          .includes(q.toLocaleLowerCase(locale))
        ? [
            {
              id: `page:${key}`,
              group: "pages" as const,
              title,
              summary: t("destination"),
              href: href!,
            },
          ]
        : []
    }
  )
  const pages = matchingPages.slice(0, LIMIT)
  const response: SiteSearchResponse = {
    items: pages,
    counts: { pages: matchingPages.length },
    estimated: [],
    unavailable: [],
  }
  if (q.length === 1) return response
  const groups = SITE_SEARCH_GROUPS.filter(
    (group) => group !== "pages" && (Boolean(q) || group !== "places")
  )
  const settled = await Promise.allSettled(
    groups.map((group) =>
      group === "places" ? places(q, locale) : indexed(group, q, locale)
    )
  )
  settled.forEach((entry, index) => {
    const group = groups[index]!
    if (entry.status === "rejected") {
      response.unavailable.push(group)

      return
    }
    response.items.push(...entry.value.items)
    response.counts[group] = entry.value.total
    if (entry.value.estimated) response.estimated.push(group)
  })

  return response
}
