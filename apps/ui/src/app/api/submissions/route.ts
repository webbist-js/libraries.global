import { headers } from "next/headers"
import { NextResponse } from "next/server"

import { auth } from "@/lib/auth"
import { readJsonCapped } from "@/lib/bridge-params"

const STRAPI = process.env.STRAPI_URL ?? "http://127.0.0.1:1337"
const SECRET = process.env.STRAPI_BRIDGE_SECRET

export function userHeaders(user: {
  id: string
  email: string
  name?: string | null
}) {
  return {
    "X-Service-Secret": SECRET ?? "",
    "X-Ba-User-Id": user.id,
    "X-Ba-User-Email": user.email,
    "X-Ba-User-Name": user.name ?? "",
  }
}

// POST /api/submissions — create a new submission
export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!SECRET)
    return NextResponse.json(
      { error: "Bridge not configured" },
      { status: 500 }
    )

  const parsed = await readJsonCapped(req, 512 * 1024)
  if (!parsed.ok)
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: parsed.status }
    )
  const body = parsed.body as Record<string, unknown>

  const res = await fetch(`${STRAPI}/api/content-moderation/submissions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...userHeaders(session.user),
    },
    body: JSON.stringify(body),
  })

  const json = await res.json()

  return NextResponse.json(json, { status: res.status })
}
