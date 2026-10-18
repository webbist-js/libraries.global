import {
  emptyTimetable,
  type MobileTimetable,
  type TimetableNotice,
} from "@repo/shared-data"
import { afterEach, describe, expect, it, vi } from "vitest"

import { makeFakeStrapi as makeBaseFakeStrapi } from "./helpers/fake-strapi"
import {
  mobileBoundaryNeedsRefresh,
  mobileStopDocuments,
  refreshMobileAtLocalMidnight,
  registerMobileStopIndex,
  syncMobileStops,
} from "../src/utils/mobile-stop-index"

const ID = "mobile00000000000000001",
  LIBRARY = "api::library.library"
function makeFakeStrapi(...args: Parameters<typeof makeBaseFakeStrapi>) {
  const made = makeBaseFakeStrapi(...args)
  const original = made.strapi.db.connection
  const metadata = made.strapi.db.metadata.get
  made.strapi.db.metadata.get = (uid: string) =>
    uid === LIBRARY
      ? {
          tableName: "libraries",
          attributes: {
            libraryType: {
              joinTable: {
                name: "libraries_library_type_lnk",
                joinColumn: { name: "library_id" },
                inverseJoinColumn: { name: "library_type_id" },
              },
            },
          },
        }
      : uid === "api::library-type.library-type"
        ? { tableName: "library_types", attributes: {} }
        : metadata(uid)
  made.strapi.db.connection = (table: string) => {
    if (table !== "libraries as l") return original(table)
    const query = {
      join: vi.fn(() => query),
      where: vi.fn(() => query),
      whereNotNull: vi.fn(() => query),
      distinct: vi.fn(() =>
        [
          ...new Set(
            (made.store[LIBRARY] ?? [])
              .filter(
                (row) =>
                  row.publishedAt &&
                  (typeof row.libraryType === "string"
                    ? row.libraryType
                    : row.libraryType?.name) === "Mobile"
              )
              .map((row) => row.timezone)
          ),
        ].map((timezone) => ({ timezone }))
      ),
    }

    return query
  }

  return made
}
const tt: MobileTimetable = {
  ...emptyTimetable("2026-10-05"),
  stops: [
    {
      id: "stop000001",
      name: "Ford Cross",
      where: "Lay-by",
      location: { lat: 51, lng: 0 },
      areaDocumentId: "area0000000000000000001",
    },
    {
      id: "stop000002",
      name: "Unused",
      where: "",
      location: null,
      areaDocumentId: null,
    },
  ],
  visits: [
    {
      id: "visit00001",
      stopId: "stop000001",
      day: "mon",
      arrive: "09:00",
      depart: "09:30",
      repeat: { kind: "cycle", weeks: [1] },
      termTimeOnly: false,
      validFrom: null,
      validTo: null,
    },
  ],
}
const library = {
  documentId: ID,
  name: "Vehicle one",
  slug: "vehicle-one",
  libraryType: { name: "Mobile" },
  operationalStatus: "open",
  timezone: "UTC",
  mobileTimetable: tt,
  continent: { slug: "europe" },
  country: { slug: "united-kingdom" },
  region: { slug: "example" },
  privateEmail: "hidden@example.org",
  baUserId: "hidden-user",
}
/** The vehicle as a published row: the midnight sweep reads the table directly. */
const mobileRow = {
  ...library,
  id: 1,
  publishedAt: "2026-01-01T00:00:00.000Z",
}
const NOTICE = "api::library-notice.library-notice"
/** Every `findMany` query made against `uid`, across the fake's handles. */
const readsOf = (strapi: any, uid: string): any[] =>
  strapi.documents.mock.calls.flatMap(([u]: [string], i: number) =>
    u === uid
      ? strapi.documents.mock.results[i].value.findMany.mock.calls.map(
          ([q]: [any]) => q ?? {}
        )
      : []
  )
