import { describe, expect, it } from "vitest"

import {
  type CorrectionRecord,
  toCorrectionRecord,
} from "@/components/contribute/correction.logic"
import type { DriveTask } from "@/lib/drives/types"

import {
  addSkip,
  earnedProLine,
  evidenceProblem,
  facilitiesPayload,
  nextTask,
  panelGapsOf,
  photoPayload,
  pointsToArchivist,
  quotaLine,
  quotaReason,
  randomTask,
  readSkips,
  recordPayload,
  skipKey,
  taskActionName,
  taskPlace,
  taskVerb,
  webSearchHref,
  withoutDrive,
} from "../task-panel.logic"

const DRIVE = "drv00000000000000000001"
const LIB = "lib00000000000000000001"
const target = {
  documentId: LIB,
  slug: "worthington-northwest",
  name: "Worthington Libraries, Northwest",
}

const record: CorrectionRecord = toCorrectionRecord({
  documentId: LIB,
  name: target.name,
  city: "Columbus",
  streetAddress: "2280 Hard Rd",
  operationalStatus: "open",
})

const MONDAY = {
  version: 1,
  days: [
    {
      day: "monday" as const,
      enabled: true,
      timeframes: [
        {
          id: "a",
          startTime: "09:00",
          endTime: "17:00",
          staffing: "staffed" as const,
        },
      ],
    },
  ],
}

const task = (id: string, extra: Partial<DriveTask> = {}): DriveTask => ({
  documentId: id,
  slug: id,
  name: `Library ${id}`,
  href: null,
  inReview: false,
  ...extra,
})

/** An in-memory Storage, so the skip list can be read back. */
function memoryStorage(): Storage {
  const data = new Map<string, string>()

  return {
    get length() {
      return data.size
    },
    clear: () => data.clear(),
    getItem: (k) => data.get(k) ?? null,
    key: (i) => [...data.keys()][i] ?? null,
    removeItem: (k) => {
      data.delete(k)
    },
    setItem: (k, v) => {
      data.set(k, String(v))
    },
  }
}

describe("panelGapsOf and the row's action name", () => {
  it("keeps the drive's panel gaps in focus order", () => {
    expect(
      panelGapsOf({ kind: "gaps", gaps: ["contact", "about", "hours"] })
    ).toEqual(["contact", "hours"])
    expect(panelGapsOf({ kind: "record", target: 80 })).toEqual([])
  })

  it("names the action after the gap and the library", () => {
    expect(taskVerb({ kind: "gaps", gaps: ["hours"] })).toBe("Add hours")
    expect(taskVerb({ kind: "gaps", gaps: ["photo"] })).toBe("Add a photo")
    expect(taskVerb({ kind: "gaps", gaps: ["hours", "contact"] })).toBe(
      "Fill the gaps"
    )
    expect(taskActionName("Add hours", target.name)).toBe(
      "Add hours for Worthington Libraries, Northwest"
    )
  })
})

