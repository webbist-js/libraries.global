import { headers } from "next/headers"
import { NextResponse } from "next/server"

import { getSessionSSR } from "@/lib/auth-server"
import { countAccepted } from "@/lib/role-application"
import { fetchMySubmissions } from "@/lib/role-application-server"

const STRAPI = process.env.STRAPI_URL ?? "http://127.0.0.1:1337"
const SECRET = process.env.STRAPI_BRIDGE_SECRET ?? ""

/**
 * The caller's rewards standing, plus `acceptedCount`: approved submissions
 * that aren't Role Applications (what applying for an editor role needs).
 */
export async function GET() {
  const session = await getSessionSSR(await headers())
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const baUserId = session.user.id
  try {
    const [res, submissions] = await Promise.all([
      fetch(`${STRAPI}/api/rewards/my-standing`, {
        cache: "no-store",
        headers: {
          "X-Ba-User-Id": baUserId,
          "X-Service-Secret": SECRET,
        },
      }),
      fetchMySubmissions(session.user),
    ])
    if (!res.ok)
      return NextResponse.json({ error: "Upstream error" }, { status: 502 })
    const json = (await res.json()) as Record<string, unknown>

    return NextResponse.json({
      ...json,
      acceptedCount: countAccepted(submissions),
    })
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}
