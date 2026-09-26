import { describe, expect, it } from "vitest"

import { webpac } from "../../src/connectors/webpac"
import type { CatalogueConfig } from "../../src/types"
import { fixture, mockHttp } from "../helpers"

const config: CatalogueConfig = {
  system: "webpac",
  baseUrl: "https://library.south-ayrshire.gov.uk/",
  settings: {},
}

describe("webpac", () => {
  it("lists branches from the search scopes, skipping collection filters", async () => {
    const { http } = mockHttp([
      { match: "/search/X", body: fixture("webpac/branches.html") },
    ])
    const branches = await webpac.listBranches(config, http)
    const names = branches.map((b) => b.name)

    expect(branches).toContainEqual({ name: "Alloway Library", code: "12" })
    expect(names).toContain("Troon Library")
    expect(names).not.toContain("Adult Books")
    expect(names).not.toContain("View Entire Collection")
    expect(names).not.toContain("Any Field:")
  })

  it("tallies holdings per location", async () => {
    const { http } = mockHttp([
      {
        match: "searchtype=i&searcharg=9780141187761",
        body: fixture("webpac/search.html"),
      },
    ])
    const result = await webpac.searchByIsbn(config, "9780141187761", http)

    expect(result.found).toBe(true)
    expect(result.recordId).toBe("b1200817")
    expect(result.recordUrl).toBe(
      "https://library.south-ayrshire.gov.uk/record=b1200817"
    )
    expect(result.holdings).toEqual([
      { branch: "Ayr Classics", available: 0, unavailable: 1 },
      { branch: "Forehill Adult Fiction", available: 1, unavailable: 0 },
      { branch: "Kyle Academy Adult Fiction", available: 0, unavailable: 1 },
      { branch: "Mobile Adult Fiction Reserve", available: 1, unavailable: 0 },
      {
        branch: "Queen Margaret Academy Young Adult",
        available: 0,
        unavailable: 1,
      },
    ])
  })

  it("applies an availableStatuses override", async () => {
    const { http } = mockHttp([
      { match: "searcharg=", body: fixture("webpac/search.html") },
    ])
    const result = await webpac.searchByIsbn(
      { ...config, settings: { availableStatuses: ["IN TRANSIT"] } },
      "9780141187761",
      http
    )
    expect(result.holdings[0]).toEqual({
      branch: "Ayr Classics",
      available: 1,
      unavailable: 0,
    })
    expect(result.holdings[1]!.available).toBe(0)
  })

  it("follows the first brief citation on a multi-record hit list", async () => {
    const list = `<table><tr class="briefCitRow"><td><span class="briefcitTitle"><a href="/search~S1?/i9780141187761/i9780141187761/1,2,2,B/frameset&FF=i9780141187761&1,1,">Title</a></span></td></tr></table>`
    const { http, requests } = mockHttp([
      { match: "frameset", body: fixture("webpac/search.html") },
      { match: "searchtype=i", body: list },
    ])
    const result = await webpac.searchByIsbn(config, "9780141187761", http)

    expect(requests[1]!.url).toContain("frameset")
    expect(result.recordId).toBe("b1200817")
    expect(result.holdings.length).toBe(5)
  })

  it("reports not found on the 'nearby ISBNs' browse page", async () => {
    const { http } = mockHttp([
      {
        match: "searcharg=9799999999990",
        body: fixture("webpac/search-empty.html"),
      },
    ])
    const result = await webpac.searchByIsbn(config, "9799999999990", http)
    expect(result).toEqual({ found: false, holdings: [] })
  })
})
