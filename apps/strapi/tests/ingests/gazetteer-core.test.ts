import { describe, expect, it } from "vitest"

import { slugify } from "../../scripts/ingests/_shared/text"
import {
  resolveProfile,
  type CountryProfile,
} from "../../scripts/ingests/gazetteer/country-profiles"
import { curatedPlaces } from "../../scripts/ingests/gazetteer/curated"
import {
  geonamesPlaces,
  parseAdminCodes,
  parseCountryDump,
  tidyName,
} from "../../scripts/ingests/gazetteer/geonames"
import { findMatch, normaliseName } from "../../scripts/ingests/gazetteer/match"
import { planChildren } from "../../scripts/ingests/gazetteer/plan"
import { planSlugs } from "../../scripts/ingests/gazetteer/slugs"
import type {
  ExistingPlace,
  SourcePlace,
} from "../../scripts/ingests/gazetteer/types"

const src = (name: string, over: Partial<SourcePlace> = {}): SourcePlace => ({
  sourceId: `geonames:${name}`,
  name,
  altNames: [],
  key: name,
  ...over,
})
const ex = (
  name: string,
  over: Partial<ExistingPlace> = {}
): ExistingPlace => ({
  documentId: `doc-${name}`,
  name,
  slug: name.toLowerCase().replaceAll(" ", "-"),
  ...over,
})

describe("normaliseName", () => {
  it("ignores case, accents, punctuation and type words", () => {
    expect(normaliseName("Zürich")).toBe("zurich")
    expect(normaliseName("Canton of Zürich")).toBe("zurich")
    expect(normaliseName("County Durham")).toBe("durham")
    expect(normaliseName("Windsor And Maidenhead")).toBe(
      normaliseName("Windsor and Maidenhead")
    )
    expect(normaliseName("Bath & North East Somerset")).toBe(
      "bath and north east somerset"
    )
  })

  it("drops the country's own label words too, but never to nothing", () => {
    expect(normaliseName("Landkreis Rosenheim", ["Landkreis"])).toBe(
      "rosenheim"
    )
    expect(normaliseName("Region")).toBe("region")
    expect(normaliseName("Москва")).toBe("")
  })

  it("transliterates letters NFKD can't split, so every place can match", () => {
    expect(normaliseName("Ærø")).toBe("aero")
  })

  it('removes apostrophes, like slugify, so "Hawke\'s Bay" joins "Hawkes Bay"', () => {
    expect(normaliseName("Hawke's Bay")).toBe(normaliseName("Hawkes Bay"))
    expect(normaliseName("Hawke’s Bay")).toBe(normaliseName("Hawkes Bay"))
    expect(normaliseName("Hawke's Bay")).toBe("hawkes bay")
  })
})

describe("slugify", () => {
  it("transliterates letters NFKD can't split, so every place can be slugged", () => {
    expect(slugify("Łódź Voivodeship")).toBe("lodz-voivodeship")
    expect(slugify("Østfold")).toBe("ostfold")
    expect(slugify("Weißenburg-Gunzenhausen")).toBe("weissenburg-gunzenhausen")
    expect(slugify("Ærø")).toBe("aero")
  })
})

describe("findMatch", () => {
  it("matches by geonamesId first, then by name or alternate name", () => {
    const zh = ex("Zurich", { geonamesId: "2657895" })
    expect(
      findMatch(src("Kanton Zürich", { geonamesId: "2657895" }), [zh])
    ).toBe(zh)
    expect(
      findMatch(src("Geneva", { altNames: ["Genève"] }), [ex("Genève")])?.name
    ).toBe("Genève")
  })

  it("matches by GSS code", () => {
    const camden = ex("London Borough of Camden", { gssCode: "E09000007" })
    expect(findMatch(src("Camden", { gssCode: "E09000007" }), [camden])).toBe(
      camden
    )
  })

  it("won't take a place already tied to another GeoNames id, or an ambiguous name", () => {
    expect(
      findMatch(src("Limburg", { geonamesId: "1" }), [
        ex("Limburg", { geonamesId: "2" }),
      ])
    ).toBeNull()
    expect(
      findMatch(src("Springfield"), [
        ex("Springfield", { documentId: "a" }),
        ex("Springfield", { documentId: "b" }),
      ])
    ).toBeNull()
  })

  it("follows an alias from an existing name to the source's spelling", () => {
    const bcp = ex("Bournemouth and Christchurch and Poole")
    expect(
      findMatch(src("Bournemouth, Christchurch and Poole"), [bcp], {
        aliases: {
          "Bournemouth and Christchurch and Poole":
            "Bournemouth, Christchurch and Poole",
        },
      })
    ).toBe(bcp)
  })
})

