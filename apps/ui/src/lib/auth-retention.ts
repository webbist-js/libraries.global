import "server-only"

import { timingSafeEqual } from "node:crypto"

/** How long sign-in rate-limit rows (keyed by IP address) are kept. */
export const RATE_LIMIT_RETENTION_DAYS = 30

type Queryable = {
  query: (
    sql: string,
    params: unknown[]
  ) => Promise<{ rowCount: number | null }>
}

/**
 * Delete Better Auth records the privacy notice says we don't keep: sessions
 * and verification tokens past their expiry, and rate-limit rows older than
 * 30 days. Better Auth only removes some of these lazily, and never the
 * rate-limit rows.
 */
export async function purgeExpiredAuthRecords(
  db: Queryable,
  now: Date = new Date()
) {
  const rateLimitCutoff =
    now.getTime() - RATE_LIMIT_RETENTION_DAYS * 24 * 60 * 60 * 1000

  const sessions = await db.query(
    'delete from "session" where "expiresAt" < $1',
    [now]
  )
  const verifications = await db.query(
    'delete from "verification" where "expiresAt" < $1',
    [now]
  )
  // lastRequest is epoch milliseconds.
  const rateLimits = await db.query(
    'delete from "rateLimit" where "lastRequest" < $1',
    [rateLimitCutoff]
  )

  return {
    sessions: sessions.rowCount ?? 0,
    verifications: verifications.rowCount ?? 0,
    rateLimits: rateLimits.rowCount ?? 0,
  }
}

/** Vercel Cron sends `Authorization: Bearer $CRON_SECRET`. */
export function isCronRequest(
  authorization: string | null,
  secret: string | undefined
): boolean {
  if (!secret || !authorization) return false
  const expected = Buffer.from(`Bearer ${secret}`)
  const actual = Buffer.from(authorization)

  return actual.length === expected.length && timingSafeEqual(actual, expected)
}
