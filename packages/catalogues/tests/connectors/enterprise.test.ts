import { describe, expect, it } from "vitest"

import { enterprise } from "../../src/connectors/enterprise"
import { CatalogueHttp } from "../../src/http"
import type { CatalogueConfig } from "../../src/types"
import { fixture, mockHttp, type Route } from "../helpers"

// Barking and Dagenham shares the London Libraries Consortium catalogue.
const config: CatalogueConfig = {
  system: "enterprise",
  baseUrl:
    "https://llc.ent.sirsidynix.net.uk/client/en_GB/barking-and-dagenham/",
  settings: {
    availableStatuses: ["On Shelf"],
    availabilityUrl:
      "search/detailnonmodal.detail.detailavailabilityaccordions:lookuptitleinfo/ent:[ITEMID]/ILS/0/true/true",
    libraryNameFilter: "Barking and Dagenham",
  },
}

const DETAIL_PATH =
  "/client/en_GB/barking-and-dagenham/search/detailnonmodal/ent:$002f$002fSD_ILS$002f0$002fSD_ILS:57836/one?qu=9780747532743"

const singleHit: Route[] = [
  {
    match: "search/results?qu=9780747532743",
    status: 302,
    headers: { Location: DETAIL_PATH },
  },
  { match: "/one?qu=", method: "GET", body: fixture("enterprise/detail.html") },
  {
    match: "lookuptitleinfo",
    method: "POST",
    body: fixture("enterprise/availability.json"),
  },
]

