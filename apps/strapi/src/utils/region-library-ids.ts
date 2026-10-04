import type { Core } from "@strapi/strapi"

import { libraryJoin, tableOf } from "./library-sql"

type Options = {
  locale?: string
  status: "draft" | "published"
}

/**
 * `documentId`s of every Region with at least one library matching
 * `status`/`locale`, from one query grouped over the library-region link
 * table. Its cost follows the number of libraries, not the number of
 * Regions, and it never fetches library rows to count them in JS.
 *
 * Regions are returned by `documentId` (not row id) because a library's
 * `region` relation is unlocalized — it points at one Region row shared by
 * every locale of that library — while Region itself is localized, so each
 * locale version has its own row id. `documentId` is the only identifier
 * stable across a Region's locales.
 */
export async function regionIdsWithLibraries(
  strapi: Core.Strapi,
  opts: Options
): Promise<Set<string>> {
  const knex = strapi.db.connection
  const libraries = tableOf(strapi, "api::library.library")
  const regions = tableOf(strapi, "api::region.region")
  const join = libraryJoin(strapi, "region")

  const query = knex(`${libraries} as l`)
    .join(`${join.linkTable} as rl`, `rl.${join.libraryColumn}`, "l.id")
    .join(`${regions} as r`, "r.id", `rl.${join.targetColumn}`)
  if (opts.status === "published") query.whereNotNull("l.published_at")
  else query.whereNull("l.published_at")
  if (opts.locale) query.where("l.locale", opts.locale)

  const rows = (await query
    .groupBy("r.document_id")
    .select("r.document_id as region_document_id")) as {
    region_document_id: unknown
  }[]

  return new Set(
    rows
      .map((row) => row.region_document_id)
      .filter((id): id is string | number => id !== null && id !== undefined)
      .map(String)
  )
}
