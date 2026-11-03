import type { Core } from "@strapi/strapi"

import { tallyLibrariesByChild } from "./library-tally"

/**
 * Countries, regions and areas that have published libraries, with counts.
 * Shared by the Atlas place filters and the Team API's place endpoints.
 * Each level is one tally query per parent, so a country list costs one
 * query per continent and never loads libraries into memory.
 */

export type CatalogPlace = {
  documentId: string
  name: string
  slug: string
  libraryCount: number
}
export type CatalogCountry = CatalogPlace & {
  iso2: string | null
  iso3: string | null
  continent: string | null
}

const SLUG = /^[a-z0-9][a-z0-9-]{0,99}$/

export const isPlaceSlug = (value: unknown): value is string =>
  typeof value === "string" && SLUG.test(value)

type Options = { locale: string; status?: "published" }
type Row = { documentId: string; name: string; slug: string }

const byName = (a: { name: string }, b: { name: string }) =>
  a.name.localeCompare(b.name)

function counted(
  places: Row[],
  tallies: Map<string, { count?: number }> | null
): CatalogPlace[] {
  return places
    .map((place) => ({
      documentId: place.documentId,
      name: place.name,
      slug: place.slug,
      libraryCount: tallies?.get(place.documentId)?.count ?? 0,
    }))
    .filter((place) => place.libraryCount > 0)
    .sort(byName)
}

/** Every country with published libraries. */
export async function countriesWithLibraries(
  strapi: Core.Strapi,
  { locale, status = "published" }: Options
): Promise<CatalogCountry[]> {
  const rows = (await strapi.documents("api::country.country").findMany({
    fields: ["name", "slug", "iso2", "iso3"],
    populate: { continent: { fields: ["slug"] } },
    locale,
    status,
    limit: 500,
  })) as (Row & {
    iso2?: string | null
    iso3?: string | null
    continent?: { documentId: string; slug: string } | null
  })[]
  const continents = new Map<string, string>()
  for (const row of rows)
    if (row.continent)
      continents.set(row.continent.documentId, row.continent.slug)
  const tallies = new Map<string, { count?: number }>()
  for (const continentId of continents.keys()) {
    const tally = await tallyLibrariesByChild(strapi, {
      parent: "continent",
      parentDocumentId: continentId,
      child: "country",
      locale,
      status,
    }).catch(() => null)
    for (const [id, value] of tally ?? []) tallies.set(id, value)
  }

  return rows
    .map((row) => ({
      documentId: row.documentId,
      name: row.name,
      slug: row.slug,
      iso2: row.iso2 ?? null,
      iso3: row.iso3 ?? null,
      continent: row.continent?.slug ?? null,
      libraryCount: tallies.get(row.documentId)?.count ?? 0,
    }))
    .filter((row) => row.libraryCount > 0)
    .sort(byName)
}

/** A country and its regions with libraries; null when there is no such country. */
export async function regionsWithLibraries(
  strapi: Core.Strapi,
  countrySlug: string,
  { locale, status = "published" }: Options
): Promise<{
  country: Row & { regionRows: Row[] }
  regions: CatalogPlace[]
} | null> {
  const [country] = (await strapi.documents("api::country.country").findMany({
    filters: { slug: { $eq: countrySlug } },
    fields: ["name", "slug"],
    populate: { regions: { fields: ["name", "slug"] } },
    locale,
    status,
    limit: 1,
  })) as (Row & { regions?: Row[] })[]
  if (!country) return null
  const tallies = await tallyLibrariesByChild(strapi, {
    parent: "country",
    parentDocumentId: country.documentId,
    child: "region",
    locale,
    status,
  }).catch(() => null)

  return {
    country: { ...country, regionRows: country.regions ?? [] },
    regions: counted(country.regions ?? [], tallies as never),
  }
}

/** A region of the country and its areas with libraries; null when either is unknown. */
export async function areasWithLibraries(
  strapi: Core.Strapi,
  countrySlug: string,
  regionSlug: string,
  options: Options
): Promise<{ region: Row; areas: CatalogPlace[] } | null> {
  const { locale, status = "published" } = options
  const parent = await regionsWithLibraries(strapi, countrySlug, options)
  const region = parent?.country.regionRows.find((r) => r.slug === regionSlug)
  if (!region) return null
  const [withAreas] = (await strapi.documents("api::region.region").findMany({
    filters: { documentId: { $eq: region.documentId } },
    fields: ["slug"],
    populate: { areas: { fields: ["name", "slug"] } },
    locale,
    status,
    limit: 1,
  })) as { areas?: Row[] }[]
  const tallies = await tallyLibrariesByChild(strapi, {
    parent: "region",
    parentDocumentId: region.documentId,
    child: "area",
    locale,
    status,
  }).catch(() => null)

  return { region, areas: counted(withAreas?.areas ?? [], tallies as never) }
}
