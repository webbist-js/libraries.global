import { NextResponse } from "next/server"
import { z } from "zod"

import { auth } from "@/lib/auth"
import { sameOriginRequest } from "@/lib/beta/access"
import { readJsonCapped } from "@/lib/bridge-params"

async function forward(req: Request, read = false) {
  const session = await auth.api.getSession({ headers: req.headers })
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const secret = process.env.STRAPI_BRIDGE_SECRET
  if (!secret)
    return NextResponse.json(
      { error: "Notifications unavailable" },
      { status: 503 }
    )
  let body: unknown
  if (read) {
    if (!sameOriginRequest(req))
      return NextResponse.json({ error: "Invalid origin" }, { status: 403 })
    const value = await readJsonCapped(req, 2048)
    const parsed = value.ok
      ? z
          .object({ documentId: z.string().min(1).max(100) })
          .strict()
          .safeParse(value.body)
      : null
    if (!parsed?.success)
      return NextResponse.json(
        { error: "Invalid body" },
        { status: value.ok ? 400 : value.status }
      )
    body = parsed.data
  }
  try {
    const response = await fetch(
      `${process.env.STRAPI_URL ?? "http://127.0.0.1:1337"}/api/notifications/${read ? "read" : "inbox"}`,
      {
        method: read ? "POST" : "GET",
        headers: {
          "X-Service-Secret": secret,
          "X-Ba-User-Id": session.user.id,
          "Content-Type": "application/json",
        },
        ...(read ? { body: JSON.stringify(body) } : {}),
        cache: "no-store",
        signal: AbortSignal.timeout(10000),
      }
    )
    if (!response.ok) throw new Error("Unavailable")

    return NextResponse.json(await response.json(), {
      headers: { "Cache-Control": "private, no-store" },
    })
  } catch {
    return NextResponse.json(
      { error: "Notifications unavailable" },
      { status: 503 }
    )
  }
}

export const GET = (req: Request) => forward(req)
export const POST = (req: Request) => forward(req, true)