describe("planChildren", () => {
  it("creates everything for a parent with no places", () => {
    const plan = planChildren({
      sources: [src("Bern"), src("Vaud")],
      existing: [],
      fill: false,
    })
    expect(plan.actions.map((a) => a.kind)).toEqual(["create", "create"])
  })

  it("adds nothing where places exist, unless the profile fills", () => {
    const existing = [ex("Bern")]
    const strict = planChildren({
      sources: [src("Bern", { geonamesId: "9" }), src("Vaud")],
      existing,
      fill: false,
    })
    expect(strict.actions).toEqual([
      {
        kind: "match",
        source: src("Bern", { geonamesId: "9" }),
        existing: existing[0],
        fill: { geonamesId: "9" },
      },
      { kind: "not-added", source: src("Vaud"), reason: "parent-has-places" },
    ])
    const filled = planChildren({
      sources: [src("Vaud")],
      existing,
      fill: true,
    })
    expect(filled.actions[0]?.kind).toBe("create")
    expect(filled.unmatchedExisting).toEqual(existing)
  })

  it("never ties two sources to one existing place", () => {
    const kent = ex("Kent")
    const kentDup = src("Kent", { sourceId: "geonames:dup" })
    const plan = planChildren({
      sources: [src("Kent"), kentDup],
      existing: [kent],
      fill: true,
    })
    expect(plan.actions).toEqual([
      { kind: "create", source: src("Kent") },
      { kind: "create", source: kentDup },
    ])
    expect(plan.ambiguous).toEqual([src("Kent"), kentDup])
    expect(plan.unmatchedExisting).toEqual([kent])
  })

  it("lets an id match win over a name two sources would otherwise contest", () => {
    const kent7 = ex("Kent", { geonamesId: "7" })
    const kentNoId = src("Kent")
    const kentWithId = src("Kent", { geonamesId: "7" })
    const plan = planChildren({
      sources: [kentNoId, kentWithId],
      existing: [kent7],
      fill: true,
    })
    expect(plan.actions).toEqual([
      { kind: "create", source: kentNoId },
      { kind: "match", source: kentWithId, existing: kent7, fill: {} },
    ])
    expect(plan.ambiguous).toEqual([])
  })

  it("treats two existing places that both match a name as ambiguous, not a free pick", () => {
    const durham = ex("Durham")
    const countyDurham = ex("County Durham")
    const durhamSource = src("Durham")
    const filled = planChildren({
      sources: [durhamSource],
      existing: [durham, countyDurham],
      fill: true,
    })
    expect(filled.actions).toEqual([{ kind: "create", source: durhamSource }])
    expect(filled.ambiguous).toEqual([durhamSource])

    const strict = planChildren({
      sources: [durhamSource],
      existing: [durham, countyDurham],
      fill: false,
    })
    expect(strict.actions).toEqual([
      { kind: "not-added", source: durhamSource, reason: "parent-has-places" },
    ])
    expect(strict.ambiguous).toEqual([durhamSource])
  })

  it("gives the same result whichever order the sources come in", () => {
    const sources = [
      src("Bern"),
      src("Vaud", { geonamesId: "5" }),
      src("Kent"),
      src("Kent", { sourceId: "geonames:kent-dup" }),
    ]
    const existing = [ex("Vaud", { geonamesId: "5" }), ex("Bern"), ex("Kent")]
    const toMap = (plan: ReturnType<typeof planChildren>) =>
      new Map(
        plan.actions.map((a) => [
          a.source.sourceId,
          a.kind === "match" ? `match:${a.existing.documentId}` : a.kind,
        ])
      )
    const forward = planChildren({ sources, existing, fill: true })
    const reversed = planChildren({
      sources: [...sources].reverse(),
      existing,
      fill: true,
    })
    expect(toMap(reversed)).toEqual(toMap(forward))
  })
})

