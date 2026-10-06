import { headers } from "next/headers"
import { NextResponse } from "next/server"

import { getSessionSSR } from "@/lib/auth-server"
import { releaseHeld } from "@/lib/drives/drive-holds-server"
import { fetchDrive } from "@/lib/drives/drives-server"
import { createRateLimiter, rateLimitResponse } from "@/lib/rate-limit"

/** Shared with POST /api/drives/[slug]/next and the holds route. */
const limiter = createRateLimiter({
  name: "drive-next",
  max: 30,
  windowMs: 60_000,
})

/**
 * DELETE /api/drives/[slug]/holds/[libraryDocumentId] — release the
 * reader's own hold, fired without waiting on Skip. Always 204: a hold
 * is a courtesy, and releasing one early is best effort.
 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ slug: string; libraryDocumentId: string }> }
) {
  const session = await getSessionSSR(await headers())
  const user = session?.user
  if (!user) return new NextResponse(null, { status: 401 })

  const limit = await limiter.check(user.id)
  if (!limit.ok) return rateLimitResponse(limit)

  const { slug, libraryDocumentId } = await params
  const locale = new URL(req.url).searchParams.get("locale") ?? undefined
  const drive = await fetchDrive(slug, locale)
  if (drive) await releaseHeld(drive.documentId, libraryDocumentId, user)

  return new NextResponse(null, { status: 204 })
}
