/** Explicit one-off cleanup. Dry-run by default; never runs during Strapi bootstrap. */
import { existsSync, readFileSync, statSync } from "node:fs"
import { createRequire } from "node:module"
import path from "node:path"

import { LIBRARIES_GLOBAL_BOT } from "../src/utils/ingest-actor"

const requireDatabase = createRequire(require.resolve("@strapi/database"))
const createKnex = requireDatabase("knex")
const populationMigration = requireDatabase(
  path.resolve(
    __dirname,
    "../database/migrations/2026.10.10T00.00.00.population-on-places"
  )
)

const FIXTURE_SLUGS = [
  "access-fixture-public-library",
  "access-fixture-second-library",
  "access-fixture-mobile-library",
]
const EMPTY_TABLES = [
  "cm_option_votes",
  "cm_option_suggestions",
  "cm_review_events",
  "cm_submission_uploads",
  "cm_submissions",
  "drive_credits",
  "drive_holds",
  "rw_point_events",
  "rw_badge_awards",
  "rw_leaderboard_snapshots",
  "staff_audits",
  "strapi_history_versions",
  "strapi_audit_logs",
  "mobile_live_events",
  "mobile_live_sessions",
  "session",
  "verification",
  "strapi_sessions",
]

function envFile() {
  return Object.fromEntries(
    readFileSync(path.resolve(__dirname, "../.env"), "utf8")
      .split(/\r?\n/)
      .filter((line) => /^[A-Z_\d]+=/.test(line))
      .map((line) => {
        const i = line.indexOf("=")

        return [
          line.slice(0, i),
          line.slice(i + 1).replace(/^(["'])(.*)\1$/, "$2"),
        ]
      })
  )
}

async function keeper(knex: any, email: string) {
  const users = await knex("user").whereRaw("lower(email) = ?", [
    email.toLowerCase(),
  ])
  const admins = await knex("admin_users").whereRaw("lower(email) = ?", [
    email.toLowerCase(),
  ])
  const bridgeUsers = await knex("up_users").whereRaw("lower(email) = ?", [
    email.toLowerCase(),
  ])
  if (users.length !== 1 || admins.length !== 1 || bridgeUsers.length !== 1)
    throw new Error(
      "The preserved email must match exactly one Better Auth, Strapi admin and bridge account"
    )
  const profiles = await knex("user_profiles").where({
    ba_user_id: users[0].id,
  })
  if (profiles.length !== 1)
    throw new Error(
      "The preserved account must have exactly one contributor profile"
    )

  return {
    user: users[0],
    admin: admins[0],
    bridge: bridgeUsers[0],
    profile: profiles[0],
  }
}

export async function cleanupReport(knex: any, email: string) {
  const keep = await keeper(knex, email)
  const count = async (table: string) =>
    Number((await knex(table).count({ n: "*" }).first()).n)
  const libraryDocuments = Number(
    (await knex("libraries").countDistinct({ n: "document_id" }).first()).n
  )
  const fixtureDocuments = Number(
    (
      await knex("libraries")
        .whereIn("slug", FIXTURE_SLUGS)
        .countDistinct({ n: "document_id" })
        .first()
    ).n
  )
  const tables = {}
  let populationEstimates = 0
  for (const table of [
    "countries",
    "regions",
    "areas",
    "continents",
    "site_configs",
  ]) {
    if (!(await knex.schema.hasColumn(table, "population_estimates"))) continue
    const query = knex(table).sum({
      n: knex.raw("jsonb_array_length(population_estimates)"),
    })
    if (table !== "site_configs")
      query.where({ locale: "en" }).whereNotNull("published_at")
    populationEstimates += Number((await query.first()).n ?? 0)
  }
  for (const table of EMPTY_TABLES)
    if (await knex.schema.hasTable(table)) tables[table] = await count(table)

  return {
    keepEmail: keep.user.email,
    bot: LIBRARIES_GLOBAL_BOT,
    libraryDocuments,
    fixtureDocuments,
    retainedLibraryDocuments: libraryDocuments - fixtureDocuments,
    accountsToRemove: {
      betterAuth: (await count("user")) - 1,
      strapi: (await count("up_users")) - 1,
      admin: (await count("admin_users")) - 1,
      profiles: (await count("user_profiles")) - 1,
    },
    populationObservations: (await knex.schema.hasTable(
      "population_observations"
    ))
      ? await count("population_observations")
      : 0,
    populationEstimates,
    tablesToEmpty: tables,
  }
}

export async function applyCleanup(knex: any, email: string) {
  return knex.transaction(async (trx: any) => {
    await trx.raw("SELECT pg_advisory_xact_lock(7420110)")
    const keep = await keeper(trx, email)
    // Stop concurrent account/content changes while squashing the prelaunch data.
    await trx.raw(
      'LOCK TABLE libraries, library_changes, "user", up_users, admin_users, user_profiles, cm_submissions IN SHARE ROW EXCLUSIVE MODE'
    )
    const before = await cleanupReport(trx, email)
    await populationMigration.up(trx)

    // Preserve accepted content and media. Delete only their moderation/ownership records.
    for (const table of EMPTY_TABLES)
      if (await trx.schema.hasTable(table)) await trx(table).delete()
    for (const table of [
      "role_grants",
      "entitlement_grants",
      "pro_verifications",
      "library_affiliations",
      "team_members",
      "saved_events",
    ])
      if (await trx.schema.hasTable(table))
        await trx(table)
          .whereNot("ba_user_id", keep.user.id)
          .orWhereNull("ba_user_id")
          .delete()

    await trx("teams").where({ slug: "access-fixture-team" }).delete()
    const fixtureIds = await trx("libraries")
      .whereIn("slug", FIXTURE_SLUGS)
      .pluck("document_id")
    if (fixtureIds.length) {
      await trx("library_changes")
        .whereIn("library_document_id", fixtureIds)
        .delete()
      if (await trx.schema.hasTable("atlas_records")) {
        const atlasIds = await trx("atlas_records")
          .whereIn("document_id", fixtureIds)
          .pluck("atlas_id")
        await trx("atlas_changes").whereIn("atlas_id", atlasIds).delete()
        await trx("atlas_records").whereIn("atlas_id", atlasIds).delete()
      }
      if (await trx.schema.hasTable("atlas_outbox"))
        await trx("atlas_outbox").whereIn("entity_id", fixtureIds).delete()
      await trx("libraries").whereIn("document_id", fixtureIds).delete()
    }

    for (const table of ["account", "passkey"])
      await trx(table).whereNot("userId", keep.user.id).delete()
    await trx("files_related_mph")
      .where({ related_type: "api::user-profile.user-profile" })
      .whereNot("related_id", keep.profile.id)
      .delete()
    await trx("user_profiles").whereNot("id", keep.profile.id).delete()
    await trx("user").whereNot("id", keep.user.id).delete()
    await trx("up_users").whereNot("id", keep.bridge.id).delete()
    await trx("strapi_api_tokens_admin_user_owner_lnk")
      .whereNot("user_id", keep.admin.id)
      .update({ user_id: keep.admin.id })
    await trx("admin_users").whereNot("id", keep.admin.id).delete()

    await trx("user_profiles").update({
      points: 0,
      points_this_month: 0,
      streak: 0,
      tier: "Reader",
      last_activity_date: null,
    })
    // Strip prelaunch authorship from editorial content as well as library history.
    for (const table of [
      "blog_articles_contributors_lnk",
      "wiki_articles_contributors_lnk",
      "blog_articles_author_profile_lnk",
    ])
      await trx(table).delete()
    const columns = await trx("information_schema.columns")
      .where({ table_schema: "public" })
      .select("table_name", "column_name", "data_type")
    const actorColumns = new Set([
      "created_by_user_id",
      "created_by_ba_user_id",
      "ended_by_ba_user_id",
      "suggested_by_user_id",
      "triggered_by_user_id",
      "requested_by_user_id",
      "connected_by",
      "started_by",
      "enabled_by",
      "granted_by",
    ])
    for (const column of columns) {
      if (
        !actorColumns.has(column.column_name) ||
        !["text", "character varying"].includes(column.data_type)
      )
        continue
      await trx(column.table_name)
        .whereNotNull(column.column_name)
        .whereNot(column.column_name, keep.user.id)
        .update({ [column.column_name]: LIBRARIES_GLOBAL_BOT.actorId })
    }
    const staffChanges =
      await trx.raw(`UPDATE libraries l SET has_staff = EXISTS (SELECT 1 FROM library_affiliations a JOIN library_affiliations_library_lnk x ON x.library_affiliation_id=a.id WHERE x.library_id=l.id)
      WHERE has_staff IS DISTINCT FROM EXISTS (SELECT 1 FROM library_affiliations a JOIN library_affiliations_library_lnk x ON x.library_affiliation_id=a.id WHERE x.library_id=l.id) RETURNING document_id`)
    const staffIds = [...new Set(staffChanges.rows.map((r) => r.document_id))]
    if (staffIds.length && (await trx.schema.hasTable("atlas_outbox")))
      await trx("atlas_outbox").insert(
        staffIds.map((entity_id) => ({
          kind: "document",
          entity_id,
          payload: "{}",
        }))
      )
    await trx("libraries").update({ created_by_id: null, updated_by_id: null })

    await trx("library_changes").delete()
    const provenance = (await trx.schema.hasColumn("libraries", "source"))
      ? "jsonb_build_object('name',name,'slug',slug,'source',source,'sourceUrl',source_url)"
      : "jsonb_build_object('name',name,'slug',slug,'sourceRecords',coalesce((select jsonb_agg(jsonb_build_object('dataset',c.dataset,'recordId',c.record_id,'url',c.url,'retrievedAt',c.retrieved_at,'role',c.role,'label',c.label,'fields',c.fields) order by j.\"order\") from libraries_cmps j join components_library_source_records c on c.id=j.cmp_id where j.entity_id=libraries.id and j.field='sourceRecords' and j.component_type='library.source-record'),'[]'::jsonb))"
    const result = await trx.raw(
      `
      INSERT INTO library_changes
        (document_id,batch_id,library_document_id,entity_ref,content_locale,version_status,action,field,previous,next,source,actor_kind,actor_id,actor_name,changed_at,created_at,updated_at,published_at)
      SELECT substr(md5('initial:' || id::text),1,24), md5('initial:' || id::text), document_id,entity_ref,locale,
        CASE WHEN published_at IS NULL THEN 'draft' ELSE 'published' END,
        'create','*',NULL,${provenance},
        'import','system',?,?,coalesce(created_at,now()),now(),now(),now()
      FROM libraries RETURNING id`,
      [LIBRARIES_GLOBAL_BOT.actorId, LIBRARIES_GLOBAL_BOT.actorName]
    )
    await trx("article_changes").delete()
    for (const [table, kind] of [
      ["wiki_articles", "wiki"],
      ["blog_articles", "blog"],
    ])
      await trx.raw(
        `INSERT INTO article_changes
        (document_id,article_kind,article_document_id,slug,content_locale,version_status,kind,actor_kind,actor_id,actor_name,changed_at,created_at,updated_at,published_at)
        SELECT substr(md5(? || id::text),1,24),?,document_id,slug,locale,
          CASE WHEN published_at IS NULL THEN 'draft' ELSE 'published' END,
          'created','system',?,?,coalesce(created_at,now()),now(),now(),now() FROM ??`,
        [
          `initial:${kind}:`,
          kind,
          LIBRARIES_GLOBAL_BOT.actorId,
          LIBRARIES_GLOBAL_BOT.actorName,
          table,
        ]
      )
    const after = await cleanupReport(trx, email)
    if (
      after.libraryDocuments !== before.retainedLibraryDocuments ||
      after.populationEstimates <
        Math.max(before.populationEstimates, before.populationObservations) ||
      Object.values(after.accountsToRemove).some((n) => n !== 0) ||
      Object.values(after.tablesToEmpty).some((n) => n !== 0)
    )
      throw new Error(
        "Go-live cleanup verification failed; transaction rolled back"
      )

    return { before, after, initialLibraryVersions: result.rowCount }
  })
}

async function main() {
  const args = process.argv.slice(2)
  const value = (flag: string) => args[args.indexOf(flag) + 1]
  const apply = args.includes("--apply")
  const email = args.includes("--keep-email")
    ? value("--keep-email")
    : "info@alex-bennett.co.uk"
  const backup = args.includes("--backup") ? value("--backup") : null
  if (apply && (!backup || !existsSync(backup) || statSync(backup).size < 1024))
    throw new Error(
      "--apply requires --backup pointing to a completed pg_dump backup"
    )
  const env = { ...envFile(), ...process.env }
  const url = env.DATABASE_URL ? new URL(env.DATABASE_URL) : null
  const knex = createKnex({
    client: "pg",
    connection: {
      host: url?.hostname ?? env.DATABASE_HOST,
      port: Number(url?.port || env.DATABASE_PORT || 5432),
      user: url ? decodeURIComponent(url.username) : env.DATABASE_USERNAME,
      password: url ? decodeURIComponent(url.password) : env.DATABASE_PASSWORD,
      database: args.includes("--database")
        ? value("--database")
        : (url?.pathname.slice(1) ?? env.DATABASE_NAME),
    },
  })
  try {
    console.log(
      JSON.stringify(
        apply
          ? await applyCleanup(knex, email)
          : await cleanupReport(knex, email),
        null,
        2
      )
    )
  } finally {
    await knex.destroy()
  }
}

if (require.main === module)
  main().catch((error) => {
    console.error(
      error instanceof Error ? error.message : "Go-live cleanup failed"
    )
    process.exitCode = 1
  })
