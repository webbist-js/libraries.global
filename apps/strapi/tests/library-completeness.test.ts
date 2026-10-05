import { describe, expect, it, vi } from "vitest"

import {
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