describe("planSlugs", () => {
  it("keeps a free slug, and suffixes every new place that shares one", () => {
    const slugs = planSlugs(
      [
        { id: "nl", name: "Limburg", suffix: "nl", tieBreak: "1" },
        { id: "be", name: "Limburg", suffix: "be", tieBreak: "2" },
        { id: "zh", name: "Zürich", suffix: "ch", tieBreak: "3" },
      ],
      new Set()
    )
    expect(Object.fromEntries(slugs)).toEqual({
      nl: "limburg-nl",
      be: "limburg-be",
      zh: "zurich",
    })
  })

  it("suffixes a new place whose slug is already taken, and breaks remaining ties", () => {
    const slugs = planSlugs(
      [
        { id: "a", name: "Central", suffix: "gh", tieBreak: "11" },
        { id: "b", name: "Central", suffix: "gh", tieBreak: "12" },
        { id: "c", name: "Kent", suffix: "gb-eng", tieBreak: "13" },
      ],
      new Set(["kent"])
    )
    expect(Object.fromEntries(slugs)).toEqual({
      a: "central-gh-11",
      b: "central-gh-12",
      c: "kent-gb-eng",
    })
  })

  it("always suffixes US-style requests", () => {
    const slugs = planSlugs(
      [
        {
          id: "x",
          name: "Tompkins County",
          suffix: "NY",
          alwaysSuffix: true,
          tieBreak: "1",
        },
      ],
      new Set()
    )
    expect(slugs.get("x")).toBe("tompkins-county-ny")
  })

  it("gives the same map whichever order the requests come in", () => {
    const requests = [
      { id: "nl", name: "Limburg", suffix: "nl", tieBreak: "1" },
      { id: "be", name: "Limburg", suffix: "be", tieBreak: "2" },
      { id: "zh", name: "Zürich", suffix: "ch", tieBreak: "3" },
    ]
    const forward = planSlugs(requests, new Set())
    const reversed = planSlugs([...requests].reverse(), new Set())
    expect(Object.fromEntries(reversed)).toEqual(Object.fromEntries(forward))
  })

  it("guarantees uniqueness even when a tie-break collides with another base slug", () => {
    const slugs = planSlugs(
      [
        { id: "a", name: "Central", suffix: "gh", tieBreak: "11" },
        { id: "b", name: "Central", suffix: "gh", tieBreak: "12" },
        { id: "c", name: "Central GH 11", suffix: "gh", tieBreak: "13" },
      ],
      new Set()
    )
    expect(new Set(slugs.values()).size).toBe(3)
  })

  it("numbers a tie-broken slug that's already taken", () => {
    const slugs = planSlugs(
      [
        { id: "a", name: "Central", suffix: "gh", tieBreak: "11" },
        { id: "b", name: "Central", suffix: "gh", tieBreak: "12" },
      ],
      new Set(["central-gh-11"])
    )
    expect(Object.fromEntries(slugs)).toEqual({
      a: "central-gh-11-2",
      b: "central-gh-12",
    })
  })

  it("adds no suffix when it's empty, so a clash falls through to one hyphen", () => {
    const slugs = planSlugs(
      [{ id: "x", name: "Kent", suffix: "", tieBreak: "gb-eng" }],
      new Set(["kent"])
    )
    expect(slugs.get("x")).toBe("kent-gb-eng")
  })
})

