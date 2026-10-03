import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import createModerationController from "../../src/plugins/content-moderation/server/controllers/moderation"
import createModerationService from "../../src/plugins/content-moderation/server/services/moderation"
import createService from "../../src/plugins/content-moderation/server/services/submission"
import createPolicy from "../../src/plugins/content-moderation/server/services/submission-policy"
import { validateLocationRequestFields } from "../../src/plugins/content-moderation/server/utils/params"
import { payloadHash } from "../../src/plugins/content-moderation/server/utils/payload-hash"
import { adminReviewer } from "../../src/plugins/content-moderation/server/utils/reviewer"
import { makeFakeStrapi } from "../helpers/fake-strapi"

const SUB = "plugin::content-moderation.submission"
const ROLE_GRANT = "api::role-grant.role-grant"
const CONTINENT = "api::continent.continent"
const COUNTRY = "api::country.country"
const REGION = "api::region.region"
const AREA = "api::area.area"
const LIBRARY = "api::library.library"

const SECRET = "test-bridge-secret"
const REVIEWER = adminReviewer({ id: 7, email: "mod@example.org" })
const INDEX_MOD = "modindex"

const C = "c00000000000000000000001"
const K = "k00000000000000000000001"
const K2 = "k00000000000000000000002"
const R = "r00000000000000000000001"
const REQ = "s00000000000000000000001"
const LIB_SUB = "s00000000000000000000002"

const PLACES = {
  [CONTINENT]: [{ documentId: C, slug: "europe" }],
  [COUNTRY]: [
    { documentId: K, slug: "gb", continent: { documentId: C } },
    { documentId: K2, slug: "fr", continent: { documentId: C } },
  ],
  [REGION]: [
    { id: 1, documentId: R, slug: "kent", country: { documentId: K } },
    // Same name in another country: the new slug must still be unique.
    { id: 2, documentId: "r00000000000000000000002", slug: "somerset" },
    { id: 3, documentId: "r00000000000000000000003", slug: "somerset-2" },
  ],
  [AREA]: [] as any[],
}

const regionFields = (over: Record<string, unknown> = {}) => ({
  kind: "region",
  name: "Somerset",
  typeLabel: "County",
  countryDocumentId: K,
  evidenceUrl: "https://example.org/somerset",
  ...over,
})

function setup(extra: Record<string, any[]> = {}) {
  const f = makeFakeStrapi({
    ...structuredClone(PLACES),
    [ROLE_GRANT]: [
      {
        documentId: "rgmodindex0000000000000",
        baUserId: INDEX_MOD,
        role: "moderator",
        queue: "index",
        scopeLocale: null,
      },
    ],
    ...extra,
  })
  // One API object per uid, so calls can be inspected.
  const fresh = f.strapi.documents
  const perUid = new Map<string, any>()
  f.strapi.documents = vi.fn((uid: string) => {
    if (!perUid.has(uid)) perUid.set(uid, fresh(uid))

    return perUid.get(uid)
  })
  const award = vi.fn(async () => {})
  f.services["rewards.points"] = { award }
  f.services["api::user-profile.quick-wins"] = {
    computeAndSave: vi.fn(async () => {}),
  }
  f.services["i18n.locales"] = {
    find: async () => [{ code: "en", isDefault: true }],
  }
  const policy = createPolicy({ strapi: f.strapi })
  f.services["content-moderation.submission-policy"] = policy
  const svc: any = createService({ strapi: f.strapi })
  f.services["content-moderation.submission"] = svc
  f.services["content-moderation.moderation"] = createModerationService({
    strapi: f.strapi,
  })
  const controller: any = createModerationController({ strapi: f.strapi })

  return { ...f, award, policy, svc, controller }
}

/** A pending submission, its payloadHash pinned as finalize would. */
function pending(over: Record<string, any>) {
  const s: any = {
    status: "pending",
    contentLocale: "en",
    submittedByUserId: "u1",
    submittedByEmail: "u1@example.org",
    draftData: null,
    ...over,
  }
  s.payloadHash = payloadHash(s)

  return s
}

const request = (fields: Record<string, unknown>, over = {}) =>
  pending({
    documentId: REQ,
    submissionType: "location_request",
    targetEntityType: fields.kind,
    fields,
    ...over,
  })

