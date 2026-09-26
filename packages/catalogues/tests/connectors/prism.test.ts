import { describe, expect, it } from "vitest"

import { prism } from "../../src/connectors/prism"
import type { CatalogueConfig } from "../../src/types"
import { fixture, mockHttp } from "../helpers"

// prism.librarymanagementcloud.co.uk (Akamai) answered 403 "Access Denied" to
// our honest User-Agent in Sept 2026, so these fixtures are hand-written from
// the markup upstream's prism3.js parses.

const config: CatalogueConfig = {
  system: "prism",
  baseUrl: "https://prism.librarymanagementcloud.co.uk/barnet/",
  settings: {},
}

describe("prism", () => {
  it("lists branches with their codes", async () => {
    const { http } = mockHttp([
      {
        match: "advancedsearch?target=catalogue",
        body: fixture("prism/advanced-search.html"),
      },
    ])
    const branches = await prism.listBranches(config, http)

    expect(branches).toEqual([
      { name: "Burnt Oak Library", code: "BU" },
      { name: "Chipping Barnet Library", code: "CF" },
      { name: "Church End Library", code: "CH" },
      { name: "East Finchley Library", code: "EF" },
      { name: "Hendon Library", code: "HL" },
    ])
  })

  it("skips eBook-only records and tallies holdings", async () => {
    const { http, requests } = mockHttp([
      {
        match: "items.json?query=9780141439518",
        body: fixture("prism/items.json"),
      },
      { match: "/barnet/items/1234567", body: fixture("prism/item.html") },
    ])
    const result = await prism.searchByIsbn(config, "9780141439518", http)

    expect(requests).toHaveLength(2)
    expect(result).toEqual({
      found: true,
      recordId: "1234567",
      recordUrl:
        "https://prism.librarymanagementcloud.co.uk/barnet/items/1234567",
      holdings: [
        { branch: "Chipping Barnet Library", available: 1, unavailable: 1 },
        { branch: "Hendon Library", available: 1, unavailable: 2 },
      ],
    })
  })

  it("also counts settings.availableStatuses as available", async () => {
    const { http } = mockHttp([
      { match: "items.json", body: fixture("prism/items.json") },
      { match: "/items/1234567", body: fixture("prism/item.html") },
    ])
    const result = await prism.searchByIsbn(
      { ...config, settings: { availableStatuses: ["On shelf"] } },
      "9780141439518",
      http
    )
    expect(result.holdings).toContainEqual({
      branch: "Hendon Library",
      available: 2,
      unavailable: 1,
    })
  })

  it("reports not found when there are no item records", async () => {
    const { http } = mockHttp([
      { match: "items.json", body: fixture("prism/items-empty.json") },
    ])
    const result = await prism.searchByIsbn(config, "9780000000002", http)
    expect(result).toEqual({ found: false, holdings: [] })
  })

  it("surfaces the real Akamai denial as blocked", async () => {
    const { http } = mockHttp([
      {
        match: "advancedsearch",
        status: 403,
        body: fixture("prism/access-denied.html"),
      },
    ])
    await expect(prism.listBranches(config, http)).rejects.toMatchObject({
      code: "blocked",
    })
  })
})
