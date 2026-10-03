import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"

import submissionControllerFactory from "../../src/plugins/content-moderation/server/controllers/submission"
import createService from "../../src/plugins/content-moderation/server/services/submission"
import createPolicy from "../../src/plugins/content-moderation/server/services/submission-policy"
import {
  roleApplicationFields,
  validateRoleApplicationFields,
} from "../../src/plugins/content-moderation/server/utils/params"
import { payloadHash } from "../../src/plugins/content-moderation/server/utils/payload-hash"
import { adminReviewer } from "../../src/plugins/content-moderation/server/utils/reviewer"
import { makeFakeStrapi } from "../helpers/fake-strapi"

const PROFILE = "api::user-profile.user-profile"
const SUB = "plugin::content-moderation.submission"
const ROLE_GRANT = "api::role-grant.role-grant"
const PROFILE_ID = "p0000000000000000000001"
const APP_ID = "s0000000000000000000099"
const REVIEWER = adminReviewer({ id: 7, email: "mod@example.org" })

const STATEMENT = "I have edited Knowledge articles for a year."

const fieldsFor = (over: Record<string, unknown> = {}) => ({
  role: "wiki_editor",
  locales: [],
  statement: STATEMENT,
  samples: ["https://example.org/a"],
  acceptedGuidelines: true,
  ...over,
})

const accepted = (n: number, type = "correction") =>
  Array.from({ length: n }, (_, i) => ({
    documentId: `acc${type}${String(i).padStart(14, "0")}`,
    submittedByUserId: "u1",
    submissionType: type,
    status: "approved",
  }))

function setup(seed: Record<string, any[]> = {}) {
  const f = makeFakeStrapi({
    [PROFILE]: [{ documentId: PROFILE_ID, baUserId: "u1", tier: "Reader" }],
    ...seed,
  })
  f.services["i18n.locales"] = {
    find: async () => [{ code: "en", isDefault: true }, { code: "fr" }],
  }

  return { ...f, policy: createPolicy({ strapi: f.strapi }) }
}

const apply = (policy: any, ...args: [unknown?, Record<string, unknown>?]) =>
  policy.check({
    baUserId: "u1",
    submissionType: "role_application",
    targetEntityType: "user_profile",
    // `apply(policy)` sends a valid application; `apply(policy, undefined)` none.
    fields: args.length === 0 ? fieldsFor() : args[0],
    ...args[1],
  })

describe("role application fields", () => {
  const ok = (f: unknown) => validateRoleApplicationFields(f, ["en", "fr"]).ok

  it("accepts a well-formed application", () => {
    expect(ok(fieldsFor({ locales: ["fr"] }))).toBe(true)
    expect(ok(fieldsFor({ role: "moderator", queue: "index" }))).toBe(true)
  })
  it("requires a queue for a moderator and drops it for an editor", () => {
    expect(ok(fieldsFor({ role: "moderator" }))).toBe(false)
    expect(ok(fieldsFor({ role: "moderator", queue: "applications" }))).toBe(
      false
    )
    const editor = validateRoleApplicationFields(
      fieldsFor({ queue: "index", sections: ["getting-started"] }),
      ["en"]
    )
    expect(editor).toMatchObject({
      ok: true,
      value: { role: "wiki_editor", sections: ["getting-started"] },
    })
    expect((editor as any).value.queue).toBeUndefined()
    // The Index queue has no sections.
    const index = validateRoleApplicationFields(
      fieldsFor({ role: "moderator", queue: "index", sections: ["x"] }),
      ["en"]
    )
    expect(index).toMatchObject({ ok: true, value: { sections: [] } })
  })
  it("requires the guidelines to be accepted, literally true", () => {
    expect(ok(fieldsFor({ acceptedGuidelines: false }))).toBe(false)
    expect(ok(fieldsFor({ acceptedGuidelines: "true" }))).toBe(false)
    expect(ok(fieldsFor({ acceptedGuidelines: undefined }))).toBe(false)
  })
  it("refuses other roles, unknown locales, short statements and bad samples", () => {
    expect(ok(fieldsFor({ role: "editorial_board" }))).toBe(false)
    expect(ok(fieldsFor({ locales: ["de"] }))).toBe(false)
    expect(ok(fieldsFor({ statement: "too short" }))).toBe(false)
    expect(ok(fieldsFor({ statement: "x".repeat(2001) }))).toBe(false)
    expect(
      ok(
        fieldsFor({ samples: Array.from({ length: 6 }).fill("https://a.org") })
      )
    ).toBe(false)
    expect(ok(fieldsFor({ samples: ["ftp://example.org/a"] }))).toBe(false)
    expect(ok(fieldsFor({ isAdmin: true }))).toBe(false)
    expect(ok(null)).toBe(false)
  })
})

