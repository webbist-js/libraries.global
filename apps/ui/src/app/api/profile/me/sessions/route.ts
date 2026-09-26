import { headers } from "next/headers"
import { NextResponse } from "next/server"

import { auth } from "@/lib/auth"

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  try {
    const sessions = await auth.api.listSessions({ headers: await headers() })
    // Flag the session making this request so the UI can label "This device"
    const currentToken = session.session?.token
    const data = sessions.map((s) => ({
      ...s,
      current: currentToken != null && s.token === currentToken,
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

  const { sessionToken } = (await req.json()) as { sessionToken?: string }

  await (sessionToken
    ? auth.api.revokeSession({
        headers: await headers(),
        body: { token: sessionToken },
      })
    : auth.api.revokeOtherSessions({ headers: await headers() }))

  return NextResponse.json({ ok: true })
}
