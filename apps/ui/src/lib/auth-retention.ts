import "server-only"

import { timingSafeEqual } from "node:crypto"

type Queryable = {
  query: (
    sql: string,
    params: unknown[]
  ) => Promise<{ rowCount: number | null }>
}

/** Strapi retires auth records; Next retires only application-owned challenges. */
export async function purgeExpiredAuthRecords(
  db: Queryable,
  now: Date = new Date()
) {
  const { authUpstreamHeaders, authUpstreamUrl } =
    await import("./auth-transport")
  const response = await fetch(
    authUpstreamUrl("/api/auth-internal/retention"),
    {
      method: "POST",
      headers: authUpstreamHeaders(new Headers(), true),
      body: "{}",
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    }
  )
  if (!response.ok) throw new Error("Authentication retention unavailable")
  const result = (await response.json()) as {
    sessions: number
    verifications: number
    rateLimits: number
  }
  const state = await db.query(
    'delete from "app_auth_state" where "expiresAt" < $1',
    [now]
  )

  return { ...result, applicationState: state.rowCount ?? 0 }
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
