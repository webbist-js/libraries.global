import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { summaryOf as adminSummaryOf } from "../../src/plugins/content-moderation/admin/src/components/submissionMeta"
import createModerationController from "../../src/plugins/content-moderation/server/controllers/moderation"
import createSubmissionController from "../../src/plugins/content-moderation/server/controllers/submission"
import contentApiRoutes from "../../src/plugins/content-moderation/server/routes/content-api"
import createModerationService from "../../src/plugins/content-moderation/server/services/moderation"
import createService from "../../src/plugins/content-moderation/server/services/submission"
import createPolicy from "../../src/plugins/content-moderation/server/services/submission-policy"
import { payloadHash } from "../../src/plugins/content-moderation/server/utils/payload-hash"
import { summaryOf } from "../../src/plugins/content-moderation/server/utils/submission-summary"
import { makeFakeStrapi } from "../helpers/fake-strapi"

const SUB = "plugin::content-moderation.submission"
const EVENT = "plugin::content-moderation.review-event"
const SUGGESTION = "plugin::content-moderation.option-suggestion"
const VOTE = "plugin::content-moderation.option-vote"
const LIBRARY = "api::library.library"
const WIKI = "api::wiki-article.wiki-article"
const ROLE_GRANT = "api::role-grant.role-grant"
const CONTINENT = "api::continent.continent"
const COUNTRY = "api::country.country"
const REGION = "api::region.region"

const SECRET = "test-bridge-secret"

// Viewers (Better Auth ids) and the Role Grants they hold.
const FR_KNOWLEDGE = "modfr"
const INDEX_MOD = "modindex"
const GLOBAL_MOD = "modall"
const BOARD = "board"
const READER = "reader"
const EN_KNOWLEDGE = "moden"
const FR_APPLICATIONS = "modfrapps"
const EN_ALL = "modenall"

const grant = (
  baUserId: string,
  role: string,
  queue: string,
  scopeLocale: string | null
) => ({
  documentId: `rg${baUserId}${queue}`.padEnd(24, "0"),
  baUserId,
  role,
  queue,
  scopeLocale,
})

const GRANTS = [
  grant(FR_KNOWLEDGE, "moderator", "knowledge", "fr"),
  grant(EN_KNOWLEDGE, "moderator", "knowledge", "en"),
  grant(INDEX_MOD, "moderator", "index", null),
  grant(GLOBAL_MOD, "moderator", "all", null),
  grant(BOARD, "editorial_board", "all", null),
  grant(FR_APPLICATIONS, "moderator", "applications", "fr"),
  grant(EN_ALL, "moderator", "all", "en"),
]

let seq = 0
const id = (n: number) => `s${String(n).padStart(23, "0")}`

/** A submission row, its payloadHash pinned as finalize would. */
const sub = (over: Record<string, any> = {}) => {
  seq += 1
  const s: any = {
    documentId: id(seq),
    id: seq,
    submissionType: "wiki_edit",
    status: "pending",
    contentLocale: "fr",
    submittedByUserId: "u1",
    submittedByEmail: "u1@example.org",
    submittedByName: "Una",
    targetSlug: "how-to",
    fields: {},
    draftData: { proposedTitle: "Comment faire" },
    note: null,
    editSummary: null,
    createdAt: `2026-09-${String(10 + seq).padStart(2, "0")}T10:00:00.000Z`,
    draftRevision: 3,
    reviewerAssignedTo: "someone",
    ...over,
  }
  if (s.status !== "draft") s.payloadHash = payloadHash(s)

  return s
}

/** `$containsi` for the fake store: expanded to the matching values. */
function expandContainsi(filters: any, rows: any[]): any {
  if (Array.isArray(filters))
    return filters.map((f) => expandContainsi(f, rows))
  if (!filters || typeof filters !== "object") return filters
  const out: Record<string, any> = {}
  for (const [k, v] of Object.entries(filters)) {
    if (v && typeof v === "object" && "$containsi" in (v as any)) {
      const needle = String((v as any).$containsi).toLowerCase()
      out[k] = {
        $in: rows
          .map((r) => r[k])
          .filter(
            (x) => typeof x === "string" && x.toLowerCase().includes(needle)
          ),
      }
    } else out[k] = expandContainsi(v, rows)
  }

  return out
}

function setup(
  rows: any[],
  extra: Record<string, any[]> = {},
  { lifecycle = true }: { lifecycle?: boolean } = {}
) {
  const f = makeFakeStrapi(
    { [SUB]: rows, [ROLE_GRANT]: GRANTS, ...extra },
    { tables: { cm_option_votes: VOTE } }
  )
  const fresh = f.strapi.documents
  const perUid = new Map<string, any>()
  f.strapi.documents = vi.fn((uid: string) => {
    if (perUid.has(uid)) return perUid.get(uid)
    const api = fresh(uid)
    if (uid === SUB) {
      const { findMany, count } = api
      api.findMany = vi.fn(async (q: any = {}) =>
        findMany({
          ...q,
          filters: expandContainsi(q.filters, f.store[SUB] ?? []),
        })
      )
      api.count = vi.fn(async (q: any = {}) =>
        count({ ...q, filters: expandContainsi(q.filters, f.store[SUB] ?? []) })
      )
    }
    if (uid === LIBRARY) {
      // The entityRef lifecycle: a library with a full hierarchy gets a real
      // reference once it is created.
      const { create } = api
      api.create = vi.fn(async (q: any) => {
        const doc = await create(q)
        if (lifecycle && q.data?.continent && q.data?.country && q.data?.region)
          doc.entityRef = `europe:gb:eng:${q.data.slug ?? "x"}`

        return doc
      })
    }
    perUid.set(uid, api)

    return api
  })
  f.services["i18n.locales"] = {
    find: async () => [{ code: "en", isDefault: true }, { code: "fr" }],
  }
  f.services["rewards.points"] = { award: vi.fn(async () => {}) }
  f.services["content-moderation.submission-policy"] = createPolicy({
    strapi: f.strapi,
  })
  const svc: any = createService({ strapi: f.strapi })
  f.services["content-moderation.submission"] = svc
  f.services["content-moderation.moderation"] = createModerationService({
    strapi: f.strapi,
  })
  // `plugin().controller()` as Strapi exposes it.
  const controllers: Record<string, any> = {
    submission: createSubmissionController({ strapi: f.strapi }),
  }
  const plugin = f.strapi.plugin
  f.strapi.plugin = vi.fn((name: string) => ({
    ...plugin(name),
    controller: (c: string) => controllers[c],
  }))
  const controller: any = createModerationController({ strapi: f.strapi })

  return { ...f, svc, controller, controllers }
}

