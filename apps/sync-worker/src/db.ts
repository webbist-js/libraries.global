// apps/sync-worker/src/db.ts
import Knex from "knex"

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required")
}

const db = Knex({
  client: "pg",
  connection: process.env.DATABASE_URL,
  pool: { min: 2, max: 10 },
  acquireConnectionTimeout: 10_000,
})

export default db