describe("roleApplicationFields", () => {
  it("reads the role and unique string locales of a stored application", () => {
    expect(
      roleApplicationFields({
        role: "journal_editor",
        locales: ["fr", "fr", 3],
      })
    ).toEqual({
      role: "journal_editor",
      queue: null,
      locales: ["fr"],
      sections: [],
    })
    expect(
      roleApplicationFields({ role: "moderator", queue: "journal" })
    ).toEqual({ role: "moderator", queue: "journal", locales: [], sections: [] })
    expect(roleApplicationFields({ role: "editorial_board" })).toEqual({
      role: null,
      queue: null,
      locales: [],
      sections: [],
    })
    expect(roleApplicationFields(null)).toEqual({
      role: null,
      queue: null,
      locales: [],
      sections: [],
    })
  })
})

describe("role application eligibility", () => {
  it("refuses with four accepted changes and allows five", async () => {
    const four = setup({ [SUB]: accepted(4) })
    expect(await apply(four.policy)).toEqual({
      ok: false,
      status: 403,
      message:
        "Editor and moderator roles go to people with at least 5 accepted changes.",
    })

    const five = setup({ [SUB]: accepted(5) })
    expect(await apply(five.policy)).toEqual({ ok: true })
  })

  it("doesn't count accepted role applications", async () => {
    const { policy } = setup({
      [SUB]: [...accepted(4), ...accepted(3, "role_application")],
    })
    expect(await apply(policy)).toMatchObject({ ok: false, status: 403 })
  })

  it("refuses invalid fields and a missing application with a 400", async () => {
    const { policy } = setup({ [SUB]: accepted(5) })
    expect(
      await apply(policy, fieldsFor({ statement: "short" }))
    ).toMatchObject({ ok: false, status: 400 })
    expect(await apply(policy, undefined)).toMatchObject({
      ok: false,
      status: 400,
    })
  })

  it("refuses while an application for the same role is open", async () => {
    const { policy } = setup({
      [SUB]: [
        ...accepted(5),
        {
          documentId: APP_ID,
          submittedByUserId: "u1",
          submissionType: "role_application",
          status: "needs_info",
          fields: fieldsFor(),
        },
      ],
    })
    expect(await apply(policy)).toEqual({
      ok: false,
      status: 403,
      message: "You already have an application for this role.",
    })
    // A different role is a different application.
    expect(await apply(policy, fieldsFor({ role: "journal_editor" }))).toEqual({
      ok: true,
    })
    // Finalize excludes the draft being finalized from its own check.
    expect(
      await apply(policy, fieldsFor(), { excludeDocumentId: APP_ID })
    ).toEqual({ ok: true })
  })

  it("refuses when a grant already covers every requested locale", async () => {
    const grant = (scopeLocale: string | null) => ({
      documentId: `rg-${scopeLocale ?? "all"}`,
      baUserId: "u1",
      role: "wiki_editor",
      queue: "all",
      scopeLocale,
    })
    const global = setup({ [SUB]: accepted(5), [ROLE_GRANT]: [grant(null)] })
    expect(
      await apply(global.policy, fieldsFor({ locales: ["fr"] }))
    ).toEqual({ ok: false, status: 403, message: "You already have this role." })

    const fr = setup({ [SUB]: accepted(5), [ROLE_GRANT]: [grant("fr")] })
    expect(
      await apply(fr.policy, fieldsFor({ locales: ["fr"] }))
    ).toMatchObject({ ok: false, status: 403 })
    // Partial overlap: French is held, English isn't.
    expect(
      await apply(fr.policy, fieldsFor({ locales: ["en", "fr"] }))
    ).toEqual({ ok: true })
    // All languages asked for, one held.
    expect(await apply(fr.policy, fieldsFor({ locales: [] }))).toEqual({
      ok: true,
    })
  })

  it("counts a moderator grant only for its queue, and the board for every role", async () => {
    const mod = (queue: string) => ({
      documentId: `rg-mod-${queue}`,
      baUserId: "u1",
      role: "moderator",
      queue,
      scopeLocale: null,
    })
    const index = setup({ [SUB]: accepted(5), [ROLE_GRANT]: [mod("index")] })
    const asMod = (queue: string) =>
      apply(index.policy, fieldsFor({ role: "moderator", queue }))
    expect(await asMod("index")).toMatchObject({ ok: false, status: 403 })
    expect(await asMod("journal")).toEqual({ ok: true })

    const board = setup({
      [SUB]: accepted(5),
      [ROLE_GRANT]: [{ ...mod("all"), role: "editorial_board" }],
    })
    expect(await apply(board.policy)).toMatchObject({ ok: false, status: 403 })
  })

  it("refuses a reapplication within 30 days of a rejection, with the date", async () => {
    const DAY = 24 * 60 * 60 * 1000
    const rejected = (daysAgo: number) => ({
      documentId: APP_ID,
      submittedByUserId: "u1",
      submissionType: "role_application",
      status: "rejected",
      fields: fieldsFor(),
      reviewedAt: new Date(Date.now() - daysAgo * DAY).toISOString(),
    })

    const row = rejected(10)
    const recent = setup({ [SUB]: [...accepted(5), row] })
    const again = new Date(new Date(row.reviewedAt).getTime() + 30 * DAY)
    const expected = new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(again)
    expect(await apply(recent.policy)).toEqual({
      ok: false,
      status: 403,
      message: `You can apply for this role again on ${expected}.`,
    })
    // Another role isn't held back.
    expect(
      await apply(recent.policy, fieldsFor({ role: "journal_editor" }))
    ).toEqual({ ok: true })

    const old = setup({ [SUB]: [...accepted(5), rejected(31)] })
    expect(await apply(old.policy)).toEqual({ ok: true })
  })
})

