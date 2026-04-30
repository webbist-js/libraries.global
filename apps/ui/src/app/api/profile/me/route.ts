import { headers } from "next/headers"
import { NextResponse } from "next/server"

import { auth } from "@/lib/auth"

const STRAPI = process.env.STRAPI_URL ?? "http://127.0.0.1:1337"
const SECRET = process.env.STRAPI_BRIDGE_SECRET
const API_TOKEN = process.env.STRAPI_REST_READONLY_API_KEY

async function getStrapiProfile(baUserId: string) {
  try {
    const params = new URLSearchParams({
      "filters[baUserId][$eq]": baUserId,
      "populate[avatar]": "*",
      "populate[languages]": "*",
      "populate[interests][fields][0]": "name",
      "populate[interests][fields][1]": "slug",
      "populate[interests][fields][2]": "status",
      "populate[followedLibraries][fields][0]": "name",
      "populate[followedLibraries][fields][1]": "slug",
      "populate[followedLibraries][fields][2]": "libraryType",
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
    "avatarFileId",
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
  const res = await fetch(`${STRAPI}/api/auth-bridge/upsert-profile`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Service-Secret": SECRET },
    body: JSON.stringify(data),
  })
  if (!res.ok)
    return NextResponse.json(
      { error: "Failed to update profile" },
      { status: 500 }
    )
  const json = await res.json()

  return NextResponse.json(json)
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

  try {
    await auth.api.deleteUser({ headers: await headers() })
  } catch (err) {
    console.warn("[deleteUser] BA deletion error (non-fatal):", err)
  }

  return NextResponse.json({ ok: true })
}
