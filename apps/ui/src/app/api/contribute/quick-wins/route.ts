import { headers } from "next/headers"
import { NextResponse } from "next/server"

import { getSessionSSR } from "@/lib/auth-server"
import { readOwnProfile } from "@/lib/own-profile-server"

const STRAPI = process.env.STRAPI_URL ?? "http://127.0.0.1:1337"
const SECRET = process.env.STRAPI_BRIDGE_SECRET ?? ""
const FOUR_HOURS_MS = 4 * 60 * 60 * 1000

export async function GET() {
  const session = await getSessionSSR(await headers())
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const baUserId = session.user.id
  try {
    // Own profile through the bridge, keyed on the session's Better Auth id
    // (`baUserId` is private, so the public REST filter can't find it).
    const lookup = await readOwnProfile(session.user)
    if (!lookup.ok) return NextResponse.json({ data: [], total: 0 })
    const wins = lookup.profile.quickWins ?? []
    const computedAt = lookup.profile.quickWinsComputedAt ?? null

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
