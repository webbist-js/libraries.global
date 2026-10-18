import { driveFilters } from "@repo/shared-data"
import { headers } from "next/headers"
import { NextResponse } from "next/server"

import { getSessionSSR } from "@/lib/auth-server"
import { fetchHolds } from "@/lib/drives/drive-holds-server"
import {
  exclusionClause,
  MAX_PAGE,
  nearParam,
  PAGE_SIZE,
  TASK_ATTRIBUTES,
  taskOf,
  taskPlaceFilter,
  taskSort,
  type DriveTaskHit,
} from "@/lib/drives/drive-tasks"
import { fetchDrive, fetchDriveInReview } from "@/lib/drives/drives-server"
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

/** `?page=` as a whole number from 0 to MAX_PAGE; anything else reads as 0. */
function pageParam(raw: string | null): number {
  const n = raw && /^\d+$/.test(raw) ? Number(raw) : 0

  return Number.isFinite(n) ? Math.min(Math.max(n, 0), MAX_PAGE) : 0
}

/**
 * GET /api/drives/[slug]/tasks?q=&near=lat,lng&page= — one page of a Drive's
 * open task list: libraries in its scope that still need its focus, minus
 * anything already pending or in `needs_info` review (the in-review ids come
 * from Strapi's `GET /drives/:documentId/in-review`). Public, rate limited.
 * Sorted by completeness, or by distance when `near` is given; `q` searches
 * names and places over the scope. 404 for a drive that doesn't exist, isn't
 * published, or isn't currently open (scheduled or closed alike). A
 * signed-in reader's response also marks rows someone else currently holds
 * (`heldByOther`); a signed-out reader never sees holds, since only a
 * signed-in reader can place one.
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

  const session = await getSessionSSR(await headers())
  const [inReview, holds] = await Promise.all([
    fetchDriveInReview(drive.documentId),
    fetchHolds(drive.documentId, session?.user ?? null),
  ])
  const filters = driveFilters({
    scope: drive.scope,
    focus: drive.focus,
    openedAt: drive.openedAt,
  })

  const result = await meiliClient.index("library").search<DriveTaskHit>(q, {
    filter: `${filters.todo} AND ${searchLocaleFilter(locale)}${taskPlaceFilter(Object.fromEntries(searchParams))}${exclusionClause(inReview)}`,
    sort: taskSort(near),
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
    facets: ["locale"],
    attributesToRetrieve: [...TASK_ATTRIBUTES],
  })

  const heldByOthers = new Set(holds.heldByOthers)
  const data = (result.hits ?? []).map((hit) => ({
    ...taskOf(hit, near),
    heldByOther: heldByOthers.has(hit.documentId),
  }))
  const locales = result.facetDistribution?.locale
  const total = locales
    ? Object.values(locales).reduce((sum, n) => sum + n, 0)
    : (result.estimatedTotalHits ?? page * PAGE_SIZE + data.length)
  const hasMore = page * PAGE_SIZE + data.length < total

  return NextResponse.json(
    { data, page, hasMore, total, pageSize: PAGE_SIZE },
    {
      headers: { "Cache-Control": "private, no-store" },
    }
  )
}
