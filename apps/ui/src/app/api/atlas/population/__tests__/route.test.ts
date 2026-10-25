import { afterEach, expect, it, vi } from "vitest"

const { session, query } = vi.hoisted(() => ({
  session: vi.fn(),
  query: vi.fn(),
}))
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: session } } }))
vi.mock("@/lib/atlas-backend", () => ({ createAtlasBackend: () => ({}) }))
vi.mock("@/lib/atlas-population-density", () => ({
  queryPopulationDensity: query,
}))
import { GET } from "../route"

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})
const request = (level = "countries") =>
  new Request(`https://ui.test/api/atlas/population?level=${level}`)

it("checks access before its bounded shared cache, coalesces reads, expires and recovers failed loads", async () => {
  vi.stubEnv("ATLAS_QUERY_ENABLED", "true")
  const clock = vi.spyOn(Date, "now").mockReturnValue(1_790_000_000_000)

  session.mockResolvedValue(null)
  expect((await GET(request())).status).toBe(401)
  expect(query).not.toHaveBeenCalled()
  session.mockResolvedValue({ user: { id: "population-cache-test" } })
  query.mockResolvedValue({ schemaVersion: 1, level: "countries", areas: [] })
  const responses = await Promise.all([
    GET(request()),
    GET(request()),
    GET(request()),
  ])
  expect(responses.every((response) => response.status === 200)).toBe(true)
  expect(responses[0]!.headers.get("cache-control")).toBe("private, max-age=60")
  expect(query).toHaveBeenCalledTimes(1)
  expect((await GET(request("arbitrary"))).status).toBe(400)
  clock.mockReturnValue(1_790_000_061_000)
  expect((await GET(request())).status).toBe(200)
  expect(query).toHaveBeenCalledTimes(2)
  session.mockResolvedValue(null)
  expect((await GET(request())).status).toBe(401)
  expect(query).toHaveBeenCalledTimes(2)
  session.mockResolvedValue({ user: { id: "population-cache-test" } })
  query.mockRejectedValueOnce(new Error("upstream unavailable"))
  expect((await GET(request("regions"))).status).toBe(503)
  expect((await GET(request("regions"))).status).toBe(200)
  expect(query).toHaveBeenCalledTimes(4)
})
