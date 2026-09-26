/**
 * SEO for the continent / country / region pages.
 *
 * These pages are programmatic: titles, descriptions and intro copy are
 * derived from the data. CMS fields (`seo`, `about`, `summary`) only override.
 * A location page earns a place in the index through its records — pages
 * below MIN_INDEXABLE_LIBRARIES are `noindex, follow` and left out of the
 * sitemap, so empty templates never reach search engines.
 */

import type { Data } from "@repo/strapi-types"

import { buildLibraryPath } from "@/lib/library-helpers"
import { absoluteUrl } from "@/lib/seo/metadata"
import type {
  LibraryTypeCount,
  PopulatedFeaturedLibraryData,
} from "@/lib/strapi-api/content/server"

/** Published libraries a location needs before it is indexed. */
export const MIN_INDEXABLE_LIBRARIES = 1

export function isIndexableLocation(libraryCount: number | null | undefined) {
  return (libraryCount ?? 0) >= MIN_INDEXABLE_LIBRARIES
}

export function locationRobots(libraryCount: number | null | undefined) {
  return isIndexableLocation(libraryCount) ? "index" : "noindex-follow"
}

function joinList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? ""

  return `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`
}

/** "12 public, 8 academic and 3 national" — the top three types by count. */
export function describeLibraryTypes(
  typeCounts: LibraryTypeCount[] | null | undefined,
  max = 3
): string | null {
  const top = (typeCounts ?? []).filter((t) => t.count > 0).slice(0, max)
  if (top.length === 0) return null

  return joinList(top.map((t) => `${t.count} ${t.type.toLowerCase()}`))
}

/**
 * One factual sentence (plus a nudge) for the meta description and the hero
 * intro when no summary has been written.
 */
export function buildLocationDescription(opts: {
  name: string
  libraryCount: number | null | undefined
  typeCounts?: LibraryTypeCount[] | null
  /** e.g. "country", "county" — what the page lets you browse by. */
  childLabel?: string | null
}): string {
  const { name, childLabel, libraryCount, typeCounts } = opts
  const count = libraryCount ?? 0

  if (count === 0) {
    return `No libraries in ${name} are documented yet. Know one? Add it to the open index of the world's libraries.`
  }

  const noun = count === 1 ? "library" : "libraries"
  const types = describeLibraryTypes(typeCounts)
  const breakdown =
    types && (typeCounts?.length ?? 0) > 1 ? `, including ${types}` : ""
  const browse = childLabel
    ? `Browse by ${childLabel.toLowerCase()}, see them on the map, and check opening hours and services.`
    : "See them on the map and check opening hours and services."

  return `${count.toLocaleString("en")} ${noun} documented in ${name}${breakdown}. ${browse}`
}

/** Title, with the CMS override winning. */
export function locationTitle(
  seo: Data.Component<"shared.seo"> | null | undefined,
  fallback: string
): string {
  return seo?.metaTitle?.trim() || fallback
}

/**
 * ItemList of the libraries shown on the page (the featured cards), or null
 * when there are none — structured data must mirror visible content.
 */
export function buildLibraryItemListSchema(opts: {
  name: string
  path: string
  locale: string
  libraries: PopulatedFeaturedLibraryData[] | null | undefined
}) {
  const items = (opts.libraries ?? []).flatMap((lib) => {
    const path = buildLibraryPath(lib)

    return lib.name && path
      ? [{ name: lib.name, url: absoluteUrl(path, opts.locale) }]
      : []
  })
  if (items.length === 0) return null

  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: opts.name,
    url: absoluteUrl(opts.path, opts.locale),
    numberOfItems: items.length,
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      url: item.url,
    })),
  }
}