type CtxInit = {
  viewer?: string | null
  secret?: string | null
  params?: Record<string, unknown>
  query?: Record<string, unknown>
  body?: unknown
}

function ctxFor({
  viewer = GLOBAL_MOD,
  secret = SECRET,
  params = {},
  query = {},
  body,
}: CtxInit = {}) {
  const headers: Record<string, string> = {}
  if (secret) headers["x-service-secret"] = secret
  if (viewer) {
    headers["x-ba-user-id"] = viewer
    headers["x-ba-user-email"] = `${viewer}@example.org`
    headers["x-ba-user-name"] = `Name ${viewer}`
  }
  const ctx: any = {
    params,
    query,
    request: { headers, body },
    status: 200,
    body: undefined,
    set: vi.fn(),
  }
  for (const [fn, status] of [
    ["badRequest", 400],
    ["unauthorized", 401],
    ["forbidden", 403],
    ["notFound", 404],
  ] as const)
    ctx[fn] = vi.fn((message?: string) => {
      ctx.status = status
      ctx.body = { error: { status, message } }
    })

  return ctx
}

beforeEach(() => {
  seq = 0
  process.env.STRAPI_BRIDGE_SECRET = SECRET
})
afterEach(() => {
  delete process.env.STRAPI_BRIDGE_SECRET
})

describe("moderation routes", () => {
  it("registers every route as auth: false content-api routes", () => {
    const paths = contentApiRoutes
      .filter((r: any) => r.path.startsWith("/moderation/"))
      .map((r: any) => `${r.method} ${r.path}`)
    expect(paths).toEqual(
      expect.arrayContaining([
        "GET /moderation/submissions",
        "GET /moderation/submissions/:documentId",
        "PUT /moderation/submissions/:documentId/status",
        "PUT /moderation/submissions/:documentId/target",
        "GET /moderation/submissions/:documentId/events",
        "GET /moderation/stats",
        "GET /moderation/relation-labels",
        "GET /moderation/option-suggestions",
        "PUT /moderation/option-suggestions/:id",
      ])
    )
    for (const r of contentApiRoutes.filter((r: any) =>
      r.path.startsWith("/moderation/")
    ))
      expect(r.config.auth).toBe(false)
  })
})

describe("identity and scope", () => {
  it("401 without the bridge secret, or without a user id", async () => {
    const { controller } = setup([sub()])
    for (const init of [
      { secret: null },
      { secret: "wrong" },
      { viewer: null },
    ]) {
      const ctx = ctxFor(init)
      await controller.list(ctx)
      expect(ctx.status).toBe(401)
    }
  })

  it("403 for a caller with no moderation scope", async () => {
    const { controller } = setup([sub()])
    const ctx = ctxFor({ viewer: READER })
    await controller.list(ctx)
    expect(ctx.status).toBe(403)
    const stats = ctxFor({ viewer: READER })
    await controller.stats(stats)
    expect(stats.status).toBe(403)
  })
})

