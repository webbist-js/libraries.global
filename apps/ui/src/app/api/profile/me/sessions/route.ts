import { headers } from "next/headers"
import { NextResponse } from "next/server"

import { auth } from "@/lib/auth"

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  try {
    const sessions = await auth.api.listSessions({ headers: await headers() })
    // Flag the session making this request so the UI can label "This device".
    // Only non-sensitive fields are returned — never the bearer `token`.
    const currentId = session.session?.id
    const data = sessions.map((s) => ({
      id: s.id,
      userAgent: s.userAgent ?? null,
      ipAddress: s.ipAddress ?? null,
      createdAt: s.createdAt,
      expiresAt: s.expiresAt,
      current: currentId != null && s.id === currentId,
    }))

    return NextResponse.json({ data })
  } catch {
    return NextResponse.json(
      { error: "Failed to list sessions" },
      { status: 500 }
    )
  }
}

export async function DELETE(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = (await req.json().catch(() => ({}))) as { id?: string }

  if (!id) {
    await auth.api.revokeOtherSessions({ headers: await headers() })

    return NextResponse.json({ ok: true })
  }

  // Resolve the id to its bearer token server-side — the client never
  // sees or sends the token.
  const sessions = await auth.api.listSessions({ headers: await headers() })
  const target = sessions.find((s) => s.id === id)
  if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 })

  await auth.api.revokeSession({
    headers: await headers(),
    body: { token: target.token },
  })

  return NextResponse.json({ ok: true })
}
