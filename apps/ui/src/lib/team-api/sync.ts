import "server-only"

import type { Pool } from "pg"

import { sendApiWarning } from "./cms"

const backoff = (attempts: number) =>
  Math.min(3600, 30 * 2 ** Math.min(attempts, 7))

/** Deliver deduplicated 50/80/100% warnings through CMS notices. */
export async function deliverApiWarnings(
  pool: Pool,
  withinBudget: () => boolean
) {
  const pending = await pool.query<{
    team_id: string
    period_start: Date
    dimension: string
    threshold: number
    attempts: number
  }>(
    "select team_id,period_start,dimension,threshold,attempts from api_warnings where delivered_at is null and next_attempt_at<=now() and attempts<10 order by created_at limit 20"
  )
  let failed = 0
  for (const w of pending.rows) {
    if (!withinBudget()) break
    const key = [w.team_id, w.period_start, w.dimension, w.threshold]
    try {
      await sendApiWarning({
        teamId: w.team_id,
        periodStart: w.period_start.toISOString(),
        dimension: w.dimension,
        threshold: w.threshold,
      })
      await pool.query(
        "update api_warnings set delivered_at=now(),attempts=attempts+1 where team_id=$1 and period_start=$2 and dimension=$3 and threshold=$4",
        key
      )
    } catch {
      await pool.query(
        "update api_warnings set attempts=attempts+1,next_attempt_at=now()+($5 * interval '1 second') where team_id=$1 and period_start=$2 and dimension=$3 and threshold=$4",
        [...key, backoff(w.attempts)]
      )
      failed++
    }
  }

  return failed
}
