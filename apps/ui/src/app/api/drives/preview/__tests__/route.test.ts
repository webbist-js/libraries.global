import { beforeEach, describe, expect, it, vi } from "vitest"

const { session, multiSearch } = vi.hoisted(() => ({
  session: { value: null as null | { user: Record<string, unknown> } },
  multiSearch: vi.fn(),
}))

vi.mock("next/headers", () => ({ headers: async () => new Headers() }))
vi.mock("next/cache", () => ({ revalidateTag: vi.fn() }))
vi.mock("@/lib/auth-server", () => ({
  getSessionSSR: async () => session.value,
}))
vi.mock("@/lib/meilisearch", () => ({
  meiliClient: { multiSearch },
  searchLocaleFilter: (l?: string) => `locale = "${l ?? "en"}"`,
}))

const fetchMock = vi.fn()

const { POST } = await import("../route")
const { MemoryRateLimitStore } = await import("@/lib/rate-limit")

const BOARD = {
  id: "board-1",
  email: "board@example.test",
  name: "Board Member",
  capabilities: ["drives.manage"],
}
const PROPOSER = {
  ...BOARD,
  id: "user-2",
  capabilities: ["submit.driveProposal"],
}
const ID_A = "i4ufvks2vsdq2qctu74bwq6p"
const FOCUS = { kind: "gaps", gaps: ["hours"] }
const SCOPE = { places: { region: ["vermont"] }, libraryTypes: ["Public"] }

/** Libraries in scope and to do, overall and per place, as the index holds them. */
const TOTAL = 187
const TODO = 40
const PLACES: Record<string, { name?: string; total: number; todo: number }> = {
  vermont: { name: "Vermont", total: 150, todo: 30 },
  chittenden: { name: "Chittenden County", total: 37, todo: 10 },
  // No library carries its name: the slug is used, as words.
  "new-england": { total: 0, todo: 0 },
}

type Query = {
  filter: string
  limit: number
  facets: string[]
  attributesToRetrieve?: string[]
}

/** Meilisearch, faked from the filter: per place, to do or not. */
function answer(q: Query) {
  const place = /(\w+)_slug = "([^"]+)"/.exec(q.filter)
  const todo = q.filter.includes("needs IN")
  const counts = place
    ? (PLACES[place[2]!] ?? { total: 1, todo: 1 })
    : { total: TOTAL, todo: TODO }
  const n = todo ? counts.todo : counts.total
  const name = place ? PLACES[place[2]!]?.name : undefined

  return {
    hits: q.limit > 0 && place && name ? [{ [`${place[1]}_name`]: name }] : [],
    facetDistribution: {
      locale: { en: n },
      ...(q.facets.includes("needs")
        ? { needs: { hours: TODO, photo: 120, about: 5 } }
        : {}),
    },
  }
}

const queriesOf = (call = 0) =>
  (multiSearch.mock.calls[call]![0] as { queries: Query[] }).queries

const preview = (body: unknown) =>
  POST(
    new Request("http://localhost/api/drives/preview", {
      method: "POST",
      body: JSON.stringify(body),
    })
  )

beforeEach(() => {
  ;(globalThis as { _rateLimitStore?: unknown })._rateLimitStore =
    new MemoryRateLimitStore()
  session.value = { user: { ...BOARD } }
  multiSearch
    .mockReset()
    .mockImplementation(async ({ queries }: { queries: Query[] }) => ({
      results: queries.map(answer),
    }))
  fetchMock.mockReset().mockResolvedValue(
    Response.json({
      data: [{ slug: "brooks-memorial-library", documentId: ID_A }],
    })
  )
  vi.stubGlobal("fetch", fetchMock)
  vi.stubEnv("STRAPI_URL", "http://strapi.test")
})

