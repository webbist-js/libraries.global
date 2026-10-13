import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { makeFakeStrapi } from "./helpers/fake-strapi"
import controllerFactory from "../src/api/drive/controllers/drive"
import serviceFactory from "../src/api/drive/services/drive"
import { centroidOf } from "../src/utils/meili-centroid"
import { countLibraries } from "../src/utils/meili-count"
import { ROLE_GRANT } from "../src/utils/role-grants"

const DRIVE = "api::drive.drive"

// `isDocumentId` wants 20-32 lowercase alphanumerics; pad short fixture ids.
const docId = (s: string) => s.padEnd(24, "0")
const DRIVE_1 = docId("drive1")

const NOW = new Date("2026-10-06T12:00:00.000Z")

function scheduledDrive(
  documentId: string,
  extra: Record<string, unknown> = {}
) {
  return {
    documentId,
    locale: "en",
    title: "Fill in opening hours for Yorkshire libraries",
    slug: "yorkshire-hours",
    status: "scheduled",
    scope: { places: { region: ["yorkshire"] } },
    focus: { kind: "gaps", gaps: ["hours"] },
    unit: "library",
    startsAt: "2026-10-01T00:00:00.000Z",
    endsAt: "2026-12-01T00:00:00.000Z",
    goalPercent: 80,
    pinned: false,
    featured: false,
    publishedAt: "2026-09-01T00:00:00.000Z",
    ...extra,
  }
}

function openDrive(documentId: string, extra: Record<string, unknown> = {}) {
  return {
    ...scheduledDrive(documentId),
    status: "open",
    openedAt: "2026-10-01T00:00:00.000Z",
    baseline: {
      total: 300,
      done: 50,
      at: "2026-10-01T00:00:00.000Z",
      centroid: { lat: 51, lng: -1 },
    },
    progressLog: [] as unknown[],
    ...extra,
  }
}

/** A fake `countLibraries`: the `todo` filter always carries `needs IN`. */
function countLibrariesFake(todo: number, total: number) {
  return vi.fn(async (filter: string) =>
    filter.includes("needs IN") ? todo : total
  )
}

const centroidFake = vi.fn(async () => ({ lat: 51.5, lng: -0.1 }))

function build(seed: Record<string, unknown[]> = {}) {
  const fake = makeFakeStrapi({ [DRIVE]: [], ...seed })
  const strapiStub: any = {
    ...fake.strapi,
    contentType: () => ({ uid: DRIVE }),
  }
  const service = serviceFactory({ strapi: strapiStub } as any)
  // `countInReview`/`countHelpers`/`countCredits` run raw SQL
  // (`strapi.db.connection.count(...).from(...)`) the fake doesn't model —
  // same workaround `drive-credits.test.ts` uses for `stats()`.
  service.countInReview = vi.fn(async () => 0)
  service.countHelpers = vi.fn(async () => 0)
  service.countCredits = vi.fn(async () => 0)
  // Keep raw-SQL recognition separate from these lifecycle-state assertions.
  service.recogniseClosedDrives = vi.fn(async () => [])
  fake.services[DRIVE] = service
  const controller = controllerFactory({ strapi: strapiStub } as any)

  return { ...fake, strapi: strapiStub, service, controller }
}

function row(store: Record<string, any[]>, documentId: string) {
  return store[DRIVE].find((d) => d.documentId === documentId)
}

beforeEach(() => {
  process.env.STRAPI_BRIDGE_SECRET = "s3cret"
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

// ── meili-count ─────────────────────────────────────────────────────────────

describe("countLibraries", () => {
  it("sums the locale facet across every locale, not just totalHits", async () => {
    vi.stubEnv("MEILISEARCH_HOST", "http://localhost:7701")
    vi.stubEnv("MEILISEARCH_ADMIN_API_KEY", "admin-key")
    const fetchMock = vi.fn(async () =>
      Response.json({ facetDistribution: { locale: { en: 700, fr: 400 } } })
    )
    vi.stubGlobal("fetch", fetchMock)

    const n = await countLibraries('libraryType = "Public"')

    expect(n).toBe(1100)
    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ]
    expect(url).toBe("http://localhost:7701/indexes/library/search")
    expect((init.headers as Record<string, string>).Authorization).toBe(
      "Bearer admin-key"
    )
    expect(JSON.parse(init.body as string)).toEqual({
      q: "",
      filter: 'libraryType = "Public"',
      limit: 0,
      facets: ["locale"],
    })
  })

  it("throws on a non-2xx response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response("nope", { status: 500, statusText: "Server Error" })
      )
    )

    await expect(countLibraries("x")).rejects.toThrow(/500/)
  })
})

