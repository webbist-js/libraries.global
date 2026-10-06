import { headers } from "next/headers"
import { NextResponse } from "next/server"

import { getSessionSSR } from "@/lib/auth-server"
import { readJsonCapped } from "@/lib/bridge-params"
import { placeHold } from "@/lib/drives/drive-holds-server"
import { fetchDrive } from "@/lib/drives/drives-server"
import { createRateLimiter, rateLimitResponse } from "@/lib/rate-limit"

const MAX_BODY_BYTES = 4096

/** Shared with POST /api/drives/[slug]/next (spec §6.4 and §11). */
const limiter = createRateLimiter({
  name: "drive-next",
  max: 30,
  windowMs: 60_000,
})

/**
 * POST /api/drives/[slug]/holds — hold one library for the signed-in
 * reader when they pick a row by hand, so two helpers don't fill the same
 * record. Answers Strapi's own status: 200 on success, 409 when someone
 * else holds it, 422 when the drive isn't open, 404 for an unknown drive.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await getSessionSSR(await headers())
  const user = session?.user
  if (!user) {
    return NextResponse.json(
      { error: "Sign in to help with this drive." },
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
  const body = (parsed.body ?? {}) as { libraryDocumentId?: unknown }
  const libraryDocumentId = body.libraryDocumentId
  if (typeof libraryDocumentId !== "string" || libraryDocumentId.length === 0) {
    return NextResponse.json({ error: "Invalid library" }, { status: 400 })
  }

  const locale = new URL(req.url).searchParams.get("locale") ?? undefined
  const drive = await fetchDrive(slug, locale)
  if (!drive) {
    return NextResponse.json({ error: "Drive not found." }, { status: 404 })
  }

  const result = await placeHold(drive.documentId, libraryDocumentId, user)
  if (!result.ok) {
    return NextResponse.json(
      { error: result.message },
      { status: result.status, headers: { "Cache-Control": "no-store" } }
    )
  }

  return NextResponse.json(
    { data: { expiresAt: result.expiresAt } },
    { headers: { "Cache-Control": "no-store" } }
  )
}
