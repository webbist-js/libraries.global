import type { Pool } from "pg"
import { describe, expect, it, beforeEach, afterEach, vi } from "vitest"

import { BillingError } from "@/lib/billing/config"

import { apiLibraries, apiSearch, serveTeamApi } from "../gateway"

const { find, reserve, finish, active } = vi.hoisted(() => ({
  find: vi.fn(),
  reserve: vi.fn(),
  finish: vi.fn(),
  active: vi.fn(),
}))
vi.mock("../store", () => ({
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
beforeEach(() => {
  vi.resetAllMocks()
  find.mockResolvedValue({ id: "key", team_id: "team" })
  active.mockResolvedValue(undefined)
  reserve.mockResolvedValue({
    id: "request",
    teamId: "team",
    budget: 1000,
    remaining: 999,
    resetsAt: "2026-11-01T00:00:00Z",
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
    expect(finish.mock.calls[0]?.[2]).toBe(200)
    expect(finish.mock.calls[0]?.[3]).toBe(
      Buffer.byteLength(JSON.stringify({ name: "Česká knihovna" }))
    )
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
    expect(finish.mock.calls[0]?.slice(2, 4)).toEqual([502, 0])
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
