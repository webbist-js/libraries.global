import type { Core } from "@strapi/strapi"

import { isPostgres, libraryJoin, tableOf } from "./library-sql"

import librarySchema from "../api/library/content-types/library/schema.json"

const LIBRARY_TYPES = librarySchema.attributes.libraryType.enum as string[]

type Relation = "continent" | "country" | "region"
type CountOptions = { locale?: string; status: "draft" | "published" }
type TypeCount = { type: string; count: number }

const finish = (counts: TypeCount[]) =>
  counts.filter((c) => c.count > 0).sort((a, b) => b.count - a.count)

/** One `GROUP BY library_type` over the location's link table (Postgres). */
async function countBySql(
  strapi: Core.Strapi,
  relation: Relation,
  documentId: string,
  opts: CountOptions
): Promise<TypeCount[]> {
  const knex = strapi.db.connection
  const libraries = tableOf(strapi, "api::library.library")
  const rel = libraryJoin(strapi, relation)

  const query = knex(`${libraries} as l`)
    .join(`${rel.linkTable} as rl`, `rl.${rel.libraryColumn}`, "l.id")
    .join(`${rel.table} as r`, "r.id", `rl.${rel.targetColumn}`)
    .where("r.document_id", documentId)
  if (opts.status === "published") query.whereNotNull("l.published_at")
  else query.whereNull("l.published_at")
  if (opts.locale) query.where("l.locale", opts.locale)

  const rows = (await query
    .groupBy("l.library_type")
    .select("l.library_type as type", knex.raw("count(*) as count"))) as {
    type: string | null
    count: unknown
  }[]

  return finish(
    rows.flatMap((row) =>
      row.type ? [{ type: row.type, count: Number(row.count) || 0 }] : []
    )
  )
}

/** One count per type through the Document Service (non-Postgres). */
async function countByType(
  strapi: Core.Strapi,
  relation: Relation,
  documentId: string,
  opts: CountOptions
): Promise<TypeCount[]> {
  const counts = await Promise.all(
    LIBRARY_TYPES.map(async (type) => {
      try {
        const count = await strapi.documents("api::library.library").count({
          filters: {
            [relation]: { documentId: { $eq: documentId } },
            libraryType: { $eq: type },
          } as never,
          locale: opts.locale,
          status: opts.status,
        })

        return { type, count }
      } catch {
        return { type, count: 0 }
      }
    })
  )

  return finish(counts)
}

/**
 * Published-library counts per `libraryType` for one location, largest first,
 * zero counts dropped. Feeds programmatic copy and meta descriptions on the
 * continent / country / region pages. On Postgres it is a single grouped
 * query; elsewhere one count per type.
 */
export async function countLibrariesByType(
  strapi: Core.Strapi,
  relation: Relation,
  documentId: string,
  opts: CountOptions
): Promise<TypeCount[]> {
  return isPostgres(strapi)
    ? countBySql(strapi, relation, documentId, opts)
    : countByType(strapi, relation, documentId, opts)
}
