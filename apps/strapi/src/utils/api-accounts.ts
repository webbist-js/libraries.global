import type { SessionApiAccount } from "@repo/access"

import { applicationPool } from "../auth/application-db"

/** Most snapshot rows read for one user's organisations. */
const MAX_API_ROWS = 50

type Queryable = {
  query: (
    sql: string,
    params: unknown[]
  ) => Promise<{ rows: Record<string, unknown>[] }>
}

const billingMode = () =>
  process.env.BILLING_ENV === "live" ? ("live" as const) : ("sandbox" as const)

/**
 * The API accounts a user belongs to, from each organisation's API paid
 * projection (`api_subscriptions.snapshot`, application database). Only
 * `paidThrough` and `revoked` are read, plus `mode` so sandbox coverage never
 * counts in live (and the reverse). The role is the user's Team role.
 * Unavailable storage reads as no API accounts: coverage is never assumed.
 */
export async function loadApiAccounts(
  strapi: any,
  memberships: { teamDocumentId: string; teamRole: "organiser" | "member" }[],
  db?: Queryable
): Promise<SessionApiAccount[]> {
  if (memberships.length === 0) return []
  const roles = new Map(memberships.map((m) => [m.teamDocumentId, m.teamRole]))
  let rows: Record<string, unknown>[]
  try {
    const result = await (db ?? (applicationPool() as Queryable)).query(
      "select team_id, snapshot->>'paidThrough' as paid_through, snapshot->>'revoked' as revoked, snapshot->>'mode' as mode from api_subscriptions where team_id = any($1) order by reconciled_at desc limit $2",
      [[...roles.keys()], MAX_API_ROWS]
    )
    rows = result.rows
  } catch {
    strapi.log?.debug?.("[api-accounts] Team API projection unavailable")

    return []
  }
  const now = Date.now()
  const best = new Map<string, SessionApiAccount>()
  for (const row of rows) {
    const teamId = String(row.team_id ?? "")
    const role = roles.get(teamId)
    if (!role) continue
    if (typeof row.mode === "string" && row.mode !== billingMode()) continue
    const paidThrough =
      typeof row.paid_through === "string" &&
      Number.isFinite(Date.parse(row.paid_through))
        ? new Date(row.paid_through).toISOString()
        : null
    const account: SessionApiAccount = {
      teamId,
      role,
      paidThrough,
      revoked: row.revoked === "true",
    }
    const covered = (a: SessionApiAccount) =>
      !a.revoked && !!a.paidThrough && Date.parse(a.paidThrough) > now
    const prior = best.get(teamId)
    // Latest snapshot wins unless an earlier one still gives coverage.
    if (!prior || (!covered(prior) && covered(account)))
      best.set(teamId, account)
  }

  return [...best.values()]
}
