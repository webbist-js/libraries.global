import { NextResponse } from "next/server"
import { z } from "zod"

import { auth } from "@/lib/auth"
import { sameOriginRequest } from "@/lib/beta/access"
import { readJsonCapped } from "@/lib/bridge-params"

async function forward(req: Request, save: boolean) {
  const session = await auth.api.getSession({ headers: req.headers })
  if (!session?.user?.emailVerified)
    return NextResponse.json(
      { error: "Verify your account email first" },
      { status: 401 }
    )
  const secret = process.env.STRAPI_BRIDGE_SECRET
  if (!secret)
    return NextResponse.json({ error: "Unavailable" }, { status: 503 })
  let body: unknown
  if (save) {
    if (!sameOriginRequest(req))
      return NextResponse.json({ error: "Invalid origin" }, { status: 403 })
    const read = await readJsonCapped(req, 1024)
    const parsed = read.ok
      ? z.object({ enabled: z.boolean() }).strict().safeParse(read.body)
      : null
    if (!parsed?.success)
      return NextResponse.json(
        { error: "Invalid preference" },
        { status: read.ok ? 400 : read.status }
      )
    body = parsed.data
  }
  try {
    const res = await fetch(
      `${process.env.STRAPI_URL ?? "http://127.0.0.1:1337"}/api/subscribers/account`,
      {
        method: save ? "PUT" : "GET",
        headers: {
          "Content-Type": "application/json",
          "X-Service-Secret": secret,
          "X-Ba-User-Id": session.user.id,
          "X-Ba-User-Email": session.user.email,
        },
        ...(save ? { body: JSON.stringify(body) } : {}),
        cache: "no-store",
        signal: AbortSignal.timeout(10000),
      }
    )
    if (!res.ok) throw new Error("Unavailable")

    return NextResponse.json(await res.json(), {
      headers: { "Cache-Control": "private, no-store" },
    })
  } catch {
    return NextResponse.json(
      { error: "Could not save newsletter preference" },
      { status: 503 }
    )
  }
}

export const GET = (req: Request) => forward(req, false)
export const PUT = (req: Request) => forward(req, true)
