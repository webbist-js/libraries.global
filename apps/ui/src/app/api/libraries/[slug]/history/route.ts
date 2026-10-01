import { headers } from "next/headers"

import { requireEntitlement } from "@/lib/access-server"
import { auth } from "@/lib/auth"
import { isDocumentIdParam } from "@/lib/bridge-params"
import { fetchLibraryHistory } from "@/lib/strapi-api/content/server"

const MAX_PAGE = 100

/** `?page=` as a whole number from 1 to 100; anything else reads as 1. */
function pageParam(raw: string | null): number {
  const n = Number.parseInt(raw ?? "", 10)

  return Number.isFinite(n) ? Math.min(Math.max(n, 1), MAX_PAGE) : 1
}

async function sessionUser() {
  try {
    const session = await auth.api.getSession({ headers: await headers() })

    return session?.user ?? null
  } catch {
    return null
  }
}

/**
 * GET /api/libraries/[documentId]/history?page=: one page of a library's
 * Change Batches, for the Changes section's "Show older changes". Field
 * names are public, so no entitlement is required; previous → next values
 * are asked for only when the session has `library.history`, and Strapi
 * re-checks the bridge secret before sending them.
 *
 * The segment is `[slug]` because Next.js allows one dynamic name per
 * level and `/api/libraries/[slug]/record` already exists; here it holds a
 * documentId.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug: documentId } = await params
  if (!isDocumentIdParam(documentId))
    return Response.json({ error: "Invalid documentId" }, { status: 400 })
  const page = pageParam(new URL(req.url).searchParams.get("page"))

  const user = await sessionUser()
  const values = !!user && requireEntitlement(user, "library.history") === null
  const history = await fetchLibraryHistory(documentId, { page, values, user })
  if (!history)
    return Response.json(
      { error: "Change history is unavailable. Try again shortly." },
      { status: 502 }
    )

  // The answer depends on the viewer's plan, so it's never shared-cached.
  return Response.json(history, {
    headers: { "Cache-Control": "private, no-store" },
  })
}