describe("centroidOf", () => {
  it("averages the _geo of every hit that has one", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          hits: [
            { _geo: { lat: 50, lng: 0 } },
            { _geo: { lat: 52, lng: 2 } },
            {},
          ],
        })
      )
    )

    expect(await centroidOf('libraryType = "Public"')).toEqual({
      lat: 51,
      lng: 1,
    })
  })

  it("returns null when nothing in the page has a location", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ hits: [{}] }))
    )

    expect(await centroidOf("x")).toBeNull()
  })
})

// ── runLifecycle ──────────────────────────────────────────────────────────

describe("runLifecycle: opening", () => {
  it("opens a scheduled drive whose start has passed, with a baseline", async () => {
    const { service, store } = build({
      [DRIVE]: [
        scheduledDrive(DRIVE_1, { startsAt: "2026-09-01T00:00:00.000Z" }),
      ],
    })
    const deps = {
      countLibraries: countLibrariesFake(109, 251),
      centroidOf: centroidFake,
    }

    const result = await service.runLifecycle(NOW, deps)

    expect(result).toEqual({ opened: [DRIVE_1], closed: [], held: [] })
    const drive = row(store, DRIVE_1)
    expect(drive.status).toBe("open")
    expect(drive.openedAt).toBe(NOW.toISOString())
    expect(drive.baseline).toEqual({
      total: 251,
      done: 251 - 109,
      at: NOW.toISOString(),
      centroid: { lat: 51.5, lng: -0.1 },
    })
    expect(drive.progressLog).toEqual([])
  })

  it("holds a scheduled drive at 2,400 tasks — over DRIVE_MAX_TASKS", async () => {
    const { service, store } = build({
      [DRIVE]: [
        scheduledDrive(DRIVE_1, { startsAt: "2026-09-01T00:00:00.000Z" }),
      ],
    })
    const deps = {
      countLibraries: countLibrariesFake(2400, 3000),
      centroidOf: centroidFake,
    }

    const result = await service.runLifecycle(NOW, deps)

    expect(result).toEqual({ opened: [], closed: [], held: [DRIVE_1] })
    expect(row(store, DRIVE_1).status).toBe("scheduled")
  })

  it("holds a scheduled drive with no tasks to do", async () => {
    const { service, store } = build({
      [DRIVE]: [
        scheduledDrive(DRIVE_1, { startsAt: "2026-09-01T00:00:00.000Z" }),
      ],
    })
    const deps = {
      countLibraries: countLibrariesFake(0, 251),
      centroidOf: centroidFake,
    }

    const result = await service.runLifecycle(NOW, deps)

    expect(result.held).toEqual([DRIVE_1])
    expect(row(store, DRIVE_1).status).toBe("scheduled")
  })

  it("leaves a scheduled drive alone before its start date, never touching the network", async () => {
    const { service, store } = build({
      [DRIVE]: [
        scheduledDrive(DRIVE_1, { startsAt: "2027-01-01T00:00:00.000Z" }),
      ],
    })
    const deps = { countLibraries: vi.fn(), centroidOf: vi.fn() }

    const result = await service.runLifecycle(NOW, deps)

    expect(result).toEqual({ opened: [], closed: [], held: [] })
    expect(row(store, DRIVE_1).status).toBe("scheduled")
    expect(deps.countLibraries).not.toHaveBeenCalled()
  })
})

