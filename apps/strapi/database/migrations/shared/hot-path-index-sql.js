"use strict"

/**
 * Shared SQL for the hot-path indexes (2026-09-29 Strapi review, E1).
 *
 * Strapi v5 only indexes primary keys, `document_id` and admin-user foreign
 * keys, so every slug lookup, `entity_ref` cross-reference, `ba_user_id`
 * profile read, submission queue query, points/badge query and the
 * leaderboard sort was a sequential scan, and nothing stopped a concurrent
 * pair of requests writing two votes, two badge awards or two snapshots for
 * the same key.
 *
 * Every table and column name below is the snake_case column Strapi
 * derives from the schema (`collectionName` + attribute names), confirmed
 * against the local Postgres on 2026-09-30.
 *
 * Used by both:
 * - the migration `2026.09.30T00.00.01.hot-path-indexes.js`
 * - the `ensureHotPathIndexes` bootstrap fallback in
 *   `src/utils/ensure-hot-path-indexes.ts` (a fresh database runs user
 *   migrations before Strapi's schema sync creates the tables, so the
 *   migration is a no-op there; bootstrap re-applies the same idempotent
 *   statements once the tables exist).
 *
 * Plain CommonJS so the `.js` migration can `require()` it.
 */

/** `CREATE INDEX IF NOT EXISTS <name> ON <table> (<cols>)`. */
function index(table, cols, opts = {}) {
  const suffix = opts.unique ? "uq" : "idx"
  const name =
    opts.name ??
    `${table}_${cols
      .map((c) => c.replace(/\s+DESC$/i, "").replace(/\s+ASC$/i, ""))
      .join("_")}_${suffix}`

  return {
    name,
    table,
    unique: Boolean(opts.unique),
    ...(opts.before ? { before: opts.before } : {}),
    sql:
      `CREATE ${opts.unique ? "UNIQUE " : ""}INDEX IF NOT EXISTS ${name} ` +
      `ON ${table} (${cols.join(", ")})`,
  }
}

/** Delete duplicate rows for `cols`, keeping the lowest (or highest) id. */
function dedupe(table, cols, keep = "lowest") {
  const same = cols.map((c) => `a.${c} = b.${c}`).join(" AND ")
  const cmp = keep === "lowest" ? "a.id > b.id" : "a.id < b.id"

  return `DELETE FROM ${table} a USING ${table} b WHERE ${same} AND ${cmp}`
}

const SLUG_TABLES = [
  "libraries",
  "regions",
  "countries",
  "continents",
  "areas",
  "wiki_articles",
  "blog_articles",
]

