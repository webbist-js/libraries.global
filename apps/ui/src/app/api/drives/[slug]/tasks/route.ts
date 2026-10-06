import { driveFilters } from "@repo/shared-data"
import { NextResponse } from "next/server"

import { fetchDrive, fetchDriveInReview } from "@/lib/drives/drives-server"
import type { DriveTask } from "@/lib/drives/types"
import { meiliClient, searchLocaleFilter } from "@/lib/meilisearch"
import {
  clientIp,
  createRateLimiter,
  rateLimitResponse,
} from "@/lib/rate-limit"

const limiter = createRateLimiter({
  name: "drive-tasks",
  max: 120,
  windowMs: 60_000,
})

const PAGE_SIZE = 10
/** A drive opens with at most DRIVE_MAX_TASKS (2,000) tasks (ADR-0004). */
const MAX_PAGE = 200

const RETRIEVE = [
  "documentId",
  "slug",
  "name",
  "city",
  "district",
  "area_name",
  "region_name",
  "continent_slug",
  "country_slug",
  "region_slug",
  "website",
  "_geo",
] as const

interface DriveTaskHit {
  documentId: string
  slug: string
  name: string
  city?: string | null
  district?: string | null
  area_name?: string | null
  region_name?: string | null
  continent_slug?: string | null
  country_slug?: string | null
  region_slug?: string | null
  website?: string | null
  _geo?: { lat: number; lng: number } | null
  _geoDistance?: number
}

const quotedIds = (ids: readonly string[]) =>
  `[${ids.map((id) => JSON.stringify(id)).join(", ")}]`

/** `?page=` as a whole number from 0 to MAX_PAGE; anything else reads as 0. */
function pageParam(raw: string | null): number {
  const n = Number.parseInt(raw ?? "", 10)

  return Number.isFinite(n) ? Math.min(Math.max(n, 0), MAX_PAGE) : 0
}

/** `?near=lat,lng`, or null when missing or not two finite numbers. */
function nearParam(raw: string | null): { lat: number; lng: number } | null {
  if (!raw) return null
  const [latRaw, lngRaw] = raw.split(",")
  const lat = Number.parseFloat(latRaw ?? "")
  const lng = Number.parseFloat(lngRaw ?? "")

  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null
}

/** The library page's path, or null when a parent slug is missing. */
function hrefOf(hit: DriveTaskHit): string | null {
  const { continent_slug, country_slug, region_slug, slug } = hit

  return continent_slug && country_slug && region_slug && slug
    ? `/${continent_slug}/${country_slug}/${region_slug}/${slug}`
    : null
}

function taskOf(hit: DriveTaskHit): DriveTask {
  const {
    continent_slug: _continentSlug,
    country_slug: _countrySlug,
    region_slug: _regionSlug,
    _geoDistance,
    ...rest
  } = hit

  return {
    ...rest,
    href: hrefOf(hit),
    inReview: false,
    ...(_geoDistance != null ? { distanceKm: _geoDistance / 1000 } : {}),
  }
}

/**
 * GET /api/drives/[slug]/tasks?q=&near=lat,lng&page= — one page of a Drive's
 * open task list: libraries in its scope that still need its focus, minus
 * anything already pending or in `needs_info` review (the in-review ids come
 * from Strapi's `GET /drives/:documentId/in-review`). Public, rate limited.
 * Sorted by completeness, or by distance when `near` is given; `q` searches
 * names and places over the scope. 404 for a drive that doesn't exist, isn't
 * published, or isn't currently open (scheduled or closed alike).
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const limit = await limiter.check(clientIp(req))
  if (!limit.ok) return rateLimitResponse(limit)

  const { slug } = await params
  const { searchParams } = new URL(req.url)
  const locale = searchParams.get("locale") ?? undefined
  const q = searchParams.get("q")?.trim() ?? ""
  const near = nearParam(searchParams.get("near"))
  const page = pageParam(searchParams.get("page"))

  const drive = await fetchDrive(slug, locale)
  if (!drive || drive.status !== "open") {
    return NextResponse.json({ error: "Drive not found." }, { status: 404 })
  }

  const inReview = await fetchDriveInReview(drive.documentId)
  const filters = driveFilters({
    scope: drive.scope,
    focus: drive.focus,
    openedAt: drive.openedAt,
  })
  const exclusion =
    inReview.length > 0 ? ` AND documentId NOT IN ${quotedIds(inReview)}` : ""

  const result = await meiliClient.index("library").search<DriveTaskHit>(q, {
    filter: `${filters.todo} AND ${searchLocaleFilter(locale)}${exclusion}`,
    sort: near
      ? [`_geoPoint(${near.lat}, ${near.lng}):asc`]
      : ["completeness:desc", "name:asc"],
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
    attributesToRetrieve: [...RETRIEVE],
  })

  const data = (result.hits ?? []).map((hit) => taskOf(hit))
  const total = result.estimatedTotalHits ?? page * PAGE_SIZE + data.length
  const hasMore = page * PAGE_SIZE + data.length < total

  return NextResponse.json({ data, page, hasMore })
}
