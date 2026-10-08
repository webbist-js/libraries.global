import { createHash, randomInt } from "node:crypto"

import type { Pool } from "pg"

type RecordState = {
  attempts: number
  windowAt: number
  lockedUntil: number
  codeHash?: string
  codeExpiresAt?: number
  sessionId?: string
}
const digest = (value: string) =>
  createHash("sha256").update(value).digest("hex")
const recordId = (userId: string) => `live-confirm:${digest(userId)}`
const empty = (): RecordState => ({
  attempts: 0,
  windowAt: Date.now(),
  lockedUntil: 0,
})

/** BA's verification table already exists. A row lock makes lockouts hold across instances. */
export async function withConfirmation<T>(
  pool: Pool,
  userId: string,
  work: (state: RecordState) => Promise<T>
): Promise<T> {
  const client = await pool.connect()
  try {
    await client.query("BEGIN")
    await client.query(
      "select pg_advisory_xact_lock(hashtextextended($1, 0))",
      [recordId(userId)]
    )
    const { rows } = await client.query<{ value: string }>(
      'select value from "verification" where id = $1 for update',
      [recordId(userId)]
    )
    let state = rows[0] ? (JSON.parse(rows[0].value) as RecordState) : empty()
    if (
      state.windowAt < Date.now() - 15 * 60_000 &&
      state.lockedUntil < Date.now()
    )
      state = empty()
    const result = await work(state)
    await client.query(
      'insert into "verification" (id,identifier,value,"expiresAt","createdAt","updatedAt") values ($1,$1,$2,$3,now(),now()) on conflict (id) do update set value=excluded.value,"expiresAt"=excluded."expiresAt","updatedAt"=now()',
      [
        recordId(userId),
        JSON.stringify(state),
        new Date(Date.now() + 24 * 3_600_000),
      ]
    )
    await client.query("COMMIT")

    return result
  } catch (e) {
    await client.query("ROLLBACK")
    throw e
  } finally {
    client.release()
  }
}
export const confirmationLocked = (state: RecordState) =>
  state.lockedUntil > Date.now()
export function recordFailure(state: RecordState): boolean {
  state.attempts += 1
  if (state.attempts >= 5) {
    state.lockedUntil = Date.now() + 15 * 60_000
    delete state.codeHash

    return true
  }

  return false
}
export function newConfirmationCode(
  state: RecordState,
  userId: string,
  sessionId: string
): string {
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0")
  state.codeHash = digest(`${userId}:${sessionId}:${code}`)
  state.codeExpiresAt = Date.now() + 10 * 60_000
  state.sessionId = sessionId

  return code
}
export function checkConfirmationCode(
  state: RecordState,
  userId: string,
  sessionId: string,
  code: unknown
): boolean {
  const ok =
    typeof code === "string" &&
    /^\d{6}$/.test(code) &&
    state.sessionId === sessionId &&
    (state.codeExpiresAt ?? 0) > Date.now() &&
    state.codeHash === digest(`${userId}:${sessionId}:${code}`)
  if (ok) {
    delete state.codeHash
    state.attempts = 0
    state.lockedUntil = 0
  }

  return ok
}
