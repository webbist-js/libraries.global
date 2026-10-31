import { headers } from "next/headers"
import { NextResponse } from "next/server"
import { z } from "zod"

import {
  APPEARANCE_PREFERENCES,
  isAppearancePreference,
} from "@/lib/appearance"
import { auth } from "@/lib/auth"
import { readOwnProfile } from "@/lib/own-profile-server"
import { isSameOrigin, sameOriginResponse } from "@/lib/same-origin"
import { invalidateSessionProfile } from "@/lib/session-profile"
import { readTypedJson } from "@/lib/typed-json"

const noStore = { "Cache-Control": "private, no-store" }

export async function GET(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user)
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: noStore }
    )
  if (req.headers.get("X-Appearance-Actor") !== session.user.id)
    return NextResponse.json(
      { error: "Account changed" },
      { status: 409, headers: noStore }
    )
  const lookup = await readOwnProfile(session.user)
  if (!lookup.ok && lookup.reason !== "not_found")
    return NextResponse.json(
      { error: "Profile unavailable" },
      { status: 503, headers: noStore }
    )
  const value = lookup.ok ? lookup.profile.appearancePreference : null

  return NextResponse.json(
    {
      actorId: session.user.id,
      preference: isAppearancePreference(value) ? value : null,
    },
    { headers: noStore }
  )
}
export async function PATCH(req: Request) {
  if (!isSameOrigin(req, process.env.APP_PUBLIC_URL))
    return sameOriginResponse()
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user)
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: noStore }
    )
  const parsed = await readTypedJson(
    req,
    2048,
    z
      .object({
        actorId: z.string().min(1),
        preference: z.enum(APPEARANCE_PREFERENCES),
      })
      .strict()
  )
  if (!parsed.ok)
    return NextResponse.json(
      { error: "Invalid appearance preference" },
      { status: parsed.status, headers: noStore }
    )
  if (parsed.body.actorId !== session.user.id)
    return NextResponse.json(
      { error: "Account changed" },
      { status: 409, headers: noStore }
    )
  const secret = process.env.STRAPI_BRIDGE_SECRET
  if (!secret)
    return NextResponse.json(
      { error: "Bridge unavailable" },
      { status: 503, headers: noStore }
    )
  try {
    const response = await fetch(
      `${process.env.STRAPI_URL ?? "http://127.0.0.1:1337"}/api/auth-bridge/upsert-profile`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Service-Secret": secret,
        },
        body: JSON.stringify({
          baUserId: session.user.id,
          appearancePreference: parsed.body.preference,
        }),
        signal: AbortSignal.timeout(5000),
      }
    )
    if (!response.ok) throw new Error("Save failed")
    invalidateSessionProfile(session.user.id)

    return NextResponse.json(
      { actorId: session.user.id, preference: parsed.body.preference },
      { headers: noStore }
    )
  } catch {
    return NextResponse.json(
      { error: "Could not save appearance" },
      { status: 503, headers: noStore }
    )
  }
}
