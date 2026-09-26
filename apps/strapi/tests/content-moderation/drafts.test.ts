import { describe, expect, it } from "vitest"

import createService from "../../src/plugins/content-moderation/server/services/submission"
import { payloadHash } from "../../src/plugins/content-moderation/server/utils/payload-hash"
import { makeFakeStrapi } from "../helpers/fake-strapi"

const UID = "plugin::content-moderation.submission"
const sub = (over: Record<string, any>) => ({
  documentId: "s0000000000000000000001",
  submissionType: "wiki_edit",
  submittedByUserId: "u1",
  targetSlug: "a",
  fields: {},
  draftData: {},
  ...over,
})

describe("saveDraft", () => {
  it.each(["pending", "approved", "rejected", "needs_info"])(
    "refuses edits once %s",
    async (status) => {
      const { strapi, store } = makeFakeStrapi({ [UID]: [sub({ status })] })
      const res = await createService({ strapi }).saveDraft(
        "s0000000000000000000001",
        "u1",
        { title: "evil" },
        1
      )
      expect(res).toEqual({ error: "not_draft" })
      expect(store[UID][0].draftData).toEqual({})
    }
  )

  it("refuses edits by another user", async () => {
    const { strapi } = makeFakeStrapi({ [UID]: [sub({ status: "draft" })] })
    expect(
      await createService({ strapi }).saveDraft(
        "s0000000000000000000001",
        "u2",
        {},
        1
      )
    ).toEqual({ error: "forbidden" })
  })

  it("saves while in draft", async () => {
    const { strapi, store } = makeFakeStrapi({
      [UID]: [sub({ status: "draft" })],
    })
    const res = await createService({ strapi }).saveDraft(
      "s0000000000000000000001",
      "u1",
      { title: "ok" },
      2
    )
    expect("data" in res).toBe(true)
    expect(store[UID][0].draftData).toEqual({ title: "ok" })
  })
})

describe("payloadHash on entering review", () => {
  it("is set by create when not a draft", async () => {
    const { strapi, store } = makeFakeStrapi()
    await createService({ strapi }).create({
      submissionType: "correction",
      targetSlug: "x",
      fields: { a: 1 },
      submittedByUserId: "u1",
      submittedByEmail: "e",
    })
    expect(store[UID][0].status).toBe("pending")
    expect(store[UID][0].payloadHash).toBe(payloadHash(store[UID][0]))
  })

  it("is set by finalizeDraft", async () => {
    const { strapi, store } = makeFakeStrapi({
      [UID]: [sub({ status: "draft" })],
    })
    await createService({ strapi }).finalizeDraft(
      "s0000000000000000000001",
      "u1",
      { title: "t" }
    )
    expect(store[UID][0].status).toBe("pending")
    expect(store[UID][0].payloadHash).toBe(payloadHash(store[UID][0]))
  })
})