describe("runLifecycle: closing", () => {
  it("closes an open drive once its goal is met", async () => {
    const { service, store } = build({
      [DRIVE]: [
        openDrive(DRIVE_1, {
          goalPercent: 80,
          endsAt: "2027-01-01T00:00:00.000Z",
        }),
      ],
    })
    // total 100, todo 15 → done 85 → 85% ≥ 80%.
    const deps = {
      countLibraries: countLibrariesFake(15, 100),
      centroidOf: centroidFake,
    }

    const result = await service.runLifecycle(NOW, deps)

    expect(result.closed).toEqual([DRIVE_1])
    const drive = row(store, DRIVE_1)
    expect(drive.status).toBe("closed")
    expect(drive.closedReason).toBe("goal")
    expect(drive.closedAt).toBe(NOW.toISOString())
    expect(drive.final).toEqual({
      total: 100,
      done: 85,
      closedGaps: 85 - 50, // baseline.done was 50
      helpers: 0,
      credits: 0,
    })
    expect(drive.pinned).toBe(false)
    expect(drive.featured).toBe(false)
  })

  it("closes an open drive past its end date, even short of goal", async () => {
    const { service, store } = build({
      [DRIVE]: [
        openDrive(DRIVE_1, {
          goalPercent: 100,
          endsAt: "2026-10-01T00:00:00.000Z",
        }),
      ],
    })
    // total 100, todo 50 → done 50 → 50% < 100%, but endsAt has passed.
    const deps = {
      countLibraries: countLibrariesFake(50, 100),
      centroidOf: centroidFake,
    }

    const result = await service.runLifecycle(NOW, deps)

    expect(result.closed).toEqual([DRIVE_1])
    expect(row(store, DRIVE_1).closedReason).toBe("ended")
  })

  it("leaves an open drive open, short of goal and before its end date", async () => {
    const { service, store } = build({
      [DRIVE]: [
        openDrive(DRIVE_1, {
          goalPercent: 100,
          endsAt: "2027-01-01T00:00:00.000Z",
        }),
      ],
    })
    const deps = {
      countLibraries: countLibrariesFake(60, 100),
      centroidOf: centroidFake,
    }

    const result = await service.runLifecycle(NOW, deps)

    expect(result.closed).toEqual([])
    expect(row(store, DRIVE_1).status).toBe("open")
  })
})

describe("runLifecycle: daily snapshot", () => {
  it("appends one progressLog entry per UTC day for an open drive that isn't closing", async () => {
    const { service, store } = build({
      [DRIVE]: [
        openDrive(DRIVE_1, {
          goalPercent: 100,
          endsAt: "2027-01-01T00:00:00.000Z",
          progressLog: [],
        }),
      ],
    })
    const deps = {
      countLibraries: countLibrariesFake(60, 100),
      centroidOf: centroidFake,
    }

    await service.runLifecycle(NOW, deps)

    expect(row(store, DRIVE_1).progressLog).toEqual([
      { day: "2026-10-06", total: 100, done: 40, inReview: 0 },
    ])

    // A second run the same day doesn't add a second entry.
    await service.runLifecycle(NOW, deps)
    expect(row(store, DRIVE_1).progressLog).toHaveLength(1)

    // The next day does.
    const tomorrow = new Date("2026-10-07T09:00:00.000Z")
    await service.runLifecycle(tomorrow, deps)
    expect(row(store, DRIVE_1).progressLog).toHaveLength(2)
  })

  it("keeps at most 90 progressLog entries", async () => {
    const oldLog = Array.from({ length: 90 }, (_, i) => ({
      day: `2026-01-${String((i % 28) + 1).padStart(2, "0")}`,
      total: 100,
      done: i,
      inReview: 0,
    }))
    const { service, store } = build({
      [DRIVE]: [
        openDrive(DRIVE_1, {
          goalPercent: 100,
          endsAt: "2027-01-01T00:00:00.000Z",
          progressLog: oldLog,
        }),
      ],
    })
    const deps = {
      countLibraries: countLibrariesFake(60, 100),
      centroidOf: centroidFake,
    }

    await service.runLifecycle(NOW, deps)

    expect(row(store, DRIVE_1).progressLog).toHaveLength(90)
    expect(row(store, DRIVE_1).progressLog.at(-1)).toMatchObject({
      day: "2026-10-06",
    })
  })
})

// ── act("open") / act("close") ──────────────────────────────────────────────