describe("the payload for each gap carries the drive", () => {
  it("hours: a record correction with the new week, the source and the drive", () => {
    const body = recordPayload(
      "hours",
      target,
      record,
      { openingTimes: MONDAY },
      " https://worthingtonlibraries.org/hours ",
      { driveDocumentId: DRIVE }
    )
    expect(body).toMatchObject({
      submissionType: "correction",
      targetEntityType: "library",
      targetSlug: target.slug,
      targetDocumentId: LIB,
      evidenceType: "other",
      evidenceUrl: "https://worthingtonlibraries.org/hours",
      driveDocumentId: DRIVE,
      fields: {
        kind: "record",
        category: "Opening hours",
        libraryName: target.name,
        previous: { openingTimes: null },
      },
    })
    const week = (body.fields as { openingTimes: { days: unknown[] } })
      .openingTimes
    expect(week.days).toHaveLength(7)
    expect(body.fields).not.toHaveProperty("driveDocumentId")
  })

  it("contact: only the links editor's fields", () => {
    const body = recordPayload(
      "contact",
      target,
      record,
      { phone: "614-807-2626", name: "Not this" },
      "https://worthingtonlibraries.org/contact",
      { driveDocumentId: DRIVE }
    )
    expect(body.fields).toEqual({
      kind: "record",
      category: "Website or catalogue",
      libraryName: target.name,
      phone: "614-807-2626",
      sourceRecords: [
        {
          url: "https://worthingtonlibraries.org/contact",
          role: "reference",
          fields: ["phone"],
        },
      ],
      previous: { phone: "" },
    })
    expect(body.driveDocumentId).toBe(DRIVE)
  })

  it("closed or moved: status and address in one record correction", () => {
    const body = recordPayload(
      "closed",
      target,
      record,
      { operationalStatus: "permanently_closed", streetAddress: "1 New St" },
      "",
      { driveDocumentId: DRIVE }
    )
    expect(body.fields).toMatchObject({
      kind: "record",
      category: "Open or closed",
      operationalStatus: "permanently_closed",
      streetAddress: "1 New St",
      previous: { operationalStatus: "open", streetAddress: "2280 Hard Rd" },
    })
    expect(body).not.toHaveProperty("evidenceUrl")
    expect(
      recordPayload(
        "closed",
        target,
        record,
        { streetAddress: "1 New St" },
        "",
        {}
      ).fields
    ).toMatchObject({ category: "Address or location" })
  })

  it("a claimant's record change goes in as a library_edit", () => {
    const body = recordPayload(
      "hours",
      target,
      record,
      { openingTimes: MONDAY },
      "https://example.org",
      { driveDocumentId: DRIVE, claimed: true }
    )
    expect(body.submissionType).toBe("library_edit")
    expect(body.targetDocumentId).toBe(LIB)
    expect(body.driveDocumentId).toBe(DRIVE)
  })

  it("photo: the photo payload, licensed, on-site, with the drive", () => {
    const body = photoPayload(
      target,
      {
        photo: { id: 7, url: "/uploads/front.jpg" },
        credit: " Ann ",
        caption: "The entrance",
      },
      { driveDocumentId: DRIVE, claimed: true }
    )
    expect(body).toEqual({
      submissionType: "correction",
      targetEntityType: "library",
      targetSlug: target.slug,
      targetDocumentId: LIB,
      fields: {
        kind: "photo",
        category: "Photo",
        libraryName: target.name,
        photoId: 7,
        photoUrl: "/uploads/front.jpg",
        credit: "Ann",
        licence: "CC BY-SA 4.0",
      },
      note: "The entrance",
      evidenceType: "on_site_photo",
      driveDocumentId: DRIVE,
    })
  })

  it("accessibility: the facility answers, with the drive", () => {
    const body = facilitiesPayload(target, [["Hearing loop", "no"]], {
      driveDocumentId: DRIVE,
    })
    expect(body).toMatchObject({
      submissionType: "correction",
      targetSlug: target.slug,
      targetDocumentId: LIB,
      driveDocumentId: DRIVE,
      fields: { kind: "facilities", answers: { "Hearing loop": "no" } },
    })
  })

  it("leaves the drive off when there's none, and withoutDrive drops it", () => {
    const tagged = recordPayload(
      "hours",
      target,
      record,
      { openingTimes: MONDAY },
      "https://example.org",
      { driveDocumentId: DRIVE }
    )
    const plain = withoutDrive(tagged)
    expect(plain).not.toHaveProperty("driveDocumentId")
    expect(plain.fields).toEqual(tagged.fields)
    expect(
      recordPayload("hours", target, record, { openingTimes: MONDAY }, "", {})
    ).not.toHaveProperty("driveDocumentId")
  })
})

describe("evidenceProblem", () => {
  it("needs the page for hours and contact", () => {
    expect(evidenceProblem("hours", "  ")).toBe(
      "Add the page you found this on."
    )
    expect(evidenceProblem("contact", "")).toBe(
      "Add the page you found this on."
    )
    expect(evidenceProblem("hours", "the council site")).toBe(
      "The source must be a web address."
    )
    expect(evidenceProblem("hours", "ftp://x.org")).toBe(
      "The source must be a web address."
    )
    expect(evidenceProblem("contact", " https://x.org/contact ")).toBeNull()
  })

  it("leaves it optional elsewhere", () => {
    expect(evidenceProblem("closed", "")).toBeNull()
    expect(evidenceProblem("closed", "The sign on the door")).toBeNull()
    expect(evidenceProblem("photo", "")).toBeNull()
    expect(evidenceProblem("accessibility", "")).toBeNull()
  })
})

