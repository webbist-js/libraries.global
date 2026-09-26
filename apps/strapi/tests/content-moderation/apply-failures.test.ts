import { describe, expect, it, vi } from "vitest"

import submissionControllerFactory from "../../src/plugins/content-moderation/server/controllers/submission"
import createService from "../../src/plugins/content-moderation/server/services/submission"
import { payloadHash } from "../../src/plugins/content-moderation/server/utils/payload-hash"
import { makeFakeStrapi } from "../helpers/fake-strapi"

const SUB = "plugin::content-moderation.submission"
const WIKI = "api::wiki-article.wiki-article"
const LIB = "api::library.library"
const AFF = "api::library-affiliation.library-affiliation"
const PROFILE = "api::user-profile.user-profile"

function withHash(s: Record<string, any>) {
  return { ...s, payloadHash: payloadHash(s as any) }
}

const wikiEdit = () =>
  withHash({
    documentId: "s0000000000000000000010",
    submissionType: "wiki_edit",
    status: "pending",
    submittedByUserId: "u1",
    targetSlug: "a",
    fields: {},
    draftData: { title: "New title", locale: "en" },
  })

const newLibrary = () =>
  withHash({
    documentId: "s0000000000000000000011",
    submissionType: "new_library",
    status: "pending",
    submittedByUserId: "u1",
    fields: { name: "Lib" },
    draftData: null,
  })

const claim = () =>
  withHash({
    documentId: "s0000000000000000000012",
    submissionType: "library_claim",
    status: "pending",
    submittedByUserId: "u2",
    targetDocumentId: "lib00000000000000000001",
    fields: { role: "Librarian" },
    draftData: null,
  })

function setup(seed: Record<string, any[]>) {
  const f = makeFakeStrapi(seed)
  const award = vi.fn(async () => {})
  f.services["rewards.points"] = { award }
  f.services["api::user-profile.quick-wins"] = {
    computeAndSave: vi.fn(async () => {}),
  }
  f.services["i18n.locales"] = { find: async () => [{ code: "en" }] }
  f.services["content-moderation.submission-policy"] = {
    loadCapabilities: async () => ({
      caps: { set: new Set(["docs.directEdit"]), claimedLibraryIds: new Set() },
      tier: null,
    }),
  }

  return { ...f, award, svc: createService({ strapi: f.strapi }) }
}

/** Makes one method of documents(uid) throw, leaving everything else intact. */
function failOn(strapi: any, uid: string, method: string) {
  const original = strapi.documents
  strapi.documents = vi.fn((u: string) => {
    const api = original(u)
    if (u !== uid) return api

    return {
      ...api,
      [method]: vi.fn(async () => {
        throw new Error("db down")
      }),
    }
  })
}

const statusOf = (store: any, id: string) =>
  store[SUB].find((d: any) => d.documentId === id)?.status

describe("I1: side-effect errors revert the approval", () => {
  it("applyWikiEdit rethrows unexpected DB errors", async () => {
    const { strapi, svc } = setup({
      [WIKI]: [{ documentId: "wa1", slug: "a", title: "Old" }],
      [PROFILE]: [],
    })
    failOn(strapi, WIKI, "update")
    await expect(svc.applyWikiEdit(wikiEdit())).rejects.toThrow("db down")
  })

  it("applyWikiEdit still returns noop for a missing article", async () => {
    const { svc } = setup({ [WIKI]: [], [PROFILE]: [] })
    expect(await svc.applyWikiEdit(wikiEdit())).toBe("noop")
  })

  it("a wiki_edit DB error returns apply_failed, reverts, and awards nothing", async () => {
    const sub = wikiEdit()
    const { strapi, store, svc, award } = setup({
      [SUB]: [sub],
      [WIKI]: [{ documentId: "wa1", slug: "a", title: "Old" }],
      [PROFILE]: [],
    })
    failOn(strapi, WIKI, "update")

    const result = await svc.updateStatus(sub.documentId, "approved", "admin1")

    expect(result).toEqual({ error: "apply_failed" })
    expect(statusOf(store, sub.documentId)).toBe("pending")
    expect(award).not.toHaveBeenCalled()
  })

  it("a new_library creation error returns apply_failed and reverts", async () => {
    const sub = newLibrary()
    const { strapi, store, svc, award } = setup({ [SUB]: [sub], [LIB]: [] })
    failOn(strapi, LIB, "create")

    const result = await svc.updateStatus(sub.documentId, "approved", "admin1")

    expect(result).toEqual({ error: "apply_failed" })
    expect(statusOf(store, sub.documentId)).toBe("pending")
    expect(store[LIB]).toHaveLength(0)
    expect(award).not.toHaveBeenCalled()
  })
})

