import type { Pool } from "pg"
import { describe, expect, it, beforeEach, afterEach, vi } from "vitest"

import { BillingError } from "@/lib/billing/config"

import {
  apiLibraries,
  apiPlaces,
  apiResult,
  apiSearch,
  serveApiRequest,
  serveTeamApi,
} from "../gateway"
import type * as StoreModule from "../store"
import { ApiRefusal } from "../store"

const { find, reserve, finish, active } = vi.hoisted(() => ({
  find: vi.fn(),
  reserve: vi.fn(),
  finish: vi.fn(),
  active: vi.fn(),
}))
vi.mock("../store", async (original) => ({
  ...(await original<typeof StoreModule>()),
  findApiKey: find,
  reserveApiRequest: reserve,
  finishApiRequest: finish,
}))
vi.mock("../team", () => ({ checkApiTeamActive: active }))
const secret = `lg_api_${"a".repeat(43)}`
const request = () =>
  new Request("https://libraries.global/api/v1/libraries", {
    headers: { Authorization: `Bearer ${secret}` },
  })
const at = (path: string) =>
  new Request(`https://libraries.global${path}`, {
    headers: { Authorization: `Bearer ${secret}` },
  })
beforeEach(() => {
  vi.resetAllMocks()
  find.mockResolvedValue({
    id: "key",
    team_id: "team",
    created_by: "organiser",
  })
  active.mockResolvedValue(undefined)
  reserve.mockResolvedValue({
    id: "request",
    teamId: "team",
    keyId: "key",
    periodStart: "2026-11-03T09:30:00.000Z",
    budget: 1000,
    credits: 0,
    remaining: { requests: 999, bytes: 5000, credits: 100 },
    resetsAt: "2026-12-03T09:30:00.000Z",
  })
  finish.mockResolvedValue(undefined)
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})
describe("machine API gateway", () => {
  it("never calls an upstream without a key and active Team", async () => {
    const upstream = vi.fn()
    expect(
      (
        await serveTeamApi(
          {} as Pool,
          new Request("https://libraries.global/api/v1/libraries"),
          "libraries:read",
          "libraries.list",
          upstream
        )
      ).status
    ).toBe(401)
    active.mockRejectedValueOnce(new BillingError("team_inactive", 403))
    expect(
      (
        await serveTeamApi(
          {} as Pool,
          request(),
          "libraries:read",
          "libraries.list",
          upstream
        )
      ).status
    ).toBe(403)
    expect(upstream).not.toHaveBeenCalled()
    expect(reserve).not.toHaveBeenCalled()
  })
  it("meters UTF-8 bytes before delivery and prevents shared caching", async () => {
    const response = await serveTeamApi(
      {} as Pool,
      request(),
      "libraries:read",
      "libraries.list",
      async () => ({ name: "Česká knihovna" })
    )
    expect(response.status).toBe(200)
    expect(response.headers.get("cache-control")).toBe("private, no-store")
    expect(response.headers.get("x-request-id")).toBe("request")
    const bytes = Buffer.byteLength(JSON.stringify({ name: "Česká knihovna" }))
    expect(finish.mock.calls[0]?.[2]).toMatchObject({ status: 200, bytes })
    // Remaining units reflect actual bytes, not the worst-case reservation.
    expect(response.headers.get("x-api-requests-remaining")).toBe("999")
    expect(response.headers.get("x-api-bytes-remaining")).toBe(
      String(5000 + 1000 - bytes)
    )
    expect(response.headers.get("x-api-analysis-credits-remaining")).toBe("100")
    expect(response.headers.get("x-api-quota-reset")).toBe(
      "2026-12-03T09:30:00.000Z"
    )
  })
  it("reserves analysis credits with the request and settles fewer for cached work", async () => {
    reserve.mockResolvedValueOnce({
      id: "request",
      teamId: "team",
      keyId: "key",
      periodStart: "2026-11-03T09:30:00.000Z",
      budget: 1000,
      credits: 5,
      remaining: { requests: 999, bytes: 5000, credits: 95 },
      resetsAt: "2026-12-03T09:30:00.000Z",
    })
    const response = await serveApiRequest(
      {} as Pool,
      request(),
      {
        scope: "analysis:run",
        endpoint: "analysis.summary",
        analysisCredits: 5,
      },
      async ({ credits, account }) => {
        expect(credits).toBe(5)
        expect(account).toEqual({ teamId: "team", keyId: "key" })

        return apiResult({ cached: true }, { status: 202, credits: 0 })
      }
    )
    expect(response.status).toBe(202)
    expect(reserve.mock.calls[0]?.[5]).toEqual({ analysisCredits: 5 })
    expect(finish.mock.calls[0]?.[2]).toMatchObject({ status: 202, credits: 0 })
    expect(response.headers.get("x-api-analysis-credits-remaining")).toBe("100")
  })
  it("fails closed when successful usage cannot be committed", async () => {
    finish.mockRejectedValue(new Error("database unavailable"))
    const response = await serveTeamApi(
      {} as Pool,
      request(),
      "libraries:read",
      "libraries.list",
      async () => ({ privateMarker: "payload" })
    )
    expect(response.status).toBe(503)
    expect(await response.text()).not.toContain("privateMarker")
  })
  it("refunds failed upstream responses and refuses oversized output", async () => {
    const response = await serveTeamApi(
      {} as Pool,
      request(),
      "libraries:read",
      "libraries.list",
      async () => ({ value: "x".repeat(1001) })
    )
    expect(response.status).toBe(502)
    expect(finish.mock.calls[0]?.[2]).toMatchObject({ status: 502, bytes: 0 })
  })
  it("rejects arbitrary Strapi queries, repeated parameters and search operations", async () => {
    await expect(
      apiLibraries(
        new Request("https://libraries.global/api/v1/libraries?populate=*"),
        1000
      )
    ).rejects.toThrow("invalid_query")
    await expect(
      apiLibraries(
        new Request(
          "https://libraries.global/api/v1/libraries?locale=en&locale=cs"
        ),
        1000
      )
    ).rejects.toThrow("invalid_query")
    await expect(
      apiSearch(
        new Request("https://libraries.global/api/v1/search/libraries", {
          method: "POST",
          body: JSON.stringify({ q: "Bristol", filter: "*" }),
        }),
        1000
      )
    ).rejects.toThrow("invalid_search")
  })
  it("keeps Meilisearch credentials upstream and projects only documented fields", async () => {
    vi.stubEnv("MEILISEARCH_HOST", "https://search.internal")
    vi.stubEnv("MEILISEARCH_SEARCH_API_KEY", "upstream-fixture")
    const fetcher = vi.fn<typeof fetch>(async () =>
      Response.json({
        hits: [
          {
            name: "Bristol",
            documentId: "library00000000000000001",
            entityRef: "europe:united-kingdom:england:bristol:central-library",
            moderatorEmail: "hidden",
          },
        ],
        estimatedTotalHits: 1,
      })
    )
    vi.stubGlobal("fetch", fetcher)
    const result = await apiSearch(
      new Request("https://libraries.global/api/v1/search/libraries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ q: "Bristol" }),
      }),
      2000
    )
    expect(JSON.stringify(result)).not.toContain("moderatorEmail")
    expect(JSON.stringify(result)).not.toContain("upstream-fixture")
    expect(JSON.stringify(result)).toContain(
      "europe:united-kingdom:england:bristol:central-library"
    )
    expect(fetcher.mock.calls[0]?.[0]).toBe(
      "https://search.internal/indexes/library/search"
    )
  })

  it("looks up the exact entityRef with encoded colons through the private bridge", async () => {
    vi.stubEnv("STRAPI_URL", "https://cms.internal")
    vi.stubEnv("STRAPI_BRIDGE_SECRET", "bridge-fixture")
    const entityRef = "europe:united-kingdom:england:bristol:central-library"
    const fetcher = vi.fn<typeof fetch>(async () =>
      Response.json({ data: { entityRef, name: "Central Library" } })
    )
    vi.stubGlobal("fetch", fetcher)
    const result = await apiLibraries(request(), 1000, entityRef)
    expect(result).toMatchObject({ data: { entityRef } })
    expect(fetcher.mock.calls[0]?.[0]).toBe(
      `https://cms.internal/api/access/api/libraries/${encodeURIComponent(entityRef)}?locale=en&limit=50`
    )
    expect(fetcher.mock.calls[0]?.[1]).toMatchObject({
      headers: { "X-Service-Secret": "bridge-fixture" },
    })
  })

  it.each([
    "",
    "library00000000000000001",
    "europe:gb:eng:../../users",
    "europe:gb:eng:central?populate=*",
    "europe%3Agb%3Aeng%3Acentral",
    `europe:gb:eng:${"x".repeat(256)}`,
  ])(
    "rejects invalid reference %s before contacting the CMS",
    async (entityRef) => {
      const fetcher = vi.fn()
      vi.stubGlobal("fetch", fetcher)
      await expect(
        apiLibraries(request(), 1000, entityRef)
      ).rejects.toMatchObject({
        code: "record_not_found",
        status: 404,
      })
      expect(fetcher).not.toHaveBeenCalled()
    }
  )

  it("returns 404 for an unknown published entityRef", async () => {
    vi.stubEnv("STRAPI_BRIDGE_SECRET", "bridge-fixture")
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 404 }))
    )
    await expect(
      apiLibraries(request(), 1000, "europe:gb:eng:missing-library")
    ).rejects.toMatchObject({ code: "record_not_found", status: 404 })
  })
})

