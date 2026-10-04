import { describe, expect, it } from "vitest"

import { makeFakeStrapi } from "./helpers/fake-strapi"
import { regionIdsWithLibraries } from "../src/utils/region-library-ids"

const link = (name: string, inverse: string) => ({
  joinTable: {
    name,
    joinColumn: { name: "library_id" },
    inverseJoinColumn: { name: inverse },
  },
})

const META: Record<string, any> = {
  "api::library.library": {
    tableName: "libraries",
    attributes: {
      region: link("libraries_region_lnk", "region_id"),
    },
  },
  "api::region.region": { tableName: "regions", attributes: {} },
}

/** A recording knex stand-in whose `await` resolves to `rows`. */
function database(rows: unknown[]) {
  const ops: [string, unknown[]][] = []
  const tables: string[] = []
  const knex: any = (table: string) => {
    tables.push(table)
    const builder: any = new Proxy(
      {},
      {
        get(_, prop) {
          if (prop === "then")
            return (res: (v: unknown) => unknown) =>
              Promise.resolve(rows).then(res)

          return (...args: unknown[]) => {
            ops.push([String(prop), args])

            return builder
          }
        },
      }
    )

    return builder
  }
  const { strapi } = makeFakeStrapi()
  strapi.db.metadata = { get: (uid: string) => META[uid] }
  strapi.db.connection = knex
  const args = (method: string) =>
    ops.filter(([m]) => m === method).map(([, a]) => a)

  return { strapi, tables, args }
}

describe("regionIdsWithLibraries", () => {
  it("runs one query grouped over the library-region link table", async () => {
    const { strapi, tables, args } = database([])

    await regionIdsWithLibraries(strapi as any, {
      locale: "en",
      status: "published",
    })

    expect(tables).toEqual(["libraries as l"])
    expect(args("join")).toEqual([
      ["libraries_region_lnk as rl", "rl.library_id", "l.id"],
      ["regions as r", "r.id", "rl.region_id"],
    ])
    expect(args("groupBy")).toEqual([["r.document_id"]])
    expect(args("select")).toEqual([["r.document_id as region_document_id"]])
    expect(args("whereNotNull")).toEqual([["l.published_at"]])
    expect(args("where")).toEqual([["l.locale", "en"]])
  })

  it("returns the distinct region documentIds from the grouped rows", async () => {
    const { strapi } = database([
      { region_document_id: "brittany" },
      { region_document_id: "normandy" },
    ])

    const ids = await regionIdsWithLibraries(strapi as any, {
      status: "published",
    })

    expect(ids).toEqual(new Set(["brittany", "normandy"]))
  })

  it("reads draft rows when asked for drafts, with no locale filter", async () => {
    const { strapi, args } = database([])

    await regionIdsWithLibraries(strapi as any, { status: "draft" })

    expect(args("whereNull")).toEqual([["l.published_at"]])
    expect(args("where")).toEqual([])
  })

  it("is empty when nothing is grouped", async () => {
    const { strapi } = database([])

    const ids = await regionIdsWithLibraries(strapi as any, {
      status: "published",
    })

    expect(ids.size).toBe(0)
  })
})
