import { driveFilters } from "@repo/shared-data"
import { headers } from "next/headers"
import { NextResponse } from "next/server"

import { getSessionSSR } from "@/lib/auth-server"
import { isDocumentIdParam, readJsonCapped } from "@/lib/bridge-params"
import { fetchHolds, placeHold } from "@/lib/drives/drive-holds-server"
import {
  exclusionClause,
  nearParam,
  TASK_ATTRIBUTES,
  taskOf,
  taskPlaceFilter,
  taskSort,
  type DriveTaskHit,
} from "@/lib/drives/drive-tasks"
import { fetchDrive, fetchDriveInReview } from "@/lib/drives/drives-server"
import { meiliClient, searchLocaleFilter } from "@/lib/meilisearch"
import { createRateLimiter, rateLimitResponse } from "@/lib/rate-limit"

const MAX_BODY_BYTES = 16_384
const MAX_SKIP = 200
const CANDIDATE_LIMIT = 5

/** Shared with the hold routes (spec §6.4 and §11). */
const limiter = createRateLimiter({
  name: "drive-next",
  max: 30,
  windowMs: 60_000,
})

/** Up to 200 valid documentIds from an unchecked body value. */
function skipParam(v: unknown): string[] {
  if (!Array.isArray(v)) return []

  return v
    .filter((x): x is string => typeof x === "string" && isDocumentIdParam(x))
    .slice(0, MAX_SKIP)
}

/** Trimmed, 100 characters or fewer; `""` for anything else. */
function qParam(v: unknown): string {
  if (typeof v !== "string") return ""

  return v.trim().slice(0, 100)
}

/**
 * POST /api/drives/[slug]/next — "Give me a library": the first open task
 * near the top of the list that isn't in review, held, or already skipped
 * this session, held for the reader on the spot. Signed in only; shares its
 * rate limit with the hold routes.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await getSessionSSR(await headers())
  const user = session?.user
  if (!user) {
    return NextResponse.json(
      { error: "Sign in to get a library." },
      { status: 401 }
    )
  }

  const limit = await limiter.check(user.id)
  if (!limit.ok) return rateLimitResponse(limit)

  const { slug } = await params
  const parsed = await readJsonCapped(req, MAX_BODY_BYTES)
  if (!parsed.ok) {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: parsed.status }
    )
  }
  const body = (parsed.body ?? {}) as {
    skip?: unknown
    q?: unknown
    near?: unknown
    locale?: unknown
    place?: Record<string, unknown>
  }
  const skip = skipParam(body.skip)
  const q = qParam(body.q)
  const near = nearParam(typeof body.near === "string" ? body.near : null)
  const locale = typeof body.locale === "string" ? body.locale : undefined

  const drive = await fetchDrive(slug, locale)
  if (!drive || drive.status !== "open") {
    return NextResponse.json(
      { error: "Drive not found." },
      { status: 404, headers: { "Cache-Control": "no-store" } }
    )
  }

  const [inReview, holds] = await Promise.all([
    fetchDriveInReview(drive.documentId),
    fetchHolds(drive.documentId, user),
  ])
  const exclude = [...new Set([...inReview, ...holds.heldByOthers, ...skip])]

  const filters = driveFilters({
    scope: drive.scope,
    focus: drive.focus,
    openedAt: drive.openedAt,
  })
  const result = await meiliClient.index("library").search<DriveTaskHit>(q, {
    filter: `${filters.todo} AND ${searchLocaleFilter(locale)}${taskPlaceFilter(body.place ?? {})}${exclusionClause(exclude)}`,
    sort: taskSort(near),
    limit: CANDIDATE_LIMIT,
    attributesToRetrieve: [...TASK_ATTRIBUTES],
  })
  const hits = result.hits ?? []

  if (hits.length === 0) {
    return NextResponse.json(
      {
        data: null,
        message: "Every library left is in review, held or skipped.",
      },
      { headers: { "Cache-Control": "no-store" } }
    )
  }

  for (const hit of hits) {
    const held = await placeHold(drive.documentId, hit.documentId, user)
    if (held.ok) {
      return NextResponse.json(
        { data: { ...taskOf(hit, near), heldUntil: held.expiresAt } },
        { headers: { "Cache-Control": "no-store" } }
      )
    }
  }

  return NextResponse.json(
    {
      data: null,
      message:
        "Every library near the top of the list is taken. Try again in a minute.",
    },
    { headers: { "Cache-Control": "no-store" } }
  )
}
