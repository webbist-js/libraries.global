import { describe, expect, it } from "vitest"

import { aspen } from "../../src/connectors/aspen"
import type { CatalogueConfig } from "../../src/types"
import { fixture, mockHttp } from "../helpers"

// Recorded from libraries.westminster.gov.uk, Sept 2026.

const config: CatalogueConfig = {
  system: "aspen",
  baseUrl: "https://libraries.westminster.gov.uk/",
  settings: {},
}

const RECORD = "b136eb5d-5be0-78f3-c3a6-0eab9eab0cb6-eng"

describe("aspen", () => {
  it("lists branches from Hours & Locations, with location ids", async () => {
    const { http } = mockHttp([
      {
        match: "getHoursAndLocations",
        body: fixture("aspen/hours-locations.html"),
      },
    ])
    const branches = await aspen.listBranches(config, http)

    expect(branches).toHaveLength(16)
    expect(branches).toContainEqual({
      name: "Charing Cross Library",
      code: "15",
    })
    expect(branches).toContainEqual({
      name: "Queen's Park Library",
      code: "28",
    })
  })

  it("falls back to the advanced search facet", async () => {
    const { http } = mockHttp([
      { match: "getHoursAndLocations", status: 404 },
      {
        match: "searchIndex=advanced",
        body: fixture("aspen/advanced-search.html"),
      },
    ])
    const branches = await aspen.listBranches(config, http)

    expect(branches).toEqual([
      { name: "Brompton Library" },
      { name: "Charing Cross Library" },
      { name: "Chelsea Library" },
      { name: "Church Street Library" },
    ])
  })

  it("tallies copies per branch", async () => {
    const { http, requests } = mockHttp([
      { match: "lookfor=9780141439518", body: fixture("aspen/search.html") },
      { match: "method=getCopyDetails", body: fixture("aspen/copies.json") },
    ])
    const result = await aspen.searchByIsbn(config, "9780141439518", http)

    expect(requests[1]!.url).toBe(
      `https://libraries.westminster.gov.uk/GroupedWork/${RECORD}/AJAX?method=getCopyDetails&format=Book&recordId=${RECORD}`
    )
    expect(result.found).toBe(true)
    expect(result.recordId).toBe(RECORD)
    expect(result.recordUrl).toBe(
      `https://libraries.westminster.gov.uk/GroupedWork/${RECORD}/Home`
    )
    expect(result.holdings).toHaveLength(17)
    expect(result.holdings).toContainEqual({
      branch: "Church Street Library",
      available: 3,
      unavailable: 2,
    })
    expect(result.holdings).toContainEqual({
      branch: "Paddington Library",
      available: 6,
      unavailable: 1,
    })
    expect(result.holdings).toContainEqual({
      branch: "Queen's Park Library",
      available: 1,
      unavailable: 1,
    })
  })

  it("reports not found when there are no results", async () => {
    const { http } = mockHttp([
      {
        match: "lookfor=9791994738215",
        body: fixture("aspen/search-empty.html"),
      },
    ])
    const result = await aspen.searchByIsbn(config, "9791994738215", http)
    expect(result).toEqual({ found: false, holdings: [] })
  })
})
