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
const { MAX_ID_LENGTH } = await import("@/lib/bridge-params")
const { MAX_EXPORT_IDS } = await import("@/lib/export-format")

/** A documentId-shaped id (lower-case letters and digits), `length` long. */
const docId = (n: number, length = 24) =>
  `lib${String(n).padStart(length - 3, "0")}`

const A = docId(1)
const B = docId(2)
const C = docId(3)
/** Well-formed, but not a library Strapi has. */
const UNKNOWN = docId(999)

/** `n` distinct documentIds, each as long as a documentId can be. */
const many = (n: number) =>
  Array.from({ length: n }, (_, i) => docId(i, MAX_ID_LENGTH))

/** One Strapi export row, shaped as `POST /api/libraries/export` returns it. */
function row(slug: string, name: string, lng: number, lat: number) {
  return {
    name,
    slug: `${slug}-library`,
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
  [A]: row("a", "Alpha", -1.55, 53.8),
  [B]: row("b", "Beta", -1.5, 53.7),
  [C]: row("c", "=Gamma", -1.4, 53.6),
}

/**
 * Strapi's export action: rows for the requested ids it has, keyed by id.
 * Like Strapi, it doesn't answer in request order (here, it's reversed).
 */
function bridge(rows: Record<string, unknown> = EXPORT_ROWS) {
  return async (_url: string, init: RequestInit) => {
    const { ids } = JSON.parse(init.body as string) as { ids: string[] }
    const found = ids.filter((id) => id in rows).map((id) => [id, rows[id]])

    return Response.json({ data: Object.fromEntries(found.reverse()) })
  }
}

/** The ids each bridge call carried, in call order. */
const bridgeCalls = () =>
  fetchMock.mock.calls.map(
    ([, init]) => (JSON.parse(init.body as string) as { ids: string[] }).ids
  )

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

/** A streamed body's chunks, as they arrive. */
async function bodyChunks(res: Response): Promise<Uint8Array[]> {
  const chunks: Uint8Array[] = []
  const reader = res.body!.getReader()
  for (;;) {
    const { done, value } = await reader.read()
    if (done) return chunks
    chunks.push(value)
  }
}

/** A streamed body's chunks, decoded as one text. */
const decode = (chunks: Uint8Array[]) =>
  new TextDecoder().decode(Buffer.concat(chunks))

/** The CSV's first column (the library names), without the header. */
const csvNames = async (res: Response) =>
  (await csvLines(res)).slice(1).map((line) => line.split(",")[0])

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(new Date("2026-09-27T10:00:00Z"))
  vi.stubGlobal("fetch", fetchMock)
  vi.stubEnv("STRAPI_BRIDGE_SECRET", "s3cret")
  fetchMock.mockImplementation(bridge())
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe("POST /api/export/atlas: access", () => {
  it("returns 401 when signed out", async () => {
    getSession.mockResolvedValue(null)

    const res = await post({ format: "csv", ids: [A] })

    expect(res.status).toBe(401)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("returns 402 without the atlas.export feature", async () => {
    getSession.mockResolvedValue({
      user: { id: "u1", features: [], limits: { exportRows: 0 } },
      session: { id: "s1" },
    })

    const res = await post({ format: "csv", ids: [A] })

    expect(res.status).toBe(402)
    expect(await res.json()).toMatchObject({ feature: "atlas.export" })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("returns 413 when there are more ids than the plan's row cap", async () => {
    getSession.mockResolvedValue(proUser({ limits: { exportRows: 2 } }))

    const res = await post({ format: "csv", ids: [A, B, C] })

    expect(res.status).toBe(413)
    expect(await res.json()).toMatchObject({ limit: 2 })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("returns 413 for 10,001 ids from a Pro user (cap 10,000)", async () => {
    getSession.mockResolvedValue(proUser({ limits: { exportRows: 10_000 } }))

    const res = await post({
      format: "csv",
      ids: Array.from({ length: 10_001 }, (_, i) => docId(i)),
    })

    expect(res.status).toBe(413)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("returns 200 for 10,001 ids from a Team user (cap 50,000)", async () => {
    getSession.mockResolvedValue(proUser({ limits: { exportRows: 50_000 } }))

    const res = await post({
      format: "csv",
      ids: Array.from({ length: 10_001 }, (_, i) => docId(i)),
    })

    expect(res.status).toBe(200)
  })

  it.each([
    ["missing", {}],
    ["null", { limits: null }],
    ["malformed", { limits: { exportRows: "10000" } }],
  ])("treats %s limits as a cap of 0", async (_label, fields) => {
    getSession.mockResolvedValue(proUser(fields))

    const res = await post({ format: "csv", ids: [A] })

    expect(res.status).toBe(413)
  })
})

describe("POST /api/export/atlas: body", () => {
  beforeEach(() => getSession.mockResolvedValue(proUser()))

  it.each([
    ["an unknown format", { format: "xlsx", ids: [A] }],
    ["no format", { ids: [A] }],
    ["ids that aren't an array", { format: "csv", ids: A }],
    ["ids that aren't strings", { format: "csv", ids: [1, 2] }],
    ["an empty id", { format: "csv", ids: [""] }],
    ["an id over 32 characters", { format: "csv", ids: [docId(1, 33)] }],
    ["an id under 20 characters", { format: "csv", ids: [docId(1, 19)] }],
    ["an upper-case id", { format: "csv", ids: [A.toUpperCase()] }],
    [
      "an id with a path in it",
      { format: "csv", ids: ["../../auth-bridge/x0"] },
    ],
    ["one malformed id among good ones", { format: "csv", ids: [A, "b!", C] }],
    ["no ids", { format: "csv", ids: [] }],
    [
      "more than 50,000 ids",
      {
        format: "csv",
        ids: Array.from({ length: 50_001 }, (_, i) => docId(i)),
      },
    ],
    ["a body that isn't JSON", "format=csv"],
  ])("returns 400 for %s", async (_label, body) => {
    const res = await post(body)

    expect(res.status).toBe(400)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe("POST /api/export/atlas: body size", () => {
  // The route's cap: every id at the longest documentId, quoted and
  // comma-separated, plus 1 KB for the rest of the JSON.
  const MAX_BODY_BYTES = MAX_EXPORT_IDS * (MAX_ID_LENGTH + 3) + 1024
  const largest = JSON.stringify({
    format: "geojson",
    ids: many(MAX_EXPORT_IDS),
  })
  // JSON allows trailing whitespace, so padding keeps the body legal.
  const padded = (bytes: number) => largest + " ".repeat(bytes - largest.length)

  beforeEach(() =>
    getSession.mockResolvedValue(proUser({ limits: { exportRows: 50_000 } }))
  )

  it("accepts the largest legal body: 50,000 ids of 32 characters", async () => {
    const res = await post(largest)

    expect(res.status).toBe(200)
  })

  it("accepts a body of exactly the cap", async () => {
    const res = await post(padded(MAX_BODY_BYTES))

    expect(res.status).toBe(200)
  })

  it("returns 413 for a body one byte over the cap, before parsing it", async () => {
    const res = await post(padded(MAX_BODY_BYTES + 1))

    expect(res.status).toBe(413)
    expect(await res.json()).toEqual({ error: "Request body too large" })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe("POST /api/export/atlas: the Strapi bridge", () => {
  beforeEach(() => getSession.mockResolvedValue(proUser()))

  it("calls the bridge with the service secret, the ids and no-store", async () => {
    await post({ format: "csv", ids: [A] })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe("http://strapi.test/api/libraries/export")
    expect(init).toMatchObject({ method: "POST", cache: "no-store" })
    expect(init.headers).toMatchObject({ "X-Service-Secret": "s3cret" })
    expect(JSON.parse(init.body as string)).toEqual({ ids: [A] })
  })

  it("returns 503 without calling Strapi when the bridge secret isn't configured", async () => {
    vi.stubEnv("STRAPI_BRIDGE_SECRET", "")

    const res = await post({ format: "csv", ids: [A] })

    expect(res.status).toBe(503)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("returns 502 when Strapi answers with a non-2xx status, without echoing its body", async () => {
    fetchMock.mockResolvedValue(
      new Response("classified upstream detail", { status: 500 })
    )

    const res = await post({ format: "csv", ids: [A] })

    expect(res.status).toBe(502)
    expect(await res.text()).not.toContain("classified upstream detail")
  })

  it("returns 502 when the bridge request fails outright", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"))

    const res = await post({ format: "csv", ids: [A] })

    expect(res.status).toBe(502)
  })
})

describe("POST /api/export/atlas: chunked bridge calls", () => {
  const TEAM = proUser({ limits: { exportRows: 50_000 } })

  beforeEach(() => getSession.mockResolvedValue(TEAM))

  it("sends 50,000 ids from a Team user in 10 calls, each under 1 MiB", async () => {
    const ids = many(50_000)

    const res = await post({ format: "csv", ids })

    expect(res.status).toBe(200)
    expect(fetchMock).toHaveBeenCalledTimes(10)
    for (const [, init] of fetchMock.mock.calls)
      expect(new TextEncoder().encode(init.body as string).length).toBeLessThan(
        1024 * 1024
      )
    expect(bridgeCalls().map((chunk) => chunk.length)).toEqual(
      Array.from({ length: 10 }, () => 5000)
    )
    expect(bridgeCalls().flat()).toEqual(ids)
  })

  it("sends a duplicated id once, but keeps the requested order", async () => {
    const res = await post({ format: "csv", ids: [C, A, C, B, A] })

    expect(bridgeCalls()).toEqual([[C, A, B]])
    expect(await csvNames(res)).toEqual(["'=Gamma", "Alpha", "Beta"])
  })

  it("keeps the requested order across chunks, whichever answers first", async () => {
    const answer = bridge()
    // The first chunk answers last.
    fetchMock.mockImplementation(async (url: string, init: RequestInit) => {
      if (fetchMock.mock.calls.length === 1)
        await new Promise((resolve) => setTimeout(resolve, 20))

      return answer(url, init)
    })

    const res = await post({ format: "csv", ids: [B, ...many(5000), A] })

    expect(bridgeCalls().map((chunk) => chunk.length)).toEqual([5000, 2])
    expect(await csvNames(res)).toEqual(["Beta", "Alpha"])
  })

  it("has at most two bridge calls in flight at once", async () => {
    const answer = bridge()
    let inFlight = 0
    let most = 0
    fetchMock.mockImplementation(async (url: string, init: RequestInit) => {
      inFlight += 1
      most = Math.max(most, inFlight)
      await new Promise((resolve) => setTimeout(resolve, 5))
      inFlight -= 1

      return answer(url, init)
    })

    const res = await post({ format: "csv", ids: many(30_000) })

    expect(res.status).toBe(200)
    expect(fetchMock).toHaveBeenCalledTimes(6)
    expect(most).toBeLessThanOrEqual(2)
  })

  it("returns 502 when one chunk fails, without echoing its body", async () => {
    const answer = bridge()
    fetchMock.mockImplementation(async (url: string, init: RequestInit) =>
      fetchMock.mock.calls.length === 2
        ? new Response("classified upstream detail", { status: 500 })
        : answer(url, init)
    )

    const res = await post({ format: "csv", ids: [A, ...many(15000), B] })

    expect(res.status).toBe(502)
    expect(await res.text()).not.toContain("classified upstream detail")
  })
})

describe("POST /api/export/atlas: the bridge response", () => {
  const { lat: _lat, ...noLat } = row("b", "Beta", -1.5, 53.7)

  beforeEach(() => getSession.mockResolvedValue(proUser()))

  it.each([
    ["a latitude that isn't a number", { ...noLat, lat: "53.7" }],
    ["a missing field", noLat],
    ["a name that isn't a string", { ...noLat, lat: 53.7, name: 42 }],
    ["a null row", null],
  ])("skips a row with %s and keeps the rest", async (_label, bad) => {
    fetchMock.mockImplementation(bridge({ ...EXPORT_ROWS, [B]: bad }))

    const res = await post({ format: "csv", ids: [A, B, C] })

    expect(res.status).toBe(200)
    expect(await csvNames(res)).toEqual(["Alpha", "'=Gamma"])
  })

  it("returns 502 when a renamed field makes every row invalid", async () => {
    const renamed = Object.fromEntries(
      Object.entries(EXPORT_ROWS).map(([id, value]) => {
        const { libraryType, ...rest } = value as Record<string, unknown>

        return [id, { ...rest, type: libraryType }]
      })
    )
    fetchMock.mockImplementation(bridge(renamed))

    const res = await post({ format: "csv", ids: [A, B] })

    expect(res.status).toBe(502)
  })

  it.each([
    ["no data", {}],
    ["data that isn't an object", { data: "rows" }],
    ["a list of rows", [EXPORT_ROWS[A]]],
  ])("returns 502 for a bridge body with %s", async (_label, json) => {
    fetchMock.mockResolvedValue(Response.json(json))

    const res = await post({ format: "csv", ids: [A] })

    expect(res.status).toBe(502)
  })

  it("returns 502 for a bridge body that isn't JSON", async () => {
    fetchMock.mockResolvedValue(new Response("<html>Bad gateway</html>"))

    const res = await post({ format: "csv", ids: [A] })

    expect(res.status).toBe(502)
    expect(await res.text()).not.toContain("Bad gateway")
  })

  it("exports an empty file when Strapi has none of the ids", async () => {
    const res = await post({ format: "csv", ids: [UNKNOWN] })

    expect(res.status).toBe(200)
    expect(await csvLines(res)).toHaveLength(1)
  })
})

describe("POST /api/export/atlas: the file", () => {
  beforeEach(() => getSession.mockResolvedValue(proUser()))

  it("returns CSV of only the requested ids, in request order", async () => {
    const res = await post({ format: "csv", ids: [C, A] })

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

  it("silently skips a well-formed id that Strapi doesn't have", async () => {
    const res = await post({ format: "csv", ids: [UNKNOWN, B] })

    const rows = await csvLines(res)
    expect(res.status).toBe(200)
    expect(rows).toHaveLength(2)
    expect(rows[1]).toMatch(/^Beta,/)
  })

  it("ignores row data sent by the client", async () => {
    const res = await post({
      format: "csv",
      ids: [A],
      rows: [{ name: "Injected" }],
    })

    expect(await res.text()).not.toContain("Injected")
  })

  it("returns GeoJSON points with attribution", async () => {
    const res = await post({ format: "geojson", ids: [B, A] })

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

  it("starts the CSV with a UTF-8 byte-order mark", async () => {
    const res = await post({ format: "csv", ids: [A] })

    const bytes = new Uint8Array(await res.arrayBuffer())
    expect(bytes.slice(0, 3)).toEqual(new Uint8Array([0xef, 0xbb, 0xbf]))
    expect(new TextDecoder().decode(bytes.slice(3, 8))).toBe("name,")
  })

  it("returns valid GeoJSON with no byte-order mark when no ids are found", async () => {
    const res = await post({ format: "geojson", ids: [UNKNOWN] })

    const text = new TextDecoder("utf-8", { ignoreBOM: true }).decode(
      await res.arrayBuffer()
    )
    expect(text[0]).toBe("{")
    expect(JSON.parse(text)).toEqual({
      type: "FeatureCollection",
      attribution: "libraries.global contributors; see /knowledge for licences",
      features: [],
    })
  })
})

describe("POST /api/export/atlas: streaming", () => {
  const ids = many(1001)
  const rows = Object.fromEntries(
    ids.map((id, i) => [id, row(`l${i}`, `Library ${i}`, -1.5, 53.8)])
  )
  const names = ids.map((_, i) => `Library ${i}`)

  beforeEach(() => {
    getSession.mockResolvedValue(proUser())
    fetchMock.mockImplementation(bridge(rows))
  })

  it("streams a CSV in several chunks, with every row in request order", async () => {
    const res = await post({ format: "csv", ids })

    const chunks = await bodyChunks(res)
    expect(chunks.length).toBeGreaterThan(1)
    const lines = decode(chunks).split("\r\n").filter(Boolean)
    expect(lines.slice(1).map((line) => line.split(",")[0])).toEqual(names)
  })

  it("streams GeoJSON in several chunks that make one valid document", async () => {
    const res = await post({ format: "geojson", ids })

    const chunks = await bodyChunks(res)
    expect(chunks.length).toBeGreaterThan(1)
    const fc = JSON.parse(decode(chunks)) as {
      features: { properties: { name: string } }[]
    }
    expect(fc.features.map((f) => f.properties.name)).toEqual(names)
  })
})
