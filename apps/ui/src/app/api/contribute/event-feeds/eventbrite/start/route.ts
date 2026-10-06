import { randomBytes } from "node:crypto"

import { headers } from "next/headers"
import { NextResponse } from "next/server"

import { requireCapability } from "@/lib/access-server"
import { getSessionSSR } from "@/lib/auth-server"
import { isDocumentIdParam } from "@/lib/bridge-params"
import { limiters } from "@/lib/event-feed-proxy"
import { signState } from "@/lib/oauth-state"

export const dynamic = "force-dynamic"

const AUTHORIZE_URL = "https://www.eventbrite.com/oauth/authorize"
const STATE_TTL_MS = 10 * 60_000
const COOKIE_MAX_AGE_SECONDS = 600

const json = (body: unknown, status: number) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } })

/**
 * Starts the "Connect with Eventbrite" flow: checks the claim, signs an
 * expiring `state` bound to a nonce, stashes the nonce in a `__Host-` cookie
 * and redirects to Eventbrite's authorize screen. `callback/route.ts`
 * verifies both the signature and the cookie before trusting the return.
 */
export async function GET(req: Request) {
  const session = await getSessionSSR(await headers())
  const user = session?.user ?? null
  const denied = requireCapability(user, "events.feed")
  if (denied || !user) return denied ?? json({ error: "Sign in first" }, 401)

  const libraryDocumentId = new URL(req.url).searchParams.get("library") ?? ""
  if (
    !isDocumentIdParam(libraryDocumentId) ||
    !(user.claimedLibraryIds ?? []).includes(libraryDocumentId)
  )
    return json({ error: "You haven't claimed this library." }, 403)

  const clientId = process.env.EVENTBRITE_CLIENT_ID
  if (!clientId) return json({ error: "Eventbrite sign-in isn't set up." }, 503)

  const limit = await limiters.test.check(user.id)
  if (!limit.ok)
    return json({ error: "Too many requests. Please try again later." }, 429)

  const nonce = randomBytes(16).toString("base64url")
  const state = signState({
    nonce,
    userId: user.id,
    libraryDocumentId,
    exp: Date.now() + STATE_TTL_MS,
  })

  const appUrl = process.env.APP_PUBLIC_URL ?? "http://localhost:3000"
  const redirectUri = `${appUrl}/api/contribute/event-feeds/eventbrite/callback`
  const authorizeUrl = `${AUTHORIZE_URL}?response_type=code&client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(state)}`

  const res = NextResponse.redirect(authorizeUrl, 302)
  res.cookies.set("__Host-eb_oauth", nonce, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE_SECONDS,
  })

  return res
}
