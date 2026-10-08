import { describe, expect, it, vi } from "vitest"

import {
  absentFacilityLabels,
  applyLibraryRecord,
  buildLibraryRecordData,
  isRecordCorrection,
  parseSuggestedOptions,
  sanitizeOpeningTimes,
  verifiedActions,
} from "../../src/plugins/content-moderation/server/utils/library-record"
import { makeFakeStrapi } from "../helpers/fake-strapi"

const LIBRARY = "api::library.library"
const ID = "lib00000000000000000001"

/** The fake hands out fresh mocks per documents() call; memoise per uid. */
function memoised(seed: Record<string, any[]>) {
  const made = makeFakeStrapi(seed)
  const perUid = new Map<string, any>()
  const fresh = made.strapi.documents
  made.strapi.documents = vi.fn((uid: string) => {
    if (!perUid.has(uid)) perUid.set(uid, fresh(uid))

    return perUid.get(uid)
  })

  return made
}

describe("buildLibraryRecordData", () => {
  it("keeps allowlisted strings, trims them, and clears with an empty string", () => {
    expect(
      buildLibraryRecordData({
        name: "  New name ",
        website: "",
        phone: "0123",
        bogus: "x",
        payloadHash: "y",
        kind: "record",
        previous: { name: "Old" },
      })
    ).toEqual({ name: "New name", website: null, phone: "0123" })
  })

  it("keeps absent facilities as checklist labels in checklist order, and clears with null", () => {
    expect(
      buildLibraryRecordData({
        absentFacilities: [
          "Wi-Fi",
          "Step-free entrance",
          "Wi-Fi",
          "Not a facility",
          7,
        ],
      })
    ).toEqual({ absentFacilities: ["Step-free entrance", "Wi-Fi"] })
    expect(buildLibraryRecordData({ absentFacilities: null })).toEqual({
      absentFacilities: [],
    })
    expect(buildLibraryRecordData({ absentFacilities: "Wi-Fi" })).toEqual({})
    // The Mobile checklist's own items count too.
    expect(absentFacilityLabels(["Step-free lift"])).toEqual(["Step-free lift"])
  })

  it("never clears the name", () => {
    expect(buildLibraryRecordData({ name: "" })).toEqual({})
  })

  it("validates enums and drops unknown values", () => {
    expect(
      buildLibraryRecordData({
        libraryType: "Public",
        operatorType: "Not a thing",
        operationalStatus: "open",
      })
    ).toEqual({ libraryType: "Public", operationalStatus: "open" })
  })

  it("turns notes into blocks and clears them", () => {
    expect(buildLibraryRecordData({ visitNotes: "Bring ID" })).toEqual({
      visitNotes: [
        { type: "paragraph", children: [{ type: "text", text: "Bring ID" }] },
      ],
    })
    expect(buildLibraryRecordData({ accessibilityNotes: "" })).toEqual({
      accessibilityNotes: null,
    })
  })

  it("maps coordinates to one location and ignores half a pair", () => {
    expect(buildLibraryRecordData({ lat: "51.5", lng: "-0.12" })).toEqual({
      location: { lat: 51.5, lng: -0.12 },
    })
    expect(buildLibraryRecordData({ lat: "51.5" })).toEqual({})
    expect(buildLibraryRecordData({ lat: "999", lng: "0" })).toEqual({})
    expect(buildLibraryRecordData({ lat: "", lng: "" })).toEqual({
      location: null,
    })
  })

  it("sets relations from documentIds and hierarchy from the picker", () => {
    expect(
      buildLibraryRecordData({
        services: ["svc00000000000000000001", "not-an-id"],
        amenities: [],
        countryDocumentId: "cty00000000000000000001",
        areaDocumentId: "",
      })
    ).toEqual({
      services: { set: [{ documentId: "svc00000000000000000001" }] },
      amenities: { set: [] },
      country: { set: [{ documentId: "cty00000000000000000001" }] },
      area: { set: [] },
    })
  })

  it("keeps well-formed opening times and social links only", () => {
    const openingTimes = sanitizeOpeningTimes({ version: 1, days: [] })
    expect(
      buildLibraryRecordData({
        openingTimes,
        socialLinks: [
          { platform: "x", url: "https://x.com/lib", label: " Lib " },
          { platform: "myspace", url: "https://myspace.com" },
          // eslint-disable-next-line sonarjs/code-eval -- asserts the unsafe scheme is rejected
          { platform: "facebook", url: "javascript:alert(1)" },
        ],
      })
    ).toEqual({
      openingTimes,
      socialLinks: [{ platform: "x", url: "https://x.com/lib", label: "Lib" }],
    })
    expect(buildLibraryRecordData({ openingTimes: { nope: true } })).toEqual({})
  })

  it("attaches only images the submitter uploaded", () => {
    expect(
      buildLibraryRecordData(
        {
          uploadedImages: [
            { strapiId: 1, isHero: false },
            { strapiId: 2, isHero: true },
            { strapiId: 3, isHero: false },
          ],
        },
        { ownedUploadIds: new Set([1, 2]) }
      )
    ).toEqual({
      heroImage: { set: [{ id: 2 }] },
      gallery: { connect: [{ id: 1 }] },
    })
    expect(
      buildLibraryRecordData({ uploadedImages: [{ strapiId: 1 }] })
    ).toEqual({})
  })
})

