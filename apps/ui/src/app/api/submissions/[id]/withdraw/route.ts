import { headers } from "next/headers"
import { NextResponse } from "next/server"
import { z } from "zod"

import { auth } from "@/lib/auth"
import { isDocumentIdParam } from "@/lib/bridge-params"
import { userHeaders } from "@/lib/bridge-user-headers"
import { isSameOrigin, sameOriginResponse } from "@/lib/same-origin"
import { readTypedJson } from "@/lib/typed-json"

const withdrawal = z
  .object({ baseUpdatedAt: z.string().datetime({ offset: true }).max(40) })
  .strict()

export async function POST(
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
  if (!process.env.STRAPI_BRIDGE_SECRET)
    return NextResponse.json(
      { error: "Bridge not configured" },
      { status: 503 }
    )
  const { id } = await params
  if (!isDocumentIdParam(id))
    return NextResponse.json({ error: "Invalid id" }, { status: 400 })
  const parsed = await readTypedJson(req, 1024, withdrawal)
  if (!parsed.ok)
    return NextResponse.json(
      { error: "Invalid withdrawal request" },
      { status: parsed.status }
    )
  try {
    const response = await fetch(
      `${process.env.STRAPI_URL ?? "http://127.0.0.1:1337"}/api/content-moderation/submissions/${encodeURIComponent(id)}/withdraw`,
      {
        method: "POST",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          ...userHeaders(session.user),
        },
        body: JSON.stringify(parsed.body),
        signal: AbortSignal.timeout(15000),
      }
    )

    return NextResponse.json(await response.json(), {
      status: response.status,
      headers: { "Cache-Control": "no-store" },
    })
  } catch {
    return NextResponse.json(
      {
        error:
          "Withdrawal outcome unknown. Reload this submission before retrying.",
      },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    )
  }
}
