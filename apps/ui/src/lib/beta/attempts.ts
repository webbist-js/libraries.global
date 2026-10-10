import "server-only"

import { createHmac } from "node:crypto"

import { Pool } from "pg"

import { clientIp, createRateLimiter } from "@/lib/rate-limit"

const WINDOW = 15 * 60 * 1000
const MAX_ATTEMPTS = 10
const localLimiter = createRateLimiter({
  name: "beta-password",
  max: MAX_ATTEMPTS,
  windowMs: WINDOW,
})
const shared = globalThis as typeof globalThis & { _betaPool?: Pool }

/** Use the existing verification table, independent of users and account sessions. */
export async function betaAttemptLimit(req: Request) {
  if (process.env.NODE_ENV !== "production")
    return localLimiter.check(clientIp(req))
  if (!process.env.DATABASE_URL)
    throw new Error("Beta attempt limiting is unavailable")
  const pool = (shared._betaPool ??= new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 2,
    connectionTimeoutMillis: 5000,
  }))
  const key = `beta-attempt:${createHmac("sha256", process.env.BETA_ACCESS_SECRET!).update(clientIp(req)).digest("hex")}`
  const now = Date.now()
  const client = await pool.connect()
  try {
    await client.query("BEGIN")
    await client.query(
      "select pg_advisory_xact_lock(hashtextextended($1, 0))",
      [key]
    )
    const { rows } = await client.query<{ value: string }>(
      'select value from "verification" where id = $1 for update',
      [key]
    )
    const previous = rows[0]
      ? (JSON.parse(rows[0].value) as { count: number; resetAt: number })
      : null
    const state =
      previous && previous.resetAt > now
        ? { ...previous, count: previous.count + 1 }
        : { count: 1, resetAt: now + WINDOW }
    await client.query(
      'insert into "verification" (id,identifier,value,"expiresAt","createdAt","updatedAt") values ($1,$1,$2,$3,now(),now()) on conflict (id) do update set value=excluded.value,"expiresAt"=excluded."expiresAt","updatedAt"=now()',
      [key, JSON.stringify(state), new Date(state.resetAt)]
    )
    await client.query("COMMIT")

    return {
      ok: state.count <= MAX_ATTEMPTS,
      remaining: Math.max(0, MAX_ATTEMPTS - state.count),
      retryAfterSeconds: Math.max(1, Math.ceil((state.resetAt - now) / 1000)),
    }
  } catch (error) {
    await client.query("ROLLBACK")
    throw error
  } finally {
    client.release()
  }
}
