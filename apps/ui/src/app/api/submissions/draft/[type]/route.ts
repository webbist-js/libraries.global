import { headers } from "next/headers"
import { NextResponse } from "next/server"

import { auth } from "@/lib/auth"
import { isSubmissionTypeParam } from "@/lib/bridge-params"
import { userHeaders } from "@/lib/bridge-user-headers"

const STRAPI = process.env.STRAPI_URL ?? "http://127.0.0.1:1337"
const SECRET = process.env.STRAPI_BRIDGE_SECRET

// GET /api/submissions/draft/[type]?targetSlug=...&locale=... — retrieve an in-progress draft
export async function GET(
  req: Request,
  { params }: { params: Promise<{ type: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!SECRET)
    return NextResponse.json(
      { error: "Bridge not configured" },
      { status: 500 }
    )

  const { type } = await params
  if (!isSubmissionTypeParam(type))
    return NextResponse.json(
      { error: "Invalid submission type" },
      { status: 400 }
    )

  const { searchParams } = new URL(req.url)
  const targetSlug = searchParams.get("targetSlug")

  const strapiUrl = new URL(
    `${STRAPI}/api/content-moderation/submissions/draft/${encodeURIComponent(type)}`
  )
  if (targetSlug) strapiUrl.searchParams.set("targetSlug", targetSlug)
  // Translation drafts are looked up per locale; Strapi maps an unknown one
  // to the default. Only a locale-shaped code is forwarded.
  const locale = searchParams.get("locale")
  if (locale && /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})?$/.test(locale))
    strapiUrl.searchParams.set("locale", locale)

  const res = await fetch(strapiUrl.toString(), {
    headers: userHeaders(session.user),
  })

  const json = await res.json()

  return NextResponse.json(json, { status: res.status })
}
