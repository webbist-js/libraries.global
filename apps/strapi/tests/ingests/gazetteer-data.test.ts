import { existsSync, readFileSync } from "node:fs"
import path from "node:path"

import { describe, expect, it } from "vitest"

import {
  PROFILES,
  resolveProfile,
} from "../../scripts/ingests/gazetteer/country-profiles"
import type { CuratedList } from "../../scripts/ingests/gazetteer/curated"
import { parseAdminCodes } from "../../scripts/ingests/gazetteer/geonames"

const CACHE = path.resolve(__dirname, "../../scripts/ingests/gazetteer/.cache")
const ADMIN1 = path.join(CACHE, "admin1CodesASCII.txt")
const ADMIN2 = path.join(CACHE, "admin2Codes.txt")

const england = JSON.parse(
  readFileSync(
    path.resolve(
      __dirname,
      "../../scripts/ingests/gazetteer/data/england.json"
    ),
    "utf8"
  )
) as CuratedList

const CEREMONIAL = [
  "Bedfordshire",
  "Berkshire",
  "Bristol",
  "Buckinghamshire",
  "Cambridgeshire",
  "Cheshire",
  "City of London",
  "Cornwall",
  "Cumbria",
  "Derbyshire",
  "Devon",
  "Dorset",
  "Durham",
  "East Riding of Yorkshire",
  "East Sussex",
  "Essex",
  "Gloucestershire",
  "Greater London",
  "Greater Manchester",
  "Hampshire",
  "Herefordshire",
  "Hertfordshire",
  "Isle of Wight",
  "Kent",
  "Lancashire",
  "Leicestershire",
  "Lincolnshire",
  "Merseyside",
  "Norfolk",
  "North Yorkshire",
  "Northamptonshire",
  "Northumberland",
  "Nottinghamshire",
  "Oxfordshire",
  "Rutland",
  "Shropshire",
  "Somerset",
  "South Yorkshire",
  "Staffordshire",
  "Suffolk",
  "Surrey",
  "Tyne and Wear",
  "Warwickshire",
  "West Midlands",
  "West Sussex",
  "West Yorkshire",
  "Wiltshire",
  "Worcestershire",
]

const TYPE_BY_PREFIX: Record<string, string> = {
  E06: "Unitary authority",
  E07: "District",
  E08: "Metropolitan borough",
  E09: "London borough",
}

describe("country profiles", () => {
  it("has one valid entry per key", () => {
    const keys = PROFILES.map((p) => p.key)
    expect(new Set(keys).size).toBe(keys.length)
    for (const k of keys) expect(() => resolveProfile(k)).not.toThrow()
  })

  it("covers the 44 countries already in the atlas", () => {
    const existing = [
      "AD",
      "AL",
      "AT",
      "BA",
      "BE",
      "BG",
      "BY",
      "CH",
      "CY",
      "CZ",
      "DE",
      "DK",
      "EE",
      "EG",
      "ES",
      "FI",
      "FR",
      "GB-ENG",
      "GB-NIR",
      "GB-SCT",
      "GB-WLS",
      "GR",
      "HR",
      "HU",
      "IE",
      "IS",
      "IT",
      "LT",
      "LV",
      "MD",
      "ME",
      "MK",
      "NL",
      "NO",
      "PL",
      "PT",
      "RO",
      "RS",
      "SE",
      "SI",
      "SK",
      "UA",
      "US",
      "XK",
    ]
    const keys = new Set(PROFILES.map((p) => p.key))
    expect(existing.filter((k) => !keys.has(k))).toEqual([])
  })

  it("never aliases two places to one name", () => {
    for (const p of PROFILES) {
      const targets = Object.values(p.aliases ?? {})
      expect(new Set(targets).size, p.key).toBe(targets.length)
    }
  })

  // The GeoNames files are downloaded on the first import run, so CI may not have them.
  it.skipIf(!existsSync(ADMIN1) || !existsSync(ADMIN2))(
    "aliases each place to a GeoNames name at its Region level",
    () => {
      const levels = {
        1: parseAdminCodes(readFileSync(ADMIN1, "utf8"), 1),
        2: parseAdminCodes(readFileSync(ADMIN2, "utf8"), 2),
      }
      const missing: string[] = []
      for (const { key } of PROFILES) {
        const profile = resolveProfile(key)
        if (profile.source !== "geonames") continue
        const { country, admin1 } = profile.geonames
        const names = new Set(
          levels[profile.regionLevel]
            .filter(
              (d) => d.country === country && (!admin1 || d.admin1 === admin1)
            )
            .map((d) => d.name)
        )
        for (const [from, to] of Object.entries(profile.aliases))
          if (!names.has(to)) missing.push(`${key}: ${from} → ${to}`)
      }
      expect(missing).toEqual([])
    }
  )
})

describe("data/england.json", () => {
  it("lists the 48 ceremonial counties", () => {
    expect(england.source).toBe("ons-lad")
    expect(england.regions.map((r) => r.name).sort()).toEqual(
      [...CEREMONIAL].sort()
    )
  })

  it("files every English district once, typed by its GSS code", () => {
    const areas = england.regions.flatMap((r) => r.areas)
    const codes = areas.map((a) => a.gssCode)
    expect(new Set(codes).size).toBe(codes.length)
    expect(areas.length).toBeGreaterThanOrEqual(290)
    expect(areas.length).toBeLessThanOrEqual(300)
    for (const a of areas) {
      expect(a.gssCode).toMatch(/^E0[6-9]\d{6}$/)
      const expected =
        a.gssCode === "E09000001"
          ? "City corporation"
          : TYPE_BY_PREFIX[a.gssCode.slice(0, 3)]
      expect(a.typeLabel).toBe(expected)
    }
  })

  it("puts known districts in the right county", () => {
    const countyOf = (gss: string) =>
      england.regions.find((r) => r.areas.some((a) => a.gssCode === gss))?.name
    expect(countyOf("E09000001")).toBe("City of London")
    expect(countyOf("E09000007")).toBe("Greater London") // Camden
    expect(countyOf("E08000035")).toBe("West Yorkshire") // Leeds
    expect(countyOf("E06000034")).toBe("Essex") // Thurrock
    expect(countyOf("E07000110")).toBe("Kent") // Maidstone
    expect(countyOf("E06000058")).toBe("Dorset") // Bournemouth, Christchurch and Poole
    expect(countyOf("E06000047")).toBe("Durham") // County Durham
  })
})
