import { describe, expect, it } from "vitest"

import { koha } from "../../src/connectors/koha"
import type { CatalogueConfig } from "../../src/types"
import { fixture, mockHttp, type Route } from "../helpers"

// OPAC pages: every Koha service in data.json served an anti-bot challenge
// (Anubis or Cloudflare) to our honest User-Agent in Sept 2026, so the OPAC
// fixtures are hand-written from Koha 23/24 markup. anubis-challenge.html is the
// real interstitial from libonline.livewirewarrington.co.uk.
// REST API: api-libraries.json and api-items.json are recorded from
// catalogue.knowsley.gov.uk (not challenge-protected); api-items-mixed.json is
// hand-written to cover each unavailable state.

const config: CatalogueConfig = {
  system: "koha",
  baseUrl: "https://catalogue.knowsley.gov.uk/",
  version: "23",
  settings: {},
}

const JSON_HEADERS = { "content-type": "application/json;charset=UTF-8" }
const API_404: Route = {
  match: "/api/v1/public/",
  status: 404,
  headers: JSON_HEADERS,
  body: '{"error":"Not found","error_code":"not_found"}',
}
const LIBRARIES: Route = {
  match: "/api/v1/public/libraries",
  headers: JSON_HEADERS,
  body: fixture("koha/api-libraries.json"),
}

