import { afterEach, beforeEach, expect, it, vi } from "vitest"

import { GET } from "../route"

const fetcher = vi.fn()
beforeEach(() => {
  vi.stubGlobal("fetch", fetcher)
  vi.stubEnv("ATLAS_QUERY_ENABLED", "true")
  vi.stubEnv("STRAPI_URL", "http://cms.test")
  vi.stubEnv("STRAPI_BRIDGE_SECRET", "private")
  vi.stubEnv("ATLAS_SERVICE_TOKEN", "private")
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  vi.clearAllMocks()
})

it("passes bounded country/region search and keyset pagination through the private bridge", async () => {
  const page = {
    networks: [{ documentId: "one", name: "One" }],
    countries: [],
    regions: [],
    selected: null,
    next: '["One","one"]',
  }
  fetcher.mockResolvedValue(Response.json(page))
  const response = await GET(
    new Request(
      "http://ui.test/api/atlas/networks?q=Wirral&country=england&region=merseyside"
    )
  )
  expect(response.status).toBe(200)
  expect(await response.json()).toEqual(page)
  const [url, options] = fetcher.mock.calls[0]!
  expect(url.searchParams.get("q")).toBe("Wirral")
  expect(url.searchParams.get("region")).toBe("merseyside")
  expect(options.cache).toBe("no-store")
})

it("rejects unbounded inputs and arbitrary parameters without contacting the CMS", async () => {
  const response = await GET(
    new Request(`http://ui.test/api/atlas/networks?q=${"x".repeat(81)}`)
  )
  expect(response.status).toBe(400)
  expect(
    (await GET(new Request("http://ui.test/api/atlas/networks?polygon=one")))
      .status
  ).toBe(400)
  expect(fetcher).not.toHaveBeenCalled()
})
