import "server-only"
import { SUPPORTED_LOCALES } from "@repo/shared-data"

import { PublicStrapiClient } from "@/lib/strapi-api"

import { batchRunReports, Ga4Error, ga4Config } from "./ga4-data-api"
import {
  libraryPagePaths,
  summariseTraffic,
  type TrafficRange,
  type TrafficReport,
  trafficRequests,
} from "./traffic-source"

/**
 * A library's traffic report. The caller must already have checked Library
 * Staff access and the `library.traffic` entitlement for `documentId`: this
 * resolves the library's own public paths on the server, so a caller can't
 * choose another library's filter or the property-wide report.
 */

const TTL_MS = 30 * 60_000
const MAX_ENTRIES = 500
const cache = new Map<string, { at: number; report: TrafficReport }>()

function remember(key: string, report: TrafficReport) {
  if (cache.size >= MAX_ENTRIES) {
    const oldest = cache.keys().next().value
    if (oldest !== undefined) cache.delete(oldest)
  }
  cache.set(key, { at: Date.now(), report })
}

type PathRow = {
  slug?: string | null
  continent?: { slug?: string | null } | null
  country?: { slug?: string | null } | null
  region?: { slug?: string | null } | null
}

/** The published library's public paths in every locale, or null. */
async function pagePathsOf(documentId: string): Promise<string[] | null> {
  const res = (await PublicStrapiClient.fetchMany(
    "api::library.library",
    {
      filters: { documentId: { $eq: documentId } },
      fields: ["slug"],
      populate: {
        continent: { fields: ["slug"] },
        country: { fields: ["slug"] },
        region: { fields: ["slug"] },
      },
      status: "published",
      pagination: { pageSize: 1 },
    } as never,
    { next: { revalidate: 300 } }
  )) as { data?: PathRow[] }
  const row = res.data?.[0]
  if (!row) return null

  return libraryPagePaths(
    [row.continent?.slug, row.country?.slug, row.region?.slug, row.slug],
    SUPPORTED_LOCALES
  )
}

export async function getTrafficReport(
  documentId: string,
  range: TrafficRange
): Promise<TrafficReport> {
  const config = ga4Config()
  if (!config) return { status: "unconfigured" }

  let paths: string[] | null
  try {
    paths = await pagePathsOf(documentId)
  } catch {
    return { status: "unavailable", reason: "error" }
  }
  if (!paths) return { status: "no-page" }

  const key = `${config.propertyId}:${documentId}:${range}:${paths[0]}`
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < TTL_MS) return hit.report

  try {
    const reports = await batchRunReports(config, trafficRequests(paths, range))
    const report: TrafficReport = {
      status: "ready",
      summary: summariseTraffic(reports, range),
    }
    remember(key, report)

    return report
  } catch (error) {
    const reason =
      error instanceof Ga4Error && error.kind === "quota" ? "quota" : "error"
    console.error(
      "[traffic] report failed:",
      error instanceof Error ? error.message : "unknown error"
    )

    return { status: "unavailable", reason }
  }
}
