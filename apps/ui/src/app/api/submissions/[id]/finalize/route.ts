import { headers } from "next/headers"
import { NextResponse } from "next/server"
import { z } from "zod"

import { auth } from "@/lib/auth"
import { isDocumentIdParam } from "@/lib/bridge-params"
import { userHeaders } from "@/lib/bridge-user-headers"
import { isSameOrigin, sameOriginResponse } from "@/lib/same-origin"
import { readTypedJson } from "@/lib/typed-json"

const STRAPI = process.env.STRAPI_URL ?? "http://127.0.0.1:1337"
const SECRET = process.env.STRAPI_BRIDGE_SECRET

// PATCH /api/submissions/[id]/finalize — promote a draft to pending
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (
    !isSameOrigin(
      req,
      process.env.APP_PUBLIC_URL ?? process.env.NEXT_PUBLIC_APP_URL
    )
  )
    return sameOriginResponse()
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

  const parsed = await readTypedJson(
    req,
    512 * 1024,
    z.record(z.string(), z.unknown())
  )
  if (!parsed.ok)
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: parsed.status }
    )
  const body = parsed.body as Record<string, unknown>

  const res = await fetch(
    `${STRAPI}/api/content-moderation/submissions/${encodeURIComponent(id)}/finalize`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...userHeaders(session.user),
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
      cache: "no-store",
    }
  )

  const json = await res.json()

  return NextResponse.json(json, {
    status: res.status,
    headers: { "Cache-Control": "no-store" },
  })
}