describe("location request fields", () => {
  const ok = (f: unknown) => validateLocationRequestFields(f).ok

  it("accepts a region and an area with its region", () => {
    expect(ok(regionFields())).toBe(true)
    expect(
      ok(regionFields({ kind: "area", name: "Dover", regionDocumentId: R }))
    ).toBe(true)
  })

  it("refuses bad names, labels, links, notes and unknown keys", () => {
    expect(ok(regionFields({ name: "x" }))).toBe(false)
    expect(ok(regionFields({ name: "x".repeat(121) }))).toBe(false)
    expect(ok(regionFields({ typeLabel: "x".repeat(61) }))).toBe(false)
    expect(ok(regionFields({ evidenceUrl: "ftp://example.org" }))).toBe(false)
    expect(ok(regionFields({ evidenceUrl: undefined }))).toBe(false)
    expect(ok(regionFields({ note: "x".repeat(1001) }))).toBe(false)
    expect(ok(regionFields({ kind: "country" }))).toBe(false)
    expect(ok(regionFields({ isAdmin: true }))).toBe(false)
  })
})

describe("location request policy", () => {
  const check = (policy: any, fields: unknown, targetEntityType?: string) =>
    policy.check({
      baUserId: "u1",
      submissionType: "location_request",
      fields,
      targetEntityType,
    })

  it("refuses an area without a region with a 400", async () => {
    const { policy } = setup()
    expect(
      await check(policy, regionFields({ kind: "area", name: "Dover" }), "area")
    ).toMatchObject({ ok: false, status: 400 })
  })

  it("refuses a target that doesn't match the kind, an unknown country or a region of another country", async () => {
    const { policy } = setup()
    expect(await check(policy, regionFields(), "area")).toMatchObject({
      ok: false,
      status: 400,
    })
    expect(
      await check(
        policy,
        regionFields({ countryDocumentId: "k00000000000000000000009" }),
        "region"
      )
    ).toMatchObject({ ok: false, status: 400 })
    expect(
      await check(
        policy,
        regionFields({
          kind: "area",
          name: "Calais",
          countryDocumentId: K2,
          regionDocumentId: R,
        }),
        "area"
      )
    ).toMatchObject({ ok: false, status: 400 })
  })

  it("allows a valid request", async () => {
    const { policy } = setup()
    expect(await check(policy, regionFields(), "region")).toEqual({ ok: true })
    expect(
      await check(
        policy,
        regionFields({ kind: "area", name: "Dover", regionDocumentId: R }),
        "area"
      )
    ).toEqual({ ok: true })
  })
})

