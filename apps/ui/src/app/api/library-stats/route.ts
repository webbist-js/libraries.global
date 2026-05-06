import { NextResponse } from "next/server"

import { meiliClient } from "@/lib/meilisearch"

export const revalidate = 1800 // 30 minutes

export async function GET() {
  const STRAPI = process.env.STRAPI_URL ?? "http://127.0.0.1:1337"
  const API_TOKEN = process.env.STRAPI_REST_READONLY_API_KEY

  const strapiHeaders: Record<string, string> = {}
  if (API_TOKEN) {
    strapiHeaders.Authorization = `Bearer ${API_TOKEN}`
  }

  try {
    const [indexStats, operationalFacets, countriesRes, regionsRes] =
      await Promise.all([
        meiliClient.index("library").getStats(),
        meiliClient.index("library").search("", {
          facets: ["operationalStatus"],
          hitsPerPage: 0,
        }),
        fetch(
          `${STRAPI}/api/countries?pagination[pageSize]=1&pagination[page]=1`,
          { headers: strapiHeaders, next: { revalidate: 1800 } }
        ).then((r) => (r.ok ? r.json() : null)),
        fetch(
          `${STRAPI}/api/regions?pagination[pageSize]=1&pagination[page]=1`,
          { headers: strapiHeaders, next: { revalidate: 1800 } }
        ).then((r) => (r.ok ? r.json() : null)),
      ])

    const totalLibraries = indexStats.numberOfDocuments

    const facetDist =
      (
        operationalFacets.facetDistribution as
          | Record<string, Record<string, number>>
          | undefined
      )?.operationalStatus ?? {}
    const openCount = facetDist["open"] ?? 0
    const percentOpen =
      totalLibraries > 0 ? Math.round((openCount / totalLibraries) * 100) : 0

    const totalCountries =
      (countriesRes as { meta?: { pagination?: { total?: number } } } | null)
        ?.meta?.pagination?.total ?? 0
    const totalRegions =
      (regionsRes as { meta?: { pagination?: { total?: number } } } | null)
        ?.meta?.pagination?.total ?? 0

    return NextResponse.json(
      { totalLibraries, totalCountries, totalRegions, percentOpen },
      {
        headers: {
          "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=3600",
        },
      }
    )
  } catch {
    return NextResponse.json(
      { totalLibraries: 0, totalCountries: 0, totalRegions: 0, percentOpen: 0 },
      { status: 200 }
    )
  }
}
