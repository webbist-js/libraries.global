import { describe, expect, it } from "vitest"

import {
  displayHelpers,
  displayProgress,
  driveHref,
  drivePlaceLabel,
  drivePlaceRefs,
  type DriveView,
  filterByFocus,
  focusFilterOptions,
  pickFeatured,
  plainDriveTitle,
  progressMeta,
} from "../drive-view"
import type { Drive } from "../types"

const drive = (over: Partial<Drive> = {}): Drive => ({
  documentId: "d1",
  title: "Ohio’s public libraries *need opening hours.*",
  slug: "ohio-hours",
  summary: "Add a week of hours.",
  focus: { kind: "gaps", gaps: ["hours"] },
  scope: { places: { region: ["ohio"] } },
  unit: "branch",
  startsAt: "2026-10-01T00:00:00.000Z",
  endsAt: "2026-11-01T00:00:00.000Z",
  goalPercent: 100,
  status: "open",
  pinned: false,
  featured: false,
  locale: "en",
  createdAt: "2026-09-30T00:00:00.000Z",
  updatedAt: "2026-09-30T00:00:00.000Z",
  steps: [],
  ...over,
})

const view = (over: Partial<Drive> = {}): DriveView => ({
  drive: drive(over),
  href: driveHref(over.slug ?? "ohio-hours"),
  place: null,
  source: null,
  progress: null,
  helpers: null,
})

describe("driveHref", () => {
  it("is the drive page under the Noticeboard", () => {
    expect(driveHref("ohio-hours")).toBe("/community/drives/ohio-hours")
  })
})

describe("plainDriveTitle", () => {
  it("drops the italic markup", () => {
    expect(plainDriveTitle("Ohio’s libraries *need hours.*")).toBe(
      "Ohio’s libraries need hours."
    )
  })
})

describe("displayProgress", () => {
  const live = {
    total: 251,
    done: 142,
    todo: 109,
    inReview: 9,
    percent: 57,
    goalMet: false,
  }

  it("prefers live counts for an open drive", () => {
    expect(displayProgress(drive(), live)).toEqual(live)
  })

  it("uses the final tally once a drive has closed, live or not", () => {
    const closed = drive({
      status: "closed",
      goalPercent: 80,
      final: {
        total: 200,
        done: 170,
        closedGaps: 60,
        helpers: 12,
        credits: 64,
      },
    })

    expect(displayProgress(closed, live)).toEqual({
      total: 200,
      done: 170,
      todo: 30,
      inReview: 0,
      percent: 85,
      goalMet: true,
    })
  })

  it("falls back to the newest progress log entry, then the baseline", () => {
    const logged = drive({
      progressLog: [
        { day: "2026-10-02", total: 251, done: 100, inReview: 3 },
        { day: "2026-10-03", total: 251, done: 120, inReview: 5 },
      ],
      baseline: { total: 251, done: 90, at: "2026-10-01T00:00:00.000Z" },
    })
    expect(displayProgress(logged, null)).toMatchObject({
      total: 251,
      done: 120,
      inReview: 5,
      percent: 48,
    })

    const baselineOnly = drive({
      baseline: { total: 251, done: 90, at: "2026-10-01T00:00:00.000Z" },
    })
    expect(displayProgress(baselineOnly, null)).toMatchObject({
      total: 251,
      done: 90,
      inReview: 0,
    })
  })

  it("is null when nothing has been counted", () => {
    expect(displayProgress(drive(), null)).toBeNull()
  })
})

describe("progressMeta", () => {
  it("pairs the percentage with how many are helping, or helped once finished", () => {
    expect(progressMeta(57, 38)).toBe("57% · 38 people helping")
    expect(progressMeta(57, 1)).toBe("57% · 1 person helping")
    expect(progressMeta(91, 41, true)).toBe("91% · 41 people helped")
    expect(progressMeta(57, null)).toBe("57%")
  })
})

describe("displayHelpers", () => {
  it("reads the final tally for a closed drive, else the live stats", () => {
    expect(
      displayHelpers(
        drive({
          status: "closed",
          final: { total: 1, done: 1, closedGaps: 1, helpers: 7, credits: 9 },
        }),
        { inReview: 0, helpers: 40, credits: 0 }
      )
    ).toBe(7)
    expect(
      displayHelpers(drive(), { inReview: 0, helpers: 38, credits: 0 })
    ).toBe(38)
    expect(displayHelpers(drive(), null)).toBeNull()
  })
})

