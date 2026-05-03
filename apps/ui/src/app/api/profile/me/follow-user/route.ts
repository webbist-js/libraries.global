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
  const targetUsername = searchParams.get("targetUsername")
  if (!targetUsername)
    return NextResponse.json(
      { error: "Missing targetUsername" },
      { status: 400 }
    )

  const url = `${STRAPI}/api/auth-bridge/user-follow-status?baUserId=${encodeURIComponent(session.user.id)}&targetUsername=${encodeURIComponent(targetUsername)}`
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

  let body: { username?: string; action?: "follow" | "unfollow" }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const { username, action } = body
  if (!username || !action)
    return NextResponse.json(
      { error: "Missing username or action" },
      { status: 400 }
    )

  const res = await fetch(`${STRAPI}/api/auth-bridge/toggle-follow-user`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Service-Secret": SECRET },
    body: JSON.stringify({
      baUserId: session.user.id,
      targetUsername: username,
      action,
    }),
  })

  if (res.status === 403) {
    return NextResponse.json(
      { error: "This profile cannot be followed" },
      { status: 403 }
    )
  }
  if (!res.ok)
    return NextResponse.json(
      { error: "Failed to update follow" },
      { status: 500 }
    )

  const json = await res.json()

  return NextResponse.json(json)
}