describe("role application approval", () => {
  function pendingApplication(locales: string[]) {
    const s: any = {
      documentId: APP_ID,
      submissionType: "role_application",
      targetEntityType: "user_profile",
      status: "pending",
      submittedByUserId: "u1",
      submittedByEmail: "u1@example.org",
      fields: fieldsFor({ locales }),
      draftData: null,
    }
    s.payloadHash = payloadHash(s)

    return s
  }

  function approvalSetup(locales: string[]) {
    const f = setup({ [SUB]: [pendingApplication(locales)] })
    const award = vi.fn(async () => {})
    f.services["rewards.points"] = { award }
    f.services["api::user-profile.quick-wins"] = {
      computeAndSave: vi.fn(async () => {}),
    }

    return { ...f, award, svc: createService({ strapi: f.strapi }) }
  }

  it("creates one grant per requested locale and links the profile", async () => {
    const { svc, store, award } = approvalSetup(["en", "fr"])
    const res: any = await svc.updateStatus(APP_ID, "approved", REVIEWER)
    expect(res.data.resultDocumentId).toBe(PROFILE_ID)

    const grants = store[ROLE_GRANT]!
    expect(grants.map((g) => g.scopeLocale).sort()).toEqual(["en", "fr"])
    for (const g of grants)
      expect(g).toMatchObject({
        baUserId: "u1",
        role: "wiki_editor",
        source: "application",
        grantedBy: "admin:7",
        reason: `Approved application ${APP_ID}`,
      })
    expect(store[SUB]!.find((s) => s.documentId === APP_ID)).toMatchObject({
      status: "approved",
      resultDocumentId: PROFILE_ID,
    })
    expect(award).not.toHaveBeenCalled()
  })

  it("grants every locale when none were named", async () => {
    const { svc, store } = approvalSetup([])
    await svc.updateStatus(APP_ID, "approved", REVIEWER)
    expect(store[ROLE_GRANT]!.map((g) => g.scopeLocale)).toEqual([null])
  })

  it("creates no grant on rejection", async () => {
    const { svc, store } = approvalSetup(["fr"])
    await svc.updateStatus(APP_ID, "rejected", REVIEWER, "Not yet.")
    expect(store[ROLE_GRANT] ?? []).toEqual([])
  })
})

