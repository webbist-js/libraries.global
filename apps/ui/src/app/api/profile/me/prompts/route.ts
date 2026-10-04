import { DISMISSIBLE_PROMPTS, isDismissiblePrompt } from "@repo/shared-data"
import { headers } from "next/headers"
import { NextResponse } from "next/server"
import { z } from "zod"

import { auth } from "@/lib/auth"
import { readJsonCapped } from "@/lib/bridge-params"
import { readOwnProfile } from "@/lib/own-profile-server"
import { invalidateSessionProfile } from "@/lib/session-profile"

const STRAPI = process.env.STRAPI_URL ?? "http://127.0.0.1:1337"
const SECRET = process.env.STRAPI_BRIDGE_SECRET

const Body = z
  .object({ prompt: z.enum(DISMISSIBLE_PROMPTS), dismissed: z.boolean() })
  .strict()

/** Hide a prompt for good, or show it again (`lib/dismissed-prompts.ts`). */
export async function PUT(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  if (!SECRET)
    return NextResponse.json(
      { error: "Bridge not configured" },
      { status: 500 }
    )

  const parsed = await readJsonCapped(req, 1024)
  if (!parsed.ok)
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: parsed.status }
    )
  const result = Body.safeParse(parsed.body)
  if (!result.success)
    return NextResponse.json({ error: "Invalid prompt" }, { status: 400 })
  const { prompt, dismissed } = result.data

  // Merge with the stored list, not the session's copy, which can be a
  // minute old. No profile yet (not onboarded): the session cookie the page
  // set is all there is, so don't create one here.
  const lookup = await readOwnProfile(session.user)
  if (!lookup.ok)
    return lookup.reason === "not_found"
      ? NextResponse.json({ error: "Profile not found" }, { status: 404 })
      : NextResponse.json({ error: "CMS unavailable" }, { status: 503 })
  const stored = (lookup.profile.dismissedPrompts ?? []).filter(
    isDismissiblePrompt
  )
  const dismissedPrompts = dismissed
    ? [...new Set([...stored, prompt])]
    : stored.filter((p) => p !== prompt)

  let res: Response
  try {
    res = await fetch(`${STRAPI}/api/auth-bridge/upsert-profile`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Service-Secret": SECRET,
      },
      body: JSON.stringify({ baUserId: session.user.id, dismissedPrompts }),
    })
  } catch {
    return NextResponse.json({ error: "CMS unavailable" }, { status: 503 })
  }
  if (!res.ok)
    return NextResponse.json({ error: "Failed to save" }, { status: 500 })
  invalidateSessionProfile(session.user.id)

  return NextResponse.json({ ok: true, dismissedPrompts })
}
