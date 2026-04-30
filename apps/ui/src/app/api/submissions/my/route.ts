import { headers } from "next/headers"
import { NextResponse } from "next/server"

import { auth } from "@/lib/auth"

import { userHeaders } from "../route"

const STRAPI = process.env.STRAPI_URL ?? "http://127.0.0.1:1337"
const SECRET = process.env.STRAPI_BRIDGE_SECRET

// GET /api/submissions/my — list the caller's own submissions
export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!SECRET)
    return NextResponse.json(
      { error: "Bridge not configured" },
      { status: 500 }
    )

  const res = await fetch(`${STRAPI}/api/content-moderation/submissions/my`, {
    headers: userHeaders(session.user),
  })

  const json = await res.json()

  return NextResponse.json(json, { status: res.status })
}
