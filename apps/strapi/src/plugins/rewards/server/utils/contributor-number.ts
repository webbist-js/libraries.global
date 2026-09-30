// Allocates the next `user_profiles.contributor_number` for a fallback
// profile created by the rewards plugin. On Postgres it draws from the
// sequence the hot-path-indexes migration creates, which is safe under
// concurrency; sqlite (tests, local scratch DBs) has no sequences, so it
// takes max+1 inside the caller's transaction instead.

const PG_CLIENTS = new Set(["pg", "postgres", "postgresql"])

export const CONTRIBUTOR_NUMBER_SEQUENCE =
  "user_profiles_contributor_number_seq"

function isPostgres(strapi: any): boolean {
  return PG_CLIENTS.has(String(strapi.db?.dialect?.client ?? "").toLowerCase())
}

export async function nextContributorNumber(
  strapi: any,
  trx?: unknown
): Promise<number> {
  const knex = strapi.db.connection

  if (isPostgres(strapi)) {
    let q = knex.raw(`SELECT nextval('${CONTRIBUTOR_NUMBER_SEQUENCE}') AS n`)
    if (trx) q = q.transacting(trx)
    const res = await q
    const row = Array.isArray(res) ? res[0] : res?.rows?.[0]

    return Number(row?.n)
  }

  let q = knex("user_profiles")
  if (trx) q = q.transacting(trx)
  const rows = (await q.max({ n: "contributor_number" })) as { n: unknown }[]

  return Number(rows?.[0]?.n ?? 0) + 1
}
