/** Remove only obsolete plugin metadata after the explicit beta reset. */
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
import { parseEnv } from "node:util"

import { RESET_KEY } from "./reset-manifest.mjs"

const filename = process.argv[2]
if (!filename)
  throw new Error("Pass the local environment file containing DATABASE_URL")
const env = parseEnv(readFileSync(filename, "utf8"))
const url = new URL(env.DATABASE_URL)
assert.ok(
  ["localhost", "127.0.0.1"].includes(url.hostname) && url.port === "5433",
  "Existing local database required"
)
const { Client } = createRequire(
  new URL("../../apps/strapi/package.json", import.meta.url)
)("pg")
const client = new Client({ connectionString: env.DATABASE_URL })
const keys = [
  "core_role-grants_role-grants-migrated-v1",
  "plugin_users-permissions_email",
  "plugin_users-permissions_advanced",
  "plugin_users-permissions_grant",
  ...["user", "permission", "role"].map(
    (type) =>
      `plugin_content_manager_configuration_content_types::plugin::users-permissions.${type}`
  ),
]
try {
  await client.connect()
  await client.query("BEGIN")
  await client.query("SET LOCAL lock_timeout = '5s'")
  await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
    RESET_KEY,
  ])
  assert.equal(
    (
      await client.query("SELECT 1 FROM auth_reset_checkpoints WHERE key=$1", [
        RESET_KEY,
      ])
    ).rowCount,
    1,
    "Completed reset required"
  )
  assert.equal(
    (
      await client.query(
        "SELECT to_regclass('public.up_users') IS NULL AND to_regclass('public.\"user\"') IS NULL AS retired"
      )
    ).rows[0].retired,
    true,
    "Legacy identity tables must be retired first"
  )
  // Its triggers disappeared with the retired Next.js identity tables. A
  // remaining dependency must fail explicitly rather than cascading away.
  await client.query(
    "DROP FUNCTION IF EXISTS public.record_internal_auth_activity() RESTRICT"
  )
  const result = await client.query(
    "DELETE FROM strapi_core_store_settings WHERE key=ANY($1::text[])",
    [keys]
  )
  await client.query("COMMIT")
  console.log(
    `Retired ${result.rowCount} obsolete auth settings; other settings retained.`
  )
} catch (error) {
  await client.query("ROLLBACK")
  throw error
} finally {
  await client.end()
}
