import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { readFile } from "node:fs/promises"

import { Client } from "pg"

try {
  process.loadEnvFile(".env.local")
} catch {
  /* Runtime environment may already be supplied. */
}
const url = new URL(process.env.DATABASE_URL)
assert.ok(
  ["localhost", "127.0.0.1"].includes(url.hostname) &&
    !url.searchParams.has("host"),
  "This check requires an existing loopback database"
)
const db = new Client({ connectionString: process.env.DATABASE_URL })
await db.connect()
try {
  await db.query("BEGIN")
  await db.query(
    await readFile(
      new URL("./internal-notifications-schema.sql", import.meta.url),
      "utf8"
    )
  )
  const id = `internal-fixture-${randomUUID()}`
  await db.query(
    'INSERT INTO "user" (id, name, email, "emailVerified", "createdAt", "updatedAt") VALUES ($1, $2, $3, false, now(), now())',
    [id, "Internal fixture", `${id}@example.invalid`]
  )
  const session = randomUUID()
  const insertSession = (value) =>
    db.query(
      'INSERT INTO "session" (id, token, "userId", "expiresAt", "createdAt", "updatedAt") VALUES ($1, $2, $3, now() + interval \'1 day\', now(), now())',
      [value, randomUUID(), id]
    )
  await insertSession(session)
  const count = async () =>
    Number(
      (
        await db.query(
          "SELECT count(*) AS total FROM internal_activity_events WHERE user_id = $1",
          [id]
        )
      ).rows[0].total
    )
  assert.equal(await count(), 2)
  await db.query('DELETE FROM "session" WHERE id = $1', [session])
  assert.equal(await count(), 2, "Sign-out must not erase the login event")
  await db.query("SAVEPOINT rolled_back_login")
  await insertSession(randomUUID())
  await db.query("ROLLBACK TO SAVEPOINT rolled_back_login")
  assert.equal(await count(), 2, "Rolled-back sessions must not produce events")
  await db.query('DELETE FROM "user" WHERE id = $1', [id])
  assert.equal(
    await count(),
    0,
    "Account erasure must cascade to activity events"
  )
  process.stdout.write(
    "Internal activity transaction, sign-out, rollback and account-erasure checks passed. All fixture/schema changes rolled back.\n"
  )
} finally {
  await db.query("ROLLBACK")
  await db.end()
}
