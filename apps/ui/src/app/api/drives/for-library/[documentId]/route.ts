import { driveFilters } from "@repo/shared-data"
import { NextResponse } from "next/server"

import { isDocumentIdParam } from "@/lib/bridge-params"
import { loadDriveViews } from "@/lib/drives/drive-view-server"
import { fetchDrives } from "@/lib/drives/drives-server"
import type { Drive } from "@/lib/drives/types"
import { meiliClient, searchLocaleFilter } from "@/lib/meilisearch"
import {
  clientIp,
  createRateLimiter,
  rateLimitResponse,
} from "@/lib/rate-limit"

const limiter = createRateLimiter({
  name: "drive-for-library",
  max: 120,
  windowMs: 60_000,
})

const CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
}

type FacetCounts = {
  facetDistribution?: Record<string, Record<string, number>>
}

const localeCount = (result: FacetCounts | undefined) =>
  Object.values(result?.facetDistribution?.locale ?? {}).reduce(
    (sum, n) => sum + n,
    0
  )

const noData = () =>
  NextResponse.json({ data: null }, { headers: CACHE_HEADERS })

/**
 * The first open drive (pinned first, as `fetchDrives` orders them) whose
 * "to do" filter still includes this library. One `multiSearch`, one query
 * per open drive. Null on no match or a Meilisearch failure.
 */
async function findDriveForLibrary(
  drives: readonly Drive[],
  documentId: string,
  locale: string | undefined
): Promise<Drive | null> {
  const localeClause = searchLocaleFilter(locale)
  const idClause = `documentId = ${JSON.stringify(documentId)}`

  try {
    const { results } = await meiliClient.multiSearch({
      queries: drives.map((d) => {
        const { todo } = driveFilters({
          scope: d.scope,
          focus: d.focus,
          openedAt: d.openedAt,
        })

        return {
          indexUid: "library",
          filter: `${todo} AND ${idClause} AND ${localeClause}`,
          limit: 0,
          facets: ["locale"],
        }
      }),
    })

    const i = results.findIndex(
      (r) => localeCount(r as unknown as FacetCounts) > 0
    )

    return i !== -1 ? (drives[i] ?? null) : null
  } catch {
    return null
  }
}

/**
 * GET /api/drives/for-library/[documentId]?locale= — the open drive this
 * library belongs to, with its progress numbers, for the library page's
 * `LibraryDriveNote` (the page is `force-static`, so it reads this
 * client-side). Public, rate limited to 120 a minute per IP. A Meilisearch
 * failure reads as no drive rather than an error.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ documentId: string }> }
) {
  const limit = await limiter.check(clientIp(req))
  if (!limit.ok) return rateLimitResponse(limit)

  const { documentId } = await params
  if (!isDocumentIdParam(documentId)) {
    return NextResponse.json({ error: "Invalid documentId" }, { status: 400 })
  }

  const { searchParams } = new URL(req.url)
  const locale = searchParams.get("locale") ?? undefined

  const drives = await fetchDrives("open", locale)
  if (drives.length === 0) return noData()

  const drive = await findDriveForLibrary(drives, documentId, locale)
  if (!drive) return noData()

  const [view] = await loadDriveViews([drive], locale)
  if (!view) return noData()

  return NextResponse.json(
    {
      data: {
        documentId: drive.documentId,
        slug: drive.slug,
        title: drive.title,
        focus: drive.focus,
        unit: drive.unit,
        done: view.progress?.done ?? 0,
        total: view.progress?.total ?? 0,
      },
    },
    { headers: CACHE_HEADERS }
  )
}
