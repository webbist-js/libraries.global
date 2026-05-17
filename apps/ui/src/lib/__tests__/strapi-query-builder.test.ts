import { describe, expect, it } from "vitest"

import { eqFilter, eqOrNull } from "@/lib/strapi-api/query-builder"

describe("eqOrNull", () => {
  it("returns $eq filter for a non-empty string", () => {
    expect(eqOrNull("foo")).toEqual({ $eq: "foo" })
  })

  it("returns $null filter for empty string", () => {
    expect(eqOrNull("")).toEqual({ $null: true })
  })

  it("returns $null filter for null", () => {
    expect(eqOrNull(null)).toEqual({ $null: true })
  })

  it("returns $null filter for undefined", () => {
    expect(eqOrNull(undefined)).toEqual({ $null: true })
  })
})

describe("eqFilter", () => {
  it("returns $eq filter", () => {
    expect(eqFilter("bar")).toEqual({ $eq: "bar" })
  })
})
