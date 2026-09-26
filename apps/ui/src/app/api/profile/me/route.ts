import { headers } from "next/headers"
import { NextResponse } from "next/server"

import { auth } from "@/lib/auth"
import { invalidateSessionProfile } from "@/lib/session-profile"

const STRAPI = process.env.STRAPI_URL ?? "http://127.0.0.1:1337"
const SECRET = process.env.STRAPI_BRIDGE_SECRET
const API_TOKEN = process.env.STRAPI_REST_READONLY_API_KEY

async function getStrapiProfile(baUserId: string) {
  try {
    const params = new URLSearchParams({
      "filters[baUserId][$eq]": baUserId,
      "populate[avatar]": "*",
      "populate[languages]": "*",
      "populate[followedLibraries][fields][0]": "name",
      "populate[followedLibraries][fields][1]": "slug",
      "populate[followedLibraries][fields][2]": "libraryType",
      "populate[followedLibraries][populate][heroImage][fields][0]": "url",
    })
    const res = await fetch(
      `${STRAPI}/api/user-profiles?${params.toString()}`,
      {
        cache: "no-store",
        headers: API_TOKEN ? { Authorization: `Bearer ${API_TOKEN}` } : {},
      }
    )
    if (!res.ok) return null
    const json = (await res.json()) as { data?: Record<string, unknown>[] }

    return json.data?.[0] ?? null
  } catch {
    return null
  }
}

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const profile = await getStrapiProfile(session.user.id)
  if (!profile)
    return NextResponse.json({ error: "Profile not found" }, { status: 404 })

  return NextResponse.json({ data: profile })
}

export async function PUT(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

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
    })
  } catch {
    return NextResponse.json({ error: "CMS unavailable" }, { status: 503 })
  }
  if (!res.ok)
    return NextResponse.json(
      { error: "Failed to update profile" },
      { status: 500 }
    )
  invalidateSessionProfile(session.user.id)
  const json = await res.json()

  return NextResponse.json(json)
}

// PATCH — partial update (e.g. single-field saves like theme)
export async function PATCH(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const patchAllowed = [
    "theme",
    "notifPrefs",
    "profileVisibility",
    "publicPrefs",
  ]
  const data: Record<string, unknown> = { baUserId: session.user.id }
  for (const key of patchAllowed) {
    if (key in body) data[key] = body[key]
  }

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
    })
  } catch {
    return NextResponse.json({ error: "CMS unavailable" }, { status: 503 })
  }
  if (!res.ok)
    return NextResponse.json(
      { error: "Failed to update profile" },
      { status: 500 }
    )
  invalidateSessionProfile(session.user.id)

  return NextResponse.json({ ok: true })
}

export async function DELETE() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  if (!SECRET)
    return NextResponse.json(
      { error: "Bridge not configured" },
      { status: 500 }
    )

  const anonymiseRes = await fetch(`${STRAPI}/api/auth-bridge/delete-profile`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Service-Secret": SECRET,
    },
    body: JSON.stringify({
      baUserId: session.user.id,
      email: session.user.email,
    }),
  })
  if (!anonymiseRes.ok) {
    return NextResponse.json(
      { error: "Failed to remove profile data" },
      { status: 500 }
    )
  }
  invalidateSessionProfile(session.user.id)

  try {
    await auth.api.deleteUser({ body: {}, headers: await headers() })
  } catch (err) {
    console.warn("[deleteUser] BA deletion error (non-fatal):", err)
  }

  return NextResponse.json({ ok: true })
}
