import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const getSession = vi.fn()
const fetchMock = vi.fn()

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers()),
}))

vi.mock("@/lib/auth", () => ({ auth: { api: { getSession } } }))

const ENV: Record<string, string> = {
  STRAPI_URL: "http://strapi.test/",
  STRAPI_REST_READONLY_API_KEY: "read-key",
  APP_PUBLIC_URL: "https://libraries.global",
}
vi.mock("@/lib/env-vars", () => ({
  getEnvVar: (name: string) => ENV[name],
}))

// next-intl's navigation can't load under vitest; only the routing is used.
vi.mock("@/lib/navigation", () => ({
  routing: { locales: ["cs", "en"], defaultLocale: "en" },
}))

const { POST } = await import("../route")

function feature(id: string, name: string, lng: number, lat: number) {
  return {
    type: "Feature",
    geometry: { type: "Point", coordinates: [lng, lat] },
    properties: {
      id,
      name,
      slug: `${id}-library`,
      type: "Public",
      status: "open",
      operator: "Municipality",
      city: "Leeds",
      country: "England",
      region: "West Yorkshire",
      path: `/europe/england/west-yorkshire/${id}-library`,
      tz: "Europe/London",
      hours: null,
      founded: null,
      closed: null,
      events: false,
      catalogue: false,
      access: [],
      services: [],
      complete: 50,
    },
  }
}

const ATLAS = {
  type: "FeatureCollection",
  features: [
    feature("a", "Alpha", -1.55, 53.8),
    feature("b", "Beta", -1.5, 53.7),
    feature("c", "=Gamma", -1.4, 53.6),
  ],
}

const PRO_FIELDS = { limits: { exportRows: 10_000 } }

const proUser = (fields: Record<string, unknown> = PRO_FIELDS) => ({
  user: { id: "u1", features: ["atlas.export"], ...fields },
  session: { id: "s1" },
})

