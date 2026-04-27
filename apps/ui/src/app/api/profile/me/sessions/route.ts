import { headers } from "next/headers"
import { NextResponse } from "next/server"

import { auth } from "@/lib/auth"

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  try {
    const sessions = await auth.api.listSessions({ headers: await headers() })

    return NextResponse.json({ data: sessions })
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

  if (sessionToken) {
    // Revoke specific session
    await auth.api.revokeSession({
      headers: await headers(),
      body: { token: sessionToken },
    })
  } else {
    // Sign out all other sessions
    await auth.api.revokeOtherSessions({ headers: await headers() })
  }

  return NextResponse.json({ ok: true })
}
