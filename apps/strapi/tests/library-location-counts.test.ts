import { describe, expect, it, vi } from "vitest"

import { makeFakeStrapi } from "./helpers/fake-strapi"
import { countLibrariesByLocationPath } from "../src/utils/library-location-counts"

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
      continent: link("libraries_continent_lnk", "continent_id"),
      country: link("libraries_country_lnk", "country_id"),
      region: link("libraries_region_lnk", "region_id"),
    },
  },
  "api::continent.continent": { tableName: "continents", attributes: {} },
  "api::country.country": { tableName: "countries", attributes: {} },
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
  knex.raw = vi.fn((sql: string) => ({ sql }))
  const { strapi } = makeFakeStrapi()
  strapi.db.metadata = { get: (uid: string) => META[uid] }
  strapi.db.connection = knex
  const args = (method: string) =>
    ops.filter(([m]) => m === method).map(([, a]) => a)

  return { strapi, tables, args, ops }
}

describe("countLibrariesByLocationPath", () => {
  it("counts Mobile libraries like any other: no building predicate (2.13)", async () => {
    const { strapi, args } = database([])
    await countLibrariesByLocationPath(strapi as any, { status: "published" })
    expect(args("whereRaw")).toEqual([])
  })
  it("runs one grouped query over the three link tables", async () => {
    const { strapi, tables, args } = database([])

    await countLibrariesByLocationPath(strapi as any, {
      locale: "en",
      status: "published",
    })

    expect(tables).toEqual(["libraries as l"])
    expect(args("leftJoin")).toEqual([
      ["libraries_continent_lnk as ctl", "ctl.library_id", "l.id"],
      ["continents as ct", "ct.id", "ctl.continent_id"],
      ["libraries_country_lnk as col", "col.library_id", "l.id"],
      ["countries as co", "co.id", "col.country_id"],
      ["libraries_region_lnk as rl", "rl.library_id", "l.id"],
      ["regions as r", "r.id", "rl.region_id"],
    ])
    expect(args("groupBy")).toEqual([["ct.slug", "co.slug", "r.slug"]])
    expect(args("whereNotNull")).toEqual([["l.published_at"]])
    expect(args("where")).toEqual([["l.locale", "en"]])
  })

  it("rolls region rows up into country and continent totals", async () => {
    const { strapi } = database([
      {
        continent: "europe",
        country: "france",
        region: "brittany",
        count: "3",
      },
      { continent: "europe", country: "france", region: "normandy", count: 2 },
      { continent: "europe", country: "spain", region: null, count: "1" },
      { continent: "asia", country: null, region: null, count: "4" },
      { continent: null, country: null, region: null, count: "9" },
    ])

    const counts = await countLibrariesByLocationPath(strapi as any, {
      status: "published",
    })

    expect(counts).toEqual({
      europe: 6,
      "europe/france": 5,
      "europe/france/brittany": 3,
      "europe/france/normandy": 2,
      "europe/spain": 1,
      asia: 4,
    })
  })

  it("reads draft rows when asked for drafts", async () => {
    const { strapi, args } = database([])

    await countLibrariesByLocationPath(strapi as any, { status: "draft" })

    expect(args("whereNull")).toEqual([["l.published_at"]])
    expect(args("where")).toEqual([])
  })
})
