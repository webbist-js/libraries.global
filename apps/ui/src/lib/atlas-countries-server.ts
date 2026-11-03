import "server-only"

import { atlasPopulationBaseline } from "@repo/shared-data"

import { createAtlasBackend } from "@/lib/atlas-backend"
import {
  boundaryFor,
  type AtlasCountriesResponse,
  type AtlasCountryDetail,
  type AtlasCountryGeometry,
  type AtlasCountryOption,
} from "@/lib/atlas-countries"
import { placeGapCounts } from "@/lib/find-search"
import { meiliClient, searchLocaleFilter } from "@/lib/meilisearch"
import { PublicStrapiClient } from "@/lib/strapi-api"

type Facets = Record<string, Record<string, number>> | undefined

/** The build's country tiles when they match the baseline, else its GeoJSON. */
export async function countryGeometry(
  signal: AbortSignal
): Promise<AtlasCountryGeometry> {
  const fallback: AtlasCountryGeometry = {
    type: "geojson",
    url: atlasPopulationBaseline.geometryUrl,
    property: "iso3",
  }
  if (process.env.ATLAS_QUERY_ENABLED !== "true") return fallback
  try {
    const tiles = (await createAtlasBackend(signal).state()).manifest
      ?.countryTiles

    return tiles?.version === atlasPopulationBaseline.version
      ? {
          type: "pmtiles",
          url: tiles.url,
          sourceLayer: "countries",
          property: "iso3",
        }
      : fallback
  } catch {
    return fallback
  }
}

type StrapiCountryRow = Omit<AtlasCountryOption, "libraries" | "boundary">

async function strapiCountries(locale: string): Promise<StrapiCountryRow[]> {
  const res = (await PublicStrapiClient.fetchAPI("/countries/atlas", {
    locale: locale as never,
  })) as { data?: StrapiCountryRow[] }

  return res.data ?? []
}

/** Library counts per country slug: one faceted, zero-hit search. */
async function countsBySlug(locale: string): Promise<Record<string, number>> {
  const res = await meiliClient.index("library").search("", {
    filter: searchLocaleFilter(locale),
    limit: 0,
    facets: ["country_slug"],
  })

  return (res.facetDistribution as Facets)?.country_slug ?? {}
}

/** Every country (the picker lists those with libraries) and the boundaries. */
export async function atlasCountries(
  locale: string,
  signal: AbortSignal
): Promise<AtlasCountriesResponse> {
  const [geometry, rows, counts] = await Promise.all([
    countryGeometry(signal),
    strapiCountries(locale),
    countsBySlug(locale).catch(() => ({}) as Record<string, number>),
  ])

  return {
    geometry,
    countries: rows
      .map((row) => ({
        ...row,
        boundary: boundaryFor(row),
        libraries: counts[row.slug] ?? 0,
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  }
}

/**
 * One country for the drawer: Strapi's counts and regions, the index's
 * origin-Dataset facet (named from the registry) and its gap counts.
 */
export async function atlasCountryDetail(
  slug: string,
  locale: string
): Promise<AtlasCountryDetail | null> {
  const row = { slug }
  const filter = `country_slug = ${JSON.stringify(row.slug)} AND ${searchLocaleFilter(locale)}`
  const [facets, gaps] = await Promise.all([
    meiliClient
      .index("library")
      .search("", { filter, limit: 0, facets: ["source", "locale"] })
      .then((res) => res.facetDistribution as Facets)
      .catch(() => {}),
    placeGapCounts("country", row.slug, locale),
  ])
  const bySource = facets?.source ?? {}
  const total = Object.values(facets?.locale ?? {}).reduce((a, b) => a + b, 0)
  const keys = Object.keys(bySource)
  const res = (await PublicStrapiClient.fetchAPI(
    `/countries/atlas/${encodeURIComponent(slug)}`,
    {
      locale: locale as never,
      ...(keys.length ? { datasets: keys.slice(0, 20).join(",") } : {}),
    } as never
  )) as {
    data?: Omit<AtlasCountryDetail, "sources" | "community" | "gaps"> & {
      datasets: Omit<AtlasCountryDetail["sources"][number], "count">[]
    }
  }
  if (!res.data) return null
  const { datasets, ...country } = res.data
  const named = new Map(datasets.map((dataset) => [dataset.key, dataset]))
  const sources = keys
    .map((key) => ({
      key,
      name: named.get(key)?.name ?? key,
      publisher: named.get(key)?.publisher ?? null,
      licence: named.get(key)?.licence ?? null,
      licenceUrl: named.get(key)?.licenceUrl ?? null,
      sourceUrl: named.get(key)?.sourceUrl ?? null,
      count: bySource[key] ?? 0,
    }))
    .sort((a, b) => b.count - a.count)
  const sourced = sources.reduce((sum, source) => sum + source.count, 0)

  return {
    ...country,
    sources,
    community: Math.max(0, total - sourced),
    gaps: gaps?.gaps ?? {},
  }
}