describe("the skip list", () => {
  it("keeps skips per drive in session storage, once each", () => {
    const storage = memoryStorage()
    expect(skipKey(DRIVE)).toBe(`drive.skips.${DRIVE}`)
    expect(readSkips(DRIVE, storage)).toEqual([])
    addSkip(DRIVE, "a", storage)
    expect(addSkip(DRIVE, "b", storage)).toEqual(["a", "b"])
    expect(addSkip(DRIVE, "a", storage)).toEqual(["a", "b"])
    expect(JSON.parse(storage.getItem(`drive.skips.${DRIVE}`)!)).toEqual([
      "a",
      "b",
    ])
    expect(readSkips("drv00000000000000000002", storage)).toEqual([])
  })

  it("survives bad or missing storage", () => {
    const storage = memoryStorage()
    storage.setItem(skipKey(DRIVE), "{not json")
    expect(readSkips(DRIVE, storage)).toEqual([])
    storage.setItem(skipKey(DRIVE), JSON.stringify(["a", 3, null]))
    expect(readSkips(DRIVE, storage)).toEqual(["a"])
    const broken = {
      getItem: () => {
        throw new Error("denied")
      },
      setItem: () => {
        throw new Error("denied")
      },
    } as unknown as Storage
    expect(readSkips(DRIVE, broken)).toEqual([])
    expect(addSkip(DRIVE, "a", broken)).toEqual(["a"])
    expect(readSkips(DRIVE, null)).toEqual([])
  })
})

describe("picking the next library", () => {
  const tasks = ["a", "b", "c", "d"].map((id) => task(id))

  it("takes the next open one after the current, wrapping round", () => {
    const none = new Set<string>()
    expect(nextTask(tasks, "a", none, none)?.documentId).toBe("b")
    expect(nextTask(tasks, "b", new Set(["c"]), none)?.documentId).toBe("d")
    expect(nextTask(tasks, "d", none, new Set(["a"]))?.documentId).toBe("b")
    expect(nextTask(tasks, null, none, none)?.documentId).toBe("a")
  })

  it("never offers the current, a skipped or an in-review library", () => {
    expect(nextTask(tasks, "a", new Set(["b", "c"]), new Set(["d"]))).toBeNull()
    expect(
      nextTask(
        [task("x", { inReview: true }), task("y")],
        null,
        new Set(),
        new Set()
      )?.documentId
    ).toBe("y")
  })

  it("“Give me a library” picks at random among the open ones", () => {
    const open = randomTask(tasks, new Set(["a"]), new Set(["b"]), () => 0.99)
    expect(open?.documentId).toBe("d")
    expect(
      randomTask(tasks, new Set(["a"]), new Set(["b"]), () => 0)?.documentId
    ).toBe("c")
    expect(
      randomTask(tasks, new Set(["a", "b", "c", "d"]), new Set(), () => 0)
    ).toBeNull()
  })
})

describe("quota and earned Pro", () => {
  it("counts what's waiting and says why sending stops at the limit", () => {
    expect(quotaLine({ pendingCount: 3, pendingLimit: 5 })).toBe(
      "3 of 5 waiting for review"
    )
    expect(quotaReason({ pendingCount: 4, pendingLimit: 5 })).toBeNull()
    expect(quotaReason({ pendingCount: 5, pendingLimit: 5 })).toBe(
      "You have 5 changes waiting for review, the most you can have at once. Send more once some are reviewed."
    )
    expect(quotaReason(null)).toBeNull()
    expect(quotaLine(null)).toBeNull()
  })

  it("counts the points to Archivist below it, and nothing from it up", () => {
    expect(
      pointsToArchivist({
        totalPoints: 1160,
        tier: {
          name: "Cartographer",
          nextName: "Archivist",
          nextThreshold: 1500,
        },
      })
    ).toBe(340)
    expect(
      pointsToArchivist({
        totalPoints: 64,
        tier: { name: "Indexer", nextName: "Cartographer", nextThreshold: 500 },
      })
    ).toBe(1436)
    expect(
      pointsToArchivist({
        totalPoints: 1600,
        tier: { name: "Archivist", nextName: "Scholar", nextThreshold: 4000 },
      })
    ).toBeNull()
    expect(pointsToArchivist(null)).toBeNull()
    expect(earnedProLine(1436)).toBe(
      "Drive work counts toward earned Pro: 1,436 points to Archivist."
    )
  })
})

describe("place and web search", () => {
  it("reads the town, then the region", () => {
    expect(
      taskPlace(task("a", { city: "Columbus", region_name: "Ohio" }))
    ).toBe("Columbus, Ohio")
    expect(
      taskPlace(
        task("a", { area_name: "Franklin County", region_name: "Ohio" })
      )
    ).toBe("Franklin County, Ohio")
    expect(taskPlace(task("a", { city: "Ohio", region_name: "Ohio" }))).toBe(
      "Ohio"
    )
    expect(taskPlace(task("a"))).toBe("")
  })

  it("searches the web for the name and town", () => {
    expect(
      webSearchHref(task("a", { name: "Northwest Library", city: "Columbus" }))
    ).toBe("https://duckduckgo.com/?q=Northwest%20Library%20Columbus")
  })
})
