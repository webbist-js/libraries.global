import { describe, expect, it } from "vitest"

import { durham } from "../../src/connectors/durham"
import { CatalogueHttp } from "../../src/http"
import type { CatalogueConfig } from "../../src/types"
import { fixture, mockHttp } from "../helpers"

const config: CatalogueConfig = {
  system: "durham",
  baseUrl: "https://libraryonline.durham.gov.uk/",
  settings: {},
}

const RESULTS = "/pgCatKeywordResults.aspx?KEY=4366415&ITEMS=1&EITEMS=0"

interface BodyRoute {
  match: string | RegExp
  method?: "GET" | "POST"
  /** Substring the (decoded) request body must contain. */
  body?: string
  status?: number
  headers?: Record<string, string>
  response?: string
}

/** The ASP.NET postbacks share a URL, so routes here can also match on the form body. */
function formHttp(routes: BodyRoute[]) {
  const requests: { url: string; method: string; body: string }[] = []
  const fetchImpl = (async (input: string, init?: RequestInit) => {
    const url = String(input)
    const method = init?.method ?? "GET"
    const body = decodeURIComponent(String(init?.body ?? "")).replaceAll(
      "+",
      " "
    )
    requests.push({ url, method, body })
    const route = routes.find(
      (r) =>
        (!r.method || r.method === method) &&
        (typeof r.match === "string"
          ? url.includes(r.match)
          : r.match.test(url)) &&
        (!r.body || body.includes(r.body))
    )
    if (!route) throw new Error(`Unmocked request: ${method} ${url}`)

    return new Response(route.response ?? "", {
      status: route.status ?? 200,
      headers: route.headers,
    })
  }) as typeof fetch

  return {
    http: new CatalogueHttp({
      fetchImpl,
      hostGuard: async () => {},
      minIntervalMs: 0,
    }),
    requests,
  }
}

const HOME = {
  match: /durham\.gov\.uk\/(\?.*)?$/,
  response: fixture("durham/home.html"),
}
const FORM = {
  match: "pgCatKeywordSearch.aspx",
  method: "GET" as const,
  response: fixture("durham/search-form.html"),
}

describe("durham", () => {
  it("lists branches with their BRA_CODE", async () => {
    const { http } = mockHttp([
      { match: "pgLib.aspx", body: fixture("durham/branches.html") },
      {
        match: "libraryonline.durham.gov.uk/",
        body: fixture("durham/home.html"),
      },
    ])
    const branches = await durham.listBranches(config, http)

    expect(branches.length).toBeGreaterThan(30)
    expect(branches).toContainEqual({ name: "Annfield Plain", code: "345" })
    expect(branches).toContainEqual({
      name: "Durham Clayport Library",
      code: "226",
    })
  })

  it("posts through search, record and libraries pages and tallies holdings", async () => {
    const { http, requests } = formHttp([
      FORM,
      {
        match: "pgCatKeywordSearch.aspx",
        method: "POST",
        body: "Keywords=9780747532743",
        status: 302,
        headers: { Location: RESULTS },
      },
      {
        match: RESULTS,
        method: "GET",
        response: fixture("durham/results.html"),
      },
      {
        match: RESULTS,
        method: "POST",
        body: "btnSelect=Select",
        response: fixture("durham/item.html"),
      },
      {
        match: RESULTS,
        method: "POST",
        body: "btLibraryList=Libraries",
        response: fixture("durham/availability.html"),
      },
      HOME,
    ])
    const result = await durham.searchByIsbn(config, "9780747532743", http)

    expect(result).toEqual({
      found: true,
      holdings: [
        { branch: "Annfield Plain", available: 1, unavailable: 0 },
        { branch: "Langley Park", available: 1, unavailable: 0 },
      ],
    })
    const search = requests.find((r) => r.method === "POST")!
    expect(search.body).toContain("__VIEWSTATE=")
    expect(search.body).toContain("cbBooks=on")
  })

  it("counts branches with a waiting list as unavailable", async () => {
    const availability = fixture("durham/availability.html").replace(
      /(tdWaitingList_1" class="right">\s*)No/,
      "$1Yes"
    )
    const { http } = formHttp([
      FORM,
      {
        match: "pgCatKeywordSearch.aspx",
        method: "POST",
        status: 302,
        headers: { Location: RESULTS },
      },
      {
        match: RESULTS,
        method: "GET",
        response: fixture("durham/results.html"),
      },
      {
        match: RESULTS,
        method: "POST",
        body: "btnSelect",
        response: fixture("durham/item.html"),
      },
      {
        match: RESULTS,
        method: "POST",
        body: "btLibraryList",
        response: availability,
      },
      HOME,
    ])
    const result = await durham.searchByIsbn(config, "9780747532743", http)

    expect(result.holdings[1]).toEqual({
      branch: "Langley Park",
      available: 0,
      unavailable: 1,
    })
  })

  it("reports not found when the search form comes back without results", async () => {
    const { http } = formHttp([
      FORM,
      {
        match: "pgCatKeywordSearch.aspx",
        method: "POST",
        response: fixture("durham/results-empty.html"),
      },
      HOME,
    ])
    const result = await durham.searchByIsbn(config, "9799999999990", http)
    expect(result).toEqual({ found: false, holdings: [] })
  })
})
