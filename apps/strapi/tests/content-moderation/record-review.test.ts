import { describe, expect, it, vi } from "vitest"

import createService from "../../src/plugins/content-moderation/server/services/submission"
import { recordReview } from "../../src/plugins/content-moderation/server/utils/record-review"
import { makeFakeStrapi } from "../helpers/fake-strapi"

const LIBRARY = "api::library.library"
const ACC = "api::accessibility.accessibility"
const LIFT = "acc00000000000000000001"
const LOOP = "acc00000000000000000002"

describe("recordReview", () => {
  it("uses the published timetable and populated names for a home branch change", async () => {
    const target = "lib00000000000000000001",
      oldHome = "lib00000000000000000002",
      newHome = "lib00000000000000000003"
    const live = { version: 1 },
      draft = { version: 2 }
    const { strapi } = makeFakeStrapi({
      [LIBRARY]: [
        {
          documentId: target,
          mobileTimetable: draft,
          __published: {
            documentId: target,
            mobileTimetable: live,
            homeLibrary: { documentId: oldHome, name: "Old branch" },
          },
        },
        { documentId: newHome, name: "New branch" },
      ],
    })
    const review = await recordReview(strapi, {
      targetDocumentId: target,
      fields: {
        kind: "record",
        mobileTimetable: live,
        previousHash: "base",
        homeLibrary: newHome,
      },
    })
    expect(review).toEqual({
      current: { mobileTimetable: live, homeLibrary: oldHome },
      names: { [oldHome]: "Old branch", [newHome]: "New branch" },
    })
    const reads = strapi.documents.mock.results.flatMap(
      (result: any) => result.value.findOne?.mock.calls ?? []
    )
    expect(reads[0][0].fields).not.toContain("homeLibrary")
    expect(reads[0][0].fields).not.toContain("previousHash")
  })
  it("reads live values and option names from Strapi, not the contributor", async () => {
    const { strapi } = makeFakeStrapi({
      [LIBRARY]: [
        {
          documentId: "lib00000000000000000001",
          slug: "nailsea-library",
          name: "Nailsea Library",
          accessibility: [{ documentId: LOOP, name: "Hearing loop" }],
        },
      ],
      [ACC]: [
        { documentId: LIFT, name: "Lift" },
        { documentId: LOOP, name: "Hearing loop" },
      ],
    })
    const review = await recordReview(strapi, {
      targetSlug: "nailsea-library",
      fields: {
        kind: "record",
        category: "Accessibility",
        name: "Nailsea Community Library",
        accessibility: { connect: [LIFT], disconnect: [LOOP] },
        previous: { name: "Made-up old name" },
      },
    })
    expect(review).toEqual({
      current: { name: "Nailsea Library", accessibility: [LOOP] },
      names: { [LOOP]: "Hearing loop", [LIFT]: "Lift" },
    })
  })

  it("the admin queue batches its library and option lookups", async () => {
    const SUB = "plugin::content-moderation.submission"
    const TOPIC = "api::topic.topic"
    const made = makeFakeStrapi({
      [LIBRARY]: [
        {
          documentId: "lib00000000000000000001",
          slug: "nailsea-library",
          name: "Nailsea Library",
          accessibility: [],
        },
        {
          documentId: "lib00000000000000000002",
          slug: "clevedon-library",
          name: "Clevedon Library",
          city: "Clevedon",
          accessibility: [],
        },
      ],
      [ACC]: [
        { documentId: LIFT, name: "Lift" },
        { documentId: LOOP, name: "Hearing loop" },
      ],
      [TOPIC]: [
        {
          documentId: "top00000000000000000001",
          name: "Ghost tours",
          slug: "ghost-tours",
          status: "pending",
        },
      ],
      [SUB]: [
        {
          documentId: "s1",
          status: "pending",
          submissionType: "correction",
          targetDocumentId: "lib00000000000000000001",
          fields: {
            kind: "record",
            name: "A",
            accessibility: { connect: [LIFT] },
          },
        },
        {
          documentId: "s2",
          status: "needs_info",
          submissionType: "correction",
          targetSlug: "clevedon-library",
          fields: {
            kind: "record",
            city: "B",
            accessibility: { connect: [LOOP] },
          },
        },
        {
          documentId: "s3",
          status: "pending",
          submissionType: "library_edit",
          targetDocumentId: "lib00000000000000000002",
          fields: { kind: "record", name: "C" },
        },
        {
          documentId: "s4",
          status: "pending",
          submissionType: "topic_suggestion",
          targetEntityType: "topic",
          targetDocumentId: "top00000000000000000001",
          fields: { name: "Ghost tours" },
        },
      ],
    })
    const perUid = new Map<string, any>()
    const fresh = made.strapi.documents
    made.strapi.documents = vi.fn((uid: string) => {
      if (!perUid.has(uid)) perUid.set(uid, fresh(uid))

      return perUid.get(uid)
    })
    const rows = await createService({ strapi: made.strapi }).findAll()
    const byId = Object.fromEntries(rows.map((r: any) => [r.documentId, r]))
    expect(byId.s1.review).toEqual({
      current: { name: "Nailsea Library", accessibility: [] },
      names: { [LIFT]: "Lift" },
    })
    expect(byId.s2.review).toEqual({
      current: { city: "Clevedon", accessibility: [] },
      names: { [LOOP]: "Hearing loop" },
    })
    expect(byId.s3.review.current).toEqual({ name: "Clevedon Library" })
    expect(byId.s4.review).toEqual({
      topic: { name: "Ghost tours", slug: "ghost-tours", status: "pending" },
    })
    // Live field values and the published staff hint each use one batched
    // query; neither query runs once per submission.
    expect(made.strapi.documents(LIBRARY).findMany).toHaveBeenCalledTimes(2)
    expect(made.strapi.documents(LIBRARY).findOne).not.toHaveBeenCalled()
    expect(made.strapi.documents(ACC).findMany).toHaveBeenCalledTimes(1)
    expect(made.strapi.documents(TOPIC).findMany).toHaveBeenCalledTimes(1)
  })

  it("is null for anything but a record correction", async () => {
    const { strapi } = makeFakeStrapi({})
    expect(
      await recordReview(strapi, { fields: { category: "Name" } })
    ).toBeNull()
  })
})
