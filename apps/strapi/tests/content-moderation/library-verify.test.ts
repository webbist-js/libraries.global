import { describe, expect, it, vi } from "vitest"

import {
  applyVerification,
  isVerification,
  latestStamp,
  sectionsSetBy,
  stampSections,
  verifySections,
} from "../../src/plugins/content-moderation/server/utils/library-verify"
import { makeFakeStrapi } from "../helpers/fake-strapi"

const LIBRARY = "api::library.library"
const AT = new Date("2026-10-05T12:00:00.000Z")

describe("verify helpers", () => {
  it("recognises a verify correction and keeps valid sections in order", () => {
    expect(isVerification({ kind: "verify" })).toBe(true)
    expect(isVerification({ kind: "record" })).toBe(false)
    expect(
      verifySections({
        kind: "verify",
        sections: ["contact", "hours", "hours", "nope"],
      })
    ).toEqual(["hours", "contact"])
    expect(verifySections({ kind: "verify" })).toEqual([])
  })

  it("names the sections a record update sets", () => {
    expect(
      sectionsSetBy({ openingTimes: { days: [] }, city: "York", phone: null })
    ).toEqual(["hours", "address"])
    expect(sectionsSetBy({ name: "X" })).toEqual([])
    expect(sectionsSetBy({ operationalStatus: "unknown" })).toEqual([])
  })

  it("merges stamps and finds the latest", () => {
    const map = stampSections(
      { hours: "2025-01-01T00:00:00.000Z" },
      ["status"],
      AT
    )
    expect(map).toEqual({
      hours: "2025-01-01T00:00:00.000Z",
      status: AT.toISOString(),
    })
    expect(latestStamp(map)).toBe(AT.toISOString())
    expect(latestStamp({})).toBeNull()
    expect(stampSections("junk", ["hours"], AT)).toEqual({
      hours: AT.toISOString(),
    })
  })
})

describe("applyVerification", () => {
  it("stamps the confirmed sections and lastVerifiedAt, changing nothing else", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(AT)
    const { strapi, store } = makeFakeStrapi({
      [LIBRARY]: [
        {
          documentId: "lib00000000000000000001",
          slug: "lib",
          name: "Library",
          locale: "en",
          verifiedSections: { contact: "2025-01-01T00:00:00.000Z" },
        },
      ],
    })

    const outcome = await applyVerification(strapi, {
      documentId: "s1",
      targetDocumentId: "lib00000000000000000001",
      fields: { kind: "verify", sections: ["hours", "status"] },
    })

    expect(outcome).toBe("applied")
    const lib = store[LIBRARY]![0]!
    expect(lib.verifiedSections).toEqual({
      contact: "2025-01-01T00:00:00.000Z",
      hours: AT.toISOString(),
      status: AT.toISOString(),
    })
    expect(new Date(lib.lastVerifiedAt).toISOString()).toBe(AT.toISOString())
    expect(lib.name).toBe("Library")
    vi.useRealTimers()
  })

  it("is a noop without sections or without the library", async () => {
    const { strapi } = makeFakeStrapi({ [LIBRARY]: [] })
    expect(
      await applyVerification(strapi, {
        documentId: "s1",
        targetDocumentId: "lib00000000000000000001",
        fields: { kind: "verify", sections: ["hours"] },
      })
    ).toBe("noop")
    expect(
      await applyVerification(strapi, {
        documentId: "s2",
        targetDocumentId: "lib00000000000000000001",
        fields: { kind: "verify", sections: [] },
      })
    ).toBe("noop")
  })
})
