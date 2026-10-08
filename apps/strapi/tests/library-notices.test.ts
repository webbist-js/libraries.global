import {
  noticeIsActive,
  noticeIsUpcoming,
  effectiveLibraryHours,
  closedNoticeDates,
  type LibraryNotice,
} from "@repo/shared-data"
import { describe, expect, it, vi } from "vitest"

import { makeFakeStrapi } from "./helpers/fake-strapi"
import noticeController from "../src/api/library-notice/controllers/library-notice"
import createNotices from "../src/plugins/library-staff/server/notices-service"
import {
  forgetIndexedNotices,
  normalizeNotice,
  publicNotice,
  noticesForIndexing,
  noticesForLibraries,
  noticesForLibrary,
  refreshBranchNoticesAtMidnight,
} from "../src/utils/library-notices"

const id = "library00000000000000001",
  LIB = "api::library.library",
  AFF = "api::library-affiliation.library-affiliation",
  NOTICE = "api::library-notice.library-notice"
const branch = {
  documentId: id,
  name: "Test library",
  libraryType: "Public",
  timezone: "Europe/London",
}
const base = {
  type: "closure",
  scope: "library",
  from: "2026-10-06",
  to: null,
  message: "Closed for maintenance",
}
const notice: LibraryNotice = {
  id: "notice",
  ...base,
  type: "closure",
  scope: "library",
  endedAt: null,
  scopeDay: null,
  scopeWeek: null,
  stopId: null,
  reason: null,
}
describe("library notices", () => {
  it("refreshes each affected branch once at its local midnight", async () => {
    const utc = { ...branch, documentId: "utc-branch", timezone: "UTC" }
    const mobile = { ...branch, documentId: "mobile", libraryType: "Mobile" }
    const f = makeFakeStrapi({
      [LIB]: [branch, utc, mobile],
      [NOTICE]: [branch, branch, utc, mobile].map((library, i) => ({
        ...base,
        documentId: `notice-${i}`,
        endedAt: null,
        library,
      })),
    })
    const update = vi.fn()
    f.services["meilisearch.meilisearch"] = {
      updateEntriesInMeilisearch: update,
    }
    await refreshBranchNoticesAtMidnight(
      f.strapi,
      new Date("2026-10-06T23:12:00Z")
    )
    expect(update).toHaveBeenCalledExactlyOnceWith({
      contentType: LIB,
      entries: [branch],
    })
    update.mockClear()
    await refreshBranchNoticesAtMidnight(
      f.strapi,
      new Date("2026-10-07T12:12:00Z")
    )
    expect(update).not.toHaveBeenCalled()
  })
  it("keeps naturally expired notices in the staff's past 30 days, without serving them publicly", async () => {
    const f = makeFakeStrapi({
      [LIB]: [branch],
      [NOTICE]: [
        {
          documentId: "recent-expired",
          ...base,
          from: "2026-09-01",
          to: "2026-09-30",
          library: { documentId: id },
        },
        {
          documentId: "old-expired",
          ...base,
          from: "2026-08-01",
          to: "2026-09-01",
          library: { documentId: id },
        },
        {
          documentId: "default-expired",
          ...base,
          from: "2026-08-09",
          library: { documentId: id },
        },
      ],
    })
    const now = new Date("2026-10-06T12:00:00Z")
    expect(
      (await noticesForLibrary(f.strapi, id, now, true)).map((n) => n.id)
    ).toEqual(["default-expired", "recent-expired"])
    expect(await noticesForLibrary(f.strapi, id, now)).toEqual([])
  })
  it("has an inclusive 30-day open-ended window", () => {
    expect(noticeIsActive(notice, "2026-11-04")).toBe(true)
    expect(noticeIsActive(notice, "2026-11-05")).toBe(false)
    expect(noticeIsUpcoming(notice, "2026-10-01")).toBe(true)
    expect(noticeIsUpcoming(notice, "2026-09-01")).toBe(false)
  })
  it("ends immediately and closes hours only on its dates", () => {
    expect(effectiveLibraryHours({}, [notice], "2026-10-06").closed).toBe(true)
    expect(
      effectiveLibraryHours(
        {},
        [{ ...notice, endedAt: "2026-10-06T10:00:00Z" }],
        "2026-10-06"
      ).closed
    ).toBe(false)
    expect(closedNoticeDates([notice], "2026-11-04", 2)).toEqual(["2026-11-04"])
  })
  it("uses temporary hours only while active", () => {
    const hours = { days: [] }
    expect(
      effectiveLibraryHours(
        null,
        [{ ...notice, type: "changed_hours", hours }],
        "2026-10-06"
      ).hours
    ).toBe(hours)
    expect(
      effectiveLibraryHours(
        null,
        [{ ...notice, type: "changed_hours", hours }],
        "2026-11-05"
      ).hours
    ).toBe(null)
    expect(
      closedNoticeDates(
        [{ ...notice, type: "changed_hours", hours }],
        "2026-10-06",
        2
      )
    ).toEqual([])
  })
  it("validates branch types, dates and safe public messages", () => {
    expect(normalizeNotice(base, branch)).toMatchObject({
      type: "closure",
      scope: "library",
    })
    expect(() => normalizeNotice({ ...base, message: "" }, branch)).toThrow(
      "Write the message"
    )
    expect(() =>
      normalizeNotice({ ...base, from: "2026-02-30" }, branch)
    ).toThrow()
    expect(() =>
      normalizeNotice({ ...base, message: "visit https://porn.xxx" }, branch)
    ).toThrow()
    expect(() =>
      normalizeNotice({ ...base, type: "not_running" }, branch)
    ).toThrow()
  })
  it("validates mobile scopes against real timetable weeks and stops", () => {
    const mobile = {
      ...branch,
      libraryType: "Mobile",
      mobileTimetable: { cycle: { weeks: 2 }, stops: [{ id: "stop000001" }] },
    }
    expect(
      normalizeNotice(
        { ...base, type: "not_running", scope: "stop", stopId: "stop000001" },
        mobile
      )
    ).toMatchObject({ stopId: "stop000001" })
    expect(() =>
      normalizeNotice(
        { ...base, type: "not_running", scope: "stop", stopId: "unknown" },
        mobile
      )
    ).toThrow()
    expect(() =>
      normalizeNotice(
        { ...base, type: "stop_moved", scope: "term_time" },
        mobile
      )
    ).toThrow()
    expect(() =>
      normalizeNotice(
        {
          ...base,
          type: "not_running",
          scope: "day",
          scopeWeek: 3,
          scopeDay: "mon",
        },
        mobile
      )
    ).toThrow()
  })
  it("keeps all actors out of public responses", () => {
    expect(
      publicNotice({
        ...base,
        documentId: "notice",
        createdByBaUserId: "private-user",
        endedByBaUserId: "private-user",
        createdBy: { email: "private@example.org" },
      })
    ).not.toHaveProperty("createdByBaUserId")
    expect(
      JSON.stringify(
        publicNotice({
          ...base,
          documentId: "notice",
          createdByBaUserId: "private-user",
        })
      )
    ).not.toContain("private-user")
  })
  it("returns 404 to non-staff and proposer affiliations", async () => {
    const f = makeFakeStrapi({
      [LIB]: [branch],
      [AFF]: [
        {
          documentId: "affiliation0000000000001",
          baUserId: "proposer",
          library: { documentId: id },
          role: "proposer",
        },
      ],
    })
    const service = createNotices({ strapi: f.strapi })
    await expect(
      service.createNotice({
        libraryDocumentId: id,
        baUserId: "stranger",
        ...base,
      })
    ).rejects.toMatchObject({ status: 404 })
    await expect(
      service.createNotice({
        libraryDocumentId: id,
        baUserId: "proposer",
        ...base,
      })
    ).rejects.toMatchObject({ status: 404 })
  })
  it("publishes notices and audits them for a free staff member", async () => {
    const f = makeFakeStrapi({
      [LIB]: [branch],
      [AFF]: [
        {
          documentId: "affiliation0000000000001",
          baUserId: "staff",
          library: { documentId: id },
          role: "Librarian",
          approvedAt: "2026-01-01",
          staffRole: "editor",
        },
      ],
    })
    const result = await createNotices({ strapi: f.strapi }).createNotice({
      libraryDocumentId: id,
      baUserId: "staff",
      ...base,
    })
    expect(result.notice.message).toBe(base.message)
    expect(f.store[NOTICE]![0]).toMatchObject({
      source: "staff",
      createdByBaUserId: "staff",
    })
    expect(f.store["plugin::library-staff.staff-audit"]![0]).toMatchObject({
      action: "notice_created",
      actor: "staff",
    })
  })
  it("public list includes active and upcoming notices but excludes expired and ended", async () => {
    const f = makeFakeStrapi({
      [LIB]: [branch],
      [NOTICE]: [
        { documentId: "active", ...base, library: { documentId: id } },
        {
          documentId: "expired",
          ...base,
          from: "2026-01-01",
          library: { documentId: id },
        },
        {
          documentId: "upcoming",
          ...base,
          from: "2026-10-10",
          library: { documentId: id },
        },
        {
          documentId: "ended",
          ...base,
          endedAt: "2026-10-05T12:00:00Z",
          library: { documentId: id },
        },
      ],
    })
    expect(
      (
        await noticesForLibrary(f.strapi, id, new Date("2026-10-06T12:00:00Z"))
      ).map((n) => n.id)
    ).toEqual(["active", "upcoming"])
  })
  it("loads many libraries' active notices in two queries, judged by each library's own date", async () => {
    const paris = {
      ...branch,
      documentId: "paris0000000000000000001",
      timezone: "Europe/Paris",
    }
    const unpublished = "unpublished000000000001"
    const f = makeFakeStrapi({
      [LIB]: [
        branch,
        paris,
        { ...branch, documentId: unpublished, publishedAt: null },
      ],
      [NOTICE]: [
        { documentId: "london-active", ...base, library: { documentId: id } },
        {
          documentId: "london-ended",
          ...base,
          endedAt: "2026-10-01T00:00:00Z",
          library: { documentId: id },
        },
        {
          documentId: "paris-upcoming",
          ...base,
          from: "2026-10-10",
          library: { documentId: paris.documentId },
        },
        {
          documentId: "paris-old",
          ...base,
          from: "2026-01-01",
          to: "2026-01-02",
          library: { documentId: paris.documentId },
        },
        {
          documentId: "unpublished-notice",
          ...base,
          library: { documentId: unpublished },
        },
      ],
    })
    const result = await noticesForLibraries(
      f.strapi,
      [id, paris.documentId, unpublished, id],
      new Date("2026-10-06T12:00:00Z")
    )
    expect([...result.keys()].sort()).toEqual([id, paris.documentId].sort())
    expect(result.get(id)!.map((n) => n.id)).toEqual(["london-active"])
    expect(result.get(paris.documentId)!.map((n) => n.id)).toEqual([
      "paris-upcoming",
    ])
    expect(
      f.strapi.documents.mock.calls.filter(([uid]: [string]) => uid === NOTICE)
    ).toHaveLength(1)
    expect(await noticesForLibraries(f.strapi, [])).toEqual(new Map())
  })
  it("answers the index's per-entry reads with one query a batch, cached until a notice changes (1.7)", async () => {
    forgetIndexedNotices(id)
    const f = makeFakeStrapi({
      [LIB]: [branch],
      [NOTICE]: [
        { documentId: "active", ...base, library: { documentId: id } },
      ],
    })
    const noticeQueries = () =>
      f.strapi.documents.mock.calls.filter(([uid]: [string]) => uid === NOTICE)
        .length
    // The plugin asks once per locale, in the same tick.
    const [en, fr] = await Promise.all([
      noticesForIndexing(f.strapi, id),
      noticesForIndexing(f.strapi, id),
    ])
    expect(en.map((n) => n.id)).toEqual(["active"])
    expect(fr).toEqual(en)
    expect(noticeQueries()).toBe(1)
    await noticesForIndexing(f.strapi, id)
    expect(noticeQueries()).toBe(1)
    f.store[NOTICE]![0]!.endedAt = "2026-10-06T10:00:00Z"
    forgetIndexedNotices(id)
    expect(await noticesForIndexing(f.strapi, id)).toEqual([])
    expect(noticeQueries()).toBe(2)
  })
  it("serves the seed up to 100 libraries' notices in one request", async () => {
    const f = makeFakeStrapi({
      [LIB]: [branch],
      [NOTICE]: [
        { documentId: "active", ...base, library: { documentId: id } },
      ],
    })
    ;(globalThis as any).strapi = f.strapi
    try {
      const ctx: any = {
        query: { ids: `${id},${id}` },
        status: 200,
        set: vi.fn(),
      }
      await noticeController.forLibraries(ctx)
      expect(ctx.status).toBe(200)
      expect(Object.keys(ctx.body.data)).toEqual([id])
      expect(ctx.body.data[id].map((n: any) => n.id)).toEqual(["active"])
      expect(ctx.set).toHaveBeenCalledWith(
        "Cache-Control",
        expect.stringContaining("max-age=60")
      )
      for (const ids of [
        "",
        "not-an-id",
        Array.from(
          { length: 101 },
          (_, i) => `library${String(i).padStart(17, "0")}`
        ).join(","),
      ]) {
        const bad: any = { query: { ids }, status: 200, set: vi.fn() }
        await noticeController.forLibraries(bad)
        expect(bad.status).toBe(400)
      }
    } finally {
      delete (globalThis as any).strapi
    }
  })
})