const HOT_PATH_INDEXES = [
  // Slug lookups (detail pages, `slugs` endpoints, entityRef recompute).
  ...SLUG_TABLES.map((t) => index(t, ["slug", "locale", "published_at"])),
  // World place import: matches Regions and Areas by GeoNames id.
  index("regions", ["geonames_id"]),
  index("areas", ["geonames_id"]),
  index("libraries", ["entity_ref"]),
  index("library_types", ["name"]),
  // Drives and Find libraries filter or sort on these (also in Meilisearch).
  index("libraries", ["completeness"]),
  index("libraries", ["name", "id"]),
  index("libraries", ["completeness", "name", "id"]),
  index("libraries", ["created_at", "id"]),
  index("libraries", ["updated_at", "id"]),
  index("libraries", ["last_verified_at"]),
  index("components_library_source_records", ["dataset", "record_id"]),

  // Profiles: bridge reads by ba_user_id; leaderboard and country boards.
  index("user_profiles", ["ba_user_id"]),
  index("user_profiles", ["points DESC"], { name: "user_profiles_points_idx" }),
  index("user_profiles", ["country", "points DESC"], {
    name: "user_profiles_country_points_idx",
  }),

  // Submissions: "my submissions", per-record queue, moderation queue.
  index("cm_submissions", ["submitted_by_user_id", "status", "created_at"]),
  index("cm_submissions", ["target_document_id", "status"]),
  index("cm_submissions", ["submission_type", "status"]),
  // The moderation queue's Drive filter.
  index("cm_submissions", ["drive_document_id", "status"]),

  // Option votes: one vote per user and suggestion, and the per-suggestion
  // tally. Duplicates (a lost race) keep the earliest vote.
  index("cm_option_votes", ["suggestion_document_id", "ba_user_id"], {
    unique: true,
    before: [
      dedupe("cm_option_votes", ["suggestion_document_id", "ba_user_id"]),
    ],
  }),
  index("cm_option_votes", ["suggestion_document_id"]),

  // Option suggestions: a contributor's daily post limit, and the
  // duplicate-name check on create.
  index("cm_option_suggestions", ["suggested_by", "created_at"]),
  index("cm_option_suggestions", ["option_key", "name_key"]),

  // Rewards: a user's history, the cron windows, one award per badge and
  // one snapshot per period. Duplicate awards keep the first; duplicate
  // snapshots keep the most recent (highest id).
  index("rw_point_events", ["ba_user_id", "awarded_at"]),
  index("rw_point_events", ["awarded_at"]),
  index("rw_badge_awards", ["ba_user_id", "badge_id"], {
    unique: true,
    before: [dedupe("rw_badge_awards", ["ba_user_id", "badge_id"])],
  }),
  index("rw_leaderboard_snapshots", ["period", "period_type"], {
    unique: true,
    before: [
      dedupe("rw_leaderboard_snapshots", ["period", "period_type"], "highest"),
    ],
  }),

  // Role Grants: the session bridge and the submission policy read a user's
  // grants by ba_user_id on every session refresh and every submission.
  // Added after the E1 migration ran, so it has its own migration
  // (2026.09.30T00.00.03.role-grants-index.js); bootstrap covers fresh DBs.
  index("role_grants", ["ba_user_id"]),

  // Audit trail (community moderation): a library's public history (its
  // published Change Batches, newest first), one batch's rows, a
  // submission's Change Records and Review Events, an article's history,
  // and the moderation queue's per-locale filter. Bootstrap only: the site
  // isn't live, so no migration backfills them.
  index(
    "library_changes",
    ["library_document_id", "version_status", "changed_at"],
    { name: "library_changes_doc_status_changed_idx" }
  ),
  index("library_changes", ["batch_id"]),
  index("library_changes", ["submission_document_id"]),
  index(
    "article_changes",
    ["article_kind", "article_document_id", "version_status", "changed_at"],
    { name: "article_changes_kind_doc_status_changed_idx" }
  ),
  index("cm_review_events", ["submission_document_id", "created_at"]),
  index("cm_submissions", ["content_locale", "status"]),

  // Drive Credits: a drive's per-user tally (leaderboard, helpers count) and
  // its credits-over-time window, plus the one credit per submission-drive
  // pair that makes a retried approval idempotent (a duplicate keeps the
  // lowest id).
  index("drive_credits", ["drive_document_id", "ba_user_id"]),
  index("drive_credits", ["drive_document_id", "accepted_at"]),
  index("drive_credits", ["submission_document_id", "drive_document_id"], {
    unique: true,
    before: [
      dedupe("drive_credits", ["submission_document_id", "drive_document_id"]),
    ],
  }),
  // Recognition (spec §8): a helper's own badge and ribbon reads.
  index("drive_credits", ["ba_user_id"]),

  // Drive Holds: one hold per library per drive decides races (a duplicate
  // keeps the lowest id), the expiry sweep and `activeHolds`'s per-drive
  // read, and the one-hold-per-helper-per-drive release.
  index("drive_holds", ["drive_document_id", "library_document_id"], {
    unique: true,
    before: [
      dedupe("drive_holds", ["drive_document_id", "library_document_id"]),
    ],
  }),
  index("drive_holds", ["drive_document_id", "expires_at"]),
  index("drive_holds", ["ba_user_id"]),
  // Staff membership and private live records. No record backfill is needed.
  index("library_affiliations", ["ba_user_id"]),
  index("library_affiliations", ["source"]),
  // Teams (access plugin): a person's seats (session bridge, entitlements),
  // the invite token lookup, a Team's seat count and the email uniqueness
  // check. `team` is a relation, so its link table carries its own index.
  index("team_members", ["ba_user_id", "status"]),
  index("team_members", ["token_hash"]),
  index("team_members", ["email"]),
  index("team_members", ["status"]),
  index("staff_audits", ["at"]),
  index("library_notices", ['"from"', '"to"', "ended_at"], {
    name: "library_notices_dates_ended_at_idx",
  }),
  index("mobile_live_sessions", ["library_document_id", "status"]),
  index("mobile_live_sessions", ["started_by", "status"]),
  index("mobile_live_sessions", ["ends_at"]),
  index("mobile_live_events", ["session_document_id", "client_at"]),
  index("mobile_live_events", ["at"]),
]

/**
 * `user_profiles.contributor_number` used to be `count() + 1`, which two
 * concurrent sign-ups can both compute. A sequence hands out distinct
 * numbers; it is seeded from the current maximum so existing numbers stay.
 */
const CONTRIBUTOR_NUMBER_SEQUENCE = {
  name: "user_profiles_contributor_number_seq",
  table: "user_profiles",
  sql: [
    "CREATE SEQUENCE IF NOT EXISTS user_profiles_contributor_number_seq",
    // A sequence's minimum is 1, so an empty table seeds `1, is_called =
    // false` (next value 1); otherwise `max, is_called = true` (next max+1).
    "SELECT setval('user_profiles_contributor_number_seq', " +
      "GREATEST(COALESCE(MAX(contributor_number), 0), 1), " +
      "COALESCE(MAX(contributor_number), 0) > 0) FROM user_profiles",
  ],
}

module.exports = { HOT_PATH_INDEXES, CONTRIBUTOR_NUMBER_SEQUENCE }
