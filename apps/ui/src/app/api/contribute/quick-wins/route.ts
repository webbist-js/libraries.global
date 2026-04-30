import { headers } from "next/headers"
import { NextResponse } from "next/server"

import { getSessionSSR } from "@/lib/auth-server"

const STRAPI = process.env.STRAPI_URL ?? "http://127.0.0.1:1337"
const SECRET = process.env.STRAPI_BRIDGE_SECRET ?? ""
const READONLY_TOKEN = process.env.STRAPI_REST_READONLY_API_KEY ?? ""
const FOUR_HOURS_MS = 4 * 60 * 60 * 1000

export async function GET() {
  const session = await getSessionSSR(await headers())
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const baUserId = session.user.id
  try {
    const res = await fetch(
      `${STRAPI}/api/user-profiles?filters[baUserId][$eq]=${encodeURIComponent(baUserId)}&populate[quickWins]=true&fields[0]=quickWinsComputedAt`,
      {
        cache: "no-store",
        headers: READONLY_TOKEN
          ? { Authorization: `Bearer ${READONLY_TOKEN}` }
          : {},
      }
    )
    if (!res.ok) return NextResponse.json({ data: [], total: 0 })
    const json = (await res.json()) as {
      data?: { quickWins?: unknown[]; quickWinsComputedAt?: string }[]
    }
    const profile = json.data?.[0]
    const wins = profile?.quickWins ?? []
    const computedAt = profile?.quickWinsComputedAt ?? null

    // Fire-and-forget recompute if stale
    if (
      !computedAt ||
      Date.now() - new Date(computedAt).getTime() > FOUR_HOURS_MS
    ) {
      fetch(`${STRAPI}/api/auth-bridge/compute-quick-wins`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Service-Secret": SECRET,
        },
        body: JSON.stringify({ baUserId }),
      }).catch(() => {})
    }

    return NextResponse.json({ data: wins, total: wins.length, computedAt })
  } catch {
    return NextResponse.json({ data: [], total: 0, computedAt: null })
  }
}
