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
    let memberships: unknown[] = []
    let membershipChanges: unknown[] = []
    let membershipConsents: unknown[] = []
    let teamMembershipConsents: unknown[] = []
    try {
      memberships = (
        await authDbPool.query(
          "select snapshot,updated_at from billing_memberships where user_id=$1",
          [user.id]
        )
      ).rows
      membershipChanges = (
        await authDbPool.query(
          "select price_id,period_end,state,created_at from billing_plan_changes where user_id=$1",
          [user.id]
        )
      ).rows
      membershipConsents = (
        await authDbPool.query(
          "select plan,interval,price_id,terms_version,created_at,state from billing_attempts where user_id=$1 order by created_at",
          [user.id]
        )
      ).rows
      teamMembershipConsents = (
        await authDbPool.query(
          "select a.team_id,t.price_id,t.seats,t.terms_version,t.created_at,t.state from team_billing_attempts t join team_billing_accounts a on a.id=t.account_id where t.actor_id=$1 order by t.created_at",
          [user.id]
        )
      ).rows
    } catch (error) {
      if ((error as { code?: string }).code !== "42P01") throw error
    }
    const payload = {
      memberships,
      membershipChanges,
      membershipConsents,
      teamMembershipConsents,
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
