import { Pool } from "pg"

let pool: Pool | undefined

/** Mobile confirmation state belongs to the application, outside auth schemas. */
export function applicationPool(): Pool {
  if (!process.env.APPLICATION_DATABASE_URL)
    throw new Error("APPLICATION_DATABASE_URL is required for authentication")

  pool ??= new Pool({
    connectionString: process.env.APPLICATION_DATABASE_URL,
    max: 2,
  })

  return pool
}

export async function closeApplicationPool() {
  await pool?.end()
  pool = undefined
}
