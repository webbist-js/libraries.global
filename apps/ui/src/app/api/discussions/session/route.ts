import { headers } from "next/headers"
import { NextResponse } from "next/server"

import { sessionCapabilities } from "@/lib/access-server"
import { auth } from "@/lib/auth"

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() })
  const canModerate = sessionCapabilities(session?.user).moderation.some(
    (scope) => scope.queue === "all" || scope.queue === "discussions"
  )

  return NextResponse.json(
    { signedIn: !!session?.user, canModerate },
    { headers: { "Cache-Control": "private, no-store" } }
  )
}
