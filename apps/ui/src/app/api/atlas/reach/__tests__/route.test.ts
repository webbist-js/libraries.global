import { resolveEntitlements, type EntitlementInput } from "@repo/access"
import { afterEach, beforeEach, expect, it, vi } from "vitest"

const { session } = vi.hoisted(() => ({ session: vi.fn() }))
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: session } } }))
import { POST as exportReach } from "../export/route"
import { POST } from "../route"

const request = (extra = {}) =>
  new Request("https://ui.test/api/atlas/reach?format=csv", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      schemaVersion: 1,
      libraryId: "one",
      mode: "walking",
      ...extra,
    }),
  })
const fetcher = vi.fn()
beforeEach(() => {
  vi.stubGlobal("fetch", fetcher)
  vi.stubEnv("ATLAS_QUERY_ENABLED", "true")
  vi.stubEnv("STRAPI_URL", "http://strapi.test")
  vi.stubEnv("STRAPI_BRIDGE_SECRET", "private-test-bridge")
  vi.stubEnv("ATLAS_SERVICE_TOKEN", "private-test-token")
  session.mockResolvedValue({
    user: {
      id: "private-user",
      features: ["atlas.analysis", "atlas.export"],
      limits: { analysisRunsPerHour: 20 },
    },
  })
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

it("checks analysis and export entitlements before any cached backend request", async () => {
  session.mockResolvedValue(null)
  expect((await POST(request())).status).toBe(401)
  session.mockResolvedValue({ user: { id: "free", features: [] } })
  expect((await POST(request())).status).toBe(402)
  session.mockResolvedValue({
    user: { id: "analysis-only", features: ["atlas.analysis"] },
  })
  expect((await exportReach(request())).status).toBe(402)
  expect(fetcher).not.toHaveBeenCalled()
})

it.each<{
  label: string
  input: Omit<EntitlementInput, "now"> & { now?: Date }
  status: number
  allowance: number
}>([
  {
    label: "signed out",
    input: { signedIn: false },
    status: 401,
    allowance: 0,
  },
  { label: "Free", input: { signedIn: true }, status: 402, allowance: 0 },
  {
    label: "Supporter, including its export permission",
    input: {
      signedIn: true,
      subscription: { plan: "supporter", status: "active" },
    },
    status: 402,
    allowance: 0,
  },
  {
    label: "Pro",
    input: { signedIn: true, subscription: { plan: "pro", status: "active" } },
    status: 202,
    allowance: 20,
  },
  {
    label: "Team",
    input: { signedIn: true, grants: [{ plan: "team", expiresAt: null }] },
    status: 202,
    allowance: 100,
  },
  {
    label: "an active Team member's personal Pro access",
    input: {
      signedIn: true,
      teams: [
        { status: "active", expiresAt: null, libraryDocumentIds: ["one"] },
      ],
    },
    status: 202,
    allowance: 20,
  },
  {
    label: "expired Pro",
    input: {
      signedIn: true,
      now: new Date("2026-10-24T12:00:00Z"),
      grants: [{ plan: "pro", expiresAt: "2026-10-23T12:00:00Z" }],
    },
    status: 402,
    allowance: 0,
  },
  {
    label: "a lapsed Team member",
    input: {
      signedIn: true,
      teams: [
        { status: "lapsed", expiresAt: null, libraryDocumentIds: ["one"] },
      ],
    },
    status: 402,
    allowance: 0,
  },
])(
  "gates calculations and exports for $label before contacting the backend",
  async ({ input, status, allowance }) => {
    const entitlements = resolveEntitlements({
      now: new Date("2026-10-24T12:00:00Z"),
      ...input,
    })
    session.mockResolvedValue(
      input.signedIn
        ? {
            user: {
              id: `reach-plan-${entitlements.plan}-${status}`,
              features: [...entitlements.features],
              limits: entitlements.limits,
            },
          }
        : null
    )
    fetcher.mockImplementation(async () =>
      Response.json(
        {
          schemaVersion: 1,
          libraryId: "one",
          mode: "walking",
          state: "pending",
        },
        { status: 202 }
      )
    )

    expect((await POST(request())).status).toBe(status)
    expect((await exportReach(request())).status).toBe(status)
    if (!allowance) expect(fetcher).not.toHaveBeenCalled()
    else {
      expect(fetcher).toHaveBeenCalledTimes(2)
      for (const [, init] of fetcher.mock.calls)
        expect(JSON.parse(init.body).hourlyLimit).toBe(allowance)
    }
  }
)
it("rejects arbitrary origins and passes only a hashed user identity and trusted allowance", async () => {
  expect((await POST(request({ lat: 51 }))).status).toBe(400)
  expect(fetcher).not.toHaveBeenCalled()
  fetcher.mockResolvedValue(
    Response.json(
      {
        schemaVersion: 1,
        state: "pending",
        libraryId: "one",
        mode: "walking",
        message: "Calculating",
      },
      { status: 202 }
    )
  )
  const response = await POST(request())
  expect(response.status).toBe(202)
  const body = JSON.parse(fetcher.mock.calls[0]![1].body)
  expect(body.userKey).toMatch(/^[a-f0-9]{64}$/)
  expect(JSON.stringify(body)).not.toContain("private-user")
  expect(body.hourlyLimit).toBe(20)
  expect(response.headers.get("cache-control")).toBe("no-store")
})
it("refuses absent allowances and mismatched job identities", async () => {
  session.mockResolvedValueOnce({ user: { features: ["atlas.analysis"] } })
  expect((await POST(request())).status).toBe(503)
  expect(fetcher).not.toHaveBeenCalled()
  fetcher.mockResolvedValue(
    Response.json({
      schemaVersion: 1,
      state: "pending",
      libraryId: "other",
      mode: "walking",
    })
  )
  expect((await POST(request())).status).toBe(503)
})

it("exports all bands with provenance and assumptions while preserving unknown population", async () => {
  const value = {
    schemaVersion: 1,
    state: "partial",
    libraryId: "one",
    mode: "walking",
    coordinateHash: "a".repeat(64),
    calculatedAt: "2026-10-24T00:00:00Z",
    method: "   =untrusted",
    snapDistanceMetres: 12,
    warnings: ["No elevation model"],
    network: {
      release: "osm-test",
      source: "OSM",
      sourceUrl: "https://example.test/network",
      licence: "ODbL",
    },
    population: {
      release: "ghsl-test",
      source: "GHSL",
      sourceUrl: "https://example.test/population",
      licence: "CC BY 4.0",
      year: 2020,
    },
    contours: [5, 10, 15, 30].map((minutes, index) => ({
      minutes,
      residents: index === 3 ? null : index * 100,
      coveredFraction: index === 3 ? 0.5 : 1,
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [0, 0],
            [1, 0],
            [1, 1],
            [0, 0],
          ],
        ],
      },
    })),
  }
  fetcher.mockImplementation(async () => Response.json(value))
  const csvResponse = await exportReach(request())
  const csv = await csvResponse.text()
  expect(csvResponse.status).toBe(200)
  expect(csv.split("\r\n")).toHaveLength(5)
  expect(csv).toContain('"\'   =untrusted"')
  expect(csv).toContain("No elevation model")
  const geoRequest = new Request(
    "https://ui.test/api/atlas/reach/export?format=geojson",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        schemaVersion: 1,
        libraryId: "one",
        mode: "walking",
      }),
    }
  )
  const geo = await (await exportReach(geoRequest)).json()
  expect(geo.features).toHaveLength(4)
  expect(geo.features[3].properties).toMatchObject({
    residents: null,
    coveredFraction: 0.5,
    populationYear: 2020,
    coordinateHash: value.coordinateHash,
    assumptions: "No elevation model",
  })
})

it("throttles repeated result checks before they can overload the CMS", async () => {
  session.mockResolvedValue({
    user: {
      id: "reach-request-burst",
      features: ["atlas.analysis"],
      limits: { analysisRunsPerHour: 20 },
    },
  })
  fetcher.mockImplementation(async () =>
    Response.json(
      {
        schemaVersion: 1,
        libraryId: "one",
        mode: "walking",
        state: "pending",
        message: "Queued",
      },
      { status: 202 }
    )
  )
  for (let i = 0; i < 60; i++) expect((await POST(request())).status).toBe(202)
  const throttled = await POST(request())
  expect(throttled.status).toBe(429)
  expect((await throttled.json()).code).toBe("REACH_RATE_LIMIT")
  expect(fetcher).toHaveBeenCalledTimes(60)
})
