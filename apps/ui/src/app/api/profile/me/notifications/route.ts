import { headers } from "next/headers"
import { NextResponse } from "next/server"
import { z } from "zod"

import { auth } from "@/lib/auth"
import { sameOriginRequest } from "@/lib/beta/access"
import { readJsonCapped } from "@/lib/bridge-params"
import { readOwnProfile } from "@/lib/own-profile-server"

const STRAPI = process.env.STRAPI_URL ?? "http://127.0.0.1:1337"
const SECRET = process.env.STRAPI_BRIDGE_SECRET

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // notifPrefs is private: only the owner view through the bridge has it.
  const lookup = await readOwnProfile(session.user)
  if (!lookup.ok)
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  const prefs = lookup.profile.notifPrefs ?? {}

  return NextResponse.json(
    { data: prefs },
    { headers: { "Cache-Control": "private, no-store" } }
  )
}

export async function PUT(req: Request) {
  if (!sameOriginRequest(req))
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 })
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  if (!SECRET)
    return NextResponse.json(
      { error: "Bridge not configured" },
      { status: 500 }
    )

  const NotifPrefs = z
    .object({
      soundOn: z.boolean(),
      weeklyReport: z.boolean(),
      recognition: z.boolean(),
      marketing: z.boolean(),
      newFollowers: z.boolean(),
      weeklyDigest: z.boolean(),
      editsReviewed: z.boolean(),
      drives: z.boolean(),
      editorialMessages: z.boolean(),
      productUpdates: z.boolean(),
    })
    .partial()
    .strict()
  const parsed = await readJsonCapped(req, 4 * 1024)
  if (!parsed.ok)
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: parsed.status }
    )
  const result = NotifPrefs.safeParse(parsed.body)
  if (!result.success)
    return NextResponse.json({ error: "Invalid preferences" }, { status: 400 })
  const body = result.data

  try {
    const res = await fetch(`${STRAPI}/api/auth-bridge/upsert-profile`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Service-Secret": SECRET,
      },
      body: JSON.stringify({ baUserId: session.user.id, notifPrefs: body }),
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok)
      return NextResponse.json({ error: "Failed to save" }, { status: 500 })

    return NextResponse.json(
      { ok: true },
      { headers: { "Cache-Control": "private, no-store" } }
    )
  } catch {
    return NextResponse.json(
      { error: "Could not save notifications" },
      { status: 503 }
    )
  }
}