/** Like mockHttp, but records request headers too. */
function httpWithHeaders(routes: Route[]) {
  const seen: {
    url: string
    method: string
    headers: Record<string, string>
  }[] = []
  const fetchImpl = (async (input: string, init?: RequestInit) => {
    seen.push({
      url: String(input),
      method: init?.method ?? "GET",
      headers: (init?.headers ?? {}) as Record<string, string>,
    })
    const route = routes.find(
      (r) =>
        (!r.method || r.method === (init?.method ?? "GET")) &&
        (typeof r.match === "string"
          ? String(input).includes(r.match)
          : r.match.test(String(input)))
    )
    if (!route) throw new Error(`Unmocked request: ${String(input)}`)

    return new Response(route.body ?? "", {
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
    seen,
  }
}

describe("enterprise", () => {
  it("lists branches with codes, filtered to the service on a shared catalogue", async () => {
    const { http } = mockHttp([
      { match: "search/advanced", body: fixture("enterprise/advanced.html") },
    ])
    const branches = await enterprise.listBranches(config, http)

    expect(branches).toContainEqual({
      name: "Barking Library (Barking and Dagenham)",
      code: "BDBAR",
    })
    expect(branches.length).toBeGreaterThan(5)
    expect(branches.every((b) => b.name.includes("Barking and Dagenham"))).toBe(
      true
    )
  })

  it("lists every consortium branch without a libraryNameFilter", async () => {
    const { http } = mockHttp([
      { match: "search/advanced", body: fixture("enterprise/advanced.html") },
    ])
    const branches = await enterprise.listBranches(
      { ...config, settings: {} },
      http
    )

    expect(branches.map((b) => b.name)).toContain("Basildon Library (Essex)")
    expect(branches.map((b) => b.name)).not.toContain("Any Library")
  })

  it("follows the redirect to the record and tallies holdings", async () => {
    const { http, seen } = httpWithHeaders(singleHit)
    const result = await enterprise.searchByIsbn(config, "9780747532743", http)

    expect(result.found).toBe(true)
    expect(result.recordId).toBe("ent://SD_ILS/0/SD_ILS:57836")
    expect(result.recordUrl).toBe(
      "https://llc.ent.sirsidynix.net.uk/client/en_GB/barking-and-dagenham/search/detailnonmodal/ent:$002f$002fSD_ILS$002f0$002fSD_ILS:57836/one"
    )
    expect(result.holdings).toEqual([
      {
        branch: "Barking Library (Barking and Dagenham)",
        available: 0,
        unavailable: 1,
      },
      {
        branch: "Dagenham Library (Barking and Dagenham)",
        available: 1,
        unavailable: 0,
      },
      {
        branch: "Valence Library (Barking and Dagenham)",
        available: 3,
        unavailable: 0,
      },
    ])

    const post = seen.find((r) => r.method === "POST")!
    expect(post.url).toContain(
      "lookuptitleinfo/ent:$002f$002fSD_ILS$002f0$002fSD_ILS:57836/ILS/0/true/true"
    )
    expect(post.headers["X-Requested-With"]).toBe("XMLHttpRequest")
    expect(post.headers.sdcsrf).toBe("8f531e77-1085-4337-a7da-ee0d3d7b4bcd")
  })

  it("counts a status at index 0 of availableStatuses as available (upstream indexOf > 0 bug)", async () => {
    const { http } = mockHttp(singleHit)
    const result = await enterprise.searchByIsbn(config, "9780747532743", http)
    const dagenham = result.holdings.find((h) =>
      h.branch.startsWith("Dagenham Library")
    )

    expect(config.settings.availableStatuses![0]).toBe("On Shelf")
    expect(dagenham).toEqual({
      branch: "Dagenham Library (Barking and Dagenham)",
      available: 1,
      unavailable: 0,
    })
  })

  it("reports holdings across the consortium without a filter, using default settings", async () => {
    const { http, requests } = mockHttp(singleHit)
    const result = await enterprise.searchByIsbn(
      { ...config, settings: {} },
      "9780747532743",
      http
    )

    expect(result.holdings.map((h) => h.branch)).toContain(
      "Edmonton Green (Enfield)"
    )
    // Falls back to ENTERPRISE_DEFAULT_AVAILABILITY_URL / ENTERPRISE_DEFAULT_AVAILABLE
    expect(requests.find((r) => r.method === "POST")!.url).toContain(
      "/ILS/0/true/true"
    )
    expect(
      result.holdings.find((h) => h.branch.startsWith("Valence"))!.available
    ).toBe(3)
  })

  it("walks a multi-result page when there is no direct hit", async () => {
    const { http, requests } = mockHttp([
      {
        match: "search/results?qu=9780000000002",
        body: fixture("enterprise/search-multi.html"),
      },
      { match: "/one", method: "GET", body: fixture("enterprise/detail.html") },
      {
        match: "lookuptitleinfo",
        method: "POST",
        body: fixture("enterprise/availability.json"),
      },
    ])
    const result = await enterprise.searchByIsbn(config, "9780000000002", http)

    expect(requests[1]!.url).toContain(
      "detailnonmodal/ent:$002f$002fSD_ILS$002f0$002fSD_ILS:2059955/one"
    )
    expect(result.found).toBe(true)
    expect(result.recordId).toBe("ent://SD_ILS/0/SD_ILS:2059955")
    expect(result.holdings.length).toBeGreaterThan(0)
  })

  it("reports not found when the search has no results", async () => {
    const { http } = mockHttp([
      {
        match: "search/results?qu=9799999999990",
        body: fixture("enterprise/search-empty.html"),
      },
    ])
    const result = await enterprise.searchByIsbn(config, "9799999999990", http)
    expect(result).toEqual({ found: false, holdings: [] })
  })

  it("reads the older ids/strings availability format against the items table", async () => {
    const page = `<script>var __sdcsrf = "abc-123";</script>
      <table><tr class="detailItemsTableRow"><td>Central Library</td><td><div id="availabilityDiv111"></div></td></tr>
      <tr class="detailItemsTableRow"><td>Central Library</td><td><div id="availabilityDiv222"></div></td></tr>
      <tr class="detailItemsTableRow"><td>Kilmarnock</td><td><div id="availabilityDiv333"></div></td></tr></table>`
    const { http } = mockHttp([
      {
        match: "search/results",
        status: 302,
        headers: {
          Location:
            "/client/en_GB/default/search/detailnonmodal/ent:$002f$002fSD_ILS$002f0$002fSD_ILS:1/one",
        },
      },
      { match: "/one", method: "GET", body: page },
      {
        match: "lookuptitleinfo",
        method: "POST",
        body: JSON.stringify({
          ids: ["111", "222", "333"],
          strings: ["SHELVES", "ON LOAN", "RESERVES"],
        }),
      },
    ])
    const result = await enterprise.searchByIsbn(
      {
        system: "enterprise",
        baseUrl: "https://ealt.ent.sirsidynix.net.uk/client/en_GB/default/",
        settings: { availableStatuses: ["SHELVES", "RESERVES"] },
      },
      "9780747532743",
      http
    )

    expect(result.holdings).toEqual([
      { branch: "Central Library", available: 1, unavailable: 1 },
      { branch: "Kilmarnock", available: 1, unavailable: 0 },
    ])
  })
})
