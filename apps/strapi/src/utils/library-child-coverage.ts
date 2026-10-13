import type { Core } from "@strapi/strapi"

import { isPostgres, libraryJoin, tableOf } from "./library-sql"
import { canonicalPlaceLibraries } from "./place-library-scope"

type CoverageOptions = {
  parent: "continent" | "country"
  parentDocumentId: string
  child: "country" | "region"
  descendant: "region" | "area"
  locale?: string
  status: "draft" | "published"
}

/** Two bounded grouped queries. Null means unavailable, never an empty database. */
export async function countChildCoverage(
  strapi: Core.Strapi,
  opts: CoverageOptions
): Promise<{
  withRecords: Map<string, number>
  total: Map<string, number>
} | null> {
  if (!isPostgres(strapi)) return null
  const child = libraryJoin(strapi, opts.child)
  const descendant = libraryJoin(strapi, opts.descendant)
  const rows = (await canonicalPlaceLibraries(
    strapi,
    opts.locale,
    opts.status,
    {
      relation: opts.parent,
      documentId: opts.parentDocumentId,
    }
  )
    .join(
      child.linkTable + " as coverage_cl",
      "coverage_cl." + child.libraryColumn,
      "l.id"
    )
    .join(
      child.table + " as coverage_c",
      "coverage_c.id",
      "coverage_cl." + child.targetColumn
    )
    .leftJoin(
      descendant.linkTable + " as coverage_dl",
      "coverage_dl." + descendant.libraryColumn,
      "l.id"
    )
    .leftJoin(
      descendant.table + " as coverage_d",
      "coverage_d.id",
      "coverage_dl." + descendant.targetColumn
    )
    .groupBy("coverage_c.document_id")
    .select("coverage_c.document_id as child_id")
    .countDistinct({ count: "coverage_d.document_id" })) as {
    child_id: string
    count: string | number
  }[]
  const metadata = strapi.db.metadata as {
    get: (uid: string) => {
      attributes: Record<
        string,
        {
          joinTable?: {
            name: string
            joinColumn: { name: string }
            inverseJoinColumn: { name: string }
          }
        }
      >
    }
  }
  const descendantUid = `api::${opts.descendant}.${opts.descendant}`
  const childUid = `api::${opts.child}.${opts.child}`
  const childRelation =
    metadata.get(descendantUid).attributes[opts.child]?.joinTable
  const parentRelation =
    metadata.get(childUid).attributes[opts.parent]?.joinTable
  if (!childRelation || !parentRelation)
    throw new Error("Place coverage relations are unavailable")

  // Count the listed geography separately: records do not define the catalogue.
  const catalogue = strapi.db
    .connection(descendant.table + " as listed_d")
    .join(
      childRelation.name + " as listed_cl",
      "listed_cl." + childRelation.joinColumn.name,
      "listed_d.id"
    )
    .join(
      child.table + " as listed_c",
      "listed_c.id",
      "listed_cl." + childRelation.inverseJoinColumn.name
    )
    .join(
      parentRelation.name + " as listed_pl",
      "listed_pl." + parentRelation.joinColumn.name,
      "listed_c.id"
    )
    .join(
      tableOf(strapi, `api::${opts.parent}.${opts.parent}`) + " as listed_p",
      "listed_p.id",
      "listed_pl." + parentRelation.inverseJoinColumn.name
    )
    .where("listed_p.document_id", opts.parentDocumentId)
  if (opts.locale) catalogue.where("listed_d.locale", opts.locale)
  if (opts.status === "published")
    catalogue.whereNotNull("listed_d.published_at")
  else catalogue.whereNull("listed_d.published_at")
  const catalogueRows = (await catalogue
    .groupBy("listed_c.document_id")
    .select("listed_c.document_id as child_id")
    .countDistinct({ count: "listed_d.document_id" })) as {
    child_id: string
    count: string | number
  }[]

  return {
    withRecords: new Map(
      rows.map((row) => [String(row.child_id), Number(row.count)])
    ),
    total: new Map(
      catalogueRows.map((row) => [String(row.child_id), Number(row.count)])
    ),
  }
}
