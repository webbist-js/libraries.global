import { describe, expect, it } from "vitest"

import {
  PUBLIC_EVENT_FIELDS,
  PUBLIC_EVENT_STATUSES,
  asString,
  clampInt,
  pageWindow,
  parseIsoDate,
  publicEventFilters,
} from "../../src/plugins/events/server/utils/query"

import eventSchema from "../../src/plugins/events/server/content-types/event/schema.json"

describe("clampInt", () => {
  const opts = { def: 20, min: 1, max: 100 }

  it("returns the default for non-numeric input", () => {
    expect(clampInt("abc", opts)).toBe(20)
    expect(clampInt(undefined, opts)).toBe(20)
    expect(clampInt(null, opts)).toBe(20)
    expect(clampInt("", opts)).toBe(20)
    expect(clampInt(Number.NaN, opts)).toBe(20)
    expect(clampInt("NaN", opts)).toBe(20)
    expect(clampInt({}, opts)).toBe(20)
  })

  it("returns the default for arrays (?limit[]=5)", () => {
    expect(clampInt(["5"], opts)).toBe(20)
    expect(clampInt([], opts)).toBe(20)
  })

  it("clamps into range", () => {
    expect(clampInt("-1", opts)).toBe(1)
    expect(clampInt(-1, opts)).toBe(1)
    expect(clampInt("0", opts)).toBe(1)
    expect(clampInt("1e9", opts)).toBe(100)
    expect(clampInt("Infinity", opts)).toBe(100)
    expect(clampInt("-Infinity", opts)).toBe(1)
  })

  it("truncates decimals and passes in-range values through", () => {
    expect(clampInt("7", opts)).toBe(7)
    expect(clampInt(7.9, opts)).toBe(7)
    expect(clampInt("100", opts)).toBe(100)
  })
})

describe("pageWindow", () => {
  it("turns page/limit query strings into a bounded start/limit", () => {
    expect(
      pageWindow({ page: "3", limit: "10" }, { def: 20, max: 100 })
    ).toEqual({
      start: 20,
      limit: 10,
      page: 3,
    })
    expect(pageWindow({}, { def: 20, max: 100 })).toEqual({
      start: 0,
      limit: 20,
      page: 1,
    })
    expect(
      pageWindow({ page: "-5", limit: "99999" }, { def: 20, max: 100 })
    ).toEqual({
      start: 0,
      limit: 100,
      page: 1,
    })
  })
})

describe("publicEventFilters", () => {
  it("always carries pendingReview: false and the public statuses", () => {
    expect(publicEventFilters()).toEqual({
      pendingReview: false,
      status: { $in: PUBLIC_EVENT_STATUSES },
    })
  })

  it("cannot be overridden by extra filters", () => {
    const f = publicEventFilters({
      pendingReview: true,
      status: { $in: ["cancelled"] },
      libraryEntityRef: "GB-X-1",
    } as any)
    expect(f.pendingReview).toBe(false)
    expect(f.status).toEqual({ $in: PUBLIC_EVENT_STATUSES })
    expect(f.libraryEntityRef).toBe("GB-X-1")
  })

  it("uses statuses that exist in the schema enum", () => {
    const enumValues = (eventSchema as any).attributes.status.enum as string[]
    for (const s of PUBLIC_EVENT_STATUSES) expect(enumValues).toContain(s)
    expect(PUBLIC_EVENT_STATUSES).not.toContain("cancelled")
  })
})

describe("PUBLIC_EVENT_FIELDS", () => {
  it("never exposes sync internals", () => {
    for (const f of [
      "credentialId",
      "syncHash",
      "externalId",
      "pendingReview",
      "importedAt",
      "lastSeenAt",
    ])
      expect(PUBLIC_EVENT_FIELDS).not.toContain(f)
    for (const f of ["title", "startTime", "url", "libraryEntityRef", "status"])
      expect(PUBLIC_EVENT_FIELDS).toContain(f)
  })

  it("only names attributes that exist in the schema", () => {
    const attrs = Object.keys((eventSchema as any).attributes)
    for (const f of PUBLIC_EVENT_FIELDS) expect(attrs).toContain(f)
  })
})

describe("asString / parseIsoDate", () => {
  it("asString ignores arrays and objects", () => {
    expect(asString("talk")).toBe("talk")
    expect(asString(["talk"])).toBeUndefined()
    expect(asString({ a: 1 })).toBeUndefined()
    expect(asString(undefined)).toBeUndefined()
    expect(asString("")).toBeUndefined()
  })

  it("parseIsoDate accepts only parseable dates", () => {
    expect(parseIsoDate("2026-06-01T00:00:00Z")).toBe(
      "2026-06-01T00:00:00.000Z"
    )
    expect(parseIsoDate("2026-06-01")).toBe("2026-06-01T00:00:00.000Z")
    expect(parseIsoDate("yesterday")).toBeUndefined()
    expect(parseIsoDate(["2026-06-01"])).toBeUndefined()
    expect(parseIsoDate(undefined)).toBeUndefined()
  })
})
