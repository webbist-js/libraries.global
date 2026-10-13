import "server-only"

import type { Locale } from "next-intl"

import type { AboutLibrary } from "@/components/about/about.types"
import { buildLibraryPath } from "@/lib/library-helpers"
import { logNonBlockingError } from "@/lib/logging"
import { routing } from "@/lib/navigation"
import { PublicStrapiClient } from "@/lib/strapi-api"
import type { PopulatedFeaturedLibraryData } from "@/lib/strapi-api/content/server"
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