const notice: TimetableNotice = {
  id: "notice",
  type: "not_running",
  scope: "service",
  scopeWeek: null,
  scopeDay: null,
  stopId: null,
  from: "2026-10-05",
  to: "2026-10-05",
  endedAt: null,
  message: "Maintenance",
  reason: "maintenance",
}
afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})
describe("mobile stop index", () => {
  it("refreshes rolling cancellations throughout a long not-running notice", () => {
    const longNotice = { ...notice, from: "2026-01-01", to: "2026-12-31" }
    expect(mobileBoundaryNeedsRefresh(tt, [longNotice], "2026-10-06")).toBe(
      true
    )
    expect(
      mobileBoundaryNeedsRefresh(
        tt,
        [{ ...longNotice, endedAt: "2026-10-05T10:00:00Z" }],
        "2026-10-06"
      )
    ).toBe(false)
    expect(
      mobileBoundaryNeedsRefresh(
        tt,
        [{ ...longNotice, type: "times_changed" }],
        "2026-10-06"
      )
    ).toBe(false)
  })
  it("indexes used mapped stops, without any private record fields", () => {
    const docs = mobileStopDocuments(
      library,
      [notice],
      "2026-10-05",
      true,
      new Map([["area0000000000000000001", { slug: "ford", name: "Ford" }]])
    )
    expect(docs).toHaveLength(1)
    expect(docs[0]).toMatchObject({
      id: `${ID}_stop000001`,
      area_slug: "ford",
      _geo: { lat: 51, lng: 0 },
      cancelled_dates: ["2026-10-05"],
      shares_live: true,
      frequencies: ["weekly"],
      library_path: "/europe/united-kingdom/example/vehicle-one",
      visit_keys: expect.arrayContaining(["c1.0.mon"]),
    })
    expect(JSON.stringify(docs)).not.toContain("hidden")
    expect(
      mobileStopDocuments(
        { ...library, libraryType: "Public" },
        [],
        "2026-10-05"
      )
    ).toEqual([])
    expect(
      mobileStopDocuments(
        { ...library, operationalStatus: "permanently_closed" },
        [],
        "2026-10-05"
      )
    ).toEqual([])
  })
  it("replaces only the selected vehicle's documents and removes stale stops", async () => {
    vi.stubEnv("MEILISEARCH_MASTER_KEY", "test-index-key")
    const fetcher = vi.fn(async (_url: unknown, _init?: RequestInit) =>
      Response.json({ taskUid: 1 }, { status: 202 })
    )
    vi.stubGlobal("fetch", fetcher)
    const { strapi } = makeFakeStrapi({ [LIBRARY]: [library] })
    ;(strapi as any).config = {
      get: () => ({ host: "http://meili.test", apiKey: "test-index-key" }),
    }
    await syncMobileStops(strapi, ID)
    expect(fetcher).toHaveBeenCalledTimes(2)
    expect(fetcher.mock.calls[0]![1]).toMatchObject({
      method: "POST",
      body: JSON.stringify({ filter: `library_document_id = "${ID}"` }),
    })
    expect(fetcher.mock.calls[1]![1]).toMatchObject({ method: "PUT" })
    const docs = JSON.parse(
      (fetcher.mock.calls[1]![1] as RequestInit).body as string
    )
    expect(docs[0].id).toBe(`${ID}_stop000001`)
  })
  it("detects validity starts, inclusive ends and open-ended notice expiry", () => {
    expect(
      mobileBoundaryNeedsRefresh(
        { ...tt, visits: [{ ...tt.visits[0]!, validFrom: "2026-10-06" }] },
        [],
        "2026-10-06"
      )
    ).toBe(true)
    expect(
      mobileBoundaryNeedsRefresh(
        { ...tt, visits: [{ ...tt.visits[0]!, validTo: "2026-10-05" }] },
        [],
        "2026-10-06"
      )
    ).toBe(true)
    expect(mobileBoundaryNeedsRefresh(tt, [notice], "2026-10-06")).toBe(true)
    expect(
      mobileBoundaryNeedsRefresh(tt, [{ ...notice, to: null }], "2026-11-04")
    ).toBe(true)
    expect(mobileBoundaryNeedsRefresh(tt, [], "2026-10-06")).toBe(false)
  })
  it("uses the installed Meili SDK method to refresh Monday frames only at local midnight", async () => {
    const made = makeFakeStrapi(
        { [LIBRARY]: [mobileRow] },
        { tables: { libraries: LIBRARY } }
      ),
      update = vi.fn()
    made.services["meilisearch.meilisearch"] = {
      updateEntriesInMeilisearch: update,
    }
    await refreshMobileAtLocalMidnight(
      made.strapi,
      new Date("2026-10-05T00:07:00Z")
    )
    expect(update).toHaveBeenCalledWith({
      contentType: LIBRARY,
      entries: [mobileRow],
    })
    update.mockClear()
    await refreshMobileAtLocalMidnight(
      made.strapi,
      new Date("2026-10-05T13:07:00Z")
    )
    await refreshMobileAtLocalMidnight(
      made.strapi,
      new Date("2026-10-06T00:07:00Z")
    )
    expect(update).not.toHaveBeenCalled()
  })
  it("reads only the zones at local midnight, by keyset, with one notices query per page (1.6)", async () => {
    const london = {
      ...mobileRow,
      id: 2,
      documentId: "mobile00000000000000002",
      timezone: "Europe/London",
    }
    const made = makeFakeStrapi(
      { [LIBRARY]: [mobileRow, london] },
      { tables: { libraries: LIBRARY } }
    )
    const update = vi.fn()
    made.services["meilisearch.meilisearch"] = {
      updateEntriesInMeilisearch: update,
    }
    await refreshMobileAtLocalMidnight(
      made.strapi,
      new Date("2026-10-05T00:07:00Z")
    )
    // London is at 01:07 BST: only the UTC vehicle is read and refreshed.
    expect(update).toHaveBeenCalledExactlyOnceWith({
      contentType: LIBRARY,
      entries: [mobileRow],
    })
    const pages = readsOf(made.strapi, LIBRARY).filter((q) => q.filters?.id)
    expect(pages).toEqual([
      expect.objectContaining({
        filters: {
          libraryType: { name: "Mobile" },
          id: { $gt: 0 },
          $or: [{ timezone: { $in: ["UTC"] } }],
        },
        sort: "id:asc",
        limit: 100,
      }),
    ])
    expect(readsOf(made.strapi, NOTICE)).toHaveLength(1)
  })
  it("walks a long list of vehicles by id, a notices batch a page", async () => {
    const rows = Array.from({ length: 101 }, (_, i) => ({
      ...mobileRow,
      id: i + 1,
      documentId: `mobile${String(i + 1).padStart(17, "0")}`,
    }))
    const made = makeFakeStrapi(
      { [LIBRARY]: rows },
      { tables: { libraries: LIBRARY } }
    )
    made.services["meilisearch.meilisearch"] = {
      updateEntriesInMeilisearch: vi.fn(),
    }
    // A Tuesday with no boundary: nothing refreshes, the paging is observed.
    await refreshMobileAtLocalMidnight(
      made.strapi,
      new Date("2026-10-06T00:07:00Z")
    )
    expect(
      readsOf(made.strapi, LIBRARY)
        .filter((q) => q.filters?.id)
        .map((q) => q.filters.id.$gt)
    ).toEqual([0, 100])
    expect(readsOf(made.strapi, NOTICE)).toHaveLength(2)
    expect(
      made.services["meilisearch.meilisearch"].updateEntriesInMeilisearch
    ).not.toHaveBeenCalled()
  })
  it("the sync middleware makes no network call unless the library is, or was, Mobile (2.7)", async () => {
    vi.stubEnv("MEILISEARCH_MASTER_KEY", "test-index-key")
    const fetcher = vi.fn(async () =>
      Response.json({ taskUid: 1 }, { status: 202 })
    )
    vi.stubGlobal("fetch", fetcher)
    const branch = {
      documentId: "branch00000000000000001",
      id: 9,
      libraryType: "Public",
      name: "Branch",
      publishedAt: mobileRow.publishedAt,
    }
    const { strapi } = makeFakeStrapi(
      { [LIBRARY]: [mobileRow, branch] },
      { tables: { libraries: LIBRARY } }
    )
    ;(strapi as any).config = {
      get: () => ({ host: "http://meili.test", apiKey: "test-index-key" }),
    }
    let middleware: any
    strapi.documents.use = vi.fn((mw: any) => {
      middleware = mw
    })
    strapi.cron = { add: vi.fn() }
    registerMobileStopIndex(strapi)
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(strapi.cron.add).toHaveBeenCalledOnce()
    fetcher.mockClear()
    const renamed = await middleware(
      {
        uid: LIBRARY,
        action: "update",
        params: { documentId: branch.documentId, data: { name: "Renamed" } },
      },
      async () => ({ ...branch, name: "Renamed" })
    )
    expect(renamed.name).toBe("Renamed")
    expect(fetcher).not.toHaveBeenCalled()
    expect(strapi.db.query).not.toHaveBeenCalled()
    // A result without the type costs one indexed column read, still no network.
    await middleware(
      {
        uid: LIBRARY,
        action: "publish",
        params: { documentId: branch.documentId },
      },
      async () => ({ documentId: branch.documentId })
    )
    expect(strapi.db.query).toHaveBeenCalledWith(LIBRARY)
    expect(fetcher).not.toHaveBeenCalled()
    // A vehicle reaches Meilisearch.
    await middleware(
      {
        uid: LIBRARY,
        action: "update",
        params: { documentId: ID, data: { name: "Vehicle" } },
      },
      async () => ({ ...mobileRow, name: "Vehicle" })
    )
    expect(fetcher).toHaveBeenCalled()
  })
})