describe("GET /moderation/submissions", () => {
  function mixedSeed() {
    return [
      sub(), // 1: Knowledge fr, pending  → visible to FR_KNOWLEDGE
      sub({ contentLocale: "en" }), // 2: Knowledge en
      sub({ submissionType: "blog_submission" }), // 3: Journal fr
      sub({ submissionType: "correction", draftData: null }), // 4: Index fr
      sub({ submittedByUserId: FR_KNOWLEDGE }), // 5: own
      sub({ status: "draft" }), // 6: draft
      sub({ status: "needs_info" }), // 7: needs_info
      sub({ status: "approved", reviewedAt: "2026-09-29T00:00:00.000Z" }), // 8
      sub({ status: "rejected" }), // 9
    ]
  }

  it("returns only in-scope rows: the French Knowledge moderator", async () => {
    const { controller } = setup(mixedSeed())
    const ctx = ctxFor({ viewer: FR_KNOWLEDGE })
    await controller.list(ctx)
    expect(ctx.status).toBe(200)
    expect(ctx.body.data.map((r: any) => r.documentId)).toEqual([id(1)])
    expect(ctx.body.meta).toEqual({ page: 1, pageSize: 25, total: 1 })
    expect(ctx.body.data[0]).toEqual({
      documentId: id(1),
      submissionType: "wiki_edit",
      queue: "knowledge",
      status: "pending",
      locale: "fr",
      summary: "Comment faire",
      targetSlug: "how-to",
      submittedByName: "Una",
      createdAt: "2026-09-11T10:00:00.000Z",
      reviewedAt: null,
    })
  })

  it("needs_info and decided segments; never drafts or the viewer's own", async () => {
    const { controller } = setup(mixedSeed())
    const info = ctxFor({
      viewer: FR_KNOWLEDGE,
      query: { status: "needs_info" },
    })
    await controller.list(info)
    expect(info.body.data.map((r: any) => r.documentId)).toEqual([id(7)])
    const decided = ctxFor({
      viewer: FR_KNOWLEDGE,
      query: { status: "decided" },
    })
    await controller.list(decided)
    expect(decided.body.data.map((r: any) => r.documentId)).toEqual([
      id(9),
      id(8),
    ])
    const all = ctxFor({ viewer: GLOBAL_MOD, query: { status: "pending" } })
    await controller.list(all)
    const ids = all.body.data.map((r: any) => r.documentId)
    expect(ids).toEqual([id(5), id(4), id(3), id(2), id(1)])
    expect(ids).not.toContain(id(6))
  })

  it("excludes the global moderator's own submissions", async () => {
    const { controller } = setup([
      sub(),
      sub({ submittedByUserId: GLOBAL_MOD }),
    ])
    const ctx = ctxFor()
    await controller.list(ctx)
    expect(ctx.body.data.map((r: any) => r.documentId)).toEqual([id(1)])
  })

  it("filters by queue, type and locale", async () => {
    const { controller } = setup(mixedSeed())
    const q = ctxFor({ query: { queue: "index" } })
    await controller.list(q)
    expect(q.body.data.map((r: any) => r.documentId)).toEqual([id(4)])
    const t = ctxFor({ query: { type: "blog_submission" } })
    await controller.list(t)
    expect(t.body.data.map((r: any) => r.documentId)).toEqual([id(3)])
    const l = ctxFor({ query: { locale: "en" } })
    await controller.list(l)
    expect(l.body.data.map((r: any) => r.documentId)).toEqual([id(2)])
  })

  it("paginates, newest first", async () => {
    const rows = Array.from({ length: 5 }, () => sub())
    const { controller } = setup(rows)
    const p1 = ctxFor({ query: { page: "1", pageSize: "2" } })
    await controller.list(p1)
    expect(p1.body.data.map((r: any) => r.documentId)).toEqual([id(5), id(4)])
    expect(p1.body.meta).toEqual({ page: 1, pageSize: 2, total: 5 })
    const p3 = ctxFor({ query: { page: "3", pageSize: "2" } })
    await controller.list(p3)
    expect(p3.body.data.map((r: any) => r.documentId)).toEqual([id(1)])
    const clamped = ctxFor({ query: { page: "9999", pageSize: "500" } })
    await controller.list(clamped)
    expect(clamped.body.meta).toMatchObject({ page: 500, pageSize: 50 })
  })

  it("searches name, slug, summary and note, never email", async () => {
    const { controller } = setup([
      sub({ submittedByName: "Marguerite" }),
      sub({ targetSlug: "opening-hours" }),
      sub({ note: "Le catalogue a changé" }),
      sub({ editSummary: "Fixed the CATALOGUE link" }),
      sub({ submittedByEmail: "catalogue@example.org" }),
    ])
    const ctx = ctxFor({ query: { q: "catalogue" } })
    await controller.list(ctx)
    expect(ctx.body.data.map((r: any) => r.documentId)).toEqual([id(4), id(3)])
    const byName = ctxFor({ query: { q: "margu" } })
    await controller.list(byName)
    expect(byName.body.data.map((r: any) => r.documentId)).toEqual([id(1)])
  })

  it("400 for an unknown status, queue, type or locale, or an over-long q", async () => {
    const { controller } = setup([sub()])
    for (const query of [
      { status: "draft" },
      { queue: "nope" },
      { type: "nope" },
      { locale: "xx" },
      { status: { $ne: "x" } },
      { q: "x".repeat(101) },
    ]) {
      const ctx = ctxFor({ query })
      await controller.list(ctx)
      expect(ctx.status).toBe(400)
    }
  })
})

