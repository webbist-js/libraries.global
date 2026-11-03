/* eslint-disable sonarjs/sql-queries -- SQL identifiers come from the reviewed manifest or database catalog and pass through quote(); values use parameters. */
import { createHash } from "node:crypto"
import { readFileSync, writeFileSync } from "node:fs"
import { createRequire } from "node:module"
import path from "node:path"
import { parseEnv } from "node:util"

import {
  RESET_KEY,
  ownedTables,
  clearedColumns,
  retiredTables,
} from "./reset-manifest.mjs"

const require = createRequire(
  new URL("../../apps/strapi/package.json", import.meta.url)
)
const { Client } = require("pg")

const args = process.argv.slice(2)
const option = (key) => args[args.indexOf(key) + 1]
if (!args.includes("--env-file") || !args.includes("--report"))
  throw new Error(
    "Use --env-file PATH --report PRIVATE_PATH [--apply PLAN_DIGEST]"
  )
const env = parseEnv(readFileSync(path.resolve(option("--env-file")), "utf8"))
const url = new URL(env.DATABASE_URL)
// Production gets a separately reviewed operator run; this command is local-only.
if (!["localhost", "127.0.0.1"].includes(url.hostname) || url.port !== "5433")
  throw new Error("Expected the existing local Docker database on port 5433")
const quote = (name) => `"${name.replaceAll('"', '""')}"`
const mutation = args.includes("--apply")
  ? "--apply"
  : args.includes("--rehearse")
    ? "--rehearse"
    : null
const db = new Client({ connectionString: env.DATABASE_URL })
const hash = (value) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex")

