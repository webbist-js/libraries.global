import * as fs from "node:fs"
import path from "node:path"

import { describe, expect, it } from "vitest"

import {
  SOUTH_AMERICA_ISO2,
  continentSlugFor,
  countriesFromSeed,
  iso2For,
  mapConfigFor,
  splitByIso2,
  type SeedCountry,
} from "../scripts/world-countries"

const SEED_PATH = path.resolve(
  __dirname,
  "../../ui/public/boundaries/seed-data.json"
)
const seed = JSON.parse(fs.readFileSync(SEED_PATH, "utf8")) as Record<
  string,
  unknown
>

const sample: SeedCountry = {
  name: "Ireland",
  code: "IE",
  slug: "ireland",
  centroidLat: 53.416042,
  centroidLng: -8.23585,
  bboxNorth: 55.386379,
  bboxSouth: 51.445705,
  bboxEast: -5.99352,
  bboxWest: -10.478179,
  boundaryUrl: "/boundaries/continents/europe.geojson",
  sourceAttribution:
    "Natural Earth public domain map data. https://www.naturalearthdata.com/",
}

describe("continentSlugFor", () => {
  it("splits the Americas into north and south", () => {
    expect(continentSlugFor("americas", "BR")).toBe("south-america")
    expect(continentSlugFor("americas", "MX")).toBe("north-america")
    expect(continentSlugFor("americas", "JM")).toBe("north-america")
    expect(continentSlugFor("americas", "FK")).toBe("south-america")
  })

  it("passes other continents through", () => {
    expect(continentSlugFor("europe", "FR")).toBe("europe")
    expect(continentSlugFor("africa", "NG")).toBe("africa")
    expect(continentSlugFor("asia", "JP")).toBe("asia")
    expect(continentSlugFor("oceania", "AU")).toBe("oceania")
  })

  it("accepts the seed key form and any case", () => {
    expect(continentSlugFor("continents/americas", "br")).toBe("south-america")
  })

  it("rejects an unknown continent", () => {
    expect(() => continentSlugFor("antarctica", "AQ")).toThrow()
  })

  it("lists the South American codes", () => {
    expect([...SOUTH_AMERICA_ISO2].sort()).toEqual(
      [
        "AR",
        "BO",
        "BR",
        "CL",
        "CO",
        "EC",
        "GY",
        "PY",
        "PE",
        "SR",
        "UY",
        "VE",
        "FK",
        "GF",
      ].sort()
    )
  })
})

describe("countriesFromSeed", () => {
  const rows = countriesFromSeed(seed)

  it("returns every country in the seed's continent lists (247)", () => {
    const total = Object.entries(seed)
      .filter(([k]) => k.startsWith("continents/"))
      .reduce((n, [, v]) => n + (v as unknown[]).length, 0)

    expect(total).toBe(247)
    expect(rows).toHaveLength(total)
  })

  it("ignores countries/* and regions/* keys", () => {
    expect(rows.find((r) => r.country.slug === "england")).toBeUndefined()
    expect(
      countriesFromSeed({
        "countries/uk": [{ ...sample, slug: "england" }],
        "regions/x": [sample],
      })
    ).toEqual([])
  })

  it("never yields an americas continent", () => {
    const slugs = new Set(rows.map((r) => r.continentSlug))

    expect(slugs.has("americas")).toBe(false)
    expect(slugs).toEqual(
      new Set([
        "africa",
        "asia",
        "europe",
        "oceania",
        "north-america",
        "south-america",
      ])
    )
  })

  it("places Brazil in South America and Mexico in North America", () => {
    const by = (slug: string) =>
      rows.find((r) => r.country.slug === slug)?.continentSlug

    expect(by("brazil")).toBe("south-america")
    expect(by("mexico")).toBe("north-america")
    expect(by("jamaica")).toBe("north-america")
    expect(by("france")).toBe("europe")
  })

  it("places uncoded American features by their centroid", () => {
    const by = (name: string) =>
      rows.find((r) => r.country.name === name)?.continentSlug

    expect(by("Southern Patagonian Ice Field")).toBe("south-america")
    expect(by("Brazilian Island")).toBe("south-america")
    expect(by("US Naval Base Guantanamo Bay")).toBe("north-america")
  })

  it("skips malformed entries", () => {
    expect(
      countriesFromSeed({
        "continents/europe": [sample, { name: "No slug" }, null],
      })
    ).toHaveLength(1)
  })
})

