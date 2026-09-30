import { headers } from "next/headers"
import { NextResponse } from "next/server"

import { userHeaders } from "@/app/api/submissions/route"
import { auth } from "@/lib/auth"

const STRAPI = process.env.STRAPI_URL ?? "http://127.0.0.1:1337"

// GET /api/option-suggestions — open suggestions, with the viewer's votes.
export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() })
  const res = await fetch(
    `${STRAPI}/api/content-moderation/option-suggestions`,
    {
      headers: session?.user ? userHeaders(session.user) : {},
      cache: "no-store",
    }
  )
  const json = await res.json().catch(() => ({ data: [] }))

  return NextResponse.json(json, { status: res.ok ? 200 : res.status })
}
