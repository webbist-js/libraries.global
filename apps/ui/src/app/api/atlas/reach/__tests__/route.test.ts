import { buildSessionAccess, type SessionProfile } from "@repo/access"
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
const NOW = new Date("2026-10-24T12:00:00Z")
const PROFILE: SessionProfile = {
  contributorRole: "contributor",
  username: "x",
  tier: null,
  claims: [],
  staff: [],
  roleGrants: [],
  dismissedPrompts: [],
  teams: [],
}
/** A session user as the bridge resolves it, from profile facts. */
const userFrom = (id: string, profile: Partial<SessionProfile>) => ({
  id,
  ...buildSessionAccess({ ...PROFILE, ...profile }, NOW),
})
const contributorUser = (id: string) =>
  userFrom(id, { acceptedContributions: 1 })
const PAID = "2026-11-24T12:00:00Z"
const fetcher = vi.fn()
beforeEach(() => {
  vi.stubGlobal("fetch", fetcher)
  vi.stubEnv("ATLAS_QUERY_ENABLED", "true")
  vi.stubEnv("STRAPI_URL", "http://strapi.test")
  vi.stubEnv("STRAPI_BRIDGE_SECRET", "private-test-bridge")
  vi.stubEnv("ATLAS_SERVICE_TOKEN", "private-test-token")
  session.mockResolvedValue({ user: contributorUser("private-user") })
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

it("checks Reach and export entitlements before any cached backend request", async () => {
  session.mockResolvedValue(null)
  expect((await POST(request())).status).toBe(401)
  // Explorer has context analysis but not Reach.
  session.mockResolvedValue({ user: userFrom("explorer", {}) })
  expect((await POST(request())).status).toBe(402)
  session.mockResolvedValue({
    user: { id: "reach-only", features: ["atlas.reach"] },
  })
  expect((await exportReach(request())).status).toBe(402)
  expect(fetcher).not.toHaveBeenCalled()
})

it.each<{
  label: string
  profile: Partial<SessionProfile> | null
  status: number
  allowance: Record<string, unknown> | null
}>([
  { label: "signed out", profile: null, status: 401, allowance: null },
  { label: "Explorer", profile: {}, status: 402, allowance: null },
  {
    label: "a Contributor",
    profile: { acceptedContributions: 1 },
    status: 202,
    allowance: { kind: "contributor", weekly: 2 },
  },
  {
    label: "a Supporter, with the same Contributor allowance",
    profile: { acceptedContributions: 150 },
    status: 202,
    allowance: { kind: "contributor", weekly: 2 },
  },
  {
    label: "revoked recognition",
    profile: { acceptedContributions: 150, recognitionRevoked: true },
    status: 402,
    allowance: null,
  },
  {
    label: "a covered API organiser",
    profile: {
      apiAccounts: [{ teamId: "team-a", role: "organiser", paidThrough: PAID }],
    },
    status: 202,
    allowance: { kind: "api", hourly: 20, daily: 100 },
  },
  {
    label: "a member of a covered API account",
    profile: {
      apiAccounts: [{ teamId: "team-a", role: "member", paidThrough: PAID }],
    },
    status: 402,
    allowance: null,
  },
  {
    label: "a lapsed API organiser",
    profile: {
      apiAccounts: [
        {
          teamId: "team-a",
          role: "organiser",
          paidThrough: "2026-10-23T12:00:00Z",
        },
      ],
    },
    status: 402,
    allowance: null,
  },
  {
    label: "a staff workspace organiser",
    profile: {
      teams: [
        {
          id: "team-a",
          name: "Kent",
          slug: "kent",
          role: "organiser",
          libraryCount: 1,
          libraryDocumentIds: ["one"],
          organiserName: null,
        },
      ],
    },
    status: 402,
    allowance: null,
  },
])(
  "gates calculations and exports for $label before contacting the backend",
  async ({ label, profile, status, allowance }) => {
    session.mockResolvedValue(
      profile ? { user: userFrom(`reach-${label}`, profile) } : null
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
      for (const [, init] of fetcher.mock.calls) {
        const sent = JSON.parse(init.body)
        expect(Object.keys(sent).sort()).toEqual([
          "allowance",
          "request",
          "userKey",
        ])
        expect(sent.allowance).toMatchObject(allowance)
        if (allowance.kind === "api") {
          expect(sent.allowance.accountKey).toMatch(/^[a-f0-9]{64}$/)
          expect(JSON.stringify(sent)).not.toContain("team-a")
        }
      }
    }
  }
)

it("relays the bridge's allowance code without its text", async () => {
  fetcher.mockResolvedValue(
    Response.json(
      { error: "<b>internal</b>", code: "REACH_WEEKLY_LIMIT" },
      { status: 429 }
    )
  )
  const response = await POST(request())
  expect(response.status).toBe(429)
  const body = await response.json()
  expect(body.code).toBe("REACH_WEEKLY_LIMIT")
  expect(body.error).toMatch(/^Weekly Reach allowance reached/)
  fetcher.mockResolvedValue(
    Response.json({ error: "x", code: "SOMETHING_ELSE" }, { status: 429 })
  )
  expect((await (await POST(request())).json()).code).toBe("REACH_LIMIT")
})

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
  expect(body.allowance).toEqual({ kind: "contributor", weekly: 2 })
  expect(response.headers.get("cache-control")).toBe("no-store")
})
it("refuses absent allowances and mismatched job identities", async () => {
  session.mockResolvedValueOnce({ user: { features: ["atlas.reach"] } })
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
  session.mockResolvedValue({ user: contributorUser("reach-request-burst") })
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