describe("GET /moderation/submissions/:documentId", () => {
  it("404 out of scope, for drafts and for the viewer's own", async () => {
    const { controller } = setup([
      sub({ contentLocale: "en" }),
      sub({ status: "draft" }),
      sub({ submittedByUserId: FR_KNOWLEDGE }),
    ])
    for (const n of [1, 2, 3]) {
      const ctx = ctxFor({
        viewer: FR_KNOWLEDGE,
        params: { documentId: id(n) },
      })
      await controller.findOne(ctx)
      expect(ctx.status).toBe(404)
    }
    const bad = ctxFor({ params: { documentId: "nope" } })
    await controller.findOne(bad)
    expect(bad.status).toBe(400)
  })

  it("returns the detail without private fields, with the live article", async () => {
    const { controller } = setup([sub({ note: "See the French guide" })], {
      [WIKI]: [
        {
          documentId: "w00000000000000000000001",
          slug: "how-to",
          locale: "fr",
          title: "Comment",
          summary: "Résumé",
          body: [{ __component: "content.rich-text", body: "x" }],
        },
      ],
    })
    const ctx = ctxFor({ viewer: FR_KNOWLEDGE, params: { documentId: id(1) } })
    await controller.findOne(ctx)
    expect(ctx.status).toBe(200)
    const d = ctx.body.data
    for (const k of [
      "submittedByEmail",
      "payloadHash",
      "draftRevision",
      "reviewerAssignedTo",
      "submittedByUserId",
    ])
      expect(d).not.toHaveProperty(k)
    expect(d).toMatchObject({
      documentId: id(1),
      queue: "knowledge",
      locale: "fr",
      note: "See the French guide",
      draftData: { proposedTitle: "Comment faire" },
      canPublish: true,
      article: {
        current: {
          title: "Comment",
          summary: "Résumé",
          body: [{ __component: "content.rich-text", body: "x" }],
        },
        source: null,
      },
    })
  })

  it("a record correction carries the library's live values", async () => {
    const { controller } = setup(
      [
        sub({
          submissionType: "correction",
          contentLocale: "en",
          targetDocumentId: "l00000000000000000000001",
          fields: { kind: "record", phone: "999" },
          draftData: null,
        }),
      ],
      {
        [LIBRARY]: [
          { documentId: "l00000000000000000000001", phone: "111", slug: "a" },
        ],
      }
    )
    const ctx = ctxFor({ viewer: INDEX_MOD, params: { documentId: id(1) } })
    await controller.findOne(ctx)
    expect(ctx.body.data.review).toEqual({
      current: { phone: "111" },
      names: {},
    })
    expect(ctx.body.data.canPublish).toBe(false)
    expect(ctx.body.data.article).toBeNull()
  })

  it("a verify correction carries the confirmed sections' live values and stamps", async () => {
    const { controller } = setup(
      [
        sub({
          submissionType: "correction",
          contentLocale: "en",
          targetDocumentId: "l00000000000000000000001",
          fields: { kind: "verify", sections: ["contact", "status"] },
          evidenceType: "on_site_visit",
          draftData: null,
        }),
      ],
      {
        [LIBRARY]: [
          {
            documentId: "l00000000000000000000001",
            slug: "a",
            phone: "111",
            website: "https://a.example.org",
            operationalStatus: "open",
            city: "York",
            verifiedSections: {
              status: "2025-01-01T00:00:00.000Z",
              bogus: "x",
            },
          },
        ],
      }
    )
    const ctx = ctxFor({ viewer: INDEX_MOD, params: { documentId: id(1) } })
    await controller.findOne(ctx)
    expect(ctx.body.data.review).toEqual({
      sections: ["status", "contact"],
      current: {
        operationalStatus: "open",
        website: "https://a.example.org",
        phone: "111",
      },
      verifiedSections: { status: "2025-01-01T00:00:00.000Z" },
    })
  })
})

