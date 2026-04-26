import { headers } from "next/headers"
import { NextResponse } from "next/server"

import { auth } from "@/lib/auth"

const STRAPI = process.env.STRAPI_URL ?? "http://127.0.0.1:1337"
const SECRET = process.env.STRAPI_BRIDGE_SECRET

async function getStrapiProfile(baUserId: string) {
  const res = await fetch(
    `${STRAPI}/api/user-profiles?filters[baUserId][$eq]=${encodeURIComponent(baUserId)}&publicationState=live`,
    { next: { revalidate: 0 } }
  )
  if (!res.ok) return null
  const json = (await res.json()) as {
    data?: { id: number; attributes?: Record<string, unknown> }[]
  }
  const row = json.data?.[0]
  if (!row) return null

  return { id: row.id, ...row.attributes }
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
    "role",
    "claimedLibraryEntityRef",
    "claimedLibraryName",
    "claimedLibraryRole",
    "claimedLibraryDepartment",
    "city",
    "country",
    "timezone",
    "website",
    "orcid",
    "mastodon",
    "linkedin",
    "avatarUrl",
    "avatarStrapiId",
    "profileVisibility",
    "languages",
    "interests",
  ]
  const data: Record<string, unknown> = { baUserId: session.user.id }
  for (const key of allowed) {
    if (key in body) data[key] = body[key]
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
