import { headers } from "next/headers"
import { NextResponse } from "next/server"

import { auth } from "@/lib/auth"
import { isDocumentIdParam, readJsonCapped } from "@/lib/bridge-params"

import { userHeaders } from "../../route"

const STRAPI = process.env.STRAPI_URL ?? "http://127.0.0.1:1337"
const SECRET = process.env.STRAPI_BRIDGE_SECRET

// PATCH /api/submissions/[id]/draft — save draft progress
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!SECRET)
    return NextResponse.json(
      { error: "Bridge not configured" },
      { status: 500 }
    )

  const { id } = await params
  if (!isDocumentIdParam(id))
    return NextResponse.json({ error: "Invalid id" }, { status: 400 })

  const parsed = await readJsonCapped(req, 512 * 1024)
  if (!parsed.ok)
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: parsed.status }
    )
  const body = parsed.body as Record<string, unknown>

  const res = await fetch(
    `${STRAPI}/api/content-moderation/submissions/${encodeURIComponent(id)}/draft`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...userHeaders(session.user),
      },
      body: JSON.stringify(body),
    }
  )

  const json = await res.json()

  return NextResponse.json(json, { status: res.status })
}
