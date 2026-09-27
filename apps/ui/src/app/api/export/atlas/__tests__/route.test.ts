import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const getSession = vi.fn()
const fetchMock = vi.fn()

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers()),
}))

vi.mock("@/lib/auth", () => ({ auth: { api: { getSession } } }))

const ENV: Record<string, string> = {
  STRAPI_URL: "http://strapi.test/",
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

/** One Strapi export row, shaped as `POST /api/libraries/export` returns it. */
function row(id: string, name: string, lng: number, lat: number) {
  return {
    name,
    slug: `${id}-library`,
    libraryType: "Public",
    operationalStatus: "open",
    streetAddress: null,
    city: "Leeds",
    region: "West Yorkshire",
    country: "England",
    lat,
    lng,
    website: null,
    phone: null,
    email: null,
    continentSlug: "europe",
    countrySlug: "england",
    regionSlug: "west-yorkshire",
  }
}

const EXPORT_ROWS: Record<string, unknown> = {
  a: row("a", "Alpha", -1.55, 53.8),
  b: row("b", "Beta", -1.5, 53.7),
  c: row("c", "=Gamma", -1.4, 53.6),
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
  vi.stubEnv("STRAPI_BRIDGE_SECRET", "s3cret")
  fetchMock.mockResolvedValue(Response.json({ data: EXPORT_ROWS }))
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
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

  it("returns 413 for 10,001 ids from a Pro user (cap 10,000)", async () => {
    getSession.mockResolvedValue(proUser({ limits: { exportRows: 10_000 } }))

    const res = await post({
      format: "csv",
      ids: Array.from({ length: 10_001 }, (_, i) => `id${i}`),
    })

    expect(res.status).toBe(413)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("returns 200 for 10,001 ids from a Team user (cap 50,000)", async () => {
    getSession.mockResolvedValue(proUser({ limits: { exportRows: 50_000 } }))

    const res = await post({
      format: "csv",
      ids: Array.from({ length: 10_001 }, (_, i) => `id${i}`),
    })

    expect(res.status).toBe(200)
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
      "more than 50,000 ids",
      { format: "csv", ids: Array.from({ length: 50_001 }, (_, i) => `${i}`) },
    ],
    ["a body that isn't JSON", "format=csv"],
  ])("returns 400 for %s", async (_label, body) => {
    const res = await post(body)

    expect(res.status).toBe(400)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("returns 413 for a body over the size cap, before parsing it", async () => {
    const res = await post({
      format: "csv",
      ids: ["a"],
      pad: "x".repeat(4_300_000),
    })

    expect(res.status).toBe(413)
    expect(await res.json()).toEqual({ error: "Request body too large" })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe("POST /api/export/atlas: the Strapi bridge", () => {
  beforeEach(() => getSession.mockResolvedValue(proUser()))

  it("calls the bridge with the service secret, the ids and no-store", async () => {
    await post({ format: "csv", ids: ["a"] })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe("http://strapi.test/api/libraries/export")
    expect(init).toMatchObject({ method: "POST", cache: "no-store" })
    expect(init.headers).toMatchObject({ "X-Service-Secret": "s3cret" })
    expect(JSON.parse(init.body as string)).toEqual({ ids: ["a"] })
  })

  it("returns 503 without calling Strapi when the bridge secret isn't configured", async () => {
    vi.stubEnv("STRAPI_BRIDGE_SECRET", "")

    const res = await post({ format: "csv", ids: ["a"] })

    expect(res.status).toBe(503)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("returns 502 when Strapi answers with a non-2xx status, without echoing its body", async () => {
    fetchMock.mockResolvedValue(
      new Response("classified upstream detail", { status: 500 })
    )

    const res = await post({ format: "csv", ids: ["a"] })

    expect(res.status).toBe(502)
    expect(await res.text()).not.toContain("classified upstream detail")
  })

  it("returns 502 when the bridge request fails outright", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"))

    const res = await post({ format: "csv", ids: ["a"] })

    expect(res.status).toBe(502)
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
      "name,slug,libraryType,operationalStatus,streetAddress,city,region,country,lat,lng,website,phone,email,url",
      "'=Gamma,c-library,Public,open,,Leeds,West Yorkshire,England,53.6,-1.4,,,,https://libraries.global/europe/england/west-yorkshire/c-library",
      "Alpha,a-library,Public,open,,Leeds,West Yorkshire,England,53.8,-1.55,,,,https://libraries.global/europe/england/west-yorkshire/a-library",
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
})
