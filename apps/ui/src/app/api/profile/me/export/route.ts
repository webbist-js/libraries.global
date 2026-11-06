import { headers } from "next/headers"
import { NextResponse } from "next/server"

import { auth, authDbPool } from "@/lib/auth"
import { readOwnProfile } from "@/lib/own-profile-server"

/**
 * GET /api/profile/me/export — download the signed-in user's profile data
 * as a JSON attachment. Strapi's owner view never carries baUserId.
 */
export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    // Owner view through the bridge, keyed on the session's Better Auth id.
    const lookup = await readOwnProfile(session.user)
    if (!lookup.ok)
      return lookup.reason === "not_found"
        ? NextResponse.json({ error: "Profile not found" }, { status: 404 })
        : NextResponse.json(
            { error: "Failed to load profile" },
            { status: 502 }
          )
    // Additional user fields are on the session user at runtime, but the
    // customSession type doesn't carry them.
    const user = session.user as typeof session.user & {
      termsVersion?: string | null
      termsAcceptedAt?: Date | string | null
    }
    // API Access is the only purchase: its checkout and overage consents are
    // recorded against the organiser who gave them.
    let apiCheckouts: unknown[] = []
    let apiOverageChanges: unknown[] = []
    try {
      apiCheckouts = (
        await authDbPool.query(
          "select team_id,price_id,locale,state,created_at from api_attempts where actor_id=$1 order by created_at limit 1000",
          [user.id]
        )
      ).rows
      apiOverageChanges = (
        await authDbPool.query(
          "select team_id,revision,enabled,cap_pence,terms_version,created_at from api_overage_changes where actor_id=$1 order by created_at limit 1000",
          [user.id]
        )
      ).rows
    } catch (error) {
      if ((error as { code?: string }).code !== "42P01") throw error
    }
    const payload = {
      apiCheckouts,
      apiOverageChanges,
      exportedAt: new Date().toISOString(),
      account: {
        email: user.email,
        createdAt: user.createdAt,
        termsVersion: user.termsVersion ?? null,
        termsAcceptedAt: user.termsAcceptedAt ?? null,
      },
      profile: lookup.profile,
    }

    return new NextResponse(JSON.stringify(payload, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="libraries-global-data-export.json"`,
        "Cache-Control": "no-store",
      },
    })
  } catch {
    return NextResponse.json({ error: "Export failed" }, { status: 500 })
  }
}