describe("role application through the controller", () => {
  let savedSecret: string | undefined
  beforeAll(() => {
    savedSecret = process.env.STRAPI_BRIDGE_SECRET
    process.env.STRAPI_BRIDGE_SECRET = "test-secret"
  })
  afterAll(() => {
    if (savedSecret === undefined) delete process.env.STRAPI_BRIDGE_SECRET
    else process.env.STRAPI_BRIDGE_SECRET = savedSecret
  })
  const headers = {
    "x-service-secret": "test-secret",
    "x-ba-user-id": "u1",
    "x-ba-user-email": "u1@example.org",
  }
  const ctxFor = (request: Record<string, unknown>, params = {}): any => ({
    params,
    request: { headers, ...request },
    state: {},
    set: vi.fn(),
    unauthorized: vi.fn(),
    badRequest: vi.fn(),
    notFound: vi.fn(),
    forbidden: vi.fn(),
  })

  function harness(acceptedCount: number) {
    const f = setup({ [SUB]: accepted(acceptedCount) })
    f.services["content-moderation.submission"] = createService({
      strapi: f.strapi,
    })
    f.services["content-moderation.submission-policy"] = f.policy

    return {
      ...f,
      controller: submissionControllerFactory({ strapi: f.strapi }),
    }
  }

  const body = (asDraft: boolean) => ({
    submissionType: "role_application",
    targetEntityType: "user_profile",
    fields: fieldsFor({ locales: ["fr"] }),
    asDraft,
  })

  it("lets an eligible user create a draft application and finalize it", async () => {
    const { controller, store } = harness(5)
    const create = ctxFor({ body: body(true) })
    await controller.create(create)
    expect(create.status).toBeUndefined()
    const draft = create.body.data
    expect(draft).toMatchObject({ status: "draft" })

    const finalize = ctxFor({ body: {} }, { id: draft.documentId })
    await controller.finalize(finalize)
    expect(finalize.status).toBeUndefined()
    expect(finalize.body.data).toMatchObject({
      status: "pending",
      submissionType: "role_application",
      fields: { role: "wiki_editor", locales: ["fr"], acceptedGuidelines: true },
    })
    expect(
      store[SUB]!.find((s) => s.documentId === draft.documentId)!.status
    ).toBe("pending")
  })

  it("lets an eligible user submit an application in one step", async () => {
    const { controller } = harness(5)
    const ctx = ctxFor({ body: body(false) })
    await controller.create(ctx)
    expect(ctx.body.data).toMatchObject({ status: "pending" })
  })

  it("files every application in the default locale, whatever locale the client sends", async () => {
    const { controller, store } = harness(5)
    const create = ctxFor({ body: { ...body(true), locale: "fr" } })
    await controller.create(create)
    const draftId = create.body.data.documentId
    expect(
      store[SUB]!.find((s) => s.documentId === draftId)!.contentLocale
    ).toBe("en")

    const finalize = ctxFor({ body: { locale: "fr" } }, { id: draftId })
    await controller.finalize(finalize)
    const row = store[SUB]!.find((s) => s.documentId === draftId)!
    expect(row).toMatchObject({ status: "pending", contentLocale: "en" })
    expect(row.payloadHash).toBe(payloadHash(row))
  })

  it("files every application against the user's profile, whatever the client sends", async () => {
    const { controller, store } = harness(5)
    for (const targetEntityType of ["library", undefined]) {
      store[SUB] = store[SUB]!.filter(
        (s) => s.submissionType !== "role_application"
      )
      const ctx = ctxFor({ body: { ...body(false), targetEntityType } })
      await controller.create(ctx)
      expect(ctx.status).toBeUndefined()
      expect(
        store[SUB]!.find((s) => s.submissionType === "role_application")
      ).toMatchObject({ targetEntityType: "user_profile" })
    }
  })

  it("refuses an ineligible user with a 403", async () => {
    const { controller, store } = harness(4)
    const ctx = ctxFor({ body: body(false) })
    await controller.create(ctx)
    expect(ctx.status).toBe(403)
    expect(
      store[SUB]!.filter((s) => s.submissionType === "role_application")
    ).toEqual([])
  })

  it("re-checks the saved fields at finalize", async () => {
    const { controller, store } = harness(5)
    store[SUB]!.push({
      documentId: APP_ID,
      submittedByUserId: "u1",
      submissionType: "role_application",
      targetEntityType: "user_profile",
      status: "draft",
      fields: fieldsFor({ statement: "short" }),
    })
    const ctx = ctxFor({ body: {} }, { id: APP_ID })
    await controller.finalize(ctx)
    expect(ctx.status).toBe(400)
  })
})
