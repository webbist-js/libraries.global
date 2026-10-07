import { headers } from "next/headers"
import { NextResponse } from "next/server"

import { auth } from "@/lib/auth"
import { isDocumentIdParam } from "@/lib/bridge-params"
import { createRateLimiter, rateLimitResponse } from "@/lib/rate-limit"

const STRAPI = process.env.STRAPI_URL ?? "http://127.0.0.1:1337"
const SECRET = process.env.STRAPI_BRIDGE_SECRET

const limiter = createRateLimiter({ name: "follow", max: 30, windowMs: 60_000 })

/** What a follow points at, as the Strapi bridge names it. */
type FollowTarget = { libraryDocumentId: string } | { driveDocumentId: string }

function missingSecret() {
  return NextResponse.json({ error: "Bridge not configured" }, { status: 500 })
}

const badTarget = () =>
  NextResponse.json(
    { error: "Send one of libraryDocumentId or driveDocumentId" },
    { status: 400 }
  )

/**
 * Exactly one of `libraryDocumentId` and `driveDocumentId`, each a Strapi
 * documentId. Null when neither, both, or a malformed id is sent.
 */
function followTargetOf(
  libraryDocumentId: unknown,
  driveDocumentId: unknown
): FollowTarget | null {
  const isLibrary = libraryDocumentId != null
  if (isLibrary === (driveDocumentId != null)) return null
  const id = isLibrary ? libraryDocumentId : driveDocumentId
  if (typeof id !== "string" || !isDocumentIdParam(id)) return null

  return isLibrary ? { libraryDocumentId: id } : { driveDocumentId: id }
}

export async function GET(req: Request) {
  if (!SECRET) return missingSecret()
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const target = followTargetOf(
    searchParams.get("libraryDocumentId"),
    searchParams.get("driveDocumentId")
  )
  if (!target) return badTarget()

  const params = new URLSearchParams({ baUserId: session.user.id, ...target })
  const res = await fetch(
    `${STRAPI}/api/auth-bridge/follow-status?${params.toString()}`,
    { headers: { "X-Service-Secret": SECRET }, cache: "no-store" }
  )
  if (!res.ok) return NextResponse.json({ following: false })

  const json = await res.json()

  return NextResponse.json(json)
}

export async function POST(req: Request) {
  if (!SECRET) return missingSecret()
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const limit = await limiter.check(session.user.id)
  if (!limit.ok) return rateLimitResponse(limit)

  let body: {
    libraryDocumentId?: unknown
    driveDocumentId?: unknown
    action?: unknown
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const input: typeof body = body && typeof body === "object" ? body : {}
  const { action, libraryDocumentId, driveDocumentId } = input
  if (action !== "follow" && action !== "unfollow")
    return NextResponse.json({ error: "Missing action" }, { status: 400 })
  const target = followTargetOf(libraryDocumentId, driveDocumentId)
  if (!target) return badTarget()

  const res = await fetch(`${STRAPI}/api/auth-bridge/toggle-follow`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Service-Secret": SECRET },
    body: JSON.stringify({ baUserId: session.user.id, ...target, action }),
  })
  if (res.status === 404)
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (!res.ok)
    return NextResponse.json(
      { error: "Failed to update follow" },
      { status: 500 }
    )

  const json = await res.json()

  return NextResponse.json(json)
}
