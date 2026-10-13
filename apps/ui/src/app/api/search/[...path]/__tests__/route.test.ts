import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { BETA_COOKIE, createBetaPass } from "@/lib/beta/access"

import { POST } from "../route"

const fetchMock = vi.fn()
const search = (path: string[], body: unknown, unlocked = true) =>
  POST(
    new Request("https://beta.test/api/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(unlocked ? { cookie: `${BETA_COOKIE}=${createBetaPass()}` } : {}),
      },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ path }) }
  )
beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal("fetch", fetchMock)
  vi.stubEnv("BETA_GATE_ENABLED", "true")
  vi.stubEnv("BETA_PASSWORD", "local-test")
  vi.stubEnv("BETA_ACCESS_SECRET", "s".repeat(32))
  vi.stubEnv("MEILISEARCH_HOST", "https://search.test")
  vi.stubEnv("MEILISEARCH_SEARCH_API_KEY", "private-search-key")
  fetchMock.mockImplementation(() =>
    Promise.resolve(Response.json({ hits: [] }))
  )
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})
describe("search proxy", () => {
  it("requires a beta pass before calling the private search origin", async () => {
    expect(
      (await search(["indexes", "library", "search"], { q: "Paris" }, false))
        .status
    ).toBe(401)
    expect(fetchMock).not.toHaveBeenCalled()
  })
  it("forwards searches with a server-only key and no upstream credentials in the result", async () => {
    const result = await search(["indexes", "library", "search"], {
      q: "Paris",
      limit: 20,
      filter: "locale = en",
    })
    expect(result.status).toBe(200)
    expect(fetchMock.mock.calls[0]![0]).toBe(
      "https://search.test/indexes/library/search"
    )
    expect(fetchMock.mock.calls[0]![1].headers.Authorization).toBe(
      "Bearer private-search-key"
    )
    expect(await result.text()).not.toContain("private-search-key")
    expect(result.headers.get("cache-control")).toContain("no-store")
  })
  it("rejects document reads, administration and unknown indexes", async () => {
    for (const path of [
      ["indexes", "library", "documents"],
      ["keys"],
      ["indexes", "subscriber", "search"],
    ]) {
      expect((await search(path, {})).status).toBe(404)
    }
    expect(
      (
        await search(["multi-search"], {
          queries: [{ indexUid: "subscriber", q: "" }],
        })
      ).status
    ).toBe(400)
    expect(fetchMock).not.toHaveBeenCalled()
  })
  it("supports bounded multi-search and rejects oversized pagination", async () => {
    expect(
      (
        await search(["multi-search"], {
          queries: [
            { indexUid: "library", q: "", limit: 0 },
            { indexUid: "mobile-stop", limit: 8 },
          ],
        })
      ).status
    ).toBe(200)
    expect(
      (await search(["indexes", "library", "search"], { limit: 1000000 }))
        .status
    ).toBe(400)
  })
})
