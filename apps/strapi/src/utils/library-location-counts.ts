import type { Core } from "@strapi/strapi"

import { libraryJoin, tableOf } from "./library-sql"

type CountOptions = {
  locale?: string
  status: "draft" | "published"
}

type PathRow = {
  continent?: string | null
  country?: string | null
  region?: string | null
  count?: unknown
}

/**
 * Library counts keyed by location slug path: `europe`, `europe/france` and
 * `europe/france/brittany`. One query grouped by the three slugs over the
 * link tables, so its cost follows the number of regions, not libraries.
 * Plain joins and `count(*)` only, so it runs on SQLite too.
 */
export async function countLibrariesByLocationPath(
  strapi: Core.Strapi,
  opts: CountOptions
): Promise<Record<string, number>> {
  const knex = strapi.db.connection
  const libraries = tableOf(strapi, "api::library.library")
  const query = knex(`${libraries} as l`)
  for (const [alias, relation] of [
    ["ct", "continent"],
    ["co", "country"],
    ["r", "region"],
  ] as const) {
    const join = libraryJoin(strapi, relation)
    query
      .leftJoin(
        `${join.linkTable} as ${alias}l`,
        `${alias}l.${join.libraryColumn}`,
        "l.id"
      )
      .leftJoin(
        `${join.table} as ${alias}`,
        `${alias}.id`,
        `${alias}l.${join.targetColumn}`
      )
  }
  if (opts.status === "published") query.whereNotNull("l.published_at")
  else query.whereNull("l.published_at")
  if (opts.locale) query.where("l.locale", opts.locale)

  const rows = (await query
    .groupBy("ct.slug", "co.slug", "r.slug")
    .select(
      "ct.slug as continent",
      "co.slug as country",
      "r.slug as region",
      knex.raw("count(*) as count")
    )) as PathRow[]

  return rollUp(rows)
}

/** Adds each (continent, country, region) row to its three path keys. */
function rollUp(rows: PathRow[]): Record<string, number> {
  const counts: Record<string, number> = {}
  const add = (key: string, n: number) => {
    counts[key] = (counts[key] ?? 0) + n
  }

  for (const row of rows) {
    const n = Number(row.count) || 0
    if (!row.continent || n === 0) continue
    add(row.continent, n)
    if (!row.country) continue
    add(`${row.continent}/${row.country}`, n)
    if (row.region) add(`${row.continent}/${row.country}/${row.region}`, n)
  }

  return counts
}
