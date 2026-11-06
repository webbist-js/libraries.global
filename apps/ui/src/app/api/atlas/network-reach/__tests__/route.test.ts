import { emptyAtlasFilters } from "@repo/shared-data"
import { beforeEach, afterEach, expect, it, vi } from "vitest"

const { session } = vi.hoisted(() => ({ session: vi.fn() }))
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: session } } }))
import { POST } from "../route"

const API_ORGANISER = {
  id: "one",
  facts: ["explorer", "apiCustomer"],
  features: ["atlas.analysis", "atlas.reach", "atlas.serviceReach"],
  limits: { analysisRunsPerHour: 20, analysisRunsPerDay: 100 },
  apiAccounts: [{ teamId: "team-a", role: "organiser", active: true }],
}
const fetcher = vi.fn()
const body = {
  schemaVersion: 1,
  networkId: "one",
  areaCode: "E06000001",
  mode: "walking",
  scope: {
    filters: emptyAtlasFilters(),
    accessibility: { enabled: false, selected: [], view: "matches" },
  },
}
const request = (extra = {}) =>
  new Request("https://ui.test/api/atlas/network-reach", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...body, ...extra }),
  })
beforeEach(() => {
  vi.stubGlobal("fetch", fetcher)
  vi.stubEnv("ATLAS_QUERY_ENABLED", "true")
  vi.stubEnv("STRAPI_URL", "http://strapi.test")
  vi.stubEnv("STRAPI_BRIDGE_SECRET", "private")
  vi.stubEnv("ATLAS_SERVICE_TOKEN", "private")
  session.mockResolvedValue({ user: API_ORGANISER })
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  vi.clearAllMocks()
})
it("requires service Reach before backend or cache access", async () => {
  session.mockResolvedValue(null)
  expect((await POST(request())).status).toBe(401)
  session.mockResolvedValue({ user: { id: "free", features: [] } })
  expect((await POST(request())).status).toBe(402)
  // A Contributor has one-library Reach only.
  session.mockResolvedValue({
    user: {
      id: "contributor",
      facts: ["explorer", "contributor"],
      features: ["atlas.analysis", "atlas.reach"],
      limits: { reachRunsPerWeek: 2 },
    },
  })
  expect((await POST(request())).status).toBe(402)
  // A forged feature without the API account allowance never reaches the CMS.
  session.mockResolvedValue({
    user: { ...API_ORGANISER, apiAccounts: [], facts: ["explorer"] },
  })
  expect((await POST(request())).status).toBe(503)
  expect(fetcher).not.toHaveBeenCalled()
})
it("validates the network identity and keeps browser-supplied origins out", async () => {
  expect((await POST(request({ members: [] }))).status).toBe(400)
  expect(fetcher).not.toHaveBeenCalled()
  fetcher.mockResolvedValue(
    Response.json(
      {
        schemaVersion: 1,
        networkId: "other",
        areaCode: body.areaCode,
        mode: "walking",
        state: "pending",
      },
      { status: 202 }
    )
  )
  expect((await POST(request())).status).toBe(503)
})

it("allows the CMS to derive the reporting area from service membership", async () => {
  fetcher.mockResolvedValue(
    Response.json(
      {
        schemaVersion: 1,
        networkId: body.networkId,
        areaCode: "N09000001",
        mode: "walking",
        state: "pending",
      },
      { status: 202 }
    )
  )
  const response = await POST(request({ areaCode: undefined }))
  expect(response.status).toBe(202)
  expect(JSON.parse(fetcher.mock.calls[0]![1].body).request).not.toHaveProperty(
    "areaCode"
  )
})

it("rejects ready metrics calculated for different filters", async () => {
  const geometry = {
    type: "Polygon",
    coordinates: [
      [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
        [0, 0],
      ],
    ],
  }
  const source = {
    release: "one",
    source: "Fixture",
    sourceUrl: "https://example.test",
    licence: "CC0",
    year: 2020,
  }
  fetcher.mockResolvedValue(
    Response.json({
      schemaVersion: 1,
      kind: "network",
      state: "ready",
      networkId: body.networkId,
      networkName: "One",
      libraryId: "network-one",
      areaCode: body.areaCode,
      mode: body.mode,
      coordinateHash: "a".repeat(64),
      selectionHash: "a".repeat(64),
      calculatedAt: new Date().toISOString(),
      method: "fixture",
      snapDistanceMetres: 0,
      network: source,
      population: source,
      warnings: [],
      totalResidents: 100,
      selectedLibraries: 1,
      excludedLibraries: 0,
      unavailableLibraries: 0,
      scope: {
        ...body.scope,
        filters: { ...body.scope.filters, catalogue: true },
      },
      contours: [5, 10, 15, 30].map((minutes) => ({
        minutes,
        geometry,
        residents: 50,
        coveredFraction: 1,
        percent: 50,
        outsideResidents: 50,
      })),
    })
  )
  expect((await POST(request())).status).toBe(503)
})

it("sends only the session's API allowance, never a capacity", async () => {
  expect((await POST(request({ capacity: 2 }))).status).toBe(400)
  fetcher.mockImplementation(async () =>
    Response.json(
      {
        schemaVersion: 1,
        networkId: "one",
        areaCode: body.areaCode,
        mode: "walking",
        state: "pending",
      },
      { status: 202 }
    )
  )
  expect((await POST(request({ minutes: 15 }))).status).toBe(202)
  const sent = JSON.parse(fetcher.mock.calls[0]![1].body)
  expect(Object.keys(sent).sort()).toEqual(["allowance", "request", "userKey"])
  expect(sent).toMatchObject({
    allowance: { kind: "api", hourly: 20, daily: 100 },
    request: { minutes: 15 },
  })
  expect(sent.allowance.accountKey).toMatch(/^[a-f0-9]{64}$/)
  expect(JSON.stringify(sent)).not.toContain("team-a")
})
