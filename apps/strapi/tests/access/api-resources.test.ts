import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const { reach, networkReach } = vi.hoisted(() => ({
  reach: vi.fn(),
  networkReach: vi.fn(),
}))
vi.mock("../../src/utils/atlas-analysis", () => ({
  requestAtlasReach: reach,
}))
vi.mock("../../src/utils/atlas-network-analysis", () => ({
  requestAtlasNetworkReach: networkReach,
}))

import createController, {
  machineAllowance,
  projectReachResult,
} from "../../src/plugins/access/server/controllers/api-resources"

const ref = "network00000000000000001"
const account = "team00000000000000000001"
const entityRef = "europe:united-kingdom:england:bristol:central-library"
const context = (
  overrides: Partial<{
    secret: string
    query: Record<string, string>
    params: Record<string, string>
    body: unknown
  }> = {}
) => ({
  request: {
    header: { "x-service-secret": overrides.secret ?? "fixture" },
    body: overrides.body,
  },
  params: overrides.params ?? {},
  query: overrides.query ?? {},
  set: vi.fn(),
  unauthorized: vi.fn(),
  status: 200,
  body: undefined as any,
})
const network = {
  documentId: ref,
  name: "Bristol Libraries",
  slug: "bristol-libraries",
  kind: "library_service",
  description: "City service",
  website: "https://bristol.gov.uk/libraries",
  sourceUrl: "https://example.org/source",
  lastVerifiedAt: "2026-10-01T00:00:00.000Z",
  publicPageReviewedBy: "moderator@example.org",
  countries: [{ name: "United Kingdom", slug: "united-kingdom", iso2: "GB" }],
}

beforeEach(() => {
  vi.stubEnv("STRAPI_BRIDGE_SECRET", "fixture")
  reach.mockReset()
  networkReach.mockReset()
})
afterEach(() => vi.unstubAllEnvs())

function runtime(rows: Record<string, unknown[]>, counts = 0) {
  const findMany = vi.fn(async (args: any) => rows[args.__uid] ?? [])
  const count = vi.fn(async () => counts)

  return {
    findMany,
    count,
    strapi: {
      documents: (uid: string) => ({
        findMany: (args: any) => findMany({ ...args, __uid: uid }),
        count: (args: any) => count({ ...args, __uid: uid }),
      }),
    },
  }
}

describe("machine API service bridge", () => {
  it("requires the bridge secret before any read", async () => {
    const { strapi, findMany } = runtime({})
    const ctx = context({ secret: "wrong" })
    await createController({ strapi }).services(ctx)
    expect(ctx.unauthorized).toHaveBeenCalled()
    expect(findMany).not.toHaveBeenCalled()
  })

  it("lists only public, reviewed services with an explicit projection", async () => {
    const { strapi, findMany } = runtime({
      "api::library-network.library-network": [network, network],
    })
    const ctx = context({ query: { limit: "1", after: "a".repeat(24) } })
    await createController({ strapi }).services(ctx)
    const args = findMany.mock.calls[0]![0]
    expect(args.filters).toMatchObject({
      publicPageEnabled: true,
      publicPageReviewedAt: { $notNull: true },
      documentId: { $gt: "a".repeat(24) },
    })
    expect(args.limit).toBe(2)
    expect(args.sort).toBe("documentId:asc")
    expect(ctx.body.data).toHaveLength(1)
    expect(ctx.body.data[0]).toMatchObject({
      ref,
      serviceType: "library_service",
      source: { url: "https://example.org/source" },
    })
    expect(ctx.body.meta.nextCursor).toBe(ref)
    expect(ctx.body.meta.semantics.membership).toMatch(/not staff authority/)
    expect(JSON.stringify(ctx.body)).not.toContain("moderator@example.org")
  })

  it("refuses unknown filters, oversized pages and bad cursors", async () => {
    const { strapi, findMany } = runtime({})
    const controller = createController({ strapi })
    for (const query of [
      { q: "x" },
      { limit: "51" },
      { after: "../../admin" },
      { serviceType: "public_library" },
    ]) {
      const ctx = context({ query })
      await controller.services(ctx)
      expect(ctx.status).toBe(400)
    }
    expect(findMany).not.toHaveBeenCalled()
  })

  it("returns 404 for private or unknown refs without a member read", async () => {
    const { strapi, findMany } = runtime({})
    const ctx = context({ params: { ref } })
    await createController({ strapi }).serviceLibraries(ctx)
    expect(ctx.status).toBe(404)
    expect(findMany).toHaveBeenCalledTimes(1)
    const bad = context({ params: { ref: "bristol-libraries" } })
    await createController({ strapi }).service(bad)
    expect(bad.status).toBe(404)
  })

  it("reads members from CMS membership, published only, keyset paginated", async () => {
    const { strapi, findMany } = runtime({
      "api::library-network.library-network": [network],
      "api::library.library": [
        { documentId: "lib1", entityRef, name: "Central", staffNotes: "x" },
      ],
    })
    const ctx = context({ params: { ref }, query: { limit: "10" } })
    await createController({ strapi }).serviceLibraries(ctx)
    const members = findMany.mock.calls.find(
      ([a]) => a.__uid === "api::library.library"
    )![0]
    expect(members).toMatchObject({
      status: "published",
      locale: "en",
      limit: 11,
      filters: { networks: { documentId: { $eq: ref } } },
    })
    expect(ctx.body.data[0].entityRef).toBe(entityRef)
    expect(JSON.stringify(ctx.body)).not.toContain("staffNotes")
  })
})