describe("PUT /moderation/submissions/:documentId/status", () => {
  it("a scoped moderator's approval writes a ba: Review Event", async () => {
    const { controller, store } = setup([
      sub({ submissionType: "correction", draftData: null, fields: { a: 1 } }),
    ])
    const ctx = ctxFor({
      viewer: INDEX_MOD,
      params: { documentId: id(1) },
      body: { status: "approved", note: "Looks right" },
    })
    await controller.updateStatus(ctx)
    expect(ctx.status).toBe(200)
    expect(ctx.body.data).toMatchObject({
      documentId: id(1),
      status: "approved",
    })
    expect(ctx.body.data).not.toHaveProperty("submittedByEmail")
    expect(store[EVENT]).toHaveLength(1)
    expect(store[EVENT]![0]).toMatchObject({
      submissionDocumentId: id(1),
      fromStatus: "pending",
      toStatus: "approved",
      reviewerId: `ba:${INDEX_MOD}`,
      reviewerKind: "contributor",
      note: "Looks right",
    })
    expect(store[SUB]![0].reviewedByUserId).toBe(`ba:${INDEX_MOD}`)

    const events = ctxFor({ viewer: INDEX_MOD, params: { documentId: id(1) } })
    await controller.events(events)
    expect(events.body.data).toEqual([
      expect.objectContaining({
        fromStatus: "pending",
        toStatus: "approved",
        reviewerKind: "contributor",
        note: "Looks right",
        byViewer: true,
      }),
    ])
  })

  it("403 for the viewer's own submission, 404 out of scope; nothing written", async () => {
    const { controller, store } = setup([
      sub({ submittedByUserId: FR_KNOWLEDGE }),
      sub({ contentLocale: "en" }),
    ])
    const own = ctxFor({
      viewer: FR_KNOWLEDGE,
      params: { documentId: id(1) },
      body: { status: "approved" },
    })
    await controller.updateStatus(own)
    expect(own.status).toBe(403)
    const out = ctxFor({
      viewer: FR_KNOWLEDGE,
      params: { documentId: id(2) },
      body: { status: "approved" },
    })
    await controller.updateStatus(out)
    expect(out.status).toBe(404)
    // The same answer as the GET route, so scope can't be probed.
    const get = ctxFor({ viewer: FR_KNOWLEDGE, params: { documentId: id(2) } })
    await controller.findOne(get)
    expect(out.body).toEqual(get.body)
    expect(store[EVENT] ?? []).toHaveLength(0)
    expect(store[SUB]!.map((s: any) => s.status)).toEqual([
      "pending",
      "pending",
    ])
  })

  it("400 for reject or needs_info without a note, or a bad status", async () => {
    const { controller, store } = setup([sub()])
    for (const body of [
      { status: "rejected" },
      { status: "needs_info", note: "   " },
      { status: "pending" },
      { status: "approved", note: "x".repeat(2001) },
      { status: "approved", publish: "yes" },
    ]) {
      const ctx = ctxFor({
        viewer: FR_KNOWLEDGE,
        params: { documentId: id(1) },
        body,
      })
      await controller.updateStatus(ctx)
      expect(ctx.status).toBe(400)
    }
    expect(store[SUB]![0].status).toBe("pending")
  })

  it("422 when the payload changed after review began", async () => {
    const s = sub({ submissionType: "correction", draftData: null })
    s.fields = { a: 2 }
    const { controller } = setup([s])
    const ctx = ctxFor({
      viewer: INDEX_MOD,
      params: { documentId: id(1) },
      body: { status: "approved" },
    })
    await controller.updateStatus(ctx)
    expect(ctx.status).toBe(422)
  })

  describe("publish: true", () => {
    const article = (over: Record<string, any> = {}) => ({
      documentId: "w00000000000000000000001",
      slug: "how-to",
      locale: "en",
      title: "Old title",
      summary: "Old",
      body: [],
      publishedAt: "2026-01-01T00:00:00.000Z",
      ...over,
    })

    it("publishes a suggestion instead of drafting it", async () => {
      const { controller, store } = setup(
        [
          sub({
            contentLocale: "en",
            draftData: { proposedTitle: "New title" },
          }),
        ],
        { [WIKI]: [article()] }
      )
      const ctx = ctxFor({
        params: { documentId: id(1) },
        body: { status: "approved", publish: true },
      })
      await controller.updateStatus(ctx)
      expect(ctx.status).toBe(200)
      expect(store[WIKI]![0].title).toBe("New title")
      expect(store[WIKI]![0].__published?.title).toBe("New title")
    })

    it("without publish, the suggestion only reaches the draft", async () => {
      const { controller, store } = setup(
        [
          sub({
            contentLocale: "en",
            draftData: { proposedTitle: "New title" },
          }),
        ],
        { [WIKI]: [article()] }
      )
      const ctx = ctxFor({
        params: { documentId: id(1) },
        body: { status: "approved" },
      })
      await controller.updateStatus(ctx)
      expect(ctx.status).toBe(200)
      expect(store[WIKI]![0].title).toBe("New title")
      expect(store[WIKI]![0].__published).toBeUndefined()
    })

    it("publishes a non-editor's new article instead of creating a draft", async () => {
      const { controller, strapi } = setup([
        sub({
          contentLocale: "en",
          targetSlug: null,
          draftData: { kind: "new_article", title: "Reading rooms", body: [] },
        }),
      ])
      const detail = ctxFor({ params: { documentId: id(1) } })
      await controller.findOne(detail)
      expect(detail.body.data.canPublish).toBe(true)
      const ctx = ctxFor({
        params: { documentId: id(1) },
        body: { status: "approved", publish: true },
      })
      await controller.updateStatus(ctx)
      expect(ctx.status).toBe(200)
      expect(strapi.documents(WIKI).create).toHaveBeenCalledWith(
        expect.objectContaining({ status: "published", locale: "en" })
      )
      expect(ctx.body.data.resultDocumentId).toBeTruthy()
    })

    it("400 for a type that can't be published on approval", async () => {
      const { controller, store } = setup([
        sub({ submissionType: "correction", draftData: null }),
      ])
      const ctx = ctxFor({
        params: { documentId: id(1) },
        body: { status: "approved", publish: true },
      })
      await controller.updateStatus(ctx)
      expect(ctx.status).toBe(400)
      expect(store[SUB]![0].status).toBe("pending")
    })

    const newLibrary = (fields: Record<string, unknown>, draftData?: any) =>
      sub({
        submissionType: "new_library",
        contentLocale: "en",
        targetSlug: null,
        fields: { name: "Nailsea Library", ...fields },
        draftData: draftData ?? null,
      })
    const C = "c00000000000000000000001"
    const K = "k00000000000000000000001"
    const R = "r00000000000000000000001"
    const places = {
      [CONTINENT]: [{ documentId: C, slug: "europe" }],
      [COUNTRY]: [{ documentId: K, slug: "gb" }],
      [REGION]: [{ documentId: R, slug: "eng" }],
    }

    it("new_library without a region: apply_refused no_hierarchy, no library", async () => {
      const { controller, store } = setup(
        [newLibrary({ continentDocumentId: C, countryDocumentId: K })],
        places
      )
      const ctx = ctxFor({
        viewer: INDEX_MOD,
        params: { documentId: id(1) },
        body: { status: "approved", publish: true },
      })
      await controller.updateStatus(ctx)
      expect(ctx.status).toBe(409)
      expect(ctx.body.error).toMatchObject({
        name: "apply_refused",
        reason: "no_hierarchy",
      })
      expect(store[LIBRARY] ?? []).toHaveLength(0)
      expect(store[SUB]![0].status).toBe("pending")
      expect(store[EVENT] ?? []).toHaveLength(0)
    })

    it("new_library whose ids don't give a real entityRef: no_hierarchy, no library", async () => {
      const { controller, store } = setup(
        [
          newLibrary({
            continentDocumentId: C,
            countryDocumentId: K,
            regionDocumentId: R,
          }),
        ],
        places,
        { lifecycle: false }
      )
      const ctx = ctxFor({
        viewer: INDEX_MOD,
        params: { documentId: id(1) },
        body: { status: "approved", publish: true },
      })
      await controller.updateStatus(ctx)
      expect(ctx.status).toBe(409)
      expect(ctx.body.error).toMatchObject({
        name: "apply_refused",
        reason: "no_hierarchy",
      })
      expect(store[LIBRARY] ?? []).toHaveLength(0)
      expect(store[SUB]![0].status).toBe("pending")
      expect(store[EVENT] ?? []).toHaveLength(0)
    })

    it("new_library publishes with the moderator's target over the submitter's", async () => {
      const { controller, store } = setup(
        [newLibrary({ continentDocumentId: C, countryDocumentId: K })],
        places
      )
      const target = ctxFor({
        viewer: INDEX_MOD,
        params: { documentId: id(1) },
        body: { continent: C, country: K, region: R },
      })
      await controller.setTarget(target)
      expect(target.status).toBe(200)
      expect(store[SUB]![0].draftData.moderatorTarget).toEqual({
        continent: C,
        country: K,
        region: R,
      })

      const ctx = ctxFor({
        viewer: INDEX_MOD,
        params: { documentId: id(1) },
        body: { status: "approved", publish: true },
      })
      await controller.updateStatus(ctx)
      expect(ctx.status).toBe(200)
      expect(store[LIBRARY]).toHaveLength(1)
      const lib = store[LIBRARY]![0]
      expect(lib.region).toEqual({ connect: [{ documentId: R }] })
      expect(lib.__published).toBeTruthy()
    })

    it("new_library approved without publish stays a draft", async () => {
      const { controller, store } = setup([newLibrary({})])
      const ctx = ctxFor({
        viewer: INDEX_MOD,
        params: { documentId: id(1) },
        body: { status: "approved" },
      })
      await controller.updateStatus(ctx)
      expect(ctx.status).toBe(200)
      expect(store[LIBRARY]).toHaveLength(1)
      expect(store[LIBRARY]![0].__published).toBeUndefined()
    })
  })
})

