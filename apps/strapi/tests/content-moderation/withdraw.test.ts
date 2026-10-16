import { describe, expect, it } from "vitest"

import createService from "../../src/plugins/content-moderation/server/services/submission"
import { canTransition } from "../../src/plugins/content-moderation/server/utils/transitions"
import { makeFakeStrapi } from "../helpers/fake-strapi"

const UID = "plugin::content-moderation.submission"
const AUDIT = "plugin::content-moderation.review-event"
const ID = "s0000000000000000000001"
const TIME = "2026-10-16T10:00:00.000Z"
const seed = (overrides: Record<string, unknown> = {}) =>
  makeFakeStrapi({
    [UID]: [
      {
        documentId: ID,
        submissionType: "blog_submission",
        submittedByUserId: "writer",
        updatedAt: TIME,
        draftRevision: 3,
        payloadHash: "old-pending-hash",
        status: "pending",
        fields: { title: "Keep this story" },
        draftData: {
          title: "Keep this story",
          baseRevision: "pinned-base",
          isNew: true,
        },
        ...overrides,
      },
    ],
  })

describe("writer article withdrawal", () => {
  it("allows pending-to-draft only for the explicit contributor withdrawal path", () => {
    expect(canTransition("pending", "draft")).toBe(false)
    expect(
      canTransition("pending", "draft", { contributorWithdraw: true })
    ).toBe(true)
    expect(
      canTransition("approved", "draft", { contributorWithdraw: true })
    ).toBe(false)
  })
  it("reopens the exact pending submission privately without losing text/base, and audits the contributor", async () => {
    const { strapi, store } = seed()
    const result = await createService({ strapi }).withdrawArticle(
      ID,
      "writer",
      TIME
    )
    expect(result).toMatchObject({
      data: {
        documentId: ID,
        status: "draft",
        fields: { title: "Keep this story" },
        draftData: { baseRevision: "pinned-base" },
      },
    })
    expect(store[UID][0]).toMatchObject({
      draftRevision: 4,
      payloadHash: null,
      reviewedByUserId: null,
    })
    expect(store[AUDIT]).toHaveLength(1)
    expect(store[AUDIT][0]).toMatchObject({
      fromStatus: "pending",
      toStatus: "draft",
      reviewerId: "ba:writer",
      reviewerKind: "contributor",
    })
    expect(
      (result as { data: Record<string, unknown> }).data
    ).not.toHaveProperty("payloadHash")
    expect(
      (result as { data: Record<string, unknown> }).data
    ).not.toHaveProperty("reviewedByUserId")
  })
  it("does not reveal another person's submission", async () => {
    const { strapi, store } = seed()
    expect(
      await createService({ strapi }).withdrawArticle(ID, "other", TIME)
    ).toEqual({ error: "not_found" })
    expect(
      await createService({ strapi }).withdrawArticle(
        "nonexistent",
        "writer",
        TIME
      )
    ).toEqual({ error: "not_found" })
    expect(store[UID][0].status).toBe("pending")
  })
  it.each(["approved", "rejected", "needs_info", "draft"])(
    "refuses to withdraw %s",
    async (status) => {
      const { strapi } = seed({ status })
      expect(
        await createService({ strapi }).withdrawArticle(ID, "writer", TIME)
      ).toEqual({ error: "conflict" })
    }
  )
  it("refuses a stale token and Library Claims without changing their trust workflow", async () => {
    const { strapi } = seed()
    expect(
      await createService({ strapi }).withdrawArticle(
        ID,
        "writer",
        "2026-10-16T09:00:00Z"
      )
    ).toEqual({ error: "conflict" })
    const claim = seed({ submissionType: "library_claim" })
    expect(
      await createService({ strapi: claim.strapi }).withdrawArticle(
        ID,
        "writer",
        TIME
      )
    ).toEqual({ error: "invalid" })
  })
  it("does not undo a review decision that commits between reading and compare-and-set", async () => {
    const { strapi, store } = seed()
    const normal = strapi.db.query.bind(strapi.db)
    strapi.db.query = (uid: string) => {
      const query = normal(uid)
      if (uid === UID) {
        const update = query.updateMany.bind(query)
        query.updateMany = async (args: any) => {
          store[UID][0].status = "approved"

          return update(args)
        }
      }

      return query
    }
    expect(
      await createService({ strapi }).withdrawArticle(ID, "writer", TIME)
    ).toEqual({ error: "conflict" })
    expect(store[UID][0].status).toBe("approved")
    expect(store[AUDIT] ?? []).toHaveLength(0)
  })
})
