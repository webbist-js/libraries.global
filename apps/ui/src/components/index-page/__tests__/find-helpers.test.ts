import { describe, expect, it } from "vitest"

import {
  DEFAULT_FIND_STATE,
  findStateFromParams,
  findStateToParams,
  hasActiveFindFilters,
} from "../find-helpers"

describe("place scope", () => {
  it("reads a continent, country or region slug from the URL", () => {
    expect(
      findStateFromParams(new URLSearchParams("continent=europe")).place
    ).toEqual({ level: "continent", slug: "europe" })
    expect(
      findStateFromParams(new URLSearchParams("country=england&q=radlett"))
        .place
    ).toEqual({ level: "country", slug: "england" })
  })

  it("prefers the narrowest place when several are given", () => {
    expect(
      findStateFromParams(
        new URLSearchParams("continent=europe&region=hertfordshire")
      ).place
    ).toEqual({ level: "region", slug: "hertfordshire" })
  })

  it("round-trips and counts as an active filter", () => {
    const state = {
      ...DEFAULT_FIND_STATE,
      place: { level: "region" as const, slug: "hertfordshire" },
    }
    expect(findStateToParams(state).toString()).toBe("region=hertfordshire")
    expect(hasActiveFindFilters(state)).toBe(true)
    expect(hasActiveFindFilters(DEFAULT_FIND_STATE)).toBe(false)
  })
})