describe("PUT /moderation/submissions/:documentId/target", () => {
  it("404 out of scope (as the GET route), 403 for the viewer's own", async () => {
    const lib = {
      submissionType: "new_library",
      fields: { name: "x" },
      draftData: null,
    }
    const { controller, store } = setup([
      sub(lib),
      sub({ ...lib, submittedByUserId: INDEX_MOD }),
    ])
    const out = ctxFor({
      viewer: FR_KNOWLEDGE,
      params: { documentId: id(1) },
      body: {},
    })
    await controller.setTarget(out)
    expect(out.status).toBe(404)
    const get = ctxFor({ viewer: FR_KNOWLEDGE, params: { documentId: id(1) } })
    await controller.findOne(get)
    expect(out.body).toEqual(get.body)
    const own = ctxFor({
      viewer: INDEX_MOD,
      params: { documentId: id(2) },
      body: {},
    })
    await controller.setTarget(own)
    expect(own.status).toBe(403)
    expect(store[SUB]!.map((s: any) => s.draftData)).toEqual([null, null])
  })

  it("422 when the content no longer matches its hash; approval still 422", async () => {
    const s = sub({
      submissionType: "new_library",
      contentLocale: "en",
      fields: { name: "x" },
      draftData: null,
    })
    s.fields = { name: "tampered" }
    const { controller, store } = setup([s], {
      [REGION]: [{ documentId: "r00000000000000000000001", slug: "eng" }],
    })
    const pinned = store[SUB]![0].payloadHash
    const target = ctxFor({
      viewer: INDEX_MOD,
      params: { documentId: id(1) },
      body: { region: "r00000000000000000000001" },
    })
    await controller.setTarget(target)
    expect(target.status).toBe(422)
    expect(store[SUB]![0].payloadHash).toBe(pinned)
    expect(store[SUB]![0].draftData).toBeNull()
    const approve = ctxFor({
      viewer: INDEX_MOD,
      params: { documentId: id(1) },
      body: { status: "approved" },
    })
    await controller.updateStatus(approve)
    expect(approve.status).toBe(422)
  })

  it("is rejected for other types", async () => {
    const { controller, store } = setup([
      sub({ submissionType: "correction", draftData: null }),
    ])
    const ctx = ctxFor({
      viewer: INDEX_MOD,
      params: { documentId: id(1) },
      body: { region: "r00000000000000000000001" },
    })
    await controller.setTarget(ctx)
    expect(ctx.status).toBe(400)
    expect(store[SUB]![0].draftData).toBeNull()
  })

  it("is rejected for an id that names no record, or an unknown key", async () => {
    const { controller } = setup([
      sub({
        submissionType: "new_library",
        fields: { name: "x" },
        draftData: null,
      }),
    ])
    for (const body of [
      { region: "r00000000000000000000009" },
      { region: "not an id" },
      { planet: "r00000000000000000000001" },
    ]) {
      const ctx = ctxFor({
        viewer: INDEX_MOD,
        params: { documentId: id(1) },
        body,
      })
      await controller.setTarget(ctx)
      expect(ctx.status).toBe(400)
    }
  })

  it("refuses a name or type on the target route", async () => {
    const { controller } = setup([
      sub({
        submissionType: "new_library",
        fields: { name: "x" },
        draftData: null,
      }),
    ])
    const ctx = ctxFor({
      viewer: INDEX_MOD,
      params: { documentId: id(1) },
      body: { name: "Wessex", typeLabel: "Region" },
    })
    await controller.setTarget(ctx)
    expect(ctx.status).toBe(400)
    expect(JSON.stringify(ctx.body)).toContain("Unknown place: name")
  })
})

describe("GET /moderation/stats", () => {
  it("counts per queue and status within scope", async () => {
    const { controller } = setup([
      sub(),
      sub(),
      sub({ status: "needs_info" }),
      sub({ status: "approved" }),
      sub({ contentLocale: "en" }),
      sub({ submissionType: "correction" }),
      sub({ submittedByUserId: FR_KNOWLEDGE }),
    ])
    const ctx = ctxFor({ viewer: FR_KNOWLEDGE })
    await controller.stats(ctx)
    expect(ctx.body.data).toEqual([
      { queue: "knowledge", status: "pending", count: 2 },
      { queue: "knowledge", status: "needs_info", count: 1 },
      { queue: "knowledge", status: "decided", count: 1 },
    ])
  })
})

