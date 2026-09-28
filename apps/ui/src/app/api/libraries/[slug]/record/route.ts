import { NextResponse } from "next/server"
import type { Locale } from "next-intl"

import {
  type OpeningTimesValue,
  toLatLng,
} from "@/components/library/library-page.helpers"
import { type Cell, csvChunks } from "@/lib/export-format"
import { buildLibraryPath } from "@/lib/library-helpers"
import { absoluteUrl } from "@/lib/seo/metadata"
import { fetchLibrary } from "@/lib/strapi-api/content/server"

export const revalidate = 300

const LICENCE = "CC BY-SA 4.0"
const ATTRIBUTION =
  "Libraries Global contributors. Imported details keep their original licence; see the record's sources."

const CSV_COLUMNS = [
  "entityRef",
  "name",
  "libraryType",
  "operationalStatus",
  "streetAddress",
  "city",
  "postalCode",
  "region",
  "country",
  "lat",
  "lng",
  "timezone",
  "website",
  "phone",
  "email",
  "catalogueUrl",
  "foundedYear",
  "openedYear",
  "url",
  "licence",
] as const

const names = (items: unknown) =>
  ((items ?? []) as { name?: string | null }[]).flatMap((i) =>
    i.name ? [i.name] : []
  )

/**
 * GET /api/libraries/{slug}/record?format=json|csv — one published library
 * record as open data, with its licence. Library facts are free, so this is
 * not gated; bulk export stays the Pro Atlas export.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const url = new URL(req.url)
  const format = url.searchParams.get("format") === "csv" ? "csv" : "json"
  const locale = (url.searchParams.get("locale") ?? "en") as Locale

  const res = await fetchLibrary(slug, locale)
  const library = res?.data
  if (!library)
    return NextResponse.json({ error: "Library not found" }, { status: 404 })

  const rec = library as unknown as Record<string, unknown>
  const coords = toLatLng(library.location)
  const path = buildLibraryPath(library)
  const pageUrl = path ? absoluteUrl(path.slice(1), locale) : null
  const openingTimes = library.openingTimes as OpeningTimesValue | null
  const str = (key: string) => (rec[key] as string | null | undefined) ?? null

  const record = {
    entityRef: library.entityRef ?? null,
    name: library.name ?? null,
    slug: library.slug ?? null,
    url: pageUrl,
    libraryType: library.libraryType ?? null,
    operationalStatus: str("operationalStatus"),
    operatorType: str("operatorType"),
    address: {
      streetAddress: library.streetAddress ?? null,
      city: library.city ?? null,
      postalCode: library.postalCode ?? null,
      region: library.region?.name ?? null,
      country: library.country?.name ?? null,
      countryCode: library.country?.iso2 ?? null,
    },
    location: coords,
    timezone: str("timezone"),
    openingTimes: openingTimes?.days
      ? openingTimes.days.map((d) => ({
          day: d.day,
          open: d.enabled,
          times: (d.enabled ? d.timeframes : []).map((tf) => ({
            start: tf.startTime,
            end: tf.endTime,
            staffing: tf.staffing ?? null,
          })),
        }))
      : null,
    contact: {
      website: str("website"),
      phone: str("phone"),
      email: str("email"),
      catalogueUrl: str("catalogueUrl"),
    },
    history: {
      foundedYear: str("foundedYear"),
      openedYear: str("openedYear"),
      closedYear: str("closedYear"),
    },
    accessibility: names(library.accessibility),
    services: names(library.services),
    amenities: names(library.amenities),
    source: str("source"),
    lastVerifiedAt: str("lastVerifiedAt"),
    updatedAt: str("updatedAt"),
    licence: LICENCE,
    attribution: ATTRIBUTION,
  }

  const filename = `${library.slug ?? "library"}.${format}`
  const headers = {
    "Content-Disposition": `attachment; filename="${filename}"`,
    "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600",
    "X-Licence": LICENCE,
  }

  if (format === "json")
    return NextResponse.json(record, {
      headers: {
        ...headers,
        "Content-Type": "application/json; charset=utf-8",
      },
    })

  const row: Record<(typeof CSV_COLUMNS)[number], Cell> = {
    entityRef: record.entityRef,
    name: record.name,
    libraryType: record.libraryType,
    operationalStatus: record.operationalStatus,
    streetAddress: record.address.streetAddress,
    city: record.address.city,
    postalCode: record.address.postalCode,
    region: record.address.region,
    country: record.address.country,
    lat: coords?.lat,
    lng: coords?.lng,
    timezone: record.timezone,
    website: record.contact.website,
    phone: record.contact.phone,
    email: record.contact.email,
    catalogueUrl: record.contact.catalogueUrl,
    foundedYear: record.history.foundedYear,
    openedYear: record.history.openedYear,
    url: pageUrl,
    licence: LICENCE,
  }

  return new NextResponse([...csvChunks([row], CSV_COLUMNS)].join(""), {
    headers: { ...headers, "Content-Type": "text/csv; charset=utf-8" },
  })
}
