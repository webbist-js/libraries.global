import { NextResponse } from "next/server"

/** Old clients must not create beta requests or redeem retired invitations. */
export async function POST() {
  return NextResponse.json(
    { error: "Beta access has ended. Libraries Global is open to everyone." },
    { status: 410, headers: { "Cache-Control": "no-store" } }
  )
}
