import { headers } from "next/headers"
import { NextResponse } from "next/server"

import { auth } from "@/lib/auth"
import { isSubmissionTypeParam } from "@/lib/bridge-params"

import { userHeaders } from "../../route"

const STRAPI = process.env.STRAPI_URL ?? "http://127.0.0.1:1337"
const SECRET = process.env.STRAPI_BRIDGE_SECRET

// GET /api/submissions/draft/[type]?targetSlug=... — retrieve an in-progress draft
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

  const res = await fetch(strapiUrl.toString(), {
    headers: userHeaders(session.user),
  })

  const json = await res.json()

  return NextResponse.json(json, { status: res.status })
}