describe("iso2For", () => {
  it("keeps a valid two-letter code", () => {
    expect(iso2For(sample)).toBe("IE")
  })

  it("fixes the Natural Earth -99 codes it knows", () => {
    expect(iso2For({ ...sample, slug: "france", code: "-99" })).toBe("FR")
    expect(iso2For({ ...sample, slug: "norway", code: "-99" })).toBe("NO")
    expect(iso2For({ ...sample, slug: "kosovo", code: "-99" })).toBe("XK")
    expect(iso2For({ ...sample, slug: "taiwan", code: "CN-TW" })).toBe("TW")
  })

  it("returns null for codes that are not ISO 3166-1 alpha-2", () => {
    expect(iso2For({ ...sample, slug: "bir-tawil", code: "-99" })).toBeNull()
  })

  it("gives every seed country a unique iso2 or none", () => {
    const codes = countriesFromSeed(seed)
      .map((r) => iso2For(r.country))
      .filter((c): c is string => c !== null)

    expect(new Set(codes).size).toBe(codes.length)
  })
})

describe("splitByIso2", () => {
  it("skips -99 features without a known mapping and keeps FR, NO, XK, TW", () => {
    const row = (slug: string, name: string, code: string) => ({
      continentSlug: "europe",
      country: { ...sample, slug, name, code },
    })
    const { importable, skipped } = splitByIso2([
      row("france", "France", "-99"),
      row("norway", "Norway", "-99"),
      row("kosovo", "Kosovo", "-99"),
      row("taiwan", "Taiwan", "CN-TW"),
      row("bir-tawil", "Bir Tawil", "-99"),
      row("ireland", "Ireland", "IE"),
    ])

    expect(importable.map((r) => r.country.slug)).toEqual([
      "france",
      "norway",
      "kosovo",
      "taiwan",
      "ireland",
    ])
    expect(skipped.map((r) => r.country.name)).toEqual(["Bir Tawil"])
  })

  it("skips the seed's uncoded features and keeps every coded country", () => {
    const { importable, skipped } = splitByIso2(countriesFromSeed(seed))
    const skippedNames = skipped.map((r) => r.country.name)

    expect(importable.length + skipped.length).toBe(247)
    expect(skippedNames).toEqual(
      expect.arrayContaining([
        "Bir Tawil",
        "Siachen Glacier",
        "Spratly Islands",
      ])
    )
    expect(skippedNames).not.toContain("France")
    expect(importable.every((r) => iso2For(r.country) !== null)).toBe(true)
  })
})

describe("mapConfigFor", () => {
  it("builds the shared.map-config shape", () => {
    const cfg = mapConfigFor(sample)

    expect(cfg).toEqual({
      centerLat: 53.416042,
      centerLng: -8.23585,
      defaultZoom: expect.any(Number),
      boundingBoxNE: "55.386379,-5.99352",
      boundingBoxSW: "51.445705,-10.478179",
      mapStyle: "standard",
    })
    expect(Object.keys(cfg).sort()).toEqual(
      [
        "boundingBoxNE",
        "boundingBoxSW",
        "centerLat",
        "centerLng",
        "defaultZoom",
        "mapStyle",
      ].sort()
    )
  })

  it("zooms in on small countries and out on large ones", () => {
    const small = mapConfigFor(sample).defaultZoom as number
    const large = mapConfigFor({
      ...sample,
      bboxNorth: 71,
      bboxSouth: 18,
      bboxEast: -66,
      bboxWest: -179,
    }).defaultZoom as number

    expect(Number.isInteger(small)).toBe(true)
    expect(small).toBeGreaterThan(large)
    expect(large).toBeGreaterThanOrEqual(2)
    expect(small).toBeLessThanOrEqual(10)
  })
})
