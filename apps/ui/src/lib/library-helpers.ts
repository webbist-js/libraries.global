/**
 * Builds the internal path for a library detail page.
 * Pattern: /[continent]/[country]/[region]/[slug]
 * Returns null if any required slug is missing (library can't be linked).
 */
export function buildLibraryPath(library: {
  slug?: string | null
  continent?: { slug?: string | null } | null
  country?: { slug?: string | null } | null
  region?: { slug?: string | null } | null
}): string | null {
  const { slug, continent, country, region } = library
  if (!slug || !continent?.slug || !country?.slug || !region?.slug) return null

  return `/${continent.slug}/${country.slug}/${region.slug}/${slug}`
}
