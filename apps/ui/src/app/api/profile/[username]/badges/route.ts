import { headers } from "next/headers"
import { NextResponse } from "next/server"

import { getSessionSSR } from "@/lib/auth-server"

const STRAPI = process.env.STRAPI_URL ?? "http://127.0.0.1:1337"
const SECRET = process.env.STRAPI_BRIDGE_SECRET

export type EarnedBadge = {
  badgeId: string
  awardedAt: string
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params
  if (!SECRET) return NextResponse.json({ data: [] })

  // Strapi shows a limited (or private) profile's badges only to its owner,
  // or (limited) to a viewer affiliated with the same library. Pass the
  // signed-in user as both; Strapi decides which, if either, applies.
  const session = await getSessionSSR(await headers())
  const qs = session?.user?.id
    ? `?${new URLSearchParams({
        ownerBaUserId: session.user.id,
        viewerBaUserId: session.user.id,
      })}`
    : ""

  const res = await fetch(
    `${STRAPI}/api/user-profiles/by-username/${encodeURIComponent(username)}/badges${qs}`,
    {
      headers: { "X-Service-Secret": SECRET },
      cache: "no-store",
    }
  )
  if (!res.ok) return NextResponse.json({ data: [] })

  const json = (await res.json()) as { data?: EarnedBadge[] }

  return NextResponse.json({ data: json.data ?? [] })
}