const tf = (startTime: string, endTime: string, staffing = "staffed") => ({
  id: `${startTime}-${endTime}`,
  startTime,
  endTime,
  staffing,
})

describe("sanitizeOpeningTimes", () => {
  it("fills all seven days in order and drops invalid values", () => {
    const hours = sanitizeOpeningTimes({
      version: 1,
      days: [
        { day: "tuesday", enabled: true, timeframes: [tf("09:00", "17:00")] },
        { day: "funday", enabled: true, timeframes: [] },
        {
          day: "monday",
          enabled: true,
          timeframes: [
            tf("13:00", "18:00", "volunteer"),
            tf("08:00", "12:00", "robots"),
          ],
        },
      ],
    })!
    expect(hours.days.map((d) => d.day)).toEqual([
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
      "sunday",
    ])
    expect(
      hours.days[0]!.timeframes.map((t) => [t.startTime, t.staffing])
    ).toEqual([
      ["08:00", "staffed"],
      ["13:00", "volunteer"],
    ])
    expect(hours.days[2]).toEqual({
      day: "wednesday",
      enabled: false,
      timeframes: [],
    })
  })

  it("refuses overlapping or excessive timeframes, and non-hours", () => {
    expect(
      sanitizeOpeningTimes({
        days: [
          {
            day: "monday",
            enabled: true,
            timeframes: [tf("09:00", "13:00"), tf("12:00", "17:00")],
          },
        ],
      })
    ).toBeNull()
    expect(
      sanitizeOpeningTimes({
        days: [
          {
            day: "monday",
            enabled: true,
            timeframes: ["01", "03", "05", "07", "09", "11", "13"].map((h) =>
              tf(`${h}:00`, `${h}:30`)
            ),
          },
        ],
      })
    ).toBeNull()
    expect(sanitizeOpeningTimes({ monday: "9-5" })).toBeNull()
  })
})

describe("relation changes and suggested options", () => {
  const A = "acc00000000000000000001"
  const B = "acc00000000000000000002"

  it("connects and disconnects without replacing the rest", () => {
    expect(
      buildLibraryRecordData({
        accessibility: { connect: [A, "bad id"], disconnect: [B, A] },
      })
    ).toEqual({
      accessibility: {
        connect: [{ documentId: A }],
        disconnect: [{ documentId: B }],
      },
    })
    expect(buildLibraryRecordData({ services: { connect: [] } })).toEqual({})
  })

  it("cleans suggested option names", () => {
    expect(
      parseSuggestedOptions({
        suggestedOptions: {
          accessibility: [
            "  Changing   Places toilet ",
            "changing places toilet",
            3,
            "",
          ],
          ghosts: ["Boo"],
        },
      })
    ).toEqual({ accessibility: ["Changing Places toilet"] })
  })

  it("links a matching option and logs a new one for the editorial board", async () => {
    const ACC = "api::accessibility.accessibility"
    const SUG = "plugin::content-moderation.option-suggestion"
    const { strapi, store } = memoised({
      [LIBRARY]: [{ documentId: ID, slug: "lib", name: "Lib", locale: "en" }],
      [ACC]: [{ documentId: A, name: "Hearing loop" }],
    })
    const outcome = await applyLibraryRecord(strapi, {
      documentId: "s1",
      targetDocumentId: ID,
      fields: {
        kind: "record",
        accessibility: { disconnect: [B] },
        suggestedOptions: { accessibility: ["hearing LOOP", "Quiet room"] },
      },
    })
    expect(outcome).toBe("applied")
    expect(store[ACC]).toHaveLength(1)
    expect(store[SUG]).toMatchObject([
      {
        name: "Quiet room",
        nameKey: "quiet room",
        optionKey: "accessibility",
        status: "open",
        requests: 1,
        libraries: [{ documentId: ID, name: "Lib" }],
        submissionIds: ["s1"],
      },
    ])
    const data = strapi.documents(LIBRARY).update.mock.calls[0]?.[0]?.data
    expect(data.accessibility).toEqual({
      disconnect: [{ documentId: B }],
      connect: [{ documentId: A }],
    })
  })

  it("leaves the record alone when only new names were suggested", async () => {
    const { strapi } = memoised({
      [LIBRARY]: [{ documentId: ID, slug: "lib", name: "Lib" }],
    })
    const outcome = await applyLibraryRecord(strapi, {
      documentId: "s2",
      targetDocumentId: ID,
      fields: {
        kind: "record",
        suggestedOptions: { services: ["Seed library"] },
      },
    })
    expect(outcome).toBe("applied")
    expect(strapi.documents(LIBRARY).update).not.toHaveBeenCalled()
  })
})

