import { headers } from "next/headers"
import { NextResponse } from "next/server"

import { getSessionSSR } from "@/lib/auth-server"
import { bridgeUserHeaders } from "@/lib/bridge-user-headers"
import { fetchDrive } from "@/lib/drives/drives-server"
import { createRateLimiter, rateLimitResponse } from "@/lib/rate-limit"

const STRAPI = process.env.STRAPI_URL ?? "http://127.0.0.1:1337"

const limiter = createRateLimiter({
  name: "drive-mine",
  max: 60,
  windowMs: 60_000,
})

/** A whole, non-negative count; anything else reads as 0. */
const count = (v: unknown) =>
  typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.floor(v)) : 0

/**
 * GET /api/drives/[slug]/mine — "Your part": the signed-in user's
 * Submissions sent for this Drive, those still in review, and their
 * accepted work (Drive Credits), from Strapi's bridge-gated
 * `GET /drives/:documentId/mine`. The user always comes from the session.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await getSessionSSR(await headers())
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const limit = await limiter.check(session.user.id)
  if (!limit.ok) return rateLimitResponse(limit)

  const { slug } = await params
  const locale = new URL(req.url).searchParams.get("locale") ?? undefined
  const drive = await fetchDrive(slug, locale)
  if (!drive) {
    return NextResponse.json({ error: "Drive not found." }, { status: 404 })
  }

  try {
    const res = await fetch(
      `${STRAPI}/api/drives/${encodeURIComponent(drive.documentId)}/mine`,
      { cache: "no-store", headers: bridgeUserHeaders(session.user) }
    )
    if (!res.ok) {
      return NextResponse.json({ error: "Upstream error" }, { status: 502 })
    }
    const json = (await res.json()) as {
      data?: { sent?: unknown; inReview?: unknown; accepted?: unknown }
    }

    return NextResponse.json(
      {
        data: {
          sent: count(json.data?.sent),
          inReview: count(json.data?.inReview),
          accepted: count(json.data?.accepted),
        },
      },
      { headers: { "Cache-Control": "no-store" } }
    )
  } catch {
    return NextResponse.json({ error: "Upstream error" }, { status: 502 })
  }
}
