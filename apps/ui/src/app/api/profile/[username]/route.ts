import { NextResponse } from "next/server"

import { fetchPublicProfile } from "@/lib/public-profile-server"

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params
  const profile = await fetchPublicProfile(username).catch(() => {})
  const headers = { "Cache-Control": "private, no-store" }
  if (profile === undefined)
    return NextResponse.json(
      { error: "Profile temporarily unavailable" },
      { status: 502, headers }
    )
  if (profile === null)
    return NextResponse.json({ error: "Not found" }, { status: 404, headers })
  if (profile === "private")
    return NextResponse.json(
      { error: "Profile is private" },
      { status: 403, headers }
    )

  return NextResponse.json({ data: profile }, { headers })
}
