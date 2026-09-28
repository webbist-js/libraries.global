/**
 * Reads and one-line writes against the local Better Auth database, for the
 * access specs. Local only: refuses a non-loopback BA_DATABASE_URL, like the
 * seed. Never logs a token, a URL or a row.
 */
import { Client } from "pg"

const LOCAL = /^(localhost|127\.0\.0\.1)$/

function connectionString(): string {
  const raw = process.env.BA_DATABASE_URL
  if (!raw)
    throw new Error("BA_DATABASE_URL is not set (qa/tests/playwright/.env)")
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new Error("Invalid BA_DATABASE_URL")
  }
  if (!LOCAL.test(url.hostname) || url.searchParams.has("host"))
    throw new Error("Refusing: BA_DATABASE_URL is not local")

  return raw
}

export async function withAuthDb<T>(
  fn: (db: Client) => Promise<T>
): Promise<T> {
  const db = new Client({ connectionString: connectionString() })
  await db.connect()
  try {
    return await fn(db)
  } finally {
    await db.end()
  }
}

/**
 * The newest unexpired magic-link token for `email`. The magicLink plugin
 * stores the raw token as the verification row's identifier and
 * `{ email, name }` as its value.
 */
export async function latestMagicLinkToken(email: string): Promise<string> {
  return withAuthDb(async (db) => {
    const { rows } = await db.query<{ identifier: string; value: string }>(
      `SELECT identifier, value FROM "verification"
         WHERE "expiresAt" > now()
         ORDER BY "createdAt" DESC
         LIMIT 20`
    )
    for (const row of rows) {
      try {
        if ((JSON.parse(row.value) as { email?: string }).email === email)
          return row.identifier
      } catch {
        // Not a magic-link row (other verification values aren't JSON).
      }
    }
    throw new Error(`No unexpired magic-link token for ${email}`)
  })
}

export async function setEmailVerified(email: string): Promise<void> {
  await withAuthDb(async (db) => {
    const { rowCount } = await db.query(
      `UPDATE "user" SET "emailVerified" = true WHERE email = $1`,
      [email]
    )
    if (!rowCount) throw new Error(`No Better Auth user for ${email}`)
  })
}

export async function authUserByEmail(email: string): Promise<{
  id: string
  emailVerified: boolean
  termsVersion: string | null
  termsAcceptedAt: Date | null
} | null> {
  return withAuthDb(async (db) => {
    const { rows } = await db.query(
      `SELECT id, "emailVerified", "termsVersion", "termsAcceptedAt"
         FROM "user" WHERE email = $1`,
      [email]
    )

    return rows[0] ?? null
  })
}
