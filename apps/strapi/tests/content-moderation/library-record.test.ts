import { describe, expect, it, vi } from "vitest"

import {
  applyLibraryRecord,
  buildLibraryRecordData,
  isRecordCorrection,
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
    const openingTimes = { version: 1, days: [] }
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

  it("isRecordCorrection recognises the Index editor's corrections only", () => {
    expect(isRecordCorrection({ kind: "record", city: "x" })).toBe(true)
    expect(isRecordCorrection({ kind: "facilities" })).toBe(false)
    expect(isRecordCorrection(null)).toBe(false)
  })
})
