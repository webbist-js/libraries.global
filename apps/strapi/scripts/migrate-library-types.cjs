/** Explicit local backfill; also runs automatically before Strapi schema sync. */
// Preview: node apps/strapi/scripts/migrate-library-types.cjs
// Apply: add --apply --backup <completed pg_dump -Fc archive>.
// Deployment: the existing application read token needs api::library-type.library-type.find
// so Strapi can populate the relation. Token scope is managed separately from content migration.
const { existsSync, readFileSync } = require("node:fs")
const { createRequire } = require("node:module")
const path = require("node:path")

const {
  migrateLibraryTypes,
} = require("../database/migrations/shared/library-types")

async function main() {
  const args = process.argv.slice(2)
  const apply = args.includes("--apply")
  const backup = args[args.indexOf("--backup") + 1]
  if (
    apply &&
    (!args.includes("--backup") ||
      !existsSync(backup) ||
      readFileSync(backup).subarray(0, 5).toString() !== "PGDMP")
  )
    throw new Error(
      "--apply requires --backup pointing to a completed pg_dump custom archive"
    )
  process.loadEnvFile(path.resolve(__dirname, "../.env"))
  if (
    !["localhost", "127.0.0.1", "0.0.0.0"].includes(
      process.env.DATABASE_HOST
    ) ||
    process.env.DATABASE_URL
  )
    throw new Error(
      "This schema migration requires the explicit local database configuration"
    )
  const req = createRequire(require.resolve("@strapi/database"))
  const db = req("knex")({
    client: "pg",
    connection: {
      host: "127.0.0.1",
      port: Number(process.env.DATABASE_PORT || 5432),
      database: process.env.DATABASE_NAME,
      user: process.env.DATABASE_USERNAME,
      password: process.env.DATABASE_PASSWORD,
    },
  })
  try {
    console.log(
      JSON.stringify({
        mode: apply ? "apply" : "dry-run",
        ...(await migrateLibraryTypes(db, { apply })),
      })
    )
  } finally {
    await db.destroy()
  }
}

main().catch((error) => {
  console.error(error.message)
  process.exitCode = 1
})