describe("option suggestions", () => {
  const suggestion = {
    documentId: "g00000000000000000000001",
    name: "Seed library",
    nameKey: "seed library",
    optionKey: "services",
    status: "open",
    requests: 1,
    libraries: [],
    submissionIds: [],
  }

  it.each([INDEX_MOD, GLOBAL_MOD])(
    "403 for a moderator who isn't on the editorial board (%s)",
    async (viewer) => {
      const { controller, store } = setup([], { [SUGGESTION]: [suggestion] })
      const list = ctxFor({ viewer })
      await controller.optionSuggestions(list)
      expect(list.status).toBe(403)
      const decide = ctxFor({
        viewer,
        params: { id: suggestion.documentId },
        body: { decision: "decline" },
      })
      await controller.decideOptionSuggestion(decide)
      expect(decide.status).toBe(403)
      expect(store[SUGGESTION]![0].status).toBe("open")
    }
  )

  it("the editorial board lists and decides", async () => {
    const { controller, store } = setup([], { [SUGGESTION]: [suggestion] })
    const list = ctxFor({ viewer: BOARD })
    await controller.optionSuggestions(list)
    expect(list.status).toBe(200)
    expect(list.body.data).toHaveLength(1)
    const decide = ctxFor({
      viewer: BOARD,
      params: { id: suggestion.documentId },
      body: { decision: "decline", note: "Not an option" },
    })
    await controller.decideOptionSuggestion(decide)
    expect(decide.status).toBe(200)
    expect(store[SUGGESTION]![0]).toMatchObject({
      status: "declined",
      decidedBy: `Name ${BOARD}`,
    })
  })
})

describe("summaryOf port", () => {
  it("matches the admin's for sample rows", () => {
    const rows: any[] = [
      { submissionType: "new_library", fields: { name: " Nailsea " } },
      {
        submissionType: "blog_submission",
        fields: {},
        draftData: { proposedTitle: "A walk" },
        targetSlug: "walk",
      },
      { submissionType: "wiki_edit", fields: {}, targetSlug: "how-to" },
      { submissionType: "correction", fields: {}, targetSlug: "bristol" },
      { submissionType: "topic_suggestion", fields: {} },
      {
        submissionType: "role_application",
        fields: { role: "wiki_editor", locales: ["fr", "de"] },
      },
      {
        submissionType: "role_application",
        fields: { role: "journal_editor", locales: [] },
      },
      {
        submissionType: "role_application",
        fields: { role: "moderator", queue: "index", locales: ["fr"] },
      },
    ]
    for (const r of rows) expect(summaryOf(r)).toBe(adminSummaryOf(r))
    expect(rows.slice(-3).map(summaryOf)).toEqual([
      "Knowledge editor application (fr, de)",
      "Journal editor application (all languages)",
      "Moderator application: Index (fr)",
    ])
  })
})

describe("review round 2", () => {
  it("canPublish is false once the submission is decided", async () => {
    const { controller } = setup([
      sub({ status: "approved", draftData: { proposedTitle: "x" } }),
      sub({ status: "needs_info", draftData: { proposedTitle: "x" } }),
    ])
    const decided = ctxFor({ params: { documentId: id(1) } })
    await controller.findOne(decided)
    expect(decided.body.data.canPublish).toBe(false)
    const open = ctxFor({ params: { documentId: id(2) } })
    await controller.findOne(open)
    expect(open.body.data.canPublish).toBe(true)
  })

  it("a row with no stored locale counts as the default locale in lists", async () => {
    const { controller } = setup([sub({ contentLocale: null }), sub()])
    const en = ctxFor({ viewer: EN_KNOWLEDGE })
    await controller.list(en)
    expect(en.body.data.map((r: any) => r.documentId)).toEqual([id(1)])
    expect(en.body.data[0].locale).toBe("en")
    const fr = ctxFor({ viewer: FR_KNOWLEDGE })
    await controller.list(fr)
    expect(fr.body.data.map((r: any) => r.documentId)).toEqual([id(2)])
    const filtered = ctxFor({ query: { locale: "en" } })
    await controller.list(filtered)
    expect(filtered.body.data.map((r: any) => r.documentId)).toEqual([id(1)])
    const stats = ctxFor({ viewer: EN_KNOWLEDGE })
    await controller.stats(stats)
    expect(stats.body.data[0]).toEqual({
      queue: "knowledge",
      status: "pending",
      count: 1,
    })
  })

  it("relation-labels runs the plugin's submission handler after authorising", async () => {
    const { controller, controllers } = setup([], {
      "api::service.service": [
        { documentId: "svc00000000000000000001", name: "Wi-Fi" },
      ],
    })
    const spy = vi.spyOn(controllers.submission, "relationLabels")
    const denied = ctxFor({ viewer: READER, query: { type: "services" } })
    await controller.relationLabels(denied)
    expect(denied.status).toBe(403)
    expect(spy).not.toHaveBeenCalled()
    const ctx = ctxFor({ query: { type: "services" } })
    await controller.relationLabels(ctx)
    expect(spy).toHaveBeenCalledTimes(1)
    expect(ctx.body).toEqual({ data: { svc00000000000000000001: "Wi-Fi" } })
  })

  it("a library claim's detail keeps the review fields and drops contact details", async () => {
    const { controller } = setup([
      sub({
        submissionType: "library_claim",
        contentLocale: "en",
        draftData: null,
        fields: {
          name: "Nailsea Library",
          entityRef: "GB-NL-001",
          role: "librarian",
          department: "Lending",
          verificationMethod: "contact_us",
          userEmailDomain: "nailsea.gov.uk",
          claimedWebsiteDomain: "nailsea.gov.uk",
          phone: "01234 567890",
          email: "una@nailsea.gov.uk",
          contactEmail: "una@example.org",
        },
      }),
    ])
    const ctx = ctxFor({ viewer: INDEX_MOD, params: { documentId: id(1) } })
    await controller.findOne(ctx)
    expect(ctx.body.data.fields).toEqual({
      name: "Nailsea Library",
      entityRef: "GB-NL-001",
      role: "librarian",
      department: "Lending",
      verificationMethod: "contact_us",
      userEmailDomain: "nailsea.gov.uk",
      claimedWebsiteDomain: "nailsea.gov.uk",
    })
  })
})