it.each([
  ["api_access_inactive", 403, null],
  ["api_scope_refused", 403, null],
  ["rate_limit", 429, 37],
  ["concurrency_limit", 429, 1],
  ["quota_requests", 429, 3600],
  ["quota_bytes", 429, 3600],
  ["quota_analysis", 429, 3600],
  ["overage_cap", 429, 3600],
] as const)(
  "refuses metered traffic before upstream work when %s",
  async (code, status, retryAfter) => {
    reserve.mockRejectedValue(
      retryAfter === null
        ? new BillingError(code, status)
        : new ApiRefusal(code, status, retryAfter, "2026-12-03T09:30:00.000Z")
    )
    const work = vi.fn()
    const response = await serveTeamApi(
      {} as Pool,
      request(),
      "libraries:read",
      "libraries.list",
      work
    )
    expect(response.status).toBe(status)
    expect(await response.json()).toEqual({ error: { code } })
    expect(response.headers.get("retry-after")).toBe(
      retryAfter === null ? null : String(retryAfter)
    )
    expect(work).not.toHaveBeenCalled()
  }
)

it("caps list pages at 50 records", async () => {
  await expect(
    apiLibraries(at("/api/v1/libraries?limit=51"), 1000)
  ).rejects.toMatchObject({ code: "invalid_limit", status: 400 })
  await expect(
    apiSearch(
      new Request("https://libraries.global/api/v1/search/libraries", {
        method: "POST",
        body: JSON.stringify({ q: "x", limit: 51 }),
      }),
      1000
    )
  ).rejects.toThrow("invalid_search")
})