describe("location request approval", () => {
  it("creates a published region with a unique slug, links it and awards nothing", async () => {
    const { svc, store, strapi, award } = setup({
      [SUB]: [request(regionFields())],
    })
    const res: any = await svc.updateStatus(REQ, "approved", REVIEWER)
    expect(res.error).toBeUndefined()

    const created = store[REGION]!.find((r) => r.name === "Somerset")!
    expect(created).toMatchObject({
      slug: "somerset-3",
      typeLabel: "County",
      country: { connect: [{ documentId: K }] },
      continent: { connect: [{ documentId: C }] },
    })
    expect(strapi.documents(REGION).create).toHaveBeenCalledWith(
      expect.objectContaining({ status: "published" })
    )
    expect(res.data.resultDocumentId).toBe(created.documentId)
    expect(store[SUB]!.find((s) => s.documentId === REQ)).toMatchObject({
      status: "approved",
      resultDocumentId: created.documentId,
    })
    expect(award).not.toHaveBeenCalled()
  })

  it("creates an area under the region and its country", async () => {
    const { svc, store } = setup({
      [SUB]: [
        request(
          regionFields({
            kind: "area",
            name: "Dover",
            typeLabel: "District",
            regionDocumentId: R,
          })
        ),
      ],
    })
    await svc.updateStatus(REQ, "approved", REVIEWER)
    expect(store[AREA]![0]).toMatchObject({
      name: "Dover",
      slug: "dover",
      typeLabel: "District",
      region: { connect: [{ documentId: R }] },
      country: { connect: [{ documentId: K }] },
    })
  })

  it("creates nothing on rejection", async () => {
    const { svc, store } = setup({ [SUB]: [request(regionFields())] })
    await svc.updateStatus(REQ, "rejected", REVIEWER, "Already listed.")
    expect(store[REGION]!.some((r) => r.name === "Somerset")).toBe(false)
  })

  describe("the moderator's edit", () => {
    let saved: string | undefined
    beforeEach(() => {
      saved = process.env.STRAPI_BRIDGE_SECRET
      process.env.STRAPI_BRIDGE_SECRET = SECRET
    })
    afterEach(() => {
      if (saved === undefined) delete process.env.STRAPI_BRIDGE_SECRET
      else process.env.STRAPI_BRIDGE_SECRET = saved
    })

    const ctxFor = (body: unknown): any => {
      const ctx: any = {
        params: { documentId: REQ },
        query: {},
        request: {
          headers: {
            "x-service-secret": SECRET,
            "x-ba-user-id": INDEX_MOD,
            "x-ba-user-email": `${INDEX_MOD}@example.org`,
          },
          body,
        },
        status: 200,
        set: vi.fn(),
      }

      return ctx
    }

    it("wins over the submitter's name and type", async () => {
      const { controller, svc, store } = setup({
        [SUB]: [request(regionFields({ name: "Somersett" }))],
      })
      const target = ctxFor({ name: " Somerset ", typeLabel: "Ceremonial county" })
      await controller.setTarget(target)
      expect(target.status).toBe(200)
      expect(store[SUB]![0].draftData.moderatorEdit).toEqual({
        name: "Somerset",
        typeLabel: "Ceremonial county",
      })
      // A bare edit leaves the place alone.
      expect(store[SUB]![0].draftData.moderatorTarget).toBeUndefined()

      const res: any = await svc.updateStatus(REQ, "approved", REVIEWER)
      expect(res.error).toBeUndefined()
      expect(store[REGION]!.find((r) => r.documentId === res.data.resultDocumentId))
        .toMatchObject({ name: "Somerset", typeLabel: "Ceremonial county" })
    })

    it("refuses a short name, and a name for another type", async () => {
      const { controller, store } = setup({
        [SUB]: [
          request(regionFields()),
          pending({
            documentId: LIB_SUB,
            submissionType: "new_library",
            fields: { name: "Lib" },
          }),
        ],
      })
      const short = ctxFor({ name: "x" })
      await controller.setTarget(short)
      expect(short.status).toBe(400)
      const other = ctxFor({ name: "Somerset" })
      other.params.documentId = LIB_SUB
      await controller.setTarget(other)
      expect(other.status).toBe(400)
      expect(store[SUB]!.map((s) => s.draftData)).toEqual([null, null])
    })
  })
})

describe("new_library with a location request", () => {
  const AREA_ID = "a00000000000000000000001"
  const newLibrary = (over: Record<string, any> = {}) =>
    pending({
      documentId: LIB_SUB,
      submissionType: "new_library",
      fields: {
        name: "Dover Library",
        continentDocumentId: C,
        countryDocumentId: K,
        regionDocumentId: R,
        proposedAreaName: "Dover",
        locationRequestDocumentId: REQ,
      },
      ...over,
    })
  const approvedRequest = (over: Record<string, any> = {}) =>
    request(
      regionFields({ kind: "area", name: "Dover", regionDocumentId: R }),
      { status: "approved", resultDocumentId: AREA_ID, ...over }
    )

  it("is filed under the area the approved request created", async () => {
    const { svc, store } = setup({ [SUB]: [approvedRequest(), newLibrary()] })
    await svc.updateStatus(LIB_SUB, "approved", REVIEWER)
    expect(store[LIBRARY]![0]).toMatchObject({
      region: { connect: [{ documentId: R }] },
      area: { connect: [{ documentId: AREA_ID }] },
    })
  })

  it("ignores a request still in review, or someone else's", async () => {
    for (const over of [
      { status: "pending", resultDocumentId: null },
      { submittedByUserId: "u2" },
    ]) {
      const { svc, store } = setup({
        [SUB]: [approvedRequest(over), newLibrary()],
      })
      await svc.updateStatus(LIB_SUB, "approved", REVIEWER)
      expect(store[LIBRARY]![0].area).toBeUndefined()
    }
  })

  it("lets the moderator's target win", async () => {
    const { svc, store } = setup({
      [SUB]: [
        approvedRequest(),
        newLibrary({
          draftData: {
            moderatorTarget: { continent: C, country: K, region: R },
          },
        }),
      ],
    })
    await svc.updateStatus(LIB_SUB, "approved", REVIEWER)
    expect(store[LIBRARY]![0].area).toBeUndefined()
    expect(store[LIBRARY]![0].region).toEqual({
      connect: [{ documentId: R }],
    })
  })
})