describe("applyLibraryRecord", () => {
  it("publishes the changed fields onto the reviewed library", async () => {
    const { strapi, store } = memoised({
      [LIBRARY]: [{ documentId: ID, slug: "lib", name: "Old", locale: "en" }],
    })
    const outcome = await applyLibraryRecord(strapi, {
      documentId: "s1",
      targetDocumentId: ID,
      fields: { kind: "record", name: "New", previous: { name: "Old" } },
    })
    expect(outcome).toBe("applied")
    expect(store[LIBRARY]![0]!.name).toBe("New")
    const call = strapi.documents(LIBRARY).update.mock.calls[0]?.[0]
    expect(call?.status).toBe("published")
    expect(call?.locale).toBe("en")
    expect(call?.data.contentUpdatedAt).toBeInstanceOf(Date)
  })

  it("falls back to the slug and is a noop for nothing valid or no library", async () => {
    const { strapi, store } = makeFakeStrapi({
      [LIBRARY]: [{ documentId: ID, slug: "lib", name: "Old" }],
    })
    expect(
      await applyLibraryRecord(strapi, {
        documentId: "s1",
        targetSlug: "lib",
        fields: { city: "Leeds" },
      })
    ).toBe("applied")
    expect(store[LIBRARY]![0]!.city).toBe("Leeds")
    expect(
      await applyLibraryRecord(strapi, {
        documentId: "s2",
        targetSlug: "lib",
        fields: { kind: "record", nonsense: 1 },
      })
    ).toBe("noop")
    expect(
      await applyLibraryRecord(strapi, {
        documentId: "s3",
        targetSlug: "missing",
        fields: { city: "x" },
      })
    ).toBe("noop")
  })

  it("stamps only the verifiable sections an edit sets", async () => {
    const { strapi, store } = memoised({
      [LIBRARY]: [{ documentId: ID, slug: "lib", name: "Old", locale: "en" }],
    })
    await applyLibraryRecord(strapi, {
      documentId: "s1",
      targetDocumentId: ID,
      fields: { kind: "record", city: "York" },
    })
    const lib = store[LIBRARY]![0]!
    expect(Object.keys(lib.verifiedSections ?? {})).toEqual(["address"])
    expect(lib.lastVerifiedAt).toBeTruthy()
  })

  it("leaves lastVerifiedAt alone for an edit with no verifiable section", async () => {
    const { strapi, store } = memoised({
      [LIBRARY]: [{ documentId: ID, slug: "lib", name: "Old", locale: "en" }],
    })
    await applyLibraryRecord(strapi, {
      documentId: "s1",
      targetDocumentId: ID,
      fields: { kind: "record", name: "New" },
    })
    const lib = store[LIBRARY]![0]!
    expect(lib.lastVerifiedAt).toBeUndefined()
    expect(lib.contentUpdatedAt).toBeInstanceOf(Date)
  })

  it("isRecordCorrection recognises the Index editor's corrections only", () => {
    expect(isRecordCorrection({ kind: "record", city: "x" })).toBe(true)
    expect(isRecordCorrection({ kind: "facilities" })).toBe(false)
    expect(isRecordCorrection(null)).toBe(false)
  })
})

