import { describe, expect, it, vi } from "vitest"

import { makeFakeStrapi } from "./helpers/fake-strapi"
import {
  backfillLibraryCompleteness,
  COMPLETENESS_FIELDS,
  computeCompleteness,
  computeGaps,
  refreshLibraryCompleteness,
} from "../src/utils/library-completeness"

const hours = {
  days: [
    {
      day: "monday",
      enabled: true,
      timeframes: [{ startTime: "09:00", endTime: "17:00" }],
    },
  ],
}

describe("library completeness and gaps", () => {
  it("reads absentFacilities, so a confirmed No can fill accessibility", () => {
    expect(COMPLETENESS_FIELDS).toContain("absentFacilities")
  })

  it("scores from the registry", () => {
    expect(computeCompleteness({ openingTimes: hours, website: "x" })).toBe(25)
    expect(computeGaps({ openingTimes: hours })).not.toContain("hours")
    expect(computeGaps({})).toContain("accessibility")
  })

  it("stores completeness and gaps together when either changed", async () => {
    const update = vi.fn(async () => ({}))
    const strapi: any = {
      documents: () => ({
        findOne: vi.fn(async () => ({ openingTimes: hours })),
      }),
      db: { query: () => ({ update }) },
      log: { warn: vi.fn() },
    }

    await refreshLibraryCompleteness(strapi, {
      id: 7,
      documentId: "lib1",
      locale: "en",
      publishedAt: null,
      completeness: 13,
      gaps: null,
    })

    expect(update).toHaveBeenCalledWith({
      where: { id: 7 },
      data: {
        completeness: 13,
        gaps: computeGaps({ openingTimes: hours }),
      },
    })
  })

  it("writes nothing when both are unchanged", async () => {
    const update = vi.fn(async () => ({}))
    const strapi: any = {
      documents: () => ({
        findOne: vi.fn(async () => ({ openingTimes: hours })),
      }),
      db: { query: () => ({ update }) },
      log: { warn: vi.fn() },
    }

    await refreshLibraryCompleteness(strapi, {
      id: 7,
      documentId: "lib1",
      locale: "en",
      publishedAt: null,
      completeness: 13,
      gaps: computeGaps({ openingTimes: hours }),
    })

    expect(update).not.toHaveBeenCalled()
  })
})

/** A core-store stand-in: `strapi.store({ type, name }).get/set({ key })`. */
function withStore(strapi: any, initial: Record<string, unknown> = {}) {
  const values = new Map<string, unknown>(Object.entries(initial))
  strapi.store = vi.fn(({ type, name }: { type: string; name: string }) => ({
    get: vi.fn(
      async ({ key }: { key: string }) =>
        values.get(`${type}:${name}:${key}`) ?? null
    ),
    set: vi.fn(async ({ key, value }: { key: string; value: unknown }) => {
      values.set(`${type}:${name}:${key}`, value)
    }),
  }))

  return values
}

const FLAG = "core:library-completeness:backfill-v2-done"
const LIBRARY = "api::library.library"

describe("backfillLibraryCompleteness", () => {
  it("fills rows missing completeness or gaps, and checks again next boot", async () => {
    const { strapi, store } = makeFakeStrapi({
      [LIBRARY]: [
        { id: 1, documentId: "lib1", completeness: null, gaps: null },
        {
          id: 2,
          documentId: "lib2",
          openingTimes: hours,
          completeness: 13,
          gaps: null,
        },
      ],
    })
    const values = withStore(strapi)

    expect(await backfillLibraryCompleteness(strapi)).toBe(2)
    expect(store[LIBRARY]![1]!.gaps).toEqual(
      computeGaps({ openingTimes: hours })
    )
    // It wrote rows, so it isn't marked done until a pass finds none.
    expect(values.has(FLAG)).toBe(false)
  })

  it("marks the backfill done once a full pass writes nothing", async () => {
    const { strapi } = makeFakeStrapi({
      [LIBRARY]: [{ id: 1, documentId: "lib1", completeness: 0, gaps: [] }],
    })
    const values = withStore(strapi)

    expect(await backfillLibraryCompleteness(strapi)).toBe(0)
    expect(values.get(FLAG)).toBeTruthy()
  })

  it("skips the scan once marked done", async () => {
    const { strapi } = makeFakeStrapi({
      [LIBRARY]: [{ id: 1, documentId: "lib1", completeness: null }],
    })
    withStore(strapi, { [FLAG]: { doneAt: "2026-10-05T00:00:00.000Z" } })

    expect(await backfillLibraryCompleteness(strapi)).toBe(0)
    expect(strapi.documents).not.toHaveBeenCalled()
  })
})
