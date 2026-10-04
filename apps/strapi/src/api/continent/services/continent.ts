import { factories } from "@strapi/strapi"

import { countLibrariesByLocationPath } from "../../../utils/library-location-counts"

const HOMEPAGE_CONTINENT_ORDER = [
  "europe",
  "asia",
  "africa",
  "north-america",
  "south-america",
  "oceania",
  // Legacy / alternate slugs still map correctly via the lookup
  "americas",
  "na",
  "sa",
] as const
const HOMEPAGE_CONTINENT_ORDER_SET = new Set<string>(HOMEPAGE_CONTINENT_ORDER)

/** There are under 250 countries; a fixed cap keeps the read bounded. */
const COUNTRY_LIMIT = 500

type CountryRow = {
  name?: string | null
  slug?: string | null
  continent?: { slug?: string | null } | null
}

type HomepageSummaryParams = {
  locale?: string
  status: "draft" | "published"
}

const getOrderIndex = (continent: {
  code?: string | null
  name?: string | null
  slug?: string | null
}) => {
  const candidates = [continent.slug, continent.code, continent.name].filter(
    (value): value is string => typeof value === "string"
  )

  const match = candidates
    .map((value) => value.trim().toLowerCase())
    .find((value) => HOMEPAGE_CONTINENT_ORDER_SET.has(value))

  if (match == null) {
    return Number.MAX_SAFE_INTEGER
  }

  return HOMEPAGE_CONTINENT_ORDER.indexOf(
    match as (typeof HOMEPAGE_CONTINENT_ORDER)[number]
  )
}

export default factories.createCoreService(
  "api::continent.continent",
  ({ strapi }) => ({
    /**
     * Every continent with its library count, how many countries it has, and
     * the countries that have libraries (most first): one grouped count over
     * the location links, so the cost follows the places, not the libraries.
     */
    async getHomepageSummaries({ locale, status }: HomepageSummaryParams) {
      const [continents, countries, counts] = await Promise.all([
        strapi.documents("api::continent.continent").findMany({
          fields: ["documentId", "name", "slug", "code"],
          locale,
          status,
        }),
        strapi.documents("api::country.country").findMany({
          fields: ["name", "slug"],
          populate: { continent: { fields: ["slug"] } },
          locale,
          status,
          limit: COUNTRY_LIMIT,
        }) as Promise<CountryRow[]>,
        countLibrariesByLocationPath(strapi, { locale, status }),
      ])

      if (!Array.isArray(continents) || continents.length === 0) {
        return []
      }

      const summarise = (continent: { slug?: string | null }) => {
        const inContinent = countries.filter(
          (country): country is CountryRow & { slug: string } =>
            Boolean(country.slug) && country.continent?.slug === continent.slug
        )

        return {
          libraryCount: counts[continent.slug ?? ""] ?? 0,
          countryTotal: inContinent.length,
          countries: inContinent
            .map((country) => ({
              name: country.name ?? country.slug,
              slug: country.slug,
              libraryCount: counts[`${continent.slug}/${country.slug}`] ?? 0,
            }))
            .filter((country) => country.libraryCount > 0)
            .sort(
              (a, b) =>
                b.libraryCount - a.libraryCount || a.name.localeCompare(b.name)
            ),
        }
      }

      return continents
        .map((continent) => ({ ...continent, ...summarise(continent) }))
        .sort((left, right) => {
          const leftOrder = getOrderIndex(left)
          const rightOrder = getOrderIndex(right)

          if (leftOrder !== rightOrder) {
            return leftOrder - rightOrder
          }

          return (left.name ?? "").localeCompare(right.name ?? "")
        })
    },
  })
)