describe("drivePlaceRefs and drivePlaceLabel", () => {
  const names = new Map([
    ["region:ohio", { name: "Ohio", country: "United States" }],
    ["region:indiana", { name: "Indiana", country: "United States" }],
    ["country:wales", { name: "Wales", country: "Wales" }],
    ["region:kent", { name: "Kent", country: "United Kingdom" }],
  ])

  it("lists places broadest level first", () => {
    expect(
      drivePlaceRefs({
        places: { region: ["ohio", "indiana"], country: ["wales"] },
      })
    ).toEqual([
      { level: "country", slug: "wales" },
      { level: "region", slug: "ohio" },
      { level: "region", slug: "indiana" },
    ])
  })

  it("names one region with its country", () => {
    expect(drivePlaceLabel({ places: { region: ["ohio"] } }, names)).toBe(
      "Ohio, United States"
    )
  })

  it("doesn't repeat a country's own name", () => {
    expect(drivePlaceLabel({ places: { country: ["wales"] } }, names)).toBe(
      "Wales"
    )
  })

  it("joins two places and counts the rest", () => {
    expect(
      drivePlaceLabel({ places: { region: ["ohio", "indiana"] } }, names)
    ).toBe("Ohio and Indiana")
    expect(
      drivePlaceLabel(
        { places: { region: ["ohio", "indiana", "kent", "devon"] } },
        names
      )
    ).toBe("Ohio, Indiana and 2 more")
  })

  it("titles a slug the index can't name", () => {
    expect(
      drivePlaceLabel({ places: { area: ["north-tyneside"] } }, new Map())
    ).toBe("North Tyneside")
  })

  it("counts an explicit library list instead", () => {
    expect(
      drivePlaceLabel(
        { libraries: ["a", "b", "c"], places: { region: ["ohio"] } },
        names
      )
    ).toBe("3 chosen libraries")
    expect(drivePlaceLabel({ libraries: ["a"] }, names)).toBe(
      "1 chosen library"
    )
  })

  it("is null with no places at all", () => {
    expect(drivePlaceLabel({}, names)).toBeNull()
  })
})

describe("pickFeatured", () => {
  it("takes the featured drive, keeping the others in order", () => {
    const views = [
      view({ documentId: "a", pinned: true }),
      view({ documentId: "b", pinned: true, featured: true }),
      view({ documentId: "c" }),
    ]
    const { featured, others } = pickFeatured(views)

    expect(featured?.drive.documentId).toBe("b")
    expect(others.map((v) => v.drive.documentId)).toEqual(["a", "c"])
  })

  it("falls back to the first pinned drive, then the first drive", () => {
    expect(
      pickFeatured([
        view({ documentId: "a" }),
        view({ documentId: "b", pinned: true }),
      ]).featured?.drive.documentId
    ).toBe("b")
    expect(
      pickFeatured([view({ documentId: "a" }), view({ documentId: "b" })])
        .featured?.drive.documentId
    ).toBe("a")
  })

  it("is empty for no drives", () => {
    expect(pickFeatured([])).toEqual({ featured: null, others: [] })
  })
})

describe("focusFilterOptions and filterByFocus", () => {
  const drives = [
    drive({ documentId: "a", focus: { kind: "gaps", gaps: ["hours"] } }),
    drive({
      documentId: "b",
      focus: { kind: "gaps", gaps: ["hours", "contact"] },
    }),
    drive({
      documentId: "c",
      focus: { kind: "verify", sections: ["status"], before: "2026-01-01" },
    }),
  ]

  it("counts each focus with an open drive, in a fixed order, hiding the rest", () => {
    expect(focusFilterOptions(drives)).toEqual([
      {
        key: "hours",
        label: "Opening hours",
        icon: "mdi:clock-outline",
        count: 2,
      },
      {
        key: "contact",
        label: "Contact details",
        icon: "mdi:card-account-phone-outline",
        count: 1,
      },
      {
        key: "verify",
        label: "Check details",
        icon: "mdi:shield-check-outline",
        count: 1,
      },
    ])
  })

  it("keeps only the drives under a focus, or all of them without one", () => {
    const views = drives.map((d) => ({ ...view(), drive: d }))

    expect(
      filterByFocus(views, "hours").map((v) => v.drive.documentId)
    ).toEqual(["a", "b"])
    expect(filterByFocus(views, "photo")).toEqual([])
    expect(filterByFocus(views, null)).toHaveLength(3)
  })
})
