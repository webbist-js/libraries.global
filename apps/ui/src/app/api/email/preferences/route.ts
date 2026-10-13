import { NextResponse } from "next/server"

import { sameOriginRequest } from "@/lib/beta/access"
import { readJsonCapped, readTextCapped } from "@/lib/bridge-params"
import {
  clientIp,
  createRateLimiter,
  rateLimitResponse,
} from "@/lib/rate-limit"

const limiter = createRateLimiter({
  name: "email-preferences",
  max: 30,
  windowMs: 60000,
})
async function action(req: Request, apply: boolean) {
  const rate = await limiter.check(clientIp(req))
  if (!rate.ok) return rateLimitResponse(rate)
  let token = new URL(req.url).searchParams.get("token")
  if (apply) {
    const contentType = req.headers.get("content-type") ?? ""
    if (contentType.startsWith("application/x-www-form-urlencoded") && token) {
      // RFC 8058 one-click POST: bearer token is the authority, not cookies.
      const body = await readTextCapped(req, 100)
      if (
        body === null ||
        new URLSearchParams(body).get("List-Unsubscribe") !== "One-Click"
      )
        return NextResponse.json({ error: "Invalid action" }, { status: 400 })
      // Confirmation links cannot be opted in by an automated unsubscribe request.
      try {
        const purpose = JSON.parse(
          Buffer.from(token.split(".")[0]!, "base64url").toString()
        ).purpose
        if (!String(purpose).endsWith("_unsubscribe"))
          return NextResponse.json({ error: "Invalid action" }, { status: 400 })
      } catch {
        return NextResponse.json({ error: "Invalid action" }, { status: 400 })
      }
    } else {
      if (!sameOriginRequest(req))
        return NextResponse.json({ error: "Invalid origin" }, { status: 403 })
      const body = await readJsonCapped(req, 2048)
      if (
        !body.ok ||
        typeof (body.body as { token?: unknown })?.token !== "string"
      )
        return NextResponse.json({ error: "Invalid action" }, { status: 400 })
      token = (body.body as { token: string }).token
    }
  }
  if (!token || token.length > 1500)
    return NextResponse.json({ error: "Invalid link" }, { status: 400 })
  const secret = process.env.STRAPI_BRIDGE_SECRET
  if (!secret)
    return NextResponse.json({ error: "Unavailable" }, { status: 503 })
  try {
    const response = await fetch(
      `${process.env.STRAPI_URL ?? "http://127.0.0.1:1337"}/api/subscribers/email-action`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Service-Secret": secret,
        },
        body: JSON.stringify({ token, apply }),
        cache: "no-store",
        signal: AbortSignal.timeout(10000),
      }
    )

    return NextResponse.json(
      response.ok
        ? await response.json()
        : { error: "This link is invalid or expired." },
      {
        status: response.ok ? 200 : response.status === 400 ? 400 : 503,
        headers: { "Cache-Control": "no-store" },
      }
    )
  } catch {
    return NextResponse.json(
      { error: "Email preferences are temporarily unavailable." },
      { status: 503 }
    )
  }
}

export const GET = (req: Request) => action(req, false)
export const POST = (req: Request) => action(req, true)
