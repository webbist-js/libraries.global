import { headers } from "next/headers"
import { NextResponse } from "next/server"

import { auth } from "@/lib/auth"
import { bridgeUserHeaders } from "@/lib/bridge-user-headers"

const STRAPI = process.env.STRAPI_URL ?? "http://127.0.0.1:1337"

export async function GET(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user)
    return NextResponse.json({ available: false }, { status: 401 })
  const { searchParams } = new URL(req.url)
  const username = searchParams.get("username")?.trim().toLowerCase()
  if (!username || username.length < 3)
    return NextResponse.json({ available: false, reason: "too_short" })
  if (!/^[a-z0-9_]+$/.test(username))
    return NextResponse.json({ available: false, reason: "invalid_chars" })

  let available: boolean
  try {
    const res = await fetch(
      `${STRAPI}/api/user-profiles/check-username?username=${encodeURIComponent(username)}`,
      {
        cache: "no-store",
        headers: bridgeUserHeaders(session.user),
      }
    )
    if (!res.ok) return NextResponse.json({ available: null, reason: "error" })
    const json = (await res.json()) as { available: boolean }
    available = json.available === true
  } catch {
    return NextResponse.json({ available: null, reason: "unavailable" })
  }

  return NextResponse.json({ available })
}