it("denies removed organisers before reserving quota or delivering data and retires their keys", async () => {
  active.mockRejectedValueOnce(new BillingError("api_key_owner_removed", 401))
  const query = vi.fn().mockResolvedValue({ rows: [] })
  const upstream = vi.fn()
  const response = await serveTeamApi(
    { query } as unknown as Pool,
    request(),
    "libraries:read",
    "libraries.list",
    upstream
  )
  expect(response.status).toBe(401)
  expect(upstream).not.toHaveBeenCalled()
  expect(reserve).not.toHaveBeenCalled()
  expect(query).toHaveBeenCalledWith(expect.stringContaining("revoked_at"), [
    "team",
    "organiser",
  ])
})

describe("place endpoints", () => {
  beforeEach(() => {
    vi.stubEnv("STRAPI_BRIDGE_SECRET", "bridge")
    vi.stubEnv("STRAPI_URL", "http://cms.internal")
  })

  it("lists a region's libraries through the private bridge, nested in its country", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(
        Response.json({ data: [], meta: { nextCursor: null } })
      )
    vi.stubGlobal("fetch", fetch)
    await apiLibraries(
      at("/api/v1/places/england/norfolk/libraries?limit=2"),
      1000,
      undefined,
      { country: "england", region: "norfolk" }
    )
    const url = new URL(fetch.mock.calls[0]![0] as string)
    expect(url.pathname).toBe("/api/access/api/libraries")
    expect(url.searchParams.get("country")).toBe("england")
    expect(url.searchParams.get("region")).toBe("norfolk")
    expect(url.searchParams.get("limit")).toBe("2")
  })

  it("refuses a region without its country and place filters on place paths", async () => {
    vi.stubGlobal("fetch", vi.fn())
    await expect(
      apiLibraries(at("/api/v1/libraries?region=norfolk"), 1000)
    ).rejects.toMatchObject({ code: "invalid_place", status: 400 })
    await expect(
      apiLibraries(
        at("/api/v1/places/england/libraries?country=wales"),
        1000,
        undefined,
        {
          country: "england",
        }
      )
    ).rejects.toMatchObject({ code: "invalid_query", status: 400 })
    await expect(
      apiPlaces(at("/api/v1/places?limit=5"), 1000, {})
    ).rejects.toMatchObject({ code: "invalid_query", status: 400 })
  })

  it("asks the bridge for a country's regions", async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json({ data: [] }))
    vi.stubGlobal("fetch", fetch)
    await apiPlaces(at("/api/v1/places/england"), 1000, { country: "england" })
    const url = new URL(fetch.mock.calls[0]![0] as string)
    expect(url.pathname).toBe("/api/access/api/places")
    expect(url.searchParams.get("country")).toBe("england")
    expect(url.searchParams.has("region")).toBe(false)
  })
})
