import { headers } from "next/headers"
import { NextResponse } from "next/server"

import { auth } from "@/lib/auth"

const STRAPI = process.env.STRAPI_URL ?? "http://127.0.0.1:1337"
const SECRET = process.env.STRAPI_BRIDGE_SECRET

function missingSecret() {
  return NextResponse.json({ error: "Bridge not configured" }, { status: 500 })
}

export async function GET(req: Request) {
  if (!SECRET) return missingSecret()
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const libraryDocumentId = searchParams.get("libraryDocumentId")
  if (!libraryDocumentId)
    return NextResponse.json(
      { error: "Missing libraryDocumentId" },
      { status: 400 }
    )

  const url = `${STRAPI}/api/auth-bridge/follow-status?baUserId=${encodeURIComponent(session.user.id)}&libraryDocumentId=${encodeURIComponent(libraryDocumentId)}`
  const res = await fetch(url, {
    headers: { "X-Service-Secret": SECRET },
    cache: "no-store",
  })
  if (!res.ok) return NextResponse.json({ following: false })

  const json = await res.json()

  return NextResponse.json(json)
}

export async function POST(req: Request) {
  if (!SECRET) return missingSecret()
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let body: { libraryDocumentId?: string; action?: "follow" | "unfollow" }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const { libraryDocumentId, action } = body
  if (!libraryDocumentId || !action)
    return NextResponse.json(
      { error: "Missing libraryDocumentId or action" },
      { status: 400 }
    )

  const res = await fetch(`${STRAPI}/api/auth-bridge/toggle-follow`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Service-Secret": SECRET },
    body: JSON.stringify({
      baUserId: session.user.id,
      libraryDocumentId,
      action,
    }),
  })
  if (!res.ok)
    return NextResponse.json(
      { error: "Failed to update follow" },
      { status: 500 }
    )

  const json = await res.json()

  return NextResponse.json(json)
}
