import { describe, expect, it, vi } from "vitest"

import createController from "../../src/plugins/content-moderation/server/controllers/submission"
import createService from "../../src/plugins/content-moderation/server/services/submission"
import { payloadHash } from "../../src/plugins/content-moderation/server/utils/payload-hash"
import {
  adminReviewer,
  contributorReviewer,
  isSelfReview,
  systemReviewer,
} from "../../src/plugins/content-moderation/server/utils/reviewer"
import {
  type ChangeContext,
  resolveChangeContext,
} from "../../src/utils/change-context"
import { makeFakeStrapi } from "../helpers/fake-strapi"

const SUB = "plugin::content-moderation.submission"
const EVENT = "plugin::content-moderation.review-event"
const LIBRARY = "api::library.library"
const ADMIN = adminReviewer({ id: 7, email: "mod@example.org" })

const pending = (over: Record<string, any> = {}) => {
  const s: any = {
    documentId: "s0000000000000000000001",
    submissionType: "correction",
    status: "pending",
    submittedByUserId: "u1",
    submittedByEmail: "Sub@Example.org",
    submittedByName: "Sam",
    targetSlug: "x",
    fields: { a: 1 },
    draftData: null,
    editSummary: "fixed the hours",
    ...over,
  }
  s.payloadHash = payloadHash(s)

  return s
}

function setup(seed?: Record<string, any[]>) {
  const f = makeFakeStrapi(seed ?? { [SUB]: [pending()] })
  f.services["rewards.points"] = { award: vi.fn(async () => {}) }
  const svc: any = createService({ strapi: f.strapi })
  f.services["content-moderation.submission"] = svc

  return { ...f, svc, events: () => f.store[EVENT] ?? [] }
}

describe("reviewer helpers", () => {
  it("prefixes ids by kind", () => {
    expect(adminReviewer({ id: 3, email: "a@b.c" })).toEqual({
      id: "admin:3",
      kind: "admin",
      email: "a@b.c",
      baUserId: null,
    })
    expect(contributorReviewer({ id: "u9" })).toEqual({
      id: "ba:u9",
      kind: "contributor",
      email: null,
      baUserId: "u9",
    })
  })

  it("matches a contributor by baUserId and an admin by trimmed, case-insensitive email", () => {
    const s = { submittedByUserId: "u1", submittedByEmail: " Sub@Example.org " }
    expect(isSelfReview(contributorReviewer({ id: "u1" }), s)).toBe(true)
    expect(isSelfReview(contributorReviewer({ id: "u2" }), s)).toBe(false)
    expect(
      isSelfReview(adminReviewer({ id: 1, email: "sub@example.org" }), s)
    ).toBe(true)
    expect(
      isSelfReview(adminReviewer({ id: 1, email: "other@example.org" }), s)
    ).toBe(false)
    expect(isSelfReview(adminReviewer({ id: 1, email: "" }), s)).toBe(false)
    expect(
      isSelfReview(adminReviewer({ id: 1, email: "" }), {
        submittedByUserId: "u1",
        submittedByEmail: "",
      })
    ).toBe(false)
  })

  it("the system reviewer is never a self-review", () => {
    expect(systemReviewer()).toMatchObject({ id: "system", kind: "system" })
    expect(isSelfReview(systemReviewer(), { submittedByUserId: "u1" })).toBe(
      false
    )
    expect(
      isSelfReview(systemReviewer(), {
        submittedByUserId: "u1",
        submittedByEmail: "sub@example.org",
      })
    ).toBe(false)
  })
})

