import {
  checkLink,
  checkText,
  findUnsafeContent,
  LANGUAGE_MESSAGE,
  LINK_MESSAGE,
  SCHEME_MESSAGE,
  SHORT_LINK_MESSAGE,
} from "@repo/shared-data"
import { describe, expect, it } from "vitest"

describe("checkText", () => {
  it("refuses swearing and slurs, including simple disguises", () => {
    expect(checkText("This is fucking wrong")).toBe(LANGUAGE_MESSAGE)
    expect(checkText("what sh1t hours")).toBe(LANGUAGE_MESSAGE)
  })

  it("accepts real places the matcher would otherwise flag", () => {
    for (const place of [
      "Penistone Library",
      "Cumnock Library, Ayrshire",
      "Twatt, Orkney",
      "Scunthorpe Central Library",
      "Cockermouth Library",
      "Essex and Sussex",
    ])
      expect(checkText(place)).toBeNull()
  })

  it("accepts words the caller allows, such as the library's own address", () => {
    expect(checkText("Shitterton Village Hall")).toBeNull()
    expect(checkText("Fucking, Austria")).toBeNull()
  })

  it("treats pornography as a subject, not a swear", () => {
    expect(checkText("Holds a history of pornography censorship")).toBeNull()
  })

  it("checks links written inside text", () => {
    expect(checkText("see www.pornhub.com for hours")).toBe(LINK_MESSAGE)
    expect(checkText("see https://bit.ly/abc")).toBe(SHORT_LINK_MESSAGE)
    expect(checkText("see https://www.gov.uk/libraries")).toBeNull()
  })
})

describe("checkLink", () => {
  it("accepts ordinary public sources", () => {
    expect(checkLink("https://www.n-somerset.gov.uk/libraries")).toBeNull()
    expect(checkLink("http://example.org/opening-hours")).toBeNull()
  })

  it("refuses adult sites by domain, TLD or path", () => {
    expect(checkLink("https://xhamster.com/x")).toBe(LINK_MESSAGE)
    expect(checkLink("https://hot.xxx/")).toBe(LINK_MESSAGE)
    expect(checkLink("https://example.com/fuck")).toBe(LINK_MESSAGE)
  })

  it("refuses unsafe schemes and shortened links", () => {
    // eslint-disable-next-line sonarjs/code-eval -- the unsafe scheme is the fixture
    expect(checkLink("javascript:alert(1)")).toBe(SCHEME_MESSAGE)
    expect(checkLink("ftp://example.com/file")).toBe(SCHEME_MESSAGE)
    expect(checkLink("https://tinyurl.com/abc")).toBe(SHORT_LINK_MESSAGE)
  })

  it("checks a plain reference as text", () => {
    expect(checkLink("the noticeboard by the door")).toBeNull()
    expect(checkLink("the shit noticeboard")).toBe(LANGUAGE_MESSAGE)
  })
})

describe("findUnsafeContent", () => {
  it("finds the problem anywhere in a payload and says where", () => {
    expect(
      findUnsafeContent({
        fields: { category: "Name", name: "Nailsea Library" },
        draftData: {
          body: [{ type: "paragraph", children: [{ text: "fuck this" }] }],
        },
      })
    ).toEqual({
      path: "draftData.body[0].children[0].text",
      message: LANGUAGE_MESSAGE,
    })
    expect(
      findUnsafeContent({ evidenceUrl: "https://onlyfans.com/a" })
    ).toEqual({ path: "evidenceUrl", message: LINK_MESSAGE })
  })

  it("skips ids and machine values, and honours the allow list", () => {
    expect(
      findUnsafeContent({
        targetDocumentId: "shitfuckabc",
        fields: { streetAddress: "1 Shitterton Lane" },
      })
    ).toBeNull()
    expect(
      findUnsafeContent({ note: "Near Bumfuck Lane" }, ["Bumfuck Lane"])
    ).toBeNull()
  })

  it("catches a blocked term buried deep in a payload", () => {
    let value: unknown = "fuck this"
    for (let i = 0; i < 14; i++) value = { nested: value }
    const issue = findUnsafeContent({ draftData: value })
    expect(issue).not.toBeNull()
    expect(
      issue!.message === LANGUAGE_MESSAGE || issue!.code === "too_deep"
    ).toBe(true)
  })

  it("skips only known machine ids, not every key ending in Id", () => {
    expect(
      findUnsafeContent({
        targetDocumentId: "shitfuckabc",
        libraryDocumentIds: ["shitfuckabc"],
        fields: {
          continentDocumentId: "shitfuckabc",
          services: { connect: ["shitfuckabc"], disconnect: ["fuckoff12"] },
        },
      })
    ).toBeNull()
    expect(findUnsafeContent({ fields: { wikidataId: "fuck you" } })).toEqual({
      path: "fields.wikidataId",
      message: LANGUAGE_MESSAGE,
    })
  })

  it("survives a malformed percent-encoding in a link", () => {
    expect(() => checkLink("https://example.org/%E0%A4%A")).not.toThrow()
    expect(checkLink("https://example.org/%E0%A4%A")).toBeNull()
    expect(checkLink("https://example.org/%E0%A4%A/fuck")).toBe(LINK_MESSAGE)
  })

  it("passes a clean opening-hours correction", () => {
    expect(
      findUnsafeContent({
        fields: {
          kind: "record",
          openingTimes: {
            version: 1,
            days: [
              {
                day: "monday",
                enabled: true,
                timeframes: [
                  {
                    id: "a",
                    startTime: "09:00",
                    endTime: "17:00",
                    staffing: "staffed",
                  },
                ],
              },
            ],
          },
        },
      })
    ).toBeNull()
  })
})
