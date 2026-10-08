import {
  emptyTimetable,
  timetableHash,
  type MobileTimetable,
} from "@repo/shared-data"
import { describe, expect, it } from "vitest"

import { makeFakeStrapi } from "./helpers/fake-strapi"
import {
  applyLibraryRecord,
  buildLibraryRecordData,
} from "../src/plugins/content-moderation/server/utils/library-record"
import {
  assertTimetableHash,
  prepareMobileLibraryData,
  validatedTimetable,
} from "../src/utils/mobile-timetable"

const ID = "lib00000000000000000001"
const timetable = (): MobileTimetable => ({
  ...emptyTimetable("2026-10-05"),
  stops: [
    {
      id: "stop000001",
      name: "Ford Cross",
      where: "Lay-by",
      location: { lat: 51, lng: 0 },
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
})
describe("mobile timetable storage", () => {
  it("accepts validated allowlisted fields only", () => {
    const tt = timetable()
    expect(
      buildLibraryRecordData({
        mobileTimetable: tt,
        homeLibrary: ID,
        operatorName: " Council ",
        timetableUrl: "https://example.org/timetable.pdf",
        admin: true,
      })
    ).toMatchObject({
      mobileTimetable: tt,
      homeLibrary: { set: [{ documentId: ID }] },
      operatorName: "Council",
    })
    expect(() =>
      validatedTimetable({
        ...tt,
        visits: [{ ...tt.visits[0], depart: "08:30" }],
      })
    ).toThrow(/departure/i)
    expect(() => validatedTimetable({ ...tt, version: 2 })).toThrow(/format/i)
  })
  it("refuses stale or absent hashes and allows an exact canonical hash", () => {
    const tt = timetable()
    expect(() => assertTimetableHash(tt, "old")).toThrow(/changed/)
    expect(() => assertTimetableHash(tt, undefined)).toThrow(/changed/)
    expect(() => assertTimetableHash(tt, timetableHash(tt))).not.toThrow()
    expect(() => assertTimetableHash(null, "empty")).not.toThrow()
  })
  it("copies a published home base and timezone, refusing mobile and self bases", async () => {
    const { strapi } = makeFakeStrapi({
      "api::library.library": [
        {
          documentId: ID,
          libraryType: "Public",
          publishedAt: "2026-01-01",
          streetAddress: "High Street",
          city: "Example",
          postalCode: "EX1",
          location: { lat: 51, lng: 0 },
          timezone: "Europe/London",
        },
      ],
    })
    const data = await prepareMobileLibraryData(
      strapi,
      { libraryType: "Mobile", homeLibrary: { set: [{ documentId: ID }] } },
      null,
      "en"
    )
    expect(data).toMatchObject({
      streetAddress: "High Street",
      location: { lat: 51, lng: 0 },
      timezone: "Europe/London",
    })
    await expect(
      prepareMobileLibraryData(
        strapi,
        { libraryType: "Mobile", homeLibrary: { set: [{ documentId: ID }] } },
        { documentId: ID },
        "en"
      )
    ).rejects.toThrow(/home base/)
  })
  it("rejects timetables on a branch and uses a first pinned stop without an address", async () => {
    await expect(
      prepareMobileLibraryData(
        {},
        { libraryType: "Public", mobileTimetable: timetable() },
        null,
        "en"
      )
    ).rejects.toThrow(/Mobile/)
    expect(
      await prepareMobileLibraryData(
        {},
        { mobileTimetable: timetable() },
        { libraryType: "Mobile", timezone: "Europe/London" },
        "en"
      )
    ).toMatchObject({ location: { lat: 51, lng: 0 }, streetAddress: null })
  })
  it("refuses stale corrections in the actual apply path", async () => {
    const tt = timetable(),
      { strapi } = makeFakeStrapi({
        "api::library.library": [
          {
            documentId: ID,
            locale: "en",
            libraryType: "Mobile",
            mobileTimetable: tt,
            location: { lat: 51, lng: 0 },
            timezone: "Europe/London",
          },
        ],
      })
    await expect(
      applyLibraryRecord(strapi, {
        documentId: "suggestion",
        submissionType: "correction",
        targetDocumentId: ID,
        fields: { kind: "record", mobileTimetable: tt, previousHash: "old" },
      })
    ).rejects.toThrow(/changed/)
  })

  it("compares corrections with the published timetable when a draft has diverged", async () => {
    const live = timetable(),
      draft = { ...live, cycle: { ...live.cycle, weeks: 2 as const } }
    const { strapi } = makeFakeStrapi({
      "api::library.library": [
        {
          documentId: ID,
          locale: "en",
          libraryType: "Mobile",
          operatorName: "Draft operator name",
          mobileTimetable: draft,
          location: { lat: 51, lng: 0 },
          timezone: "Europe/London",
          __published: {
            documentId: ID,
            locale: "en",
            libraryType: "Mobile",
            operatorName: "Published operator name",
            mobileTimetable: live,
            location: { lat: 51, lng: 0 },
            timezone: "Europe/London",
          },
        },
      ],
    })
    const after = { ...live, cycle: { ...live.cycle, weeks: 3 as const } }
    await expect(
      applyLibraryRecord(strapi, {
        documentId: "suggestion",
        submissionType: "correction",
        targetDocumentId: ID,
        fields: {
          kind: "record",
          mobileTimetable: after,
          previousHash: timetableHash(live),
        },
      })
    ).resolves.toBe("applied_draft")
  })

  it("ignores even malformed timetable fields on a translated correction", async () => {
    const { strapi, services } = makeFakeStrapi({
      "api::library.library": [
        {
          documentId: ID,
          locale: "en",
          libraryType: "Mobile",
          mobileTimetable: timetable(),
          timezone: "Europe/London",
        },
      ],
    })
    services["i18n.locales"] = {
      find: async () => [
        { code: "en", isDefault: true },
        { code: "fr", isDefault: false },
      ],
    }
    await expect(
      applyLibraryRecord(strapi, {
        documentId: "suggestion",
        submissionType: "correction",
        targetDocumentId: ID,
        contentLocale: "fr",
        fields: {
          kind: "record",
          mobileTimetable: { version: 99 },
          previousHash: "stale",
        },
      })
    ).resolves.toBe("noop")
  })
})