describe("machine API analysis bridge", () => {
  it("never accepts polygons, coordinates, memberships or upstream URLs", async () => {
    vi.stubEnv("ATLAS_ENABLED", "true")
    vi.stubEnv("ANALYSIS_SERVICE_URL", "http://analysis.internal")
    const { strapi } = runtime({})
    const controller = createController({ strapi })
    for (const extra of [
      { polygon: [[0, 0]] },
      { lat: 51, lng: -2 },
      { libraries: ["lib1"] },
      { url: "http://evil.example" },
    ]) {
      const ctx = context({
        body: {
          account,
          mode: "library",
          ref: entityRef,
          travelMode: "walking",
          ...extra,
        },
      })
      await controller.reach(ctx)
      expect(ctx.status).toBe(400)
    }
    expect(reach).not.toHaveBeenCalled()
  })

  it("admits a published library with the separate machine pool and projects the result", async () => {
    vi.stubEnv("ATLAS_ENABLED", "true")
    vi.stubEnv("ANALYSIS_SERVICE_URL", "http://analysis.internal")
    const { strapi } = runtime({
      "api::library.library": [{ documentId: "lib1", entityRef, name: "C" }],
    })
    reach.mockResolvedValue({
      status: 200,
      body: {
        state: "ready",
        mode: "walking",
        libraryId: "lib1",
        coordinateHash: "secret-hash",
        calculatedAt: "2026-11-01T00:00:00.000Z",
        method: "m",
        warnings: [],
        network: {
          release: "r",
          source: "OSM",
          sourceUrl: "https://osm.org",
          licence: "ODbL",
        },
        population: {
          release: "p",
          source: "ONS",
          sourceUrl: "https://ons.gov.uk",
          licence: "OGL",
        },
        contours: [5, 10, 15, 30].map((minutes) => ({
          minutes,
          residents: minutes * 10,
          coveredFraction: 1,
          geometry: { type: "Polygon", coordinates: [] },
        })),
      },
    })
    const ctx = context({
      body: {
        account,
        mode: "library",
        ref: entityRef,
        travelMode: "walking",
        minutes: 10,
      },
    })
    await createController({ strapi }).reach(ctx)
    expect(reach.mock.calls[0]![1]).toEqual({
      schemaVersion: 1,
      libraryId: "lib1",
      mode: "walking",
    })
    expect(reach.mock.calls[0]![3]).toEqual(machineAllowance(account))
    expect(machineAllowance(account).accountKey).not.toBe(
      machineAllowance("team00000000000000000002").accountKey
    )
    expect(ctx.body.state).toBe("ready")
    expect(ctx.body.result.ref).toBe(entityRef)
    expect(ctx.body.result.contours).toHaveLength(1)
    expect(JSON.stringify(ctx.body)).not.toContain("secret-hash")
    expect(JSON.stringify(ctx.body)).not.toContain("lib1")
  })

  it("checks service visibility before network admission", async () => {
    vi.stubEnv("ATLAS_ENABLED", "true")
    vi.stubEnv("ANALYSIS_SERVICE_URL", "http://analysis.internal")
    const { strapi } = runtime({})
    const ctx = context({
      body: {
        account,
        mode: "service",
        ref,
        travelMode: "walking",
        areaCode: "E06000023",
      },
    })
    await createController({ strapi }).reach(ctx)
    expect(ctx.status).toBe(404)
    expect(networkReach).not.toHaveBeenCalled()
  })

  it("reports pending, unavailable and capacity outcomes without results", async () => {
    vi.stubEnv("ATLAS_ENABLED", "true")
    vi.stubEnv("ANALYSIS_SERVICE_URL", "http://analysis.internal")
    const { strapi } = runtime({
      "api::library.library": [{ documentId: "lib1", entityRef, name: "C" }],
    })
    const body = {
      account,
      mode: "library",
      ref: entityRef,
      travelMode: "cycling",
    }
    for (const [outcome, expected] of [
      [{ status: 202, body: {} }, { state: "pending" }],
      [
        { status: 200, body: { state: "unroutable" } },
        { state: "unavailable", reason: "unroutable" },
      ],
      [
        { status: 429, body: {} },
        { state: "refused", code: "analysis_capacity" },
      ],
    ] as const) {
      reach.mockResolvedValueOnce(outcome)
      const ctx = context({ body })
      await createController({ strapi }).reach(ctx)
      expect(ctx.body).toMatchObject(expected)
    }
  })

  it("drops large geometry and network coordinates from results", () => {
    const big = {
      type: "Polygon",
      coordinates: [Array.from({ length: 20000 }).fill([0.123456, 51.123456])],
    }
    const projected = projectReachResult(
      {
        kind: "network",
        state: "ready",
        mode: "walking",
        analysis: { eligibleLibraries: [{ lat: 1, lng: 2 }] },
        contours: [
          { minutes: 15, residents: 1, coveredFraction: 1, geometry: big },
        ],
      },
      { mode: "network", ref }
    )
    expect(projected.geometry).toBe("unavailable")
    expect((projected.contours as any[])[0].geometry).toBeNull()
    expect(JSON.stringify(projected)).not.toContain("eligibleLibraries")
  })

  it("validates summary operations against their scope", async () => {
    const { strapi, count } = runtime({})
    const controller = createController({ strapi })
    for (const body of [
      { operation: "service.profile", place: { country: "uk" } },
      { operation: "place.profile", ref },
      { operation: "everything", ref },
      { operation: "place.profile", place: { country: "uk", area: "x" } },
    ]) {
      const ctx = context({ body })
      await controller.summary(ctx)
      expect(ctx.status).toBe(400)
    }
    expect(count).not.toHaveBeenCalled()
  })

  it("counts a place profile with bounded count queries only", async () => {
    const { strapi, count, findMany } = runtime(
      { "api::library-type.library-type": [{ name: "Public" }] },
      3
    )
    const ctx = context({
      body: {
        operation: "place.profile",
        place: { country: "united-kingdom" },
      },
    })
    await createController({ strapi }).summary(ctx)
    expect(ctx.body.data).toMatchObject({
      libraries: 3,
      byLibraryType: { Public: 3 },
    })
    expect(
      findMany.mock.calls.some(([a]) => a.__uid === "api::library.library")
    ).toBe(false)
    expect(count.mock.calls.every(([a]) => a.status === "published")).toBe(true)
  })
})
