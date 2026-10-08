import type { LibraryNotice } from "@repo/shared-data"
import { describe, expect, it, vi } from "vitest"

import { openNow, type AtlasLibrary } from "@/components/atlas/atlas.logic"
import { openStatus } from "@/components/index-page/find-helpers"
import { openNowFilter } from "@/lib/find-search"

import { getOpenStatus } from "../library-page.helpers"

vi.mock("@/lib/meilisearch", () => ({
  meiliClient: {},
  searchLocale: (v: string) => v,
  searchLocaleFilter: () => "",
}))

const now = new Date("2026-10-06T12:00:00Z")
const hours: any = {
  version: 1,
  days: [
    {
      day: "tuesday",
      enabled: true,
      timeframes: [
        {
          id: "frame",
          startTime: "09:00",
          endTime: "17:00",
          staffing: "staffed",
        },
      ],
    },
  ],
}
const closure: LibraryNotice = {
  id: "notice",
  type: "closure",
  scope: "library",
  from: "2026-10-06",
  to: "2026-10-06",
  scopeWeek: null,
  scopeDay: null,
  stopId: null,
  message: "Closed for maintenance",
  endedAt: null,
  reason: "maintenance",
}
describe("notices change public opening status", () => {
  it("closes an otherwise open branch in the page, Find and Atlas", () => {
    expect(getOpenStatus(hours, "Europe/London", now, [closure])).toEqual({
      state: "closed",
      label: "Closed today",
    })
    expect(openStatus(hours, "Europe/London", now, [closure])).toEqual({
      known: true,
      open: false,
    })
    expect(
      openNow(
        {
          hours: [[], [[540, 1020]], [], [], [], [], []],
          tz: "Europe/London",
          notices: [closure],
        } as unknown as AtlasLibrary,
        now
      )
    ).toBe("closed")
  })
  it("uses temporary changed hours in all three status helpers", () => {
    const notice = {
      ...closure,
      type: "changed_hours" as const,
      hours: {
        ...hours,
        days: [
          {
            day: "tuesday",
            enabled: true,
            timeframes: [{ startTime: "14:00", endTime: "16:00" }],
          },
        ],
      },
    }
    expect(getOpenStatus(hours, "Europe/London", now, [notice]).state).toBe(
      "closed"
    )
    expect(openStatus(hours, "Europe/London", now, [notice]).open).toBe(false)
    expect(
      openNow(
        {
          hours: [[], [[540, 1020]], [], [], [], [], []],
          tz: "Europe/London",
          notices: [notice],
        } as unknown as AtlasLibrary,
        now
      )
    ).toBe("closed")
  })
  it("excludes each timezone’s local closed date from the Meili filter", () => {
    const filter = openNowFilter(
      ["Pacific/Auckland", "America/Los_Angeles"],
      new Date("2026-10-06T23:30:00Z")
    )
    expect(filter).toContain('NOT closed_dates = "2026-10-07"')
    expect(filter).toContain('NOT closed_dates = "2026-10-06"')
  })
})
