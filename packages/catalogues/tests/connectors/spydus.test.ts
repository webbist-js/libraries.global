import { describe, expect, it } from "vitest"

import { spydus } from "../../src/connectors/spydus"
import type { CatalogueConfig } from "../../src/types"
import { fixture, mockHttp } from "../helpers"

const config: CatalogueConfig = {
  system: "spydus",
  baseUrl: "https://aberdeencity.spydus.co.uk/",
  settings: {},
}

describe("spydus", () => {
  it("lists branches with their codes, skipping 'All locations'", async () => {
    const { http } = mockHttp([
      { match: "MSGTRN/WPAC/COMB", body: fixture("spydus/branches.html") },
    ])
    const branches = await spydus.listBranches(config, http)

    expect(branches.length).toBeGreaterThan(10)
    expect(branches).toContainEqual({ name: "Airyhall Library", code: "28083" })
    expect(branches.map((b) => b.name)).not.toContain("All locations")
  })

  it("applies the opacReference override", async () => {
    const { http, requests } = mockHttp([
      { match: "MSGTRN/OPAC/COMB", body: fixture("spydus/branches.html") },
    ])
    await spydus.listBranches(
      { ...config, settings: { opacReference: "OPAC" } },
      http
    )
    expect(requests[0]!.url).toContain("/OPAC/")
  })

  it("tallies holdings per branch", async () => {
    const { http } = mockHttp([
      { match: "BIBENQ?NRECS=1", body: fixture("spydus/search.html") },
      { match: "/XHLD/", body: fixture("spydus/holdings.html") },
    ])
    const result = await spydus.searchByIsbn(config, "9781408855652", http)

    expect(result.found).toBe(true)
    expect(result.recordId).toBe("1853808")
    expect(result.recordUrl).toContain("ISBN=9781408855652")
    expect(result.holdings.length).toBeGreaterThan(0)
    const airyhall = result.holdings.find(
      (h) => h.branch === "Airyhall Library"
    )
    expect(airyhall).toBeDefined()
    expect(airyhall!.available + airyhall!.unavailable).toBeGreaterThan(0)
  })

  it("reports not found when there are no results", async () => {
    const { http } = mockHttp([
      { match: "BIBENQ?NRECS=1", body: fixture("spydus/search-empty.html") },
    ])
    const result = await spydus.searchByIsbn(config, "9780000000002", http)
    expect(result).toEqual({ found: false, holdings: [] })
  })
})