async function main() {
  await db.connect()
  await db.query("BEGIN ISOLATION LEVEL SERIALIZABLE")
  try {
    await db.query("SET LOCAL lock_timeout = '5s'")
    await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
      RESET_KEY,
    ])
    const checkpoint = await db.query(
      "SELECT to_regclass('public.auth_reset_checkpoints') AS name"
    )
    if (checkpoint.rows[0].name) {
      const done = await db.query(
        "SELECT 1 FROM auth_reset_checkpoints WHERE key=$1",
        [RESET_KEY]
      )
      if (done.rowCount)
        throw new Error(
          "Reset already completed; refusing to touch newly registered users"
        )
    }
    const columns = (
      await db.query(
        "SELECT table_name,column_name FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name,ordinal_position"
      )
    ).rows
    const tables = [...new Set(columns.map((row) => row.table_name))].sort()
    const has = (table, column) =>
      columns.some(
        (row) => row.table_name === table && row.column_name === column
      )
    const erased = new Set(tables.filter((table) => ownedTables.has(table)))
    // Strapi relation/component link tables carry no independently retained content.
    for (const table of tables)
      if (
        [...erased].some(
          (parent) =>
            table.startsWith(`${parent}_`) && /_(lnk|cmps)$/.test(table)
        )
      )
        erased.add(table)
    const foreignKeys = (
      await db.query(
        `SELECT c.conrelid::regclass::text AS child, c.confrelid::regclass::text AS parent FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace WHERE c.contype='f' AND n.nspname='public'`
      )
    ).rows.map((row) => ({
      child: row.child.replaceAll('"', ""),
      parent: row.parent.replaceAll('"', ""),
    }))
    for (const { child, parent } of foreignKeys) {
      if (erased.has(parent) && !erased.has(child)) {
        if (child.endsWith("_lnk")) erased.add(child)
        else
          throw new Error(`Unreviewed dependent table: ${child} -> ${parent}`)
      }
    }
    const special = new Set([
      "library_changes",
      "article_changes",
      "files_related_mph",
      "strapi_history_versions",
      "strapi_audit_logs",
      "auth_reset_checkpoints",
    ])
    const targets = tables.filter(
      (table) =>
        erased.has(table) || table in clearedColumns || special.has(table)
    )
    if (mutation)
      await db.query(
        `LOCK TABLE ${targets.map(quote).join(",")} IN ACCESS EXCLUSIVE MODE`
      )
    const fingerprints = {}
    for (const table of tables) {
      if (table.startsWith("pg_")) continue
      const omit = (clearedColumns[table] ?? []).filter((field) =>
        has(table, field)
      )
      const expression = `to_jsonb(t)${omit.map((field) => ` - '${field}'`).join("")}`
      const result = await db.query(
        `SELECT count(*)::text AS count, md5(coalesce(string_agg(md5((${expression})::text),'' ORDER BY md5((${expression})::text)),'')) AS hash FROM ${quote(table)} t`
      )
      fingerprints[table] = result.rows[0]
    }
    const oldIds = tables.includes("user")
      ? (await db.query('SELECT id FROM "user"')).rows.map((row) =>
          String(row.id)
        )
      : []
    if (has("user_profiles", "ba_user_id"))
      oldIds.push(
        ...(
          await db.query(
            "SELECT ba_user_id FROM user_profiles WHERE ba_user_id IS NOT NULL"
          )
        ).rows.map((row) => String(row.ba_user_id))
      )
    const patterns = oldIds
      .filter((id) => id.length >= 16)
      .map(
        (id) =>
          `%${id.replaceAll("%", String.raw`\%`).replaceAll("_", String.raw`\_`)}%`
      )
    const identityReferences = {}
    if (patterns.length)
      for (const table of tables) {
        const count = (
          await db.query(
            `SELECT count(*)::int AS count FROM ${quote(table)} t WHERE to_jsonb(t)::text LIKE ANY($1::text[])`,
            [patterns]
          )
        ).rows[0].count
        if (count) identityReferences[table] = count
      }
    if (fingerprints.ba_user && fingerprints.ba_user.count !== "0")
      throw new Error(
        "New auth accounts already exist; refusing a legacy reset"
      )
    const retired = tables.filter(
      (table) =>
        retiredTables.has(table) ||
        [...retiredTables].some(
          (parent) => table.startsWith(`${parent}_`) && table.endsWith("_lnk")
        )
    )
    const digest = hash({
      key: RESET_KEY,
      columns,
      targets,
      retired,
      fingerprints,
    })
    const report = {
      key: RESET_KEY,
      digest,
      deleteTables: [...erased].sort(),
      retireTables: retired,
      identityReferences,
      clearColumns: clearedColumns,
      history: "one system baseline per content version",
      counts: Object.fromEntries(
        Object.entries(fingerprints).map(([table, value]) => [
          table,
          value.count,
        ])
      ),
    }
    writeFileSync(
      path.resolve(option("--report")),
      JSON.stringify(report, null, 2) + "\n",
      { mode: 0o600 }
    )
    if (!mutation) {
      await db.query("ROLLBACK")
      console.log(`Reviewed plan required before reset. Digest: ${digest}`)

      return
    }
    if (option(mutation) !== digest)
      throw new Error("Database changed since planning; inspect a fresh plan")
    // Delete only profile/owned-content media associations, retaining the file inventory.
    if (tables.includes("files_related_mph"))
      await db.query(
        `DELETE FROM files_related_mph WHERE related_type = ANY($1::text[])`,
        [
          [
            "api::user-profile.user-profile",
            "plugin::content-moderation.submission",
            "plugin::discussions.attachment",
          ],
        ]
      )
    for (const table of ["strapi_history_versions", "strapi_audit_logs"]) {
      if (tables.includes(table) && patterns.length)
        await db.query(
          `DELETE FROM ${quote(table)} t WHERE to_jsonb(t)::text LIKE ANY($1::text[])`,
          [patterns]
        )
    }
    if (tables.includes("strapi_history_versions"))
      await db.query(
        "DELETE FROM strapi_history_versions WHERE content_type=ANY($1::text[])",
        [["api::user-profile.user-profile", "plugin::users-permissions.user"]]
      )
    // Delete children before parents; no blanket CASCADE and no sequence reuse.
    const remaining = new Set(erased)
    while (remaining.size) {
      const ready = [...remaining].filter(
        (parent) =>
          !foreignKeys.some(
            (fk) =>
              fk.parent === parent &&
              fk.child !== parent &&
              remaining.has(fk.child)
          )
      )
      if (!ready.length)
        throw new Error("Unreviewed foreign-key cycle in reset manifest")
      for (const table of ready) {
        await db.query(`DELETE FROM ${quote(table)}`)
        remaining.delete(table)
      }
    }
    for (const [table, fields] of Object.entries(clearedColumns)) {
      const existing = fields.filter((field) => has(table, field))
      if (existing.length)
        await db.query(
          `UPDATE ${quote(table)} SET ${existing.map((field) => `${quote(field)}=NULL`).join(",")}`
        )
    }
    if (tables.includes("library_changes")) {
      await db.query(
        `DELETE FROM library_changes WHERE id NOT IN (SELECT DISTINCT ON (library_document_id,content_locale,version_status,field) id FROM library_changes ORDER BY library_document_id,content_locale,version_status,field,changed_at DESC,id DESC)`
      )
      await db.query(
        `UPDATE library_changes SET batch_id=md5($1 || library_document_id || coalesce(content_locale,'') || coalesce(version_status,'')), previous=NULL, action='baseline', source='system', actor_kind='system', actor_id=NULL,actor_name=NULL,reviewer_id=NULL,submission_document_id=NULL`,
        [RESET_KEY]
      )
      await db.query(
        "UPDATE library_changes c SET changed_at=b.changed_at FROM (SELECT batch_id,max(changed_at) AS changed_at FROM library_changes GROUP BY batch_id) b WHERE c.batch_id=b.batch_id"
      )
    }
    if (tables.includes("article_changes")) {
      await db.query(
        `DELETE FROM article_changes WHERE id NOT IN (SELECT DISTINCT ON (article_kind,article_document_id,content_locale,version_status) id FROM article_changes ORDER BY article_kind,article_document_id,content_locale,version_status,changed_at DESC,id DESC)`
      )
      await db.query(
        `UPDATE article_changes SET kind='baseline', actor_kind='system',actor_id=NULL,actor_name=NULL,reviewer_id=NULL,submission_document_id=NULL,edit_summary='Baseline after beta account reset.'`
      )
    }
    // Assert every untouched table still has exactly the same data, including catalogue dates and components.
    for (const table of tables) {
      if (erased.has(table) || special.has(table)) continue
      const omit = (clearedColumns[table] ?? []).filter((field) =>
        has(table, field)
      )
      const expression = `to_jsonb(t)${omit.map((field) => ` - '${field}'`).join("")}`
      const current = (
        await db.query(
          `SELECT count(*)::text AS count, md5(coalesce(string_agg(md5((${expression})::text),'' ORDER BY md5((${expression})::text)),'')) AS hash FROM ${quote(table)} t`
        )
      ).rows[0]
      if (hash(current) !== hash(fingerprints[table]))
        throw new Error(`Retained data changed: ${table}; reset rolled back`)
    }
    if (patterns.length)
      for (const table of tables) {
        const found = await db.query(
          `SELECT 1 FROM ${quote(table)} t WHERE to_jsonb(t)::text LIKE ANY($1::text[]) LIMIT 1`,
          [patterns]
        )
        if (found.rowCount)
          throw new Error(
            `Unreviewed account reference remains in ${table}; reset rolled back`
          )
      }
    if (retired.length)
      await db.query(`DROP TABLE ${retired.map(quote).join(",")} RESTRICT`)
    await db.query(
      "CREATE TABLE IF NOT EXISTS auth_reset_checkpoints (key text PRIMARY KEY, completed_at timestamptz NOT NULL DEFAULT now(), plan_digest text NOT NULL)"
    )
    await db.query(
      "INSERT INTO auth_reset_checkpoints(key,plan_digest) VALUES($1,$2)",
      [RESET_KEY, digest]
    )
    await db.query(mutation === "--rehearse" ? "ROLLBACK" : "COMMIT")
    console.log(
      mutation === "--rehearse"
        ? "Reset rehearsal passed and rolled back; retained data fingerprints match."
        : "Local beta reset committed; retained data fingerprints match."
    )
  } catch (error) {
    await db.query("ROLLBACK")
    throw error
  } finally {
    await db.end()
  }
}
main().catch((error) => {
  console.error(error.message)
  process.exitCode = 1
})
