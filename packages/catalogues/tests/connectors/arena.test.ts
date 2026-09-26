import { describe, expect, it } from "vitest"

import { arena } from "../../src/connectors/arena"
import { CatalogueHttp } from "../../src/http"
import { CatalogueError, type CatalogueConfig } from "../../src/types"
import { fixture, mockHttp } from "../helpers"

// Live fixtures (Sept 2026): extended-search, organisation XML, sign-up page and
// the challenge page. Every live search request got the leastFactor challenge,
// so the search → item → holdings fixtures are hand-written from upstream's parser.

const config: CatalogueConfig = {
  system: "arena",
  baseUrl: "https://beds-arena.culturalservices.net/web/arena/",
  settings: {
    arenaName: "AUK000022",
    organisationId: "AUK000022|3",
    isbnAlias: "number",
    advancedUrl: "extended-search",
  },
}

const ISBN = "9781408855652"

/** Like mockHttp, but POST routes can also match on the form body. */
function wicketHttp(
  routes: { url: string; body?: string; method?: string; response: string }[]
) {
  const requests: {
    url: string
    method: string
    body?: string
    headers: Headers
  }[] = []
  const fetchImpl = (async (input: string, init?: RequestInit) => {
    const url = String(input)
    const method = init?.method ?? "GET"
    const body = init?.body ? decodeURIComponent(String(init.body)) : undefined
    requests.push({ url, method, body, headers: new Headers(init?.headers) })
    const route = routes.find(
      (r) =>
        (r.method ?? "GET") === method &&
        url.includes(r.url) &&
        (!r.body || (body ?? "").includes(r.body))
    )
    if (!route)
      throw new Error(`Unmocked request: ${method} ${url} ${body ?? ""}`)

    return new Response(route.response)
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

describe("arena", () => {
  describe("listBranches", () => {
    it("posts the organisation choice and reads branches from the ajax-response", async () => {
      const { http, requests } = mockHttp([
        {
          match: "extended-search",
          method: "GET",
          body: fixture("arena/extended-search-bedford.html"),
        },
        {
          match: "extended-search",
          method: "POST",
          body: fixture("arena/organisation-bedford.xml"),
        },
      ])
      const branches = await arena.listBranches(config, http)

      expect(branches).toHaveLength(10)
      expect(branches).toContainEqual({
        name: "Bedford - Bedford Central Library",
        code: "AUK000022|3|10",
      })
      const post = requests.find((r) => r.method === "POST")!
      const form = new URLSearchParams(post.body)
      expect(form.get("p_p_id")).toBe("extendedSearch_WAR_arenaportlet")
      expect(
        form.get(
          "organisationHierarchyPanel:organisationContainer:organisationChoice"
        )
      ).toBe("AUK000022|3")
    })

    it("sends Wicket headers with the organisation select's id", async () => {
      const { http, requests } = wicketHttp([
        {
          url: "extended-search",
          response: fixture("arena/extended-search-bedford.html"),
        },
        {
          url: "extended-search",
          method: "POST",
          response: fixture("arena/organisation-bedford.xml"),
        },
      ])
      await arena.listBranches(config, http)
      const post = requests.find((r) => r.method === "POST")!
      expect(post.headers.get("wicket-ajax")).toBe("true")
      expect(post.headers.get("wicket-focusedelementid")).toBe(
        "id__extendedSearch__WAR__arenaportlet____e"
      )
    })

    it("prefers the sign-up page when signupUrl is set", async () => {
      const { http, requests } = mockHttp([
        {
          match: "join-the-library",
          body: fixture("arena/signup-shropshire.html"),
        },
      ])
      const branches = await arena.listBranches(
        {
          system: "arena",
          baseUrl: "https://libraries.shropshire.gov.uk/web/arena/",
          settings: {
            signupUrl:
              "https://libraries.shropshire.gov.uk/protected/join-the-library",
          },
        },
        http
      )

      expect(requests).toHaveLength(1)
      expect(branches).toContainEqual({ name: "Albrighton Library", code: "2" })
      expect(branches.map((b) => b.name)).not.toContain("Select an alternative")
    })

    it("honours a custom advancedUrl", async () => {
      const { http, requests } = mockHttp([
        {
          match: "advanced-search",
          method: "GET",
          body: fixture("arena/extended-search-bedford.html"),
        },
        {
          match: "advanced-search",
          method: "POST",
          body: fixture("arena/organisation-bedford.xml"),
        },
      ])
      await arena.listBranches(
        {
          ...config,
          settings: { ...config.settings, advancedUrl: "advanced-search" },
        },
        http
      )
      expect(requests[0]!.url).toBe(
        "https://beds-arena.culturalservices.net/web/arena/advanced-search"
      )
    })
  })

  describe("searchByIsbn", () => {
    it("raises bot_challenge on the leastFactor loading page and never solves it", async () => {
      const { http, requests } = mockHttp([
        { match: "p_p_id=searchResult", body: fixture("arena/challenge.html") },
      ])
      const err = await arena
        .searchByIsbn(config, ISBN, http)
        .catch((e: unknown) => e)

      expect(err).toBeInstanceOf(CatalogueError)
      expect((err as CatalogueError).code).toBe("bot_challenge")
      // No retry with a minted cookie.
      expect(requests).toHaveLength(1)
    })

    it("builds the organisation-scoped number_index query", async () => {
      const { http, requests } = mockHttp([
        {
          match: "p_p_id=searchResult",
          body: fixture("arena/search-empty.html"),
        },
      ])
      await arena.searchByIsbn(config, ISBN, http)
      expect(decodeURIComponent(requests[0]!.url)).toContain(
        `arena_search_query=organisationId_index:AUK000022|3+AND+number_index:${ISBN}`
      )
    })

    it("uses a free-text query when searchType is Keyword", async () => {
      const { http, requests } = mockHttp([
        {
          match: "p_p_id=searchResult",
          body: fixture("arena/search-empty.html"),
        },
      ])
      await arena.searchByIsbn(
        { ...config, settings: { searchType: "Keyword" } },
        ISBN,
        http
      )
      expect(requests[0]!.url).toMatch(
        new RegExp(`arena_search_query=${ISBN}$`)
      )
    })

    it("reports not found when there are no results", async () => {
      const { http } = mockHttp([
        {
          match: "p_p_id=searchResult",
          body: fixture("arena/search-empty.html"),
        },
      ])
      expect(await arena.searchByIsbn(config, ISBN, http)).toEqual({
        found: false,
        holdings: [],
      })
    })

    it("reads holdings rendered inline on the item page", async () => {
      const { http, requests } = mockHttp([
        {
          match: "p_p_id=searchResult",
          body: fixture("arena/search-results.html"),
        },
        {
          match: "arena_search_item_id=1234567",
          body: fixture("arena/item-inline.html"),
        },
      ])
      const result = await arena.searchByIsbn(config, ISBN, http)

      expect(result.found).toBe(true)
      expect(result.recordId).toBe("1234567")
      expect(result.recordUrl).toContain("arena_agency_name=AUK000022")
      expect(result.recordUrl).toContain("arena_search_item_id=1234567")
      expect(result.holdings).toEqual([
        { branch: "Bedford Central Library", available: 2, unavailable: 1 },
        { branch: "Putnoe Library", available: 0, unavailable: 1 },
      ])
      expect(requests).toHaveLength(2)
    })

    it("tallies a holdings panel that carries counts", async () => {
      const { http, requests } = wicketHttp([
        {
          url: "p_p_id=searchResult",
          response: fixture("arena/search-results.html"),
        },
        {
          url: "arena_search_item_id=1234567",
          response: fixture("arena/item.html"),
        },
        {
          url: "/results",
          method: "POST",
          body: "recordPanel:holdingsPanel::IBehaviorListener",
          response: fixture("arena/holdings-panel-totals.xml"),
        },
      ])
      const result = await arena.searchByIsbn(config, ISBN, http)

      expect(result.holdings).toEqual([
        { branch: "Kempston Library", available: 3, unavailable: 1 },
        { branch: "Bromham Library", available: 2, unavailable: 2 },
      ])
      expect(requests.at(-1)!.headers.get("wicket-ajax")).toBe("true")
    })

    it("applies the holdingsPanel override", async () => {
      const panel =
        "/crDetailWicket/?wicket:interface=:0:recordPanel:panel:holdingsPanel::IBehaviorListener:0:"
      const { http } = wicketHttp([
        {
          url: "p_p_id=searchResult",
          response: fixture("arena/search-results.html"),
        },
        {
          url: "arena_search_item_id=1234567",
          response: fixture("arena/item.html"),
        },
        {
          url: "/results",
          method: "POST",
          body: `p_p_resource_id=${panel}`,
          response: fixture("arena/holdings-panel-totals.xml"),
        },
      ])
      const result = await arena.searchByIsbn(
        { ...config, settings: { ...config.settings, holdingsPanel: panel } },
        ISBN,
        http
      )
      expect(result.holdings).toHaveLength(2)
    })

    it("expands the organisation and each branch through Wicket resource calls", async () => {
      const view =
        "wicket:interface=:3:recordPanel:panel:holdingsPanel:content:holdingsView:2"
      const { http, requests } = wicketHttp([
        {
          url: "p_p_id=searchResult",
          response: fixture("arena/search-results.html"),
        },
        {
          url: "arena_search_item_id=1234567",
          response: fixture("arena/item.html"),
        },
        {
          url: "/results",
          method: "POST",
          body: `${view}:holdingContainer:togglableLink`,
          response: fixture("arena/holdings-organisation.xml"),
        },
        {
          url: "/results",
          method: "POST",
          body: `${view}:childContainer:childView:0:`,
          response: fixture("arena/holdings-branch-0.xml"),
        },
        {
          url: "/results",
          method: "POST",
          body: `${view}:childContainer:childView:1:`,
          response: fixture("arena/holdings-branch-1.xml"),
        },
        {
          url: "/results",
          method: "POST",
          body: "recordPanel:holdingsPanel::IBehaviorListener",
          response: fixture("arena/holdings-panel-organisations.xml"),
        },
      ])
      const result = await arena.searchByIsbn(
        {
          ...config,
          settings: { ...config.settings, organisationName: "Central" },
        },
        ISBN,
        http
      )

      expect(result.holdings).toEqual([
        { branch: "Bedford Central Library", available: 2, unavailable: 1 },
        { branch: "Putnoe Library", available: 0, unavailable: 2 },
      ])
      const branchCall = requests.find((r) => r.body?.includes("childView:1:"))!
      expect(branchCall.headers.get("wicket-focusedelementid")).toBe(
        "id__crDetailWicket__WAR__arenaportlet____41"
      )
    })

    it("asks for organisationName when a shared record lists several organisations", async () => {
      const { http } = wicketHttp([
        {
          url: "p_p_id=searchResult",
          response: fixture("arena/search-results.html"),
        },
        {
          url: "arena_search_item_id=1234567",
          response: fixture("arena/item.html"),
        },
        {
          url: "/results",
          method: "POST",
          response: fixture("arena/holdings-panel-organisations.xml"),
        },
      ])
      await expect(
        arena.searchByIsbn(config, ISBN, http)
      ).rejects.toMatchObject({
        code: "parse",
      })
    })
  })
})
