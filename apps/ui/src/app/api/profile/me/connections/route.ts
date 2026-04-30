import { headers } from "next/headers"
import { NextResponse } from "next/server"

import { auth } from "@/lib/auth"

export async function GET() {
  const hdrs = await headers()
  const session = await auth.api.getSession({ headers: hdrs })
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const accounts = await auth.api.listUserAccounts({ headers: hdrs })

    return NextResponse.json({ data: accounts })
  } catch {
    return NextResponse.json(
      { error: "Failed to list accounts" },
      { status: 500 }
    )
  }
}

export async function DELETE(req: Request) {
  const hdrs = await headers()
  const session = await auth.api.getSession({ headers: hdrs })
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let providerId: string | undefined
  try {
    const body = (await req.json()) as { providerId?: string }
    providerId = body.providerId
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  if (!providerId)
    return NextResponse.json({ error: "Missing providerId" }, { status: 400 })

  // Safety: never allow removing a credential account via this endpoint.
  // Credential (email/password) removal is handled by the danger-zone delete flow.
  if (providerId === "credential")
    return NextResponse.json(
      { error: "Cannot remove email/password via this endpoint" },
      { status: 400 }
    )

  try {
    await auth.api.unlinkAccount({
      headers: hdrs,
      body: { providerId },
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to unlink"

    return NextResponse.json({ error: message }, { status: 500 })
  }
}