describe("POST /api/drives/preview", () => {
  it("is 403 without a capability that builds or reviews a drive, and counts nothing", async () => {
    session.value = { user: { ...BOARD, capabilities: ["submit.correction"] } }
    const res = await preview({ scope: SCOPE, focus: FOCUS })
    expect(res.status).toBe(403)
    expect(multiSearch).not.toHaveBeenCalled()
  })

  it("lets a proposer count", async () => {
    session.value = { user: { ...PROPOSER } }
    expect((await preview({ scope: SCOPE, focus: FOCUS })).status).toBe(200)
  })

  it("counts the scope, the gaps and each place, as if the drive opened now", async () => {
    const before = Math.floor(Date.now() / 1000)
    const res = await preview({ scope: SCOPE, focus: FOCUS })
    expect(res.status).toBe(200)
    expect(res.headers.get("cache-control")).toBe("no-store")
    expect(await res.json()).toEqual({
      total: TOTAL,
      todo: TODO,
      gaps: { hours: TODO, photo: 120, accessibility: 0, contact: 0 },
      places: [
        {
          level: "region",
          slug: "vermont",
          name: "Vermont",
          total: 150,
          todo: 30,
        },
      ],
    })

    expect(multiSearch).toHaveBeenCalledTimes(1)
    const queries = queriesOf()
    expect(queries).toHaveLength(4)
    const scope = queries[0]!
    expect(scope.filter).toMatch(
      /^region_slug IN \["vermont"\] AND libraryType IN \["Public"\] AND created_ts <= (\d+) AND operationalStatus != "permanently_closed" AND locale = "en"$/
    )
    const opened = Number(/created_ts <= (\d+)/.exec(scope.filter)![1])
    expect(opened).toBeGreaterThanOrEqual(before - 1)
    expect(opened).toBeLessThanOrEqual(Math.floor(Date.now() / 1000) + 1)
    expect(scope).toMatchObject({ limit: 0, facets: ["locale", "needs"] })
    expect(queries[1]!.filter).toContain('needs IN ["hours"]')
    expect(queries[2]).toMatchObject({
      limit: 1,
      attributesToRetrieve: ["region_name"],
    })
    expect(queries[2]!.filter).toContain('AND region_slug = "vermont"')
    expect(queries[3]!.filter).toContain(
      'needs IN ["hours"] AND region_slug = "vermont"'
    )
  })

  it("gives every place its own counts, broadest first, named from the index", async () => {
    const res = await preview({
      scope: {
        places: { area: ["chittenden"], region: ["vermont", "new-england"] },
      },
      focus: FOCUS,
    })
    const { places } = (await res.json()) as { places: unknown[] }
    expect(places).toEqual([
      {
        level: "region",
        slug: "vermont",
        name: "Vermont",
        total: 150,
        todo: 30,
      },
      {
        level: "region",
        slug: "new-england",
        name: "New England",
        total: 0,
        todo: 0,
      },
      {
        level: "area",
        slug: "chittenden",
        name: "Chittenden County",
        total: 37,
        todo: 10,
      },
    ])
  })

  it("counts at most 12 places one by one, in the same single multiSearch", async () => {
    const area = Array.from({ length: 15 }, (_, i) => `area-${i}`)
    const res = await preview({ scope: { places: { area } }, focus: FOCUS })
    const { places, total } = (await res.json()) as {
      places: { slug: string }[]
      total: number
    }
    expect(places.map((p) => p.slug)).toEqual(area.slice(0, 12))
    expect(total).toBe(TOTAL)
    expect(multiSearch).toHaveBeenCalledTimes(1)
    expect(queriesOf()).toHaveLength(2 + 12 * 2)
    // The totals still count every place.
    expect(queriesOf()[0]!.filter).toContain('"area-14"')
  })

  it("counts the scope alone while no gap is chosen: no to-do anywhere", async () => {
    const res = await preview({
      scope: SCOPE,
      focus: { kind: "gaps", gaps: [] },
    })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      total: TOTAL,
      todo: null,
      gaps: { hours: TODO, photo: 120, accessibility: 0, contact: 0 },
      places: [
        {
          level: "region",
          slug: "vermont",
          name: "Vermont",
          total: 150,
          todo: null,
        },
      ],
    })
    expect(queriesOf()).toHaveLength(2)
    expect(queriesOf().some((q) => q.filter.includes("needs IN"))).toBe(false)
  })

  it("counts a verify or whole-record focus the same way", async () => {
    const res = await preview({
      scope: SCOPE,
      focus: { kind: "record", target: 75 },
    })
    expect(res.status).toBe(200)
    expect(queriesOf()[1]!.filter).toContain("completeness < 75")
  })

  it("is 400 for a focus it can't count", async () => {
    for (const focus of [
      { kind: "gaps", gaps: ["hours", "nope"] },
      { kind: "gaps", gaps: ["hours", "photo", "contact", "accessibility"] },
      { kind: "gaps" },
      { kind: "verify", sections: ["hours_ts < 0 OR x"], before: "x" },
      { kind: "record", target: 40 },
      null,
    ]) {
      expect((await preview({ scope: SCOPE, focus })).status).toBe(400)
    }
    expect(multiSearch).not.toHaveBeenCalled()
  })

  it("is 400 with nowhere to look", async () => {
    const res = await preview({
      scope: { libraryTypes: ["Public"] },
      focus: FOCUS,
    })
    expect(res.status).toBe(400)
    expect((await res.json()).error.details.errors).toEqual([
      "Limit the drive to places or to a list of libraries.",
    ])
  })

  it("is 400 for a list over 500", async () => {
    const libraries = Array.from({ length: 501 }, (_, i) => `library-${i}`)
    const res = await preview({ scope: { libraries }, focus: FOCUS })
    expect(res.status).toBe(400)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("resolves a pasted list, names the slugs it couldn't find, and has no places", async () => {
    const res = await preview({
      scope: { libraries: ["brooks-memorial-library", "gone-library"] },
      focus: FOCUS,
    })
    expect(await res.json()).toEqual({
      total: TOTAL,
      todo: TODO,
      gaps: { hours: TODO, photo: 120, accessibility: 0, contact: 0 },
      places: [],
      unknown: ["gone-library"],
    })
    expect(queriesOf()[0]!.filter).toContain(`documentId IN ["${ID_A}"]`)
    expect(queriesOf()).toHaveLength(2)
  })

  it("is zero, without counting, when nothing on the list was found", async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ data: [] }))
    const res = await preview({ scope: { libraries: ["gone"] }, focus: FOCUS })
    expect(await res.json()).toEqual({
      total: 0,
      todo: 0,
      gaps: { hours: 0, photo: 0, accessibility: 0, contact: 0 },
      places: [],
      unknown: ["gone"],
    })
    expect(multiSearch).not.toHaveBeenCalled()
  })

  it("is 502 when Meilisearch can't count", async () => {
    multiSearch.mockRejectedValueOnce(new Error("down"))
    const res = await preview({ scope: SCOPE, focus: FOCUS })
    expect(res.status).toBe(502)
    expect(await res.json()).toEqual({
      error: "The counts are unavailable right now.",
    })
  })

  it("has its own, looser limit than board writes", async () => {
    for (let i = 0; i < 31; i++) {
      expect((await preview({ scope: SCOPE, focus: FOCUS })).status).toBe(200)
    }
  })
})
