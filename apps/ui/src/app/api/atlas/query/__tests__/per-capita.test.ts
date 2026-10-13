import { emptyAtlasFilters } from "@repo/shared-data"
import { afterEach, beforeEach, expect, it, vi } from "vitest"

const { session, backend, execute } = vi.hoisted(() => ({
  session: vi.fn(),
  backend: vi.fn(),
  execute: vi.fn(),
}))
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: session } } }))
vi.mock("@/lib/atlas-backend", () => ({ createAtlasBackend: backend }))
vi.mock("@/lib/atlas-query", () => ({
  AtlasQueryEngine: class {
    execute = execute
  },
}))
import { POST } from "../route"

const request = (purpose = "perCapita") =>
  new Request("https://ui.test/api/atlas/query", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      schemaVersion: 1,
      purpose,
      ...(purpose === "libraryAccess" ? { level: "local" } : {}),
      scope: {
        filters: emptyAtlasFilters(),
        accessibility: { enabled: false, selected: [], view: "matches" },
      },
    }),
  })
beforeEach(() => {
  vi.stubEnv("ATLAS_QUERY_ENABLED", "true")
  vi.clearAllMocks()
  const state = {
    queryEpoch: "test",
    dictionary: { version: "test" },
    indexedThrough: "1",
  }
  backend.mockReturnValue({ state: async () => state })
  execute.mockResolvedValue({ schemaVersion: 1, countries: [] })
})
afterEach(() => vi.unstubAllEnvs())
it("identifies a disabled local query service before contacting the backend", async () => {
  vi.stubEnv("ATLAS_QUERY_ENABLED", "false")
  const result = await POST(request("counts"))
  expect(result.status).toBe(503)
  expect(await result.json()).toMatchObject({ code: "ATLAS_DISABLED" })
  expect(backend).not.toHaveBeenCalled()
})
it.each(["perCapita", "libraryAccess"])(
  "checks server entitlements before accessing %s counts",
  async (purpose) => {
    session.mockResolvedValue(null)
    expect((await POST(request(purpose))).status).toBe(401)
    session.mockResolvedValue({ user: { features: [] } })
    expect((await POST(request(purpose))).status).toBe(402)
    expect(backend).not.toHaveBeenCalled()
    expect(execute).not.toHaveBeenCalled()
  }
)
it("serves Pro analysis privately while ordinary map counts stay public", async () => {
  session.mockResolvedValue({ user: { features: ["atlas.analysis"] } })
  const result = await POST(request())
  expect(result.status).toBe(200)
  expect(result.headers.get("cache-control")).toBe("no-store")
  session.mockClear()
  expect((await POST(request("counts"))).status).toBe(200)
  expect(session).not.toHaveBeenCalled()
})
