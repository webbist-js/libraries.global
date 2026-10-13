import "server-only"

import { atlasPopulationBaseline } from "@repo/shared-data"
import type { Locale } from "next-intl"

import type {
  AboutGlobeCountry,
  AboutGlobeRecord,
} from "@/components/about/about-globe.types"
import type { AboutLibrary } from "@/components/about/about.types"
import type { HomepageContinentSummary } from "@/components/home/homepage.types"
import { buildLibraryPath } from "@/lib/library-helpers"
import { logNonBlockingError } from "@/lib/logging"
import { routing } from "@/lib/navigation"
import { PublicStrapiClient } from "@/lib/strapi-api"
import type {
  PopulatedCountryData,
  PopulatedFeaturedLibraryData,
} from "@/lib/strapi-api/content/server"
import { formatStrapiMediaUrlForClient } from "@/lib/strapi-helpers"
import type { APIResponseCollection } from "@/types/api"

/** Published national libraries with photographs, selected across countries.
 * This reads existing records; About needs no extra CMS configuration. */
export async function fetchAboutLibraries(
  locale: Locale
): Promise<AboutLibrary[]> {
  try {
    const read = async (recordLocale: Locale) => {
      const response = (await PublicStrapiClient.fetchAPI("/libraries", {
        locale: recordLocale,
        status: "published",
        filters: {
          libraryType: { $eq: "National" },
          heroImage: { id: { $notNull: true } },
        },
        fields: ["name", "slug", "city", "summary"],
        populate: {
          heroImage: { fields: ["url", "alternativeText"] },
          country: { fields: ["name", "slug"] },
          continent: { fields: ["slug"] },
          region: { fields: ["slug"] },
        },
        sort: ["featured:desc", "name:asc", "documentId:asc"],
        pagination: { pageSize: 30 },
      })) as APIResponseCollection<PopulatedFeaturedLibraryData>

      return response?.data ?? []
    }
    let records = await read(locale)
    if (records.length === 0 && locale !== routing.defaultLocale)
      records = await read(routing.defaultLocale)

    const countries = new Set<string>()
    const libraries: AboutLibrary[] = []
    for (const record of records) {
      const image = formatStrapiMediaUrlForClient(record.heroImage?.url)
      const country = record.country?.slug ?? record.documentId
      if (!image || !record.name || countries.has(country)) continue
      countries.add(country)
      libraries.push({
        documentId: record.documentId,
        name: record.name,
        place: [record.city, record.country?.name].filter(Boolean).join(", "),
        image,
        imageAlt: record.heroImage?.alternativeText || record.name,
        summary: record.summary ?? null,
        href: buildLibraryPath(record),
      })
      if (libraries.length === 4) break
    }

    return libraries
  } catch (error) {
    logNonBlockingError({
      message: "Could not load national libraries for About",
      error: { error: error instanceof Error ? error.message : String(error) },
    })

    return []
  }
}

/** One compact catalog; expensive country statistics are fetched only on intent. */
export async function fetchAboutGlobeCountries(
  locale: Locale,
  continents:
    | readonly HomepageContinentSummary[]
    | Promise<readonly HomepageContinentSummary[]>
): Promise<AboutGlobeCountry[]> {
  try {
    const read = async (recordLocale: Locale) => {
      const page = async (number: number) =>
        (await PublicStrapiClient.fetchAPI("/countries", {
          locale: recordLocale,
          status: "published",
          fields: ["name", "slug", "iso2", "iso3"],
          populate: {
            continent: { fields: ["slug"] },
            mapConfig: { fields: ["centerLat", "centerLng"] },
          },
          pagination: { page: number, pageSize: 100 },
          sort: ["name:asc", "slug:asc"],
        })) as {
          data?: PopulatedCountryData[]
          meta?: { pagination?: { pageCount?: number } }
        }
      const first = await page(1)
      const pageCount = first.meta?.pagination?.pageCount ?? 1
      const rest = await Promise.all(
        Array.from({ length: Math.max(0, pageCount - 1) }, (_, index) =>
          page(index + 2)
        )
      )

      return [first, ...rest].flatMap((response) => response.data ?? [])
    }
    let rows = await read(locale)
    if (!rows.length && locale !== routing.defaultLocale)
      rows = await read(routing.defaultLocale)
    const counts = new Map(
      (await continents).flatMap((continent) =>
        (continent.countries ?? []).map(
          (country) => [country.slug, country.libraryCount] as const
        )
      )
    )

    return rows.flatMap((country) => {
      const iso3 =
        country.iso3 ??
        atlasPopulationBaseline.countries.find(
          (entry) => entry.iso2 === country.iso2
        )?.iso3
      if (!iso3 || !country.slug || !country.name || !country.continent?.slug)
        return []
      const lat = country.mapConfig?.centerLat
      const lng = country.mapConfig?.centerLng

      return [
        {
          slug: country.slug,
          name: country.name,
          iso2: country.iso2 ?? null,
          iso3: iso3.toUpperCase(),
          continent: country.continent.slug,
          libraryCount: counts.get(country.slug) ?? null,
          center:
            typeof lat === "number" && typeof lng === "number"
              ? { lat, lng }
              : null,
        },
      ]
    })
  } catch (error) {
    logNonBlockingError({
      message: "Could not load About globe countries",
      error: { error: String(error) },
    })

    return []
  }
}

/** Always published, including in a preview session. No draft CMS data in hover cards. */
export async function fetchAboutGlobeRecord(
  slug: string,
  locale: Locale
): Promise<AboutGlobeRecord | null> {
  const read = async (recordLocale: Locale) => {
    const response = (await PublicStrapiClient.fetchAPI(
      `/countries/detail/${encodeURIComponent(slug)}`,
      { locale: recordLocale, status: "published" }
    )) as { data?: PopulatedCountryData | null }

    return response.data
  }
  let country = await read(locale)
  if (!country && locale !== routing.defaultLocale)
    country = await read(routing.defaultLocale)
  if (!country) return null

  return {
    summary: country.summary ?? null,
    capitalCity: country.capitalCity ?? null,
    libraryCount:
      country.statistics?.libraries === false
        ? null
        : (country.libraryCount ?? null),
    libraryTypeCounts:
      country.statistics?.types === false
        ? null
        : (country.libraryTypeCounts ?? null),
    featuredLibraries: (country.featuredLibraries ?? [])
      .slice(0, 3)
      .map((library) => ({
        name: library.name ?? "Library",
        place: library.city ?? library.region?.name ?? country!.name ?? "",
        type: library.libraryType ?? null,
        href: buildLibraryPath(library),
      })),
  }
}