describe("Review Events on updateStatus", () => {
  it("approving writes exactly one Review Event with from, to and reviewer", async () => {
    const { svc, events, store } = setup()
    const res = await svc.updateStatus(
      "s0000000000000000000001",
      "approved",
      ADMIN,
      "looks right"
    )
    expect("data" in res).toBe(true)
    expect(events()).toHaveLength(1)
    expect(events()[0]).toMatchObject({
      submissionDocumentId: "s0000000000000000000001",
      fromStatus: "pending",
      toStatus: "approved",
      reviewerId: "admin:7",
      reviewerKind: "admin",
      note: "looks right",
    })
    expect(store[SUB][0].reviewedByUserId).toBe("admin:7")
  })

  it("a lost compare-and-set writes no Review Event", async () => {
    const { strapi, svc, events } = setup()
    const originalQuery = strapi.db.query
    strapi.db.query = vi.fn((uid: string) => ({
      ...originalQuery(uid),
      updateMany: vi.fn(async () => ({ count: 0 })),
    }))
    expect(
      await svc.updateStatus("s0000000000000000000001", "approved", ADMIN)
    ).toEqual({ error: "conflict" })
    expect(events()).toHaveLength(0)
  })

  it("a failing apply rolls the Review Event back with the status", async () => {
    const { svc, events, store } = setup()
    svc.applyFacilityAnswers = vi.fn(async () => {
      throw new Error("boom")
    })
    expect(
      await svc.updateStatus("s0000000000000000000001", "approved", ADMIN)
    ).toEqual({ error: "apply_failed" })
    expect(events()).toHaveLength(0)
    expect(store[SUB][0].status).toBe("pending")
  })

  it("a contributor reviewer approving their own submission gets self_review", async () => {
    const { svc, events, store } = setup()
    expect(
      await svc.updateStatus(
        "s0000000000000000000001",
        "approved",
        contributorReviewer({ id: "u1" })
      )
    ).toEqual({ error: "self_review" })
    expect(events()).toHaveLength(0)
    expect(store[SUB][0].status).toBe("pending")
  })

  it.each(["sub@example.org", " SUB@EXAMPLE.ORG ", "Sub@Example.org"])(
    "an admin with the submitter's email (%j) gets self_review",
    async (email) => {
      const { svc, store } = setup()
      expect(
        await svc.updateStatus(
          "s0000000000000000000001",
          "approved",
          adminReviewer({ id: 1, email })
        )
      ).toEqual({ error: "self_review" })
      expect(store[SUB][0].status).toBe("pending")
    }
  )

  it("apply side effects run in the submitter's change context with the reviewer", async () => {
    const { svc } = setup()
    let seen: ChangeContext | undefined
    svc.applyFacilityAnswers = vi.fn(async () => {
      seen = resolveChangeContext({})

      return "applied"
    })
    await svc.updateStatus("s0000000000000000000001", "approved", ADMIN)
    expect(seen).toEqual({
      source: "submission",
      actorKind: "contributor",
      actorId: "ba:u1",
      actorName: "Sam",
      reviewerId: "admin:7",
      submissionDocumentId: "s0000000000000000000001",
      editSummary: "fixed the hours",
    })
  })

  it("new_library approval stores the created library's documentId", async () => {
    const { svc, store } = setup({
      [SUB]: [
        pending({
          submissionType: "new_library",
          fields: { name: "New Lib" },
          evidenceType: "institutional_url",
          evidenceUrl: "https://library.example.org/",
          editSummary: null,
        }),
      ],
    })
    const res = await svc.updateStatus(
      "s0000000000000000000001",
      "approved",
      ADMIN
    )
    expect("data" in res).toBe(true)
    const lib = store[LIBRARY][0]
    expect(lib.sourceRecords).toEqual([
      { role: "reference", url: "https://library.example.org/" },
    ])
    expect(store[SUB][0].resultDocumentId).toBe(lib.documentId)
    expect((res as any).data.resultDocumentId).toBe(lib.documentId)
  })

  it("new_library's library create sees the change context", async () => {
    const { strapi, svc } = setup({
      [SUB]: [
        pending({ submissionType: "new_library", fields: { name: "N" } }),
      ],
    })
    let seen: ChangeContext | undefined
    const original = strapi.documents
    strapi.documents = vi.fn((uid: string) => {
      const api = original(uid)
      if (uid !== LIBRARY) return api

      return {
        ...api,
        create: vi.fn(async (args: any) => {
          seen = resolveChangeContext({})

          return api.create(args)
        }),
      }
    })
    await svc.updateStatus("s0000000000000000000001", "approved", ADMIN)
    expect(seen?.actorId).toBe("ba:u1")
    expect(seen?.reviewerId).toBe("admin:7")
  })

  it("article approvals that create an article store its documentId", async () => {
    const { svc, store } = setup({
      [SUB]: [
        pending({
          submissionType: "wiki_edit",
          fields: {},
          draftData: { kind: "new_article", title: "T" },
        }),
      ],
    })
    svc.applyArticle = vi.fn(async () => ({
      outcome: "created_draft",
      documentId: "art00000000000000000001",
    }))
    await svc.updateStatus("s0000000000000000000001", "approved", ADMIN)
    expect(store[SUB][0].resultDocumentId).toBe("art00000000000000000001")
  })
})

