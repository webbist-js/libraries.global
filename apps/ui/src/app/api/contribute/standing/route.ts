import { headers } from "next/headers"
import { NextResponse } from "next/server"

import { getSessionSSR } from "@/lib/auth-server"
import { fetchSubmissionCounts } from "@/lib/role-application-server"

const STRAPI = process.env.STRAPI_URL ?? "http://127.0.0.1:1337"
const SECRET = process.env.STRAPI_BRIDGE_SECRET ?? ""

/**
 * The caller's rewards standing, plus `acceptedCount`: approved submissions
 * that aren't Role Applications (what applying for an editor role needs),
 * and the pending quota: `pendingCount` submissions waiting for review, at
 * most `pendingLimit` (both null when Strapi can't say).
 */
export async function GET() {
  const session = await getSessionSSR(await headers())
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const baUserId = session.user.id
  try {
    const [res, counts] = await Promise.all([
      fetch(`${STRAPI}/api/rewards/my-standing`, {
        cache: "no-store",
        headers: {
          "X-Ba-User-Id": baUserId,
          "X-Service-Secret": SECRET,
        },
      }),
      fetchSubmissionCounts(session.user),
    ])
    if (!res.ok)
      return NextResponse.json({ error: "Upstream error" }, { status: 502 })
    const json = (await res.json()) as Record<string, unknown>

    return NextResponse.json({
      ...json,
      acceptedCount: counts.accepted,
      pendingCount: counts.pending,
      pendingLimit: counts.pendingLimit,
    })
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}
