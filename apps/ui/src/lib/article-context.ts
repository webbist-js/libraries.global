import type { ArticleGeography } from "@repo/shared-data"

import { buildLibraryPath } from "@/lib/library-helpers"

export type ArticleContextPlace = {
  documentId?: string
  name?: string | null
  slug?: string | null
}
export type ArticleContextLibrary = ArticleContextPlace & {
  continent?: { slug?: string | null } | null
  country?: { slug?: string | null } | null
  region?: { slug?: string | null } | null
}
export type ArticleEventCitation = {
  citationId?: string | null
  title?: string | null
  startTime?: string | null
  endTime?: string | null
  timezone?: string | null
  url?: string | null
  library?: ArticleContextLibrary | null
}
export type ArticleContextData = {
  topics?: readonly ArticleContextPlace[] | null
  libraries?: readonly ArticleContextLibrary[] | null
  continents?: readonly ArticleContextPlace[] | null
  countries?: readonly ArticleContextPlace[] | null
  regions?: readonly ArticleContextPlace[] | null
  areas?: readonly ArticleContextPlace[] | null
  geographyFacet?: ArticleGeography | null
  eventMentions?: readonly ArticleEventCitation[] | null
}
export const ARTICLE_PLACE_GROUPS = [
  "continents",
  "countries",
  "regions",
  "areas",
] as const

/** Historical geography wins even when a stamped group is empty. */
export function articleContextPlaces(article: ArticleContextData) {
  return ARTICLE_PLACE_GROUPS.flatMap((key) => {
    const values = article.geographyFacet?.[key] ?? article[key]
    const places = Array.isArray(values)
      ? values.filter((place): place is ArticleContextPlace =>
          Boolean(place && typeof place.name === "string" && place.name.trim())
        )
      : []

    return places.length ? [{ key, places }] : []
  })
}
const hasControl = (value: string) =>
  Array.from(value).some((char) => {
    const code = char.codePointAt(0) ?? 0

    return code < 32 || code === 127
  })

/** Relations cannot turn canonical internal paths into arbitrary destinations. */
export function articleLibraryHref(
  library: ArticleContextLibrary
): string | null {
  const parts = [
    library.continent?.slug,
    library.country?.slug,
    library.region?.slug,
    library.slug,
  ]
  if (
    !parts.every(
      (part): part is string =>
        typeof part === "string" &&
        Boolean(part.trim()) &&
        part === part.trim() &&
        !hasControl(part) &&
        !/[/?#\\]/u.test(part) &&
        part !== "." &&
        part !== ".."
    )
  )
    return null
  const [continent, country, region, slug] = parts.map(encodeURIComponent)

  return buildLibraryPath({
    slug,
    continent: { slug: continent },
    country: { slug: country },
    region: { slug: region },
  })
}

/** Event citations expose only their stored, absolute public HTTP source. */
export function articleCitationHref(value?: string | null): string | null {
  if (
    typeof value !== "string" ||
    !value ||
    hasControl(value) ||
    value.includes("\\")
  )
    return null
  try {
    const url = new URL(value)

    return ["https:", "http:"].includes(url.protocol) &&
      !url.username &&
      !url.password
      ? url.href
      : null
  } catch {
    return null
  }
}

export function articleCitationTimezone(value?: string | null): string {
  if (value) {
    try {
      new Intl.DateTimeFormat("en", { timeZone: value })

      return value
    } catch {
      /* Use explicit UTC for an invalid legacy zone. */
    }
  }

  return "UTC"
}
export function articleCitationDate(
  value: string | null | undefined,
  locale: string,
  timezone: string
): string | null {
  if (!value) return null
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return null

  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: timezone,
  }).format(date)
}