describe("I3: partial claim approval and revert failures", () => {
  const libSeed = [{ documentId: "lib00000000000000000001", name: "L" }]

  it("deletes an affiliation it created when grantVerifiedLibrarian throws", async () => {
    const sub = claim()
    const { strapi, store, svc } = setup({
      [SUB]: [sub],
      [LIB]: libSeed,
      [AFF]: [],
      [PROFILE]: [{ documentId: "p2", baUserId: "u2" }],
    })
    failOn(strapi, PROFILE, "update")

    const result = await svc.updateStatus(sub.documentId, "approved", "admin1")

    expect(result).toEqual({ error: "apply_failed" })
    expect(store[AFF]).toHaveLength(0)
    expect(statusOf(store, sub.documentId)).toBe("pending")
  })

  it("keeps a pre-existing affiliation when grantVerifiedLibrarian throws", async () => {
    const sub = claim()
    const { strapi, store, svc } = setup({
      [SUB]: [sub],
      [LIB]: libSeed,
      [AFF]: [
        {
          documentId: "aff1",
          baUserId: "u2",
          library: { documentId: "lib00000000000000000001" },
        },
      ],
      [PROFILE]: [{ documentId: "p2", baUserId: "u2" }],
    })
    failOn(strapi, PROFILE, "update")

    const result = await svc.updateStatus(sub.documentId, "approved", "admin1")

    expect(result).toEqual({ error: "apply_failed" })
    expect(store[AFF].map((a: any) => a.documentId)).toEqual(["aff1"])
  })

  it("reports unreverted when the revert matches no row", async () => {
    const sub = newLibrary()
    const { strapi, store, svc } = setup({ [SUB]: [sub], [LIB]: [] })
    failOn(strapi, LIB, "create")
    const originalQuery = strapi.db.query
    let calls = 0
    strapi.db.query = vi.fn((uid: string) => {
      const api = originalQuery(uid)

      return {
        ...api,
        updateMany: vi.fn(async (args: any) =>
          ++calls === 1 ? api.updateMany(args) : { count: 0 }
        ),
      }
    })

    const result = await svc.updateStatus(sub.documentId, "approved", "admin1")

    expect(result).toEqual({ error: "apply_failed", unreverted: true })
    expect(statusOf(store, sub.documentId)).toBe("approved")
    expect(strapi.log.error).toHaveBeenCalledWith(
      expect.stringContaining(
        "approval revert failed; submission left approved without side effects"
      )
    )
  })

  it("reports unreverted when the revert throws", async () => {
    const sub = newLibrary()
    const { strapi, svc } = setup({ [SUB]: [sub], [LIB]: [] })
    failOn(strapi, LIB, "create")
    const originalQuery = strapi.db.query
    let calls = 0
    strapi.db.query = vi.fn((uid: string) => {
      const api = originalQuery(uid)

      return {
        ...api,
        updateMany: vi.fn(async (args: any) => {
          if (++calls === 1) return api.updateMany(args)
          throw new Error("connection lost")
        }),
      }
    })

    const result = await svc.updateStatus(sub.documentId, "approved", "admin1")

    expect(result).toEqual({ error: "apply_failed", unreverted: true })
  })
})

describe("controller responses", () => {
  function harness(services: Record<string, any>) {
    const f = makeFakeStrapi({ [SUB]: [] })
    Object.assign(f.services, services)

    return submissionControllerFactory({ strapi: f.strapi })
  }

  it("returns apply_failed_unreverted with an honest message", async () => {
    const controller = harness({
      "content-moderation.submission": {
        updateStatus: async () => ({ error: "apply_failed", unreverted: true }),
      },
    })
    const ctx: any = {
      params: { id: "s0000000000000000000011" },
      request: { body: { status: "approved" }, headers: {} },
      state: { admin: { id: 1, email: "mod@example.com" } },
      badRequest: vi.fn(),
      notFound: vi.fn(),
      forbidden: vi.fn(),
    }

    await controller.updateStatus(ctx)

    expect(ctx.status).toBe(500)
    expect(ctx.body.error.name).toBe("apply_failed_unreverted")
    expect(ctx.body.error.message).not.toMatch(/returned to review\./)
  })

  it("keeps the returned-to-review message when the revert succeeded", async () => {
    const controller = harness({
      "content-moderation.submission": {
        updateStatus: async () => ({ error: "apply_failed" }),
      },
    })
    const ctx: any = {
      params: { id: "s0000000000000000000011" },
      request: { body: { status: "approved" }, headers: {} },
      state: { admin: { id: 1, email: "mod@example.com" } },
      badRequest: vi.fn(),
      notFound: vi.fn(),
      forbidden: vi.fn(),
    }

    await controller.updateStatus(ctx)

    expect(ctx.body.error.name).toBe("apply_failed")
    expect(ctx.body.error.message).toMatch(/returned to review/)
  })

  it("sets Retry-After on a 429 policy verdict", async () => {
    process.env.STRAPI_BRIDGE_SECRET = "test-secret"
    const controller = harness({
      "content-moderation.submission-policy": {
        check: async () => ({ ok: false, status: 429, message: "Slow down" }),
      },
    })
    const ctx: any = {
      request: {
        body: { submissionType: "correction", fields: {} },
        headers: {
          "x-service-secret": "test-secret",
          "x-ba-user-id": "u1",
          "x-ba-user-email": "u1@example.com",
        },
      },
      state: {},
      set: vi.fn(),
      unauthorized: vi.fn(),
      badRequest: vi.fn(),
    }

    await controller.create(ctx)

    expect(ctx.status).toBe(429)
    expect(ctx.set).toHaveBeenCalledWith("Retry-After", "3600")
  })
})

describe("M2: internal fields never reach clients", () => {
  it("findAll and findByUser strip payloadHash and draftRevision", async () => {
    const sub = { ...claim(), draftRevision: 3 }
    const { svc } = setup({ [SUB]: [sub] })

    for (const rows of [await svc.findAll(), await svc.findByUser("u2")]) {
      expect(rows).toHaveLength(1)
      expect(rows[0]).not.toHaveProperty("payloadHash")
      expect(rows[0]).not.toHaveProperty("draftRevision")
      expect(rows[0].documentId).toBe(sub.documentId)
    }
  })

  it("findDraft strips them too", async () => {
    const { svc } = setup({
      [SUB]: [
        {
          documentId: "d1",
          status: "draft",
          submissionType: "correction",
          submittedByUserId: "u1",
          draftRevision: 2,
        },
      ],
    })
    const draft = await svc.findDraft("u1", "correction")
    expect(draft).not.toHaveProperty("draftRevision")
    expect(draft.documentId).toBe("d1")
  })
})