describe("Role Application scope", () => {
  // Stored in the default locale; the scope is the languages asked for.
  const application = (locales: string[]) =>
    sub({
      submissionType: "role_application",
      contentLocale: "en",
      targetSlug: null,
      draftData: null,
      fields: {
        role: "wiki_editor",
        locales,
        statement: "I have edited Knowledge articles for a year.",
        samples: [],
      },
    })
  const seed = () => [
    application(["fr"]), // 1
    application(["fr", "en"]), // 2
    application([]), // 3: every language
    application(["en"]), // 4
  ]
  const listed = async (controller: any, viewer: string) => {
    const ctx = ctxFor({ viewer, query: { queue: "applications" } })
    await controller.list(ctx)

    return {
      ids: ctx.body.data.map((r: any) => r.documentId),
      total: ctx.body.meta.total,
    }
  }

  it("lists for a locale-scoped moderator only applications for exactly that locale", async () => {
    const { controller } = setup(seed())
    expect(await listed(controller, FR_APPLICATIONS)).toEqual({
      ids: [id(1)],
      total: 1,
    })
    // `all` in English: the English-only application, never one that also
    // asks for French or for every language.
    expect(await listed(controller, EN_ALL)).toEqual({
      ids: [id(4)],
      total: 1,
    })
    expect(await listed(controller, GLOBAL_MOD)).toEqual({
      ids: [id(4), id(3), id(2), id(1)],
      total: 4,
    })
  })

  it("keeps a locale-scoped all-queue moderator's other queues filtered by locale", async () => {
    const { controller } = setup([
      sub({
        submissionType: "correction",
        contentLocale: "en",
        draftData: null,
      }),
      sub({
        submissionType: "correction",
        contentLocale: "fr",
        draftData: null,
      }),
    ])
    const ctx = ctxFor({ viewer: EN_ALL })
    await controller.list(ctx)
    expect(ctx.body.data.map((r: any) => r.documentId)).toEqual([id(1)])
  })

  it("404s an out-of-scope application on read and on decision", async () => {
    const { controller, store } = setup(seed())
    for (const n of [2, 3, 4]) {
      const read = ctxFor({
        viewer: FR_APPLICATIONS,
        params: { documentId: id(n) },
      })
      await controller.findOne(read)
      expect(read.status).toBe(404)
    }
    const decide = ctxFor({
      viewer: FR_APPLICATIONS,
      params: { documentId: id(3) },
      body: { status: "rejected", note: "No." },
    })
    await controller.updateStatus(decide)
    expect(decide.status).toBe(404)
    expect(store[SUB]!.find((r: any) => r.documentId === id(3))!.status).toBe(
      "pending"
    )

    const ok = ctxFor({
      viewer: FR_APPLICATIONS,
      params: { documentId: id(1) },
    })
    await controller.findOne(ok)
    expect(ok.status).toBe(200)
  })

  it("shows Moderator applications to the editorial board only", async () => {
    const moderatorApplication = sub({
      submissionType: "role_application",
      contentLocale: "en",
      targetSlug: null,
      draftData: null,
      fields: {
        role: "moderator",
        queue: "index",
        locales: [],
        statement: "I have reviewed library corrections for a year.",
        samples: [],
        acceptedGuidelines: true,
      },
    })
    const { controller, store } = setup([moderatorApplication])
    const appId = moderatorApplication.documentId

    // A global Moderator: not listed, 404 on read and on decision.
    expect(await listed(controller, GLOBAL_MOD)).toEqual({ ids: [], total: 0 })
    const read = ctxFor({ viewer: GLOBAL_MOD, params: { documentId: appId } })
    await controller.findOne(read)
    expect(read.status).toBe(404)
    const decide = ctxFor({
      viewer: GLOBAL_MOD,
      params: { documentId: appId },
      body: { status: "approved" },
    })
    await controller.updateStatus(decide)
    expect(decide.status).toBe(404)
    expect(store[SUB]!.find((r: any) => r.documentId === appId)!.status).toBe(
      "pending"
    )

    // The editorial board sees it, with the applicant block.
    expect(await listed(controller, BOARD)).toEqual({ ids: [appId], total: 1 })
    const board = ctxFor({ viewer: BOARD, params: { documentId: appId } })
    await controller.findOne(board)
    expect(board.status).toBe(200)
    expect(board.body.data.applicant).toEqual({
      username: null,
      acceptedCount: 0,
      recentAccepted: [],
    })
  })

  it("counts only in-scope applications in stats", async () => {
    const { controller } = setup(seed())
    const ctx = ctxFor({ viewer: FR_APPLICATIONS })
    await controller.stats(ctx)
    expect(ctx.body.data).toContainEqual({
      queue: "applications",
      status: "pending",
      count: 1,
    })
  })
})