describe("act: open and close", () => {
  it("opens a scheduled drive immediately, bypassing startsAt", async () => {
    const { service, store } = build({
      [DRIVE]: [
        scheduledDrive(DRIVE_1, { startsAt: "2027-01-01T00:00:00.000Z" }),
      ],
    })
    const fetchMock = vi.fn(async (_url: unknown, init: RequestInit) => {
      const body = JSON.parse(init.body as string)
      if (body.facets)
        return Response.json({ facetDistribution: { locale: { en: 12 } } })

      return Response.json({ hits: [{ _geo: { lat: 51.5, lng: -0.1 } }] })
    })
    vi.stubGlobal("fetch", fetchMock)

    const result: any = await service.act(DRIVE_1, "open")

    expect("errors" in result).toBe(false)
    expect(result.data.status).toBe("open")
    expect(result.data.baseline.total).toBe(12)
    expect(row(store, DRIVE_1).status).toBe("open")
  })

  it("refuses to open a drive that isn't scheduled (409)", async () => {
    const { service } = build({ [DRIVE]: [openDrive(DRIVE_1)] })

    const result: any = await service.act(DRIVE_1, "open")

    expect(result.status).toBe(409)
    expect(result.errors[0]).toMatch(/must be scheduled/)
  })

  it("refuses to open a drive held by too many/too few tasks (409)", async () => {
    const { service, store } = build({
      [DRIVE]: [
        scheduledDrive(DRIVE_1, { startsAt: "2026-09-01T00:00:00.000Z" }),
      ],
    })
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({ facetDistribution: { locale: { en: 0 } } })
      )
    )

    const result: any = await service.act(DRIVE_1, "open")

    expect(result.status).toBe(409)
    expect(row(store, DRIVE_1).status).toBe("scheduled")
  })

  it("closes an open drive with closedReason 'ended', even when the goal is met", async () => {
    const { service, store } = build({
      [DRIVE]: [openDrive(DRIVE_1, { goalPercent: 1 })],
    })
    const fetchMock = vi.fn(async (_url: unknown, init: RequestInit) => {
      const body = JSON.parse(init.body as string)
      const isTodo =
        typeof body.filter === "string" && body.filter.includes("needs IN")

      return Response.json({
        facetDistribution: { locale: { en: isTodo ? 1 : 100 } },
      })
    })
    vi.stubGlobal("fetch", fetchMock)

    const result: any = await service.act(DRIVE_1, "close")

    expect("errors" in result).toBe(false)
    expect(result.data.status).toBe("closed")
    expect(result.data.closedReason).toBe("ended")
    expect(row(store, DRIVE_1).final.done).toBe(99)
  })

  it("refuses to close a drive that isn't open (409)", async () => {
    const { service } = build({ [DRIVE]: [scheduledDrive(DRIVE_1)] })

    const result: any = await service.act(DRIVE_1, "close")

    expect(result.status).toBe(409)
    expect(result.errors[0]).toMatch(/must be open/)
  })
})

// ── POST /drives/lifecycle/run (board gate) ─────────────────────────────────

function ctx({
  secret = "s3cret",
  baUserId,
}: { secret?: string | null; baUserId?: string } = {}) {
  const headers: Record<string, string> = {}
  if (secret !== null) headers["x-service-secret"] = secret
  if (baUserId) headers["x-ba-user-id"] = baUserId
  const c: any = { request: { headers }, params: {}, query: {} }
  const setStatus = (status: number) => (message?: string) => {
    c.status = status
    c.body = { data: null, error: { status, message } }
  }
  c.unauthorized = setStatus(401)
  c.forbidden = setStatus(403)

  return c
}

const BOARD_GRANT = (baUserId: string) => ({
  documentId: `rg-${baUserId}`,
  baUserId,
  role: "editorial_board",
  queue: "all",
  scopeLocale: null,
  expiresAt: null,
})

describe("drive lifecycle board gate (controller)", () => {
  it("refuses without the bridge secret (401)", async () => {
    const { controller } = build()
    const c = ctx({ secret: null })

    await controller.runLifecycle(c)

    expect(c.status).toBe(401)
  })

  it("refuses a non-board caller (403)", async () => {
    const { controller } = build({
      [ROLE_GRANT]: [
        {
          documentId: "rg1",
          baUserId: "mod-1",
          role: "moderator",
          queue: "index",
          scopeLocale: null,
          expiresAt: null,
        },
      ],
    })
    const c = ctx({ baUserId: "mod-1" })

    await controller.runLifecycle(c)

    expect(c.status).toBe(403)
  })

  it("runs the lifecycle for a board caller and reports what moved", async () => {
    const { controller, store } = build({
      [DRIVE]: [
        scheduledDrive(DRIVE_1, { startsAt: "2026-09-01T00:00:00.000Z" }),
      ],
      [ROLE_GRANT]: [BOARD_GRANT("board-1")],
    })
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: unknown, init: RequestInit) => {
        const body = JSON.parse(init.body as string)
        if (body.facets)
          return Response.json({ facetDistribution: { locale: { en: 20 } } })

        return Response.json({ hits: [] })
      })
    )
    const c = ctx({ baUserId: "board-1" })

    await controller.runLifecycle(c)

    expect(c.status).toBeUndefined()
    expect(c.body.data.opened).toEqual([DRIVE_1])
    expect(row(store, DRIVE_1).status).toBe("open")
  })
})
