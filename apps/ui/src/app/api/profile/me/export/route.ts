import { headers } from "next/headers"
import { NextResponse } from "next/server"

import { auth } from "@/lib/auth"

const STRAPI = process.env.STRAPI_URL ?? "http://127.0.0.1:1337"
const API_TOKEN = process.env.STRAPI_REST_READONLY_API_KEY

/**
 * GET /api/profile/me/export — download the signed-in user's profile data
 * as a JSON attachment. Sensitive linkage (baUserId) is stripped.
 */
export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const params = new URLSearchParams({
      "filters[baUserId][$eq]": session.user.id,
      "populate[avatar]": "*",
      "populate[languages]": "*",
      "populate[interests][fields][0]": "name",
      "populate[interests][fields][1]": "slug",
      "populate[followedLibraries][fields][0]": "name",
      "populate[followedLibraries][fields][1]": "slug",
      "populate[claimedLibraries][fields][0]": "name",
      "populate[claimedLibraries][fields][1]": "slug",
    })
    const res = await fetch(`${STRAPI}/api/user-profiles?${params}`, {
      cache: "no-store",
      headers: API_TOKEN ? { Authorization: `Bearer ${API_TOKEN}` } : {},
    })
    if (!res.ok)
      return NextResponse.json(
        { error: "Failed to load profile" },
        { status: 502 }
      )
    const json = (await res.json()) as { data?: Record<string, unknown>[] }
    const profile = json.data?.[0]
    if (!profile)
      return NextResponse.json({ error: "Profile not found" }, { status: 404 })

    const { baUserId: _omit, ...rest } = profile
    const payload = {
      exportedAt: new Date().toISOString(),
      account: { email: session.user.email },
      profile: rest,
    }

    return new NextResponse(JSON.stringify(payload, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="libraries-global-data-export.json"`,
        "Cache-Control": "no-store",
      },
    })
  } catch {
    return NextResponse.json({ error: "Export failed" }, { status: 500 })
  }
}