describe("applyLibraryRecord reports the fields that changed", () => {
  const A = "acc00000000000000000001"
  const B = "acc00000000000000000002"
  const weekday = (startTime: string, id: string) => ({
    version: 1,
    days: [
      {
        day: "monday",
        enabled: true,
        timeframes: [{ id, startTime, endTime: "17:00", staffing: "staffed" }],
      },
    ],
  })
  const seeded = (extra: Record<string, unknown> = {}) =>
    memoised({
      [LIBRARY]: [
        {
          documentId: ID,
          slug: "lib",
          name: "Lib",
          locale: "en",
          city: "York",
          phone: "01904 000000",
          website: "https://lib.example",
          openingTimes: weekday("09:00", "kept-id"),
          accessibility: [{ documentId: A }],
          ...extra,
        },
      ],
    })

  it("leaves out fields sent with their current value", async () => {
    const { strapi } = seeded()
    const report = { changed: [] as string[] }
    await applyLibraryRecord(
      strapi,
      {
        documentId: "s1",
        targetDocumentId: ID,
        fields: {
          kind: "record",
          city: "York",
          phone: " 01904 000000 ",
          website: "https://lib.example",
          streetAddress: "1 High St",
        },
      },
      undefined,
      report
    )
    expect(report.changed).toEqual(["streetAddress"])
  })

  it("compares hours by their times, not their timeframe ids", async () => {
    const { strapi } = seeded()
    const same = { changed: ["stale"] }
    await applyLibraryRecord(
      strapi,
      {
        documentId: "s1",
        targetDocumentId: ID,
        fields: { kind: "record", openingTimes: weekday("09:00", "new-id") },
      },
      undefined,
      same
    )
    expect(same.changed).toEqual([])

    const moved = { changed: [] as string[] }
    await applyLibraryRecord(
      strapi,
      {
        documentId: "s2",
        targetDocumentId: ID,
        fields: { kind: "record", openingTimes: weekday("10:00", "new-id") },
      },
      undefined,
      moved
    )
    expect(moved.changed).toEqual(["openingTimes"])
  })

  it("counts a relation change only when it links or unlinks something", async () => {
    const run = async (accessibility: unknown) => {
      const { strapi } = seeded()
      const report = { changed: [] as string[] }
      await applyLibraryRecord(
        strapi,
        {
          documentId: "s1",
          targetDocumentId: ID,
          fields: { kind: "record", accessibility },
        },
        undefined,
        report
      )

      return report.changed
    }
    expect(await run({ connect: [A] })).toEqual([])
    expect(await run({ disconnect: [B] })).toEqual([])
    expect(await run([A])).toEqual([])
    expect(await run({ connect: [B] })).toEqual(["accessibility"])
    expect(await run({ disconnect: [A] })).toEqual(["accessibility"])
    expect(await run([A, B])).toEqual(["accessibility"])
  })

  it("reports nothing when nothing was applied", async () => {
    const { strapi } = seeded()
    const report = { changed: ["stale"] }
    expect(
      await applyLibraryRecord(
        strapi,
        {
          documentId: "s1",
          targetSlug: "missing",
          fields: { kind: "record", city: "Leeds" },
        },
        undefined,
        report
      )
    ).toBe("noop")
    expect(report.changed).toEqual([])
  })
})

describe("verifiedActions", () => {
  const hours = sanitizeOpeningTimes({
    version: 1,
    days: [
      {
        day: "monday",
        enabled: true,
        timeframes: [{ startTime: "09:00", endTime: "17:00" }],
      },
    ],
  })

  it("counts setting the hours as checking them", () => {
    expect(
      verifiedActions({ kind: "record", openingTimes: hours }, false)
    ).toEqual(["hours_verified"])
  })

  it("counts setting the open status as checking it", () => {
    expect(
      verifiedActions({ kind: "record", operationalStatus: "open" }, false)
    ).toEqual(["status_verified"])
  })

  it("earns both when both are set", () => {
    expect(
      verifiedActions(
        { openingTimes: hours, operationalStatus: "temporarily_closed" },
        false
      )
    ).toEqual(["hours_verified", "status_verified"])
  })

  it("earns nothing for clearing the hours or an unknown status", () => {
    expect(verifiedActions({ openingTimes: "" }, false)).toEqual([])
    expect(verifiedActions({ openingTimes: null }, false)).toEqual([])
    expect(verifiedActions({ operationalStatus: "unknown" }, false)).toEqual([])
    expect(verifiedActions({ operationalStatus: "haunted" }, false)).toEqual([])
  })

  it("earns nothing for other fields", () => {
    expect(verifiedActions({ kind: "record", city: "York" }, false)).toEqual([])
    expect(verifiedActions(null, false)).toEqual([])
  })

  it("earns only for the sections whose fields changed, when told which did", () => {
    const both = { openingTimes: hours, operationalStatus: "open" }
    expect(verifiedActions(both, false, ["operationalStatus"])).toEqual([
      "status_verified",
    ])
    expect(verifiedActions(both, false, ["openingTimes"])).toEqual([
      "hours_verified",
    ])
    expect(verifiedActions(both, false, [])).toEqual([])
  })

  it("earns nothing in a translation, which can't change shared fields", () => {
    expect(
      verifiedActions({ openingTimes: hours, operationalStatus: "open" }, true)
    ).toEqual([])
  })
})
