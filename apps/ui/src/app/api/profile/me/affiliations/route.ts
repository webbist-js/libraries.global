import { headers } from "next/headers"
import { NextResponse } from "next/server"

import { auth } from "@/lib/auth"

const STRAPI = process.env.STRAPI_URL ?? "http://127.0.0.1:1337"
const SECRET = process.env.STRAPI_BRIDGE_SECRET

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return NextResponse.json({ entityRefs: [] })
  if (!SECRET) return NextResponse.json({ entityRefs: [] })

  const res = await fetch(
    `${STRAPI}/api/auth-bridge/user-affiliations?baUserId=${encodeURIComponent(session.user.id)}`,
    { headers: { "X-Service-Secret": SECRET }, cache: "no-store" }
  )
  if (!res.ok) return NextResponse.json({ entityRefs: [] })

  const json = (await res.json()) as { entityRefs: string[] }

  return NextResponse.json({ entityRefs: json.entityRefs ?? [] })
}