describe("koha", () => {
  describe("listBranches", () => {
    it("uses the public libraries API, with codes and addresses", async () => {
      const { http, requests } = mockHttp([LIBRARIES])
      const branches = await koha.listBranches(config, http)

      expect(requests).toHaveLength(1)
      expect(requests[0]!.url).toBe(
        "https://catalogue.knowsley.gov.uk/api/v1/public/libraries?_per_page=100&_page=1"
      )
      expect(branches).toHaveLength(10)
      expect(branches).toContainEqual({
        name: "Prescot Library",
        code: "PT",
        address: "Prescot Shopping Centre, Prescot",
        postcode: "L34 5GA",
      })
      // Nulls are dropped rather than joined.
      expect(branches).toContainEqual({ name: "Home Delivery", code: "HD" })
    })

    it("paginates until a short page", async () => {
      const page = (from: number, count: number): string =>
        JSON.stringify(
          Array.from({ length: count }, (_, i) => ({
            library_id: `L${from + i}`,
            name: `Library ${from + i}`,
          }))
        )
      const { http, requests } = mockHttp([
        { match: /&_page=1$/, headers: JSON_HEADERS, body: page(0, 100) },
        { match: /&_page=2$/, headers: JSON_HEADERS, body: page(100, 3) },
      ])
      const branches = await koha.listBranches(config, http)

      expect(requests).toHaveLength(2)
      expect(branches).toHaveLength(103)
      expect(branches.at(-1)).toEqual({ name: "Library 102", code: "L102" })
    })

    it("falls back to the OPAC facets when the API is off", async () => {
      const { http, requests } = mockHttp([
        API_404,
        { match: "expand=holdingbranch", body: fixture("koha/branches.html") },
      ])
      const branches = await koha.listBranches(config, http)

      expect(requests[1]!.url).toBe(
        "https://catalogue.knowsley.gov.uk/cgi-bin/koha/opac-search.pl?do=Search&expand=holdingbranch"
      )
      expect(branches).toEqual([
        { name: "Birchwood Library", code: "BIR" },
        { name: "Burtonwood Library", code: "BUR" },
        { name: "Warrington Central Library", code: "CEN" },
        { name: "Culcheth Library", code: "CUL" },
        { name: "Padgate Library", code: "PAD" },
        { name: "Mobile Library", code: "MOB" },
      ])
    })

    it("falls back when the API answers with HTML", async () => {
      const { http } = mockHttp([
        { match: "/api/v1/public/", body: "<html>OPAC home</html>" },
        { match: "expand=holdingbranch", body: fixture("koha/branches.html") },
      ])
      expect(await koha.listBranches(config, http)).toHaveLength(6)
    })

    it("uses the OPAC with multiBranchLimit, which the API can't filter by", async () => {
      const { http, requests } = mockHttp([
        { match: "expand=holdingbranch", body: fixture("koha/branches.html") },
      ])
      await koha.listBranches(
        { ...config, settings: { multiBranchLimit: "CHESHIREEAST" } },
        http
      )
      expect(requests).toHaveLength(1)
      expect(requests[0]!.url).toContain(
        "opac-search.pl?multibranchlimit=CHESHIREEAST&do=Search"
      )
    })

    it("honours the libsUrl override for the OPAC fallback", async () => {
      const { http, requests } = mockHttp([
        API_404,
        {
          match: "opac-search.pl?limit=x",
          body: fixture("koha/branches.html"),
        },
      ])
      await koha.listBranches(
        {
          ...config,
          settings: { libsUrl: "cgi-bin/koha/opac-search.pl?limit=x" },
        },
        http
      )
      expect(requests[1]!.url).toBe(
        "https://catalogue.knowsley.gov.uk/cgi-bin/koha/opac-search.pl?limit=x"
      )
    })
  })

  describe("searchByIsbn", () => {
    it("takes holdings from the items API, named via the libraries API", async () => {
      const { http, requests } = mockHttp([
        { match: "format=rss2", body: fixture("koha/search.xml") },
        {
          match: "/api/v1/public/biblios/184213/items",
          headers: JSON_HEADERS,
          body: fixture("koha/api-items-mixed.json"),
        },
        LIBRARIES,
      ])
      const result = await koha.searchByIsbn(config, "9780141439518", http)

      expect(requests.map((r) => r.url)).not.toContainEqual(
        expect.stringContaining("opac-detail.pl")
      )
      expect(result).toEqual({
        found: true,
        recordId: "184213",
        recordUrl:
          "https://catalogue.knowsley.gov.uk/cgi-bin/koha/opac-detail.pl?biblionumber=184213",
        holdings: [
          // one on the shelf, one checked out
          { branch: "Kirkby Library", available: 1, unavailable: 1 },
          // not for loan, lost
          { branch: "Huyton Library", available: 0, unavailable: 2 },
          // damaged still lends
          { branch: "Prescot Library", available: 1, unavailable: 0 },
          // unknown library id is kept as-is; withdrawn
          { branch: "ZZ", available: 0, unavailable: 1 },
        ],
      })
    })

    it("parses the recorded Knowsley items response", async () => {
      const { http } = mockHttp([
        { match: "format=rss2", body: fixture("koha/search.xml") },
        {
          match: "/biblios/184213/items",
          headers: JSON_HEADERS,
          body: fixture("koha/api-items.json"),
        },
        LIBRARIES,
      ])
      const result = await koha.searchByIsbn(config, "9780141439518", http)
      expect(result.holdings).toEqual([
        { branch: "Prescot Library", available: 1, unavailable: 0 },
      ])
    })

    it("falls back to opac-detail when the items API is unavailable", async () => {
      const { http, requests } = mockHttp([
        { match: "format=rss2", body: fixture("koha/search.xml") },
        API_404,
        {
          match: "opac-detail.pl?biblionumber=184213",
          body: fixture("koha/detail.html"),
        },
      ])
      const result = await koha.searchByIsbn(config, "9780141439518", http)

      expect(requests.at(-1)!.url).toContain(
        "biblionumber=184213&viewallitems=1"
      )
      expect(result.holdings).toEqual([
        { branch: "Warrington Central Library", available: 2, unavailable: 1 },
        { branch: "Birchwood Library", available: 0, unavailable: 1 },
        { branch: "Culcheth Library", available: 1, unavailable: 0 },
      ])
    })

    it("follows a single-hit redirect to the record", async () => {
      const detailUrl =
        "https://catalogue.knowsley.gov.uk/cgi-bin/koha/opac-detail.pl?biblionumber=184213"
      const { http } = mockHttp([
        { match: "format=rss2", status: 302, headers: { location: detailUrl } },
        API_404,
        {
          match: "opac-detail.pl?biblionumber=184213",
          body: fixture("koha/detail.html"),
        },
      ])
      const result = await koha.searchByIsbn(
        { ...config, version: "24" },
        "9780141439518",
        http
      )
      expect(result.recordId).toBe("184213")
      expect(result.holdings).toHaveLength(3)
    })

    it("reports not found when the feed is empty", async () => {
      const { http } = mockHttp([
        { match: "format=rss2", body: fixture("koha/search-empty.xml") },
      ])
      const result = await koha.searchByIsbn(config, "9780000000002", http)
      expect(result).toEqual({ found: false, holdings: [] })
    })

    it("raises bot_challenge on an Anubis interstitial", async () => {
      const { http } = mockHttp([
        { match: "format=rss2", body: fixture("koha/anubis-challenge.html") },
      ])
      await expect(
        koha.searchByIsbn(config, "9780141439518", http)
      ).rejects.toMatchObject({ code: "bot_challenge" })
    })
  })
})
