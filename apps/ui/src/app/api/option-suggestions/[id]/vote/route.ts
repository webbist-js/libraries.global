import { headers } from "next/headers"
import { NextResponse } from "next/server"

import { userHeaders } from "@/app/api/submissions/route"
import { auth } from "@/lib/auth"

const STRAPI = process.env.STRAPI_URL ?? "http://127.0.0.1:1337"

// POST /api/option-suggestions/:id/vote — add or remove the viewer's vote.
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user)
    return NextResponse.json({ error: "Sign in to vote." }, { status: 401 })
  if (!process.env.STRAPI_BRIDGE_SECRET)
    return NextResponse.json(
      { error: "Bridge not configured" },
      { status: 500 }
    )
  const { id } = await params
  if (!/^[a-z0-9]{20,32}$/i.test(id))
    return NextResponse.json({ error: "Not found" }, { status: 404 })

  const res = await fetch(
    `${STRAPI}/api/content-moderation/option-suggestions/${id}/vote`,
    { method: "POST", headers: userHeaders(session.user) }
  )
  const json = await res.json().catch(() => ({}))

  return NextResponse.json(json, { status: res.status })
}
