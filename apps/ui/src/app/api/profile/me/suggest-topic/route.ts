import { headers } from "next/headers"
import { NextResponse } from "next/server"

import { auth } from "@/lib/auth"

const STRAPI = process.env.STRAPI_URL ?? "http://127.0.0.1:1337"
const SECRET = process.env.STRAPI_BRIDGE_SECRET

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!SECRET)
    return NextResponse.json(
      { error: "Bridge not configured" },
      { status: 500 }
    )

  let body: { name?: string }
  try {
    body = (await req.json()) as { name?: string }
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }
  const { name } = body
  if (!name?.trim() || name.trim().length < 2)
    return NextResponse.json({ error: "Topic name too short" }, { status: 400 })
  if (name.trim().length > 100)
    return NextResponse.json({ error: "Topic name too long" }, { status: 400 })

  // Check for duplicates
  const topicRes = await fetch(`${STRAPI}/api/topics/approved`, {
    next: { revalidate: 0 },
  })
  if (topicRes.ok) {
    const existing = (await topicRes.json()) as {
      data: { name: string }[]
    }
    const duplicate = existing.data.find(
      (t) => t.name.toLowerCase() === name.trim().toLowerCase()
    )
    if (duplicate)
      return NextResponse.json(
        { error: "Topic already exists" },
        { status: 409 }
      )
  }

  // Submit as moderation entry
  const res = await fetch(`${STRAPI}/api/content-moderation/submissions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Service-Secret": SECRET,
    },
    body: JSON.stringify({
      submissionType: "topic_suggestion",
      baUserId: session.user.id,
      fields: { name: name.trim(), suggestedByEmail: session.user.email },
      note: `Topic suggestion: "${name.trim()}"`,
    }),
  })

  if (!res.ok)
    return NextResponse.json({ error: "Failed to submit" }, { status: 500 })

  return NextResponse.json({ ok: true })
}
