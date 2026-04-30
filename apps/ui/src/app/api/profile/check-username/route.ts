import { headers } from "next/headers"
import { NextResponse } from "next/server"

import { auth } from "@/lib/auth"

const STRAPI = process.env.STRAPI_URL ?? "http://127.0.0.1:1337"
const API_TOKEN = process.env.STRAPI_REST_READONLY_API_KEY

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

  let data: unknown[]
  try {
    const res = await fetch(
      `${STRAPI}/api/user-profiles?filters[username][$eq]=${encodeURIComponent(username)}&fields[0]=id`,
      {
        cache: "no-store",
        headers: API_TOKEN ? { Authorization: `Bearer ${API_TOKEN}` } : {},
      }
    )
    if (!res.ok) return NextResponse.json({ available: null, reason: "error" })
    const json = (await res.json()) as { data: unknown[] }
    data = json.data
  } catch {
    return NextResponse.json({ available: null, reason: "unavailable" })
  }

  return NextResponse.json({ available: data.length === 0 })
}
