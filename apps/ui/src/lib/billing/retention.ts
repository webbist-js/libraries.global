import "server-only"

import type { Pool } from "pg"

import { billingConfig } from "./config"

/** Successful event references expire after 90 days; erased financial bindings after six years. */
export async function purgeBillingMetadata(pool: Pool, now = new Date()) {
  const client = await pool.connect()
  try {
    await client.query("BEGIN")
    const eventCutoff = new Date(now.getTime() - 90 * 86_400_000)
    const erasedCutoff = new Date(now)
    erasedCutoff.setUTCFullYear(erasedCutoff.getUTCFullYear() - 6)
    const events = await client.query(
      "delete from billing_events where event_id in (select event_id from billing_events where state in ('complete','ignored') and completed_at<$1 order by completed_at limit 10000)",
      [eventCutoff]
    )
    const accounts = await client.query<{ user_id: string }>(
      "select user_id from billing_accounts where mode=$1 and erased_at<$2 order by erased_at limit 100 for update skip locked",
      [billingConfig().mode, erasedCutoff]
    )
    const ids = accounts.rows.map((row) => row.user_id)
    if (ids.length) {
      await client.query(
        "delete from billing_plan_changes where user_id=any($1::text[])",
        [ids]
      )
      await client.query(
        "delete from billing_memberships where user_id=any($1::text[])",
        [ids]
      )
      await client.query(
        "delete from billing_attempts where user_id=any($1::text[])",
        [ids]
      )
      await client.query(
        "delete from billing_accounts where user_id=any($1::text[])",
        [ids]
      )
    }
    await client.query("COMMIT")

    return { events: events.rowCount ?? 0, erasedAccounts: ids.length }
  } catch (error) {
    await client.query("ROLLBACK")
    if ((error as { code?: string }).code === "42P01")
      return { configured: false }
    throw error
  } finally {
    client.release()
  }
}
