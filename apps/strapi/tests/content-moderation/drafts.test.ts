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

describe("draftRevision compare-and-set (finalize race)", () => {
  it("saveDraft bumps draftRevision on every write", async () => {
    const { strapi, store } = makeFakeStrapi({
      [UID]: [sub({ status: "draft", draftRevision: 3 })],
    })
    const res = await createService({ strapi }).saveDraft(
      "s0000000000000000000001",
      "u1",
      { title: "ok" },
      1
    )
    expect("data" in res).toBe(true)
    expect(store[UID][0].draftRevision).toBe(4)
  })

  it("finalizeDraft's compare-and-set fails when a concurrent saveDraft bumps draftRevision between the policy check and the write", async () => {
    const { strapi, store } = makeFakeStrapi({
      [UID]: [sub({ status: "draft", draftRevision: 3 })],
    })
    const result = await createService({ strapi }).finalizeDraft(
      "s0000000000000000000001",
      "u1",
      { title: "t" },
      async () => {
        // Simulate a concurrent saveDraft landing after finalize read the
        // row (and after its beforeTransition policy check ran) but before
        // finalize's own compare-and-set write.
        store[UID][0].draftRevision = 5

        return { ok: true }
      }
    )
    expect(result).toBeNull()
    expect(store[UID][0].status).toBe("draft")
  })
})

describe("extras are validated against the schema", () => {
  it("saveDraft rejects an unknown evidenceType and stores nothing", async () => {
    const { strapi, store } = makeFakeStrapi({
      [UID]: [sub({ status: "draft", evidenceType: "press_release" })],
    })
    const res = await createService({ strapi }).saveDraft(
      "s0000000000000000000001",
      "u1",
      { title: "ok", evidenceType: "hearsay" },
      1
    )
    expect(res).toMatchObject({ error: "invalid" })
    expect((res as any).message).toMatch(/evidence/i)
    expect(store[UID][0].evidenceType).toBe("press_release")
    expect(store[UID][0].draftData).toEqual({})
  })

  it("finalizeDraft refuses an unknown evidenceType with a 400 verdict", async () => {
    const { strapi, store } = makeFakeStrapi({
      [UID]: [sub({ status: "draft" })],
    })
    const res = await createService({ strapi }).finalizeDraft(
      "s0000000000000000000001",
      "u1",
      { title: "t", evidenceType: "hearsay" }
    )
    expect(res).toMatchObject({
      error: "policy",
      verdict: { ok: false, status: 400 },
    })
    expect(store[UID][0].status).toBe("draft")
  })

  it("caps editSummary at 255 and drops non-string extras", async () => {
    const { strapi, store } = makeFakeStrapi({
      [UID]: [sub({ status: "draft" })],
    })
    const res = await createService({ strapi }).saveDraft(
      "s0000000000000000000001",
      "u1",
      { title: "ok", editSummary: "x".repeat(300), note: { nope: 1 } },
      1
    )
    expect("data" in res).toBe(true)
    expect(store[UID][0].editSummary).toHaveLength(255)
    expect(store[UID][0].note).toBeUndefined()
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

describe("moderator-only draftData keys", () => {
  const target = { region: "r0000000000000000000001" }
  const edit = { name: "Renamed" }

  it("create drops moderatorTarget and moderatorEdit from the contributor's draftData", async () => {
    const { strapi, store } = makeFakeStrapi({ [UID]: [] })
    await createService({ strapi }).create({
      submissionType: "new_library",
      fields: { name: "A library" },
      draftData: {
        name: "A library",
        moderatorTarget: target,
        moderatorEdit: edit,
      },
      submittedByUserId: "u1",
      submittedByEmail: "u1@example.org",
      asDraft: true,
    })
    expect(store[UID][0].draftData).toEqual({ name: "A library" })
  })

  it("saveDraft drops them", async () => {
    const { strapi, store } = makeFakeStrapi({
      [UID]: [sub({ status: "draft", submissionType: "new_library" })],
    })
    const res = await createService({ strapi }).saveDraft(
      "s0000000000000000000001",
      "u1",
      { name: "A library", moderatorTarget: target, moderatorEdit: edit },
      1
    )
    expect("data" in res).toBe(true)
    expect(store[UID][0].draftData).toEqual({ name: "A library" })
  })

  it("finalizeDraft drops them from a draft saved before the rule, and hashes what it stores", async () => {
    const { strapi, store } = makeFakeStrapi({
      [UID]: [
        sub({
          status: "draft",
          submissionType: "location_request",
          draftData: { moderatorTarget: target, moderatorEdit: edit, step: 2 },
        }),
      ],
    })
    const result = await createService({ strapi }).finalizeDraft(
      "s0000000000000000000001",
      "u1",
      {}
    )
    expect(result).not.toBeNull()
    const row = store[UID][0]
    expect(row.status).toBe("pending")
    expect(row.draftData).toEqual({ step: 2 })
    expect(row.payloadHash).toBe(payloadHash(row))
  })
})
