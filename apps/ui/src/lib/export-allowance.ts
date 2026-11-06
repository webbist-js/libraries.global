import "server-only"

import { createRateLimiter, type RateLimiter } from "@/lib/rate-limit"

const DAY_MS = 86_400_000
const limiters = new Map<number, RateLimiter>()

/** The account's daily export allowance from its session limits; malformed means 0. */
export function exportsPerDayOf(user: { limits?: unknown }): number {
  const n = (user.limits as { exportsPerDay?: unknown } | null | undefined)
    ?.exportsPerDay

  return typeof n === "number" && Number.isSafeInteger(n) && n > 0 ? n : 0
}

/**
 * Spend one export from the account's daily allowance (Explorer fair use).
 * Returns a 429 response when the allowance is used, otherwise null. Counts
 * are per process, like the other route limiters: a fair-use ceiling, not a
 * billing meter.
 */
export async function spendExport(user: {
  id: string
  limits?: unknown
}): Promise<Response | null> {
  const max = exportsPerDayOf(user)
  if (max === 0)
    return Response.json(
      {
        error: "Exports are unavailable for this account.",
        code: "EXPORT_DAILY_LIMIT",
      },
      { status: 429, headers: { "cache-control": "no-store" } }
    )
  let limiter = limiters.get(max)
  if (!limiter) {
    limiter = createRateLimiter({
      name: `exports-${max}`,
      max,
      windowMs: DAY_MS,
    })
    limiters.set(max, limiter)
  }
  const result = await limiter.check(user.id)
  if (result.ok) return null

  return Response.json(
    {
      error: `You can export ${max} times a day. Try again later.`,
      code: "EXPORT_DAILY_LIMIT",
    },
    {
      status: 429,
      headers: {
        "retry-after": String(result.retryAfterSeconds),
        "cache-control": "no-store",
      },
    }
  )
}