describe("GeoNames parsing", () => {
  it("reads admin1 and admin2 code files", () => {
    expect(
      parseAdminCodes("CH.ZH\tZurich\tZurich\t2657895\nbad line\n", 1)
    ).toEqual([
      {
        geonameId: "2657895",
        level: 1,
        country: "CH",
        admin1: "ZH",
        admin2: "",
        name: "Zurich",
        asciiName: "Zurich",
        altNames: [],
      },
    ])
    expect(
      parseAdminCodes(
        "US.NY.097\tSchuyler County\tSchuyler County\t5137920\n",
        2
      )[0]
    ).toMatchObject({ level: 2, country: "US", admin1: "NY", admin2: "097" })
  })

  it("keeps only ADM1–ADM3 rows from a country dump", () => {
    const row = (code: string, name: string) =>
      [
        "123",
        name,
        name,
        "Alt A,Alt B",
        "48.1",
        "11.5",
        "A",
        code,
        "DE",
        "",
        "02",
        "091",
        "09187",
        "",
        "0",
        "",
        "500",
        "Europe/Berlin",
        "2024-01-01",
      ].join("\t")
    const rows = parseCountryDump(
      [
        row("ADM3", "Landkreis Rosenheim"),
        row("PPL", "Rosenheim"),
        row("ADM1H", "Old"),
      ].join("\n")
    )
    expect(rows).toEqual([
      {
        geonameId: "123",
        level: 3,
        country: "DE",
        admin1: "02",
        admin2: "091",
        name: "Landkreis Rosenheim",
        asciiName: "Landkreis Rosenheim",
        altNames: ["Alt A", "Alt B"],
      },
    ])
  })

  it("tidies type words off either end", () => {
    expect(tidyName("Landkreis Rosenheim", ["Landkreis "])).toBe("Rosenheim")
    expect(tidyName("Rhône Department", [" Department"])).toBe("Rhône")
    expect(tidyName("Landkreis ", ["Landkreis "])).toBe("Landkreis ")
  })

  it("turns a profile's levels into Regions and Areas", () => {
    const profile = resolveProfile("DE", [
      {
        key: "DE",
        areaLevel: 3,
        tidyNames: ["Landkreis ", "Kreisfreie Stadt "],
      },
    ])
    const admin1 = parseAdminCodes("DE.02\tBavaria\tBavaria\t2951839\n", 1)
    const dump = [
      {
        geonameId: "1",
        level: 3 as const,
        country: "DE",
        admin1: "02",
        admin2: "091",
        name: "Landkreis Rosenheim",
        asciiName: "Landkreis Rosenheim",
        altNames: [],
      },
      {
        geonameId: "2",
        level: 3 as const,
        country: "DE",
        admin1: "02",
        admin2: "091",
        name: "Kreisfreie Stadt Rosenheim",
        asciiName: "Kreisfreie Stadt Rosenheim",
        altNames: [],
      },
      {
        geonameId: "3",
        level: 3 as const,
        country: "DE",
        admin1: "02",
        admin2: "091",
        name: "Landkreis Ebersberg",
        asciiName: "Landkreis Ebersberg",
        altNames: [],
      },
    ]
    const places = geonamesPlaces(profile, { admin1, admin2: [], dump })
    expect(places.regions).toEqual([
      {
        sourceId: "geonames:2951839",
        geonamesId: "2951839",
        name: "Bavaria",
        altNames: [],
        key: "02",
        admin1: "02",
      },
    ])
    // Both Rosenheims would tidy to "Rosenheim", so both keep their full names.
    expect(places.areas.map((a) => [a.name, a.parentKey])).toEqual([
      ["Landkreis Rosenheim", "02"],
      ["Kreisfreie Stadt Rosenheim", "02"],
      ["Ebersberg", "02"],
    ])
  })

  it("reads a UK nation's level-2 places", () => {
    const profile = resolveProfile("GB-SCT", [
      {
        key: "GB-SCT",
        geonames: { country: "GB", admin1: "SCT" },
        regionLevel: 2,
        areaLevel: null,
      },
    ])
    const admin2 = parseAdminCodes(
      "GB.SCT.T5\tGlasgow City\tGlasgow City\t3333231\nGB.WLS.Y1\tCardiff\tCardiff\t3333148\n",
      2
    )
    const places = geonamesPlaces(profile, { admin1: [], admin2 })
    expect(places.regions.map((r) => [r.name, r.key])).toEqual([
      ["Glasgow City", "SCT.T5"],
    ])
    expect(places.areas).toEqual([])
  })
})

describe("curated lists", () => {
  it("turns counties and districts into Regions and Areas", () => {
    const places = curatedPlaces({
      source: "ons-lad",
      attribution: "ONS",
      regions: [
        {
          key: "essex",
          name: "Essex",
          areas: [
            {
              gssCode: "E06000034",
              name: "Thurrock",
              typeLabel: "Unitary authority",
            },
          ],
        },
      ],
    })
    expect(places.regions).toEqual([
      { sourceId: "curated:essex", name: "Essex", altNames: [], key: "essex" },
    ])
    expect(places.areas).toEqual([
      {
        sourceId: "gss:E06000034",
        gssCode: "E06000034",
        name: "Thurrock",
        altNames: [],
        key: "E06000034",
        parentKey: "essex",
        typeLabel: "Unitary authority",
      },
    ])
  })
})

describe("resolveProfile", () => {
  const profiles: CountryProfile[] = [
    { key: "CH", labels: { region: "Canton", regions: "Cantons" } },
    { key: "GB-X", source: "curated" },
    { key: "GB-Y" },
    { key: "ZZ", regionLevel: 2, areaLevel: 2 },
  ]

  it("fills defaults", () => {
    expect(resolveProfile("FR", profiles)).toEqual({
      key: "FR",
      labels: null,
      regionLevel: 1,
      areaLevel: 2,
      geonames: { country: "FR" },
      fill: false,
      source: "geonames",
      curatedFile: null,
      tidyNames: [],
      areaSlugSuffix: "on-clash",
      aliases: {},
      regionLabels: {},
    })
    expect(resolveProfile("CH", profiles).labels?.region).toBe("Canton")
  })

  it("refuses profiles that can't work", () => {
    expect(() => resolveProfile("GB-X", profiles)).toThrow(/curatedFile/)
    expect(() => resolveProfile("GB-Y", profiles)).toThrow(/GeoNames country/)
    expect(() => resolveProfile("ZZ", profiles)).toThrow(
      /below the Region level/
    )
  })
})
