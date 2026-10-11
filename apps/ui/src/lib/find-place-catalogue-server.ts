import "server-only"

import { DEFAULT_LOCALE, isSupportedLocale } from "@repo/shared-data"
import qs from "qs"

import { strapiServiceHeaders } from "@/lib/bridge-user-headers"
import type { FindPlaceLevel } from "@/lib/find-places"
import type { FindPlaceRef } from "@/lib/find-search"

const countryFields = [
  "name",
  "slug",
  "regionTypeLabel",
  "regionsSectionLabel",
  "areaTypeLabel",
  "areasSectionLabel",
]
const regionFields = ["name", "slug", "areaTypeLabel", "areasSectionLabel"]
const continent = { fields: ["name", "slug"] }
const country = { fields: countryFields, populate: { continent } }
const region = { fields: regionFields, populate: { country, continent } }
const shapes = {
  continent,
  country,
  region,
  area: { fields: ["name", "slug"], populate: { region, country, continent } },
}
const collections = {
  continent: "continents",
  country: "countries",
  region: "regions",
  area: "areas",
}
type CataloguePlace = FindPlaceRef & {
  continent?: CataloguePlace
  country?: CataloguePlace
  region?: CataloguePlace
}

/** One catalogue record supplies labels and ancestry even when it has no libraries. */
export async function findPlaceCatalogue(
  place: { level: FindPlaceLevel; slug: string },
  requestedLocale?: string
): Promise<Partial<Record<FindPlaceLevel, FindPlaceRef>> | undefined> {
  if (!process.env.STRAPI_URL) return undefined
  const locale = isSupportedLocale(requestedLocale)
    ? requestedLocale
    : DEFAULT_LOCALE
  const read = async (
    language: string
  ): Promise<CataloguePlace | undefined> => {
    const query = qs.stringify(
      {
        ...shapes[place.level],
        locale: language,
        status: "published",
        filters: { slug: { $eq: place.slug } },
        pagination: { limit: 1 },
      },
      { encodeValuesOnly: true }
    )
    const res = await fetch(
      `${process.env.STRAPI_URL}/api/${collections[place.level]}?${query}`,
      {
        headers: {
          ...strapiServiceHeaders(),
          ...(process.env.STRAPI_REST_READONLY_API_KEY
            ? {
                Authorization: `Bearer ${process.env.STRAPI_REST_READONLY_API_KEY}`,
              }
            : {}),
        },
        next: {
          revalidate: 60,
          tags: ["strapi", "continent", "country", "region", "area"],
        },
      }
    )
    if (!res.ok) throw new Error("Place catalogue unavailable")

    return ((await res.json()) as { data?: CataloguePlace[] }).data?.[0]
  }
  try {
    const record =
      (await read(locale)) ??
      (locale !== DEFAULT_LOCALE ? await read(DEFAULT_LOCALE) : undefined)
    if (!record) return undefined
    const chain: Partial<Record<FindPlaceLevel, FindPlaceRef>> = {
      [place.level]: record,
    }
    const parentRegion = record.region
    const parentCountry = record.country ?? parentRegion?.country
    if (parentRegion) chain.region = parentRegion
    if (parentCountry) chain.country = parentCountry
    const parentContinent =
      record.continent ?? parentCountry?.continent ?? parentRegion?.continent
    if (parentContinent) chain.continent = parentContinent

    // Do not serialize nested copies of the whole ancestry to client components.
    return Object.fromEntries(
      Object.entries(chain).map(([level, value]) => {
        const {
          continent: _continent,
          country: _country,
          region: _region,
          ...ref
        } = value as CataloguePlace

        return [level, ref]
      })
    )
  } catch {
    return undefined
  }
}