describe("Review Events on finalizeDraft", () => {
  it("finalize writes draft → pending by the submitter", async () => {
    const { svc, events } = setup({
      [SUB]: [
        {
          documentId: "s0000000000000000000001",
          submissionType: "correction",
          status: "draft",
          submittedByUserId: "u1",
          submittedByEmail: "u1@x.org",
          fields: { a: 1 },
          draftRevision: 0,
        },
      ],
    })
    const res = await svc.finalizeDraft("s0000000000000000000001", "u1", {
      a: 2,
    })
    expect(res).toBeTruthy()
    expect(events()).toHaveLength(1)
    expect(events()[0]).toMatchObject({
      submissionDocumentId: "s0000000000000000000001",
      fromStatus: "draft",
      toStatus: "pending",
      reviewerId: "ba:u1",
      reviewerKind: "contributor",
    })
  })
})

describe("admin controller updateStatus", () => {
  it("passes an admin reviewer and maps self_review to 403", async () => {
    const { strapi, svc } = setup()
    const spy = vi.spyOn(svc, "updateStatus")
    const forbidden = vi.fn()
    await createController({ strapi }).updateStatus({
      params: { id: "s0000000000000000000001" },
      request: { body: { status: "approved" } },
      state: { user: { id: 4, email: " sub@example.org" } },
      badRequest: vi.fn(),
      forbidden,
    })
    expect(spy).toHaveBeenCalledWith(
      "s0000000000000000000001",
      "approved",
      {
        id: "admin:4",
        kind: "admin",
        email: " sub@example.org",
        baUserId: null,
      },
      undefined
    )
    expect(forbidden).toHaveBeenCalledWith(
      "You can't review your own submission."
    )
  })
})

describe("saveDraft locale", () => {
  it("recomputes contentLocale when an article draft's locale changes", async () => {
    const f = makeFakeStrapi({
      [SUB]: [
        {
          documentId: "s0000000000000000000001",
          submissionType: "wiki_edit",
          status: "draft",
          submittedByUserId: "u1",
          targetSlug: "a",
          contentLocale: "en",
          draftData: { locale: "en" },
          fields: {},
        },
      ],
    })
    f.services["i18n.locales"] = {
      find: async () => [
        { code: "en", isDefault: true },
        { code: "cs", isDefault: false },
      ],
    }
    const svc: any = createService({ strapi: f.strapi })
    await svc.saveDraft("s0000000000000000000001", "u1", { locale: "cs" }, 1)
    expect(f.store[SUB][0].contentLocale).toBe("cs")
    const found = await svc.findDraft("u1", "wiki_edit", "a", "cs")
    expect(found?.documentId).toBe("s0000000000000000000001")

    // An unknown locale normalises to the default, as create/finalize do.
    await svc.saveDraft("s0000000000000000000001", "u1", { locale: "xx" }, 1)
    expect(f.store[SUB][0].contentLocale).toBe("en")
  })

  it("leaves a library draft's contentLocale alone", async () => {
    const f = makeFakeStrapi({
      [SUB]: [
        {
          documentId: "s0000000000000000000001",
          submissionType: "correction",
          status: "draft",
          submittedByUserId: "u1",
          contentLocale: "cs",
          fields: {},
        },
      ],
    })
    f.services["i18n.locales"] = {
      find: async () => [
        { code: "en", isDefault: true },
        { code: "cs", isDefault: false },
      ],
    }
    await createService({ strapi: f.strapi }).saveDraft(
      "s0000000000000000000001",
      "u1",
      { locale: "en", name: "x" },
      1
    )
    expect(f.store[SUB][0].contentLocale).toBe("cs")
  })
})
