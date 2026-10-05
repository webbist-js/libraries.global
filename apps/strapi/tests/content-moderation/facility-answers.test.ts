import { describe, expect, it, vi } from "vitest"

import createService from "../../src/plugins/content-moderation/server/services/submission"
import { parseFacilityAnswers } from "../../src/plugins/content-moderation/server/utils/facility-answers"
import { payloadHash } from "../../src/plugins/content-moderation/server/utils/payload-hash"
import { adminReviewer } from "../../src/plugins/content-moderation/server/utils/reviewer"
import { makeFakeStrapi } from "../helpers/fake-strapi"

const REVIEWER = adminReviewer({ id: 1, email: "moderator@example.org" })

const SUB = "plugin::content-moderation.submission"
const LIB = "api::library.library"
const ACC = "api::accessibility.accessibility"
const AMEN = "api::amenity.amenity"
const SERV = "api::service.service"

const LIB_ID = "li3iupdwjpxlpq6pg6pgk4b3"

function withHash(s: Record<string, any>) {
  return { ...s, payloadHash: payloadHash(s as any) }
}

const facilities = (
  answers: Record<string, unknown>,
  extra: Record<string, unknown> = {}
) =>
  withHash({
    documentId: "s0000000000000000000040",
    submissionType: "correction",
    status: "pending",
    submittedByUserId: "u1",
    targetEntityType: "library",
    targetSlug: "nailsea-library",
    fields: {
      kind: "facilities",
      category: "Accessibility",
      libraryName: "Nailsea Library",
      answers,
    },
    draftData: null,
    ...extra,
  })

const TAXONOMY = {
  [ACC]: [
    { documentId: "acc-stepfree", name: "Step-free access" },
    { documentId: "acc-loop", name: "Hearing loop" },
    { documentId: "acc-lowvision", name: "Low vision support" },
  ],
  [AMEN]: [{ documentId: "amen-wifi", name: "Wi-Fi" }],
  [SERV]: [{ documentId: "serv-cafe", name: "Cafes & restaurant" }],
}

function setup(library: Record<string, unknown> = {}, sub = facilities({})) {
  const f = makeFakeStrapi({
    [SUB]: [sub],
    [LIB]: [
      {
        documentId: LIB_ID,
        slug: "nailsea-library",
        locale: "en",
        absentFacilities: null,
        ...library,
      },
    ],
    ...TAXONOMY,
  })
  f.services["rewards.points"] = { award: vi.fn(async () => {}) }

  return { ...f, svc: createService({ strapi: f.strapi }) }
}

/** The data of every documents(LIB).update call. */
const libraryUpdates = (fake: any): any[] =>
  fake.documents.mock.calls
    .map((call: any[], i: number) =>
      call[0] === LIB ? fake.documents.mock.results[i].value : null
    )
    .filter(Boolean)
    .flatMap((api: any) => api.update.mock.calls.map((c: any[]) => c[0]))

describe("parseFacilityAnswers", () => {
  it("keeps only checklist questions with yes or no", () => {
    const parsed = parseFacilityAnswers({
      kind: "facilities",
      answers: {
        "Hearing loop": "yes",
        "Wi-Fi": "no",
        "Free biscuits": "yes",
        Café: "maybe",
      },
    })

    expect(parsed.map((p) => [p.check.label, p.answer])).toEqual([
      ["Hearing loop", "yes"],
      ["Wi-Fi", "no"],
    ])
  })

  it("ignores other corrections", () => {
    expect(parseFacilityAnswers({ category: "Opening hours" })).toEqual([])
    expect(parseFacilityAnswers(null)).toEqual([])
  })
})

describe("approving facility answers", () => {
  it("connects yes answers, records no answers and publishes", async () => {
    const sub = facilities({
      "Step-free entrance": "yes",
      "Wi-Fi": "yes",
      Café: "yes",
      "Hearing loop": "no",
    })
    const { strapi, svc } = setup({}, sub)

    const result = await svc.updateStatus(sub.documentId, "approved", REVIEWER)

    expect(result).not.toHaveProperty("error")
    const [update] = libraryUpdates(strapi)
    expect(update).toMatchObject({
      documentId: LIB_ID,
      locale: "en",
      status: "published",
    })
    expect(update.data.accessibility).toEqual({
      connect: [{ documentId: "acc-stepfree" }],
      disconnect: [{ documentId: "acc-loop" }],
    })
    expect(update.data.amenities).toEqual({
      connect: [{ documentId: "amen-wifi" }],
      disconnect: [],
    })
    expect(update.data.services).toEqual({
      connect: [{ documentId: "serv-cafe" }],
      disconnect: [],
    })
    expect(update.data.absentFacilities).toEqual(["Hearing loop"])
  })

  it("a later yes clears an earlier no", async () => {
    const sub = facilities({ "Hearing loop": "yes" })
    const { strapi, svc } = setup(
      { absentFacilities: ["Hearing loop", "Café"] },
      sub
    )

    await svc.updateStatus(sub.documentId, "approved", REVIEWER)

    const [update] = libraryUpdates(strapi)
    expect(update.data.absentFacilities).toEqual(["Café"])
    expect(update.data.accessibility.connect).toEqual([
      { documentId: "acc-loop" },
    ])
  })

  it("prefers the reviewed targetDocumentId over the slug", async () => {
    const sub = facilities(
      { "Wi-Fi": "yes" },
      { targetDocumentId: LIB_ID, targetSlug: "someone-else" }
    )
    const { strapi, svc } = setup({}, sub)

    await svc.updateStatus(sub.documentId, "approved", REVIEWER)

    expect(libraryUpdates(strapi)[0].documentId).toBe(LIB_ID)
  })

  it("skips a yes whose CMS entry is missing, but still records answers it can", async () => {
    const sub = facilities({ "Accessible toilets": "yes", "Wi-Fi": "no" })
    const { strapi, svc } = setup({}, sub)

    await svc.updateStatus(sub.documentId, "approved", REVIEWER)

    const [update] = libraryUpdates(strapi)
    expect(update.data.accessibility.connect).toEqual([])
    expect(update.data.absentFacilities).toEqual(["Wi-Fi"])
    expect(strapi.log.warn).toHaveBeenCalled()
  })

  it("leaves the library alone for other corrections and bad answers", async () => {
    const plain = withHash({
      documentId: "s0000000000000000000041",
      submissionType: "correction",
      status: "pending",
      submittedByUserId: "u1",
      targetSlug: "nailsea-library",
      fields: { category: "Opening hours" },
      draftData: null,
    })
    const { strapi, svc } = setup({}, plain)

    await svc.updateStatus(plain.documentId, "approved", REVIEWER)

    expect(libraryUpdates(strapi)).toEqual([])
  })

  it("reverts the approval when the library update fails", async () => {
    const sub = facilities({ "Wi-Fi": "yes" })
    const { strapi, store, svc } = setup({}, sub)
    const original = strapi.documents
    strapi.documents = vi.fn((uid: string) => {
      const api = original(uid)

      return uid === LIB
        ? {
            ...api,
            update: vi.fn(async () => {
              throw new Error("db down")
            }),
          }
        : api
    })

    const result = await svc.updateStatus(sub.documentId, "approved", REVIEWER)

    expect(result).toEqual({ error: "apply_failed" })
    expect(
      store[SUB].find((d: any) => d.documentId === sub.documentId)?.status
    ).toBe("pending")
  })
})
