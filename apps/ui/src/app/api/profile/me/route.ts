import { isProfileBackground } from "@repo/shared-data"
import { headers } from "next/headers"
import { NextResponse } from "next/server"
import { z } from "zod"

import { isAppearancePreference } from "@/lib/appearance"
import { auth, authDbPool } from "@/lib/auth"
import { proxyAuthRequest } from "@/lib/auth-transport"
import { BillingError } from "@/lib/billing/config"
import { stopBillingBeforeDeletion } from "@/lib/billing/deletion"
import { sessionIsFresh, reauthenticationResponse } from "@/lib/fresh-auth"
import { readOwnProfile } from "@/lib/own-profile-server"
import { isSameOrigin, sameOriginResponse } from "@/lib/same-origin"
import { readTypedJson } from "@/lib/typed-json"

const STRAPI = process.env.STRAPI_URL ?? "http://127.0.0.1:1337"
const SECRET = process.env.STRAPI_BRIDGE_SECRET

function profileValidationError(body: Record<string, unknown>) {
  if (
    "appearancePreference" in body &&
    !isAppearancePreference(body.appearancePreference)
  )
    return "Invalid appearance preference"
  if (
    "profileBackground" in body &&
    !isProfileBackground(body.profileBackground)
  )
    return "Invalid profile background"

  return null
}

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  // Owner view through the bridge, keyed on the session's Better Auth id
  // (`baUserId` is private, so the public REST filter can't find it).
  const lookup = await readOwnProfile(session.user)
  if (!lookup.ok)
    return lookup.reason === "not_found"
      ? NextResponse.json({ error: "Profile not found" }, { status: 404 })
      : NextResponse.json({ error: "CMS unavailable" }, { status: 503 })

  return NextResponse.json({ data: lookup.profile })
}

export async function PUT(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  if (!isSameOrigin(req, process.env.APP_PUBLIC_URL))
    return sameOriginResponse()

  const parsed = await readTypedJson(
    req,
    64 * 1024,
    z.record(z.string(), z.unknown())
  )
  if (!parsed.ok)
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: parsed.status }
    )
  const body = parsed.body
  const validationError = profileValidationError(body)
  if (validationError)
    return NextResponse.json({ error: validationError }, { status: 400 })

  const allowed = [
    "username",
    "firstName",
    "lastName",
    "bio",
    "pronouns",
    "affiliation",
    "affiliationType",
    "jobTitle",
    "city",
    "country",
    "timezone",
    "website",
    "orcid",
    "mastodon",
    "linkedin",
    "profileVisibility",
    "notifPrefs",
    "languages",
    "interests",
    // avatarFileId is intentionally absent: only the avatar upload route may
    // set it, with the id of the file it just uploaded. Accepting it here would
    // let users attach any media-library file to their profile.
    "theme",
    "appearancePreference",
    "profileBackground",
  ]
  const data: Record<string, unknown> = { baUserId: session.user.id }
  for (const key of allowed) {
    if (key in body) {
      data[key] = body[key] === "" ? null : body[key]
    }
  }

  if (!SECRET)
    return NextResponse.json(
      { error: "Bridge not configured" },
      { status: 500 }
    )
  let res: Response
  try {
    res = await fetch(`${STRAPI}/api/auth-bridge/upsert-profile`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Service-Secret": SECRET,
      },
      body: JSON.stringify(data),
      signal: AbortSignal.timeout(5000),
    })
  } catch {
    return NextResponse.json({ error: "CMS unavailable" }, { status: 503 })
  }
  if (!res.ok)
    return NextResponse.json(
      { error: "Failed to update profile" },
      { status: 500 }
    )
  const json = await res.json()

  return NextResponse.json(json)
}

// PATCH — partial update (e.g. single-field saves like theme)
export async function PATCH(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  if (!isSameOrigin(req, process.env.APP_PUBLIC_URL))
    return sameOriginResponse()

  const parsed = await readTypedJson(
    req,
    64 * 1024,
    z.record(z.string(), z.unknown())
  )
  if (!parsed.ok)
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: parsed.status }
    )
  const body = parsed.body
  const validationError = profileValidationError(body)
  if (validationError)
    return NextResponse.json({ error: validationError }, { status: 400 })

  const patchAllowed = [
    "theme",
    "appearancePreference",
    "profileBackground",
    "notifPrefs",
    "profileVisibility",
    "publicPrefs",
    "supporterListed",
    "supporterBadgeVisible",
  ]
  const data: Record<string, unknown> = { baUserId: session.user.id }
  for (const key of patchAllowed) {
    if (key in body) data[key] = body[key]
  }

  for (const key of ["supporterListed", "supporterBadgeVisible"])
    if (key in body && typeof body[key] !== "boolean")
      return NextResponse.json(
        { error: `${key} must be a boolean` },
        { status: 400 }
      )

  if (Object.keys(data).length <= 1)
    return NextResponse.json({ error: "No valid fields" }, { status: 400 })

  if (!SECRET)
    return NextResponse.json(
      { error: "Bridge not configured" },
      { status: 500 }
    )

  let res: Response
  try {
    res = await fetch(`${STRAPI}/api/auth-bridge/upsert-profile`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Service-Secret": SECRET,
      },
      body: JSON.stringify(data),
      signal: AbortSignal.timeout(5000),
    })
  } catch {
    return NextResponse.json({ error: "CMS unavailable" }, { status: 503 })
  }
  if (!res.ok)
    return NextResponse.json(
      { error: "Failed to update profile" },
      { status: 500 }
    )

  return NextResponse.json({ ok: true })
}

export async function DELETE(req: Request) {
  // A cross-site page must not be able to delete the account with a cookie.
  if (!isSameOrigin(req, process.env.APP_PUBLIC_URL))
    return sameOriginResponse()

  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  if (!sessionIsFresh(session.session))
    return reauthenticationResponse("/profile/settings")

  try {
    await stopBillingBeforeDeletion(authDbPool, session.user.id)
  } catch (error) {
    if (
      error instanceof BillingError &&
      error.code === "transfer_api_account_before_deletion"
    )
      return NextResponse.json(
        {
          error:
            "Make another active member an Organiser of your organisation before deleting your account, so its API access can continue.",
        },
        { status: 409 }
      )

    return NextResponse.json(
      {
        error:
          "We couldn't stop future membership payments. Please retry before deleting your account.",
      },
      { status: 503 }
    )
  }
  const result = await proxyAuthRequest(
    new Request(new URL("/api/auth/delete-user", req.url), {
      method: "POST",
      headers: {
        ...Object.fromEntries(req.headers),
        "content-type": "application/json",
      },
      body: JSON.stringify({}),
    })
  )
  if (!result.ok)
    return NextResponse.json(
      { error: "We couldn't finish deleting your account. Please try again." },
      { status: result.status }
    )
  const response = NextResponse.json({ ok: true })
  for (const cookie of result.headers.getSetCookie())
    response.headers.append("set-cookie", cookie)

  return response
}
