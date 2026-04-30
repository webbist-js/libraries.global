import { headers } from "next/headers"
import { NextResponse } from "next/server"

import { auth } from "@/lib/auth"

import { userHeaders } from "../../route"

const STRAPI = process.env.STRAPI_URL ?? "http://127.0.0.1:1337"
const SECRET = process.env.STRAPI_BRIDGE_SECRET

// PATCH /api/submissions/[id]/finalize — promote a draft to pending
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
  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const res = await fetch(
    `${STRAPI}/api/content-moderation/submissions/${id}/finalize`,
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
