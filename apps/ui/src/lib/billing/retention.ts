import "server-only"

import type { Pool } from "pg"

/**
 * Successful webhook event references expire after 90 days. API usage events,
 * period totals and overage audit are financial records and are kept.
 */
export async function purgeBillingMetadata(pool: Pool, now = new Date()) {
  try {
    const eventCutoff = new Date(now.getTime() - 90 * 86_400_000)
    const events = await pool.query(
      "delete from billing_events where event_id in (select event_id from billing_events where state in ('complete','ignored') and completed_at<$1 order by completed_at limit 10000)",
      [eventCutoff]
    )

    return { events: events.rowCount ?? 0 }
  } catch (error) {
    if ((error as { code?: string }).code === "42P01")
      return { configured: false }
    throw error
  }
}
