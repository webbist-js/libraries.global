import { describe, expect, it } from "vitest"

import { iguana } from "../../src/connectors/iguana"
import type { CatalogueConfig } from "../../src/types"
import { fixture, mockHttp, type Route } from "../helpers"

const config: CatalogueConfig = {
  system: "iguana",
  baseUrl: "https://libcat.renfrewshire.gov.uk/iguana/",
  settings: { database: "1", faceted: false },
}

const home: Route = {
  match: "www.main.cls",
  body: fixture("iguana/home.html"),
  headers: {
    "Set-Cookie":
      "CSPSESSIONID-SP-443-UP-iguana-=000001000000LSB1J2FkI3h$V$gphqQ4Iwir87SsJc8z3hCBec; path=/iguana/; secure; httpOnly",
  },
}

const proxy = (body: string): Route => ({
  match: "Proxy.SearchRequest.cls",
  method: "POST",
  body,
})

describe("iguana", () => {
  it("lists branches with codes from the Location facet", async () => {
    const { http, requests } = mockHttp([
      home,
      proxy(fixture("iguana/branches.xml")),
    ])
    const branches = await iguana.listBranches(config, http)

    expect(branches).toContainEqual({
      name: "PAISLEY CENTRAL LIBRARY",
      code: "REN/CEN",
    })
    expect(branches).toContainEqual({
      name: "BRIDGE OF WEIR LIBRARY",
      code: "REN/BOW",
    })
    expect(branches.length).toBe(15)
    expect(requests[1]!.body).toContain("SIDTKN=LSB1J2FkI3")
    expect(requests[1]!.body).toContain("Request=harry")
  })

  it("falls back to shelfmarks when the response has no facets", async () => {
    const xml = `<?xml version="1.0"?><searchRetrieveResponse><records><record><recordData><BibDocument><Id>1.1</Id>
      <HoldingsSummary><ShelfmarkData><Shelfmark><![CDATA[GRAYS LIBRARY : Fiction]]></Shelfmark><Scope><![CDATA[T/GRY]]></Scope><Available><![CDATA[1]]></Available></ShelfmarkData>
      <ShelfmarkData><Shelfmark><![CDATA[TILBURY : Fiction]]></Shelfmark><Available><![CDATA[0]]></Available></ShelfmarkData></HoldingsSummary>
      </BibDocument></recordData></record></records></searchRetrieveResponse>`
    const { http } = mockHttp([home, proxy(xml)])
    const branches = await iguana.listBranches(config, http)

    expect(branches).toEqual([
      { name: "GRAYS LIBRARY", code: "T/GRY" },
      { name: "TILBURY" },
    ])
  })

  it("tallies holdings per branch from the holdings summary", async () => {
    const { http, requests } = mockHttp([
      home,
      proxy(fixture("iguana/search.xml")),
    ])
    const result = await iguana.searchByIsbn(config, "9780747532743", http)

    expect(result.found).toBe(true)
    expect(result.recordId).toBe("1.130922")
    expect(result.recordUrl).toContain("RecordId=1.130922")
    expect(result.holdings).toEqual([
      { branch: "LINWOOD LIBRARY", available: 0, unavailable: 1 },
      { branch: "RENFREW LIBRARY", available: 0, unavailable: 1 },
    ])
    expect(requests[1]!.body).toContain("Request=9780747532743")
    expect(requests[1]!.body).toContain("Database=1&")
  })

  it("counts available copies", async () => {
    const xml = fixture("iguana/search.xml").replace(
      "<Available><![CDATA[0]]></Available>",
      "<Available><![CDATA[2]]></Available>"
    )
    const { http } = mockHttp([home, proxy(xml)])
    const result = await iguana.searchByIsbn(config, "9780747532743", http)

    expect(result.holdings[0]).toEqual({
      branch: "LINWOOD LIBRARY",
      available: 2,
      unavailable: 0,
    })
  })

  it("applies the database override", async () => {
    const { http, requests } = mockHttp([
      home,
      proxy(fixture("iguana/search.xml")),
    ])
    await iguana.searchByIsbn(
      {
        ...config,
        baseUrl: "https://dag.vsmarthosting.net/iguana/",
        settings: { database: "1_STOCK" },
      },
      "9780747532743",
      http
    )
    expect(requests[1]!.body).toContain("Database=1_STOCK")
  })

  it("reports not found when there are no records", async () => {
    const { http } = mockHttp([home, proxy(fixture("iguana/search-empty.xml"))])
    const result = await iguana.searchByIsbn(config, "9799999999990", http)
    expect(result).toEqual({ found: false, holdings: [] })
  })

  it("treats a best-match guess as not found", async () => {
    const xml = fixture("iguana/search.xml").replace(
      "<numberOfRecords>",
      "<bestMatch>1</bestMatch><numberOfRecords>"
    )
    const { http } = mockHttp([home, proxy(xml)])
    const result = await iguana.searchByIsbn(config, "9780747532743", http)
    expect(result).toEqual({ found: false, holdings: [] })
  })

  it("fails with a parse error when no session cookie is issued", async () => {
    const { http } = mockHttp([{ match: "www.main.cls", body: "" }])
    await expect(
      iguana.searchByIsbn(config, "9780747532743", http)
    ).rejects.toMatchObject({
      code: "parse",
    })
  })
})