const post = (body: unknown) =>
  POST(
    new Request("http://localhost/api/export/atlas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    })
  )

const csvLines = async (res: Response) =>
  (await res.text()).split("\r\n").filter(Boolean)

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(new Date("2026-09-27T10:00:00Z"))
  vi.stubGlobal("fetch", fetchMock)
  fetchMock.mockResolvedValue(Response.json(ATLAS))
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe("POST /api/export/atlas: access", () => {
  it("returns 401 when signed out", async () => {
    getSession.mockResolvedValue(null)

    const res = await post({ format: "csv", ids: ["a"] })

    expect(res.status).toBe(401)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("returns 402 without the atlas.export feature", async () => {
    getSession.mockResolvedValue({
      user: { id: "u1", features: [], limits: { exportRows: 0 } },
      session: { id: "s1" },
    })

    const res = await post({ format: "csv", ids: ["a"] })

    expect(res.status).toBe(402)
    expect(await res.json()).toMatchObject({ feature: "atlas.export" })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("returns 413 when there are more ids than the plan's row cap", async () => {
    getSession.mockResolvedValue(proUser({ limits: { exportRows: 2 } }))

    const res = await post({ format: "csv", ids: ["a", "b", "c"] })

    expect(res.status).toBe(413)
    expect(await res.json()).toMatchObject({ limit: 2 })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it.each([
    ["missing", {}],
    ["null", { limits: null }],
    ["malformed", { limits: { exportRows: "10000" } }],
  ])("treats %s limits as a cap of 0", async (_label, fields) => {
    getSession.mockResolvedValue(proUser(fields))

    const res = await post({ format: "csv", ids: ["a"] })

    expect(res.status).toBe(413)
  })
})

describe("POST /api/export/atlas: body", () => {
  beforeEach(() => getSession.mockResolvedValue(proUser()))

  it.each([
    ["an unknown format", { format: "xlsx", ids: ["a"] }],
    ["no format", { ids: ["a"] }],
    ["ids that aren't an array", { format: "csv", ids: "a" }],
    ["ids that aren't strings", { format: "csv", ids: [1, 2] }],
    ["an empty id", { format: "csv", ids: [""] }],
    ["an over-long id", { format: "csv", ids: ["x".repeat(65)] }],
    ["no ids", { format: "csv", ids: [] }],
    [
      "more than 10,000 ids",
      { format: "csv", ids: Array.from({ length: 10_001 }, (_, i) => `${i}`) },
    ],
    ["a body that isn't JSON", "format=csv"],
  ])("returns 400 for %s", async (_label, body) => {
    const res = await post(body)

    expect(res.status).toBe(400)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("returns 413 for a body over 1 MiB, before parsing it", async () => {
    const res = await post({ format: "csv", ids: ["a"], pad: "x".repeat(2e6) })

    expect(res.status).toBe(413)
    expect(await res.json()).toEqual({ error: "Request body too large" })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe("POST /api/export/atlas: the file", () => {
  beforeEach(() => getSession.mockResolvedValue(proUser()))

  it("returns CSV of only the requested ids, in request order", async () => {
    const res = await post({ format: "csv", ids: ["c", "a"] })

    expect(res.status).toBe(200)
    expect(res.headers.get("content-type")).toBe("text/csv; charset=utf-8")
    expect(res.headers.get("content-disposition")).toBe(
      'attachment; filename="libraries-global-atlas-2026-09-27.csv"'
    )
    expect(res.headers.get("x-data-attribution")).toBe(
      "libraries.global contributors; see /knowledge for licences"
    )
    expect(await csvLines(res)).toEqual([
      "name,slug,libraryType,operationalStatus,city,region,country,lat,lng,url",
      "'=Gamma,c-library,Public,open,Leeds,West Yorkshire,England,53.6,-1.4,https://libraries.global/europe/england/west-yorkshire/c-library",
      "Alpha,a-library,Public,open,Leeds,West Yorkshire,England,53.8,-1.55,https://libraries.global/europe/england/west-yorkshire/a-library",
    ])
  })

  it("silently skips ids that aren't in the dataset", async () => {
    const res = await post({ format: "csv", ids: ["missing", "b"] })

    const rows = await csvLines(res)
    expect(res.status).toBe(200)
    expect(rows).toHaveLength(2)
    expect(rows[1]).toMatch(/^Beta,/)
  })

  it("ignores row data sent by the client", async () => {
    const res = await post({
      format: "csv",
      ids: ["a"],
      rows: [{ name: "Injected" }],
    })

    expect(await res.text()).not.toContain("Injected")
  })

  it("returns GeoJSON points with attribution", async () => {
    const res = await post({ format: "geojson", ids: ["b", "a"] })

    expect(res.status).toBe(200)
    expect(res.headers.get("content-type")).toBe("application/geo+json")
    expect(res.headers.get("content-disposition")).toBe(
      'attachment; filename="libraries-global-atlas-2026-09-27.geojson"'
    )
    const fc = await res.json()
    expect(fc.attribution).toBe(
      "libraries.global contributors; see /knowledge for licences"
    )
    expect(
      fc.features.map(
        (f: { properties: { name: string } }) => f.properties.name
      )
    ).toEqual(["Beta", "Alpha"])
    expect(fc.features[0].geometry).toEqual({
      type: "Point",
      coordinates: [-1.5, 53.7],
    })
  })

  it("reads the Atlas dataset from Strapi with the public read key, cached", async () => {
    await post({ format: "csv", ids: ["a"] })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe("http://strapi.test/api/libraries/atlas")
    expect(init.headers).toMatchObject({ Authorization: "Bearer read-key" })
    expect(init.next).toEqual({ revalidate: 300 })
  })

  it("returns 502 when the dataset can't be loaded", async () => {
    fetchMock.mockResolvedValue(new Response("down", { status: 503 }))

    const res = await post({ format: "csv", ids: ["a"] })

    expect(res.status).toBe(502)
  })
})
