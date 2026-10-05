import { describe, expect, it, vi } from "vitest"

import createController from "../../src/plugins/content-moderation/server/controllers/submission"
import createService, {
  toClient,
} from "../../src/plugins/content-moderation/server/services/submission"
import createPolicy from "../../src/plugins/content-moderation/server/services/submission-policy"
import { applyArticleSubmission } from "../../src/plugins/content-moderation/server/utils/article-apply"
import { applyLibraryRecord } from "../../src/plugins/content-moderation/server/utils/library-record"
import {
  backfillSubmissionLocales,
  configuredLocales,
  defaultLocale,
  normaliseLocale,
} from "../../src/plugins/content-moderation/server/utils/locales"
import {
  legacyPayloadHash,
  payloadHash,
} from "../../src/plugins/content-moderation/server/utils/payload-hash"
import {
  applyToLocale,
  ApplyRefusedError,
} from "../../src/plugins/content-moderation/server/utils/publish-guard"
import { adminReviewer } from "../../src/plugins/content-moderation/server/utils/reviewer"
import { makeFakeStrapi } from "../helpers/fake-strapi"

const REVIEWER = adminReviewer({ id: 1, email: "moderator@example.org" })

const SUB = "plugin::content-moderation.submission"
const WIKI = "api::wiki-article.wiki-article"
const BLOG = "api::blog-article.blog-article"
const LIBRARY = "api::library.library"

const LOCALES = [
  { code: "en", isDefault: true },
  { code: "cs", isDefault: false },
]

type Row = Record<string, any> & {
  documentId: string
  locale: string
  published: boolean
}

/**
 * A locale-aware stand-in for one uid: one row per (documentId, locale), a
 * read without a locale reads the default (`en`) version, like Strapi, and
 * an update in a locale with no version creates it.
 */
function localeAware(rows: Row[]) {
  const pick = (r: Row, fields?: string[]) =>
    fields ? Object.fromEntries(fields.map((f) => [f, r[f]])) : { ...r }
  const matches = (r: Row, filters: Record<string, any> = {}) =>
    Object.entries(filters).every(([k, v]) => {
      if (v && typeof v === "object" && "$eq" in v) return r[k] === v.$eq
      if (v && typeof v === "object" && "$startsWith" in v)
        return String(r[k] ?? "").startsWith(v.$startsWith)

      return r[k] === v
    })
  const visible = (r: Row, status?: string) =>
    status === "published" ? r.published : true

  return {
    rows,
    findOne: vi.fn(async ({ documentId, locale, status, fields }: any) => {
      const r = rows.find(
        (x) => x.documentId === documentId && x.locale === (locale ?? "en")
      )

      return r && visible(r, status) ? pick(r, fields) : null
    }),
    findMany: vi.fn(async ({ filters, locale, status, fields }: any = {}) =>
      rows
        .filter(
          (r) =>
            r.locale === (locale ?? "en") &&
            visible(r, status) &&
            matches(r, filters)
        )
        .map((r) => pick(r, fields))
    ),
    update: vi.fn(async ({ documentId, locale, status, data }: any) => {
      let r = rows.find(
        (x) => x.documentId === documentId && x.locale === (locale ?? "en")
      )
      if (!r) {
        r = { documentId, locale: locale ?? "en", published: false }
        rows.push(r)
      }
      Object.assign(r, data)
      if (status === "published") r.published = true

      return r
    }),
    create: vi.fn(async ({ data, locale, status }: any) => {
      const r: Row = {
        documentId: `new${rows.length}`,
        locale: locale ?? "en",
        published: status === "published",
        ...data,
      }
      rows.push(r)

      return r
    }),
  }
}

/** A fake Strapi with en (default) and cs, and `uids` served locale-aware. */
function setup(
  seed: Record<string, any[]> = {},
  aware: Record<string, Row[]> = {}
) {
  const made = makeFakeStrapi(seed)
  const { strapi, services } = made
  services["i18n.locales"] = { find: async () => LOCALES }
  const docs: Record<string, ReturnType<typeof localeAware>> = {}
  for (const [uid, rows] of Object.entries(aware)) docs[uid] = localeAware(rows)
  const perUid = new Map<string, any>()
  const fresh = strapi.documents
  strapi.documents = vi.fn((uid: string) => {
    if (docs[uid]) return docs[uid]
    if (!perUid.has(uid)) perUid.set(uid, fresh(uid))

    return perUid.get(uid)
  })

  return { ...made, docs }
}

const editorCaps = {
  set: new Set(["docs.directEdit", "journal.directEdit"]),
  claimedLibraryIds: new Set(),
  editorLocales: { docs: "all", journal: "all" },
}

describe("utils/locales", () => {
  it("reads the configured locales and the default", async () => {
    const { strapi } = setup()
    expect(await configuredLocales(strapi)).toEqual(["en", "cs"])
    expect(await defaultLocale(strapi)).toBe("en")
  })

  it("an unknown locale falls back to the default", async () => {
    const { strapi } = setup()
    expect(await normaliseLocale(strapi, "cs")).toBe("cs")
    expect(await normaliseLocale(strapi, "xx")).toBe("en")
    expect(await normaliseLocale(strapi, { $ne: "en" })).toBe("en")
    expect(await normaliseLocale(strapi, undefined)).toBe("en")
  })

  it("is `en` alone without the i18n plugin", async () => {
    const { strapi } = makeFakeStrapi()
    expect(await configuredLocales(strapi)).toEqual(["en"])
    expect(await normaliseLocale(strapi, "cs")).toBe("en")
  })
})

describe("the submission's locale", () => {
  const base = {
    submissionType: "correction",
    targetSlug: "lib",
    fields: { kind: "record", summary: "x" },
    submittedByUserId: "u1",
    submittedByEmail: "e",
  }

  it("is stored as contentLocale on create, normalised, and exposed as locale", async () => {
    const { strapi, store } = setup()
    const svc = createService({ strapi })
    const cs = await svc.create({ ...base, locale: "cs" })
    const xx = await svc.create({ ...base, locale: "xx" })
    const none = await svc.create({ ...base })
    expect(store[SUB]!.map((r) => r.contentLocale)).toEqual(["cs", "en", "en"])
    expect(store[SUB]![0]!.locale).toBeUndefined()
    expect(cs).toMatchObject({ locale: "cs" })
    expect(cs).not.toHaveProperty("contentLocale")
    expect(xx).toMatchObject({ locale: "en" })
    expect(none).toMatchObject({ locale: "en" })
  })

  it("uses draftData.locale for an article when the body names none", async () => {
    const { strapi, store } = setup()
    await createService({ strapi }).create({
      ...base,
      submissionType: "wiki_edit",
      draftData: { locale: "cs", body: [] },
    })
    expect(store[SUB]![0]!.contentLocale).toBe("cs")
  })

  it("is set on finalize from the body, never stored as a field", async () => {
    const { strapi, store } = setup({
      [SUB]: [
        {
          documentId: "s0000000000000000000001",
          submissionType: "correction",
          status: "draft",
          submittedByUserId: "u1",
          targetSlug: "lib",
          fields: {},
          contentLocale: "en",
        },
      ],
    })
    const res = await createService({ strapi }).finalizeDraft(
      "s0000000000000000000001",
      "u1",
      { kind: "record", summary: "Shrnutí", locale: "cs" }
    )
    const row = store[SUB]![0]!
    expect(row.status).toBe("pending")
    expect(row.contentLocale).toBe("cs")
    expect(row.fields).toEqual({ kind: "record", summary: "Shrnutí" })
    expect(row.payloadHash).toBe(payloadHash(row))
    expect(res).toMatchObject({ locale: "cs" })
  })

  it("finalize normalises an unknown locale to the default", async () => {
    const { strapi, store } = setup({
      [SUB]: [
        {
          documentId: "s0000000000000000000001",
          submissionType: "correction",
          status: "draft",
          submittedByUserId: "u1",
          fields: { a: 1 },
          contentLocale: "cs",
        },
      ],
    })
    await createService({ strapi }).finalizeDraft(
      "s0000000000000000000001",
      "u1",
      { locale: "klingon" }
    )
    expect(store[SUB]![0]!.contentLocale).toBe("en")
    expect(store[SUB]![0]!.fields).toEqual({ a: 1 })
  })

  it("toClient names contentLocale locale", () => {
    expect(
      toClient({ documentId: "s", contentLocale: "cs", payloadHash: "h" })
    ).toEqual({ documentId: "s", locale: "cs" })
  })
})

describe("payloadHash covers the locale", () => {
  it("changes with the locale, whichever name carries it", () => {
    const s = { submissionType: "wiki_edit", targetSlug: "a", draftData: {} }
    expect(payloadHash({ ...s, locale: "en" })).not.toBe(
      payloadHash({ ...s, locale: "cs" })
    )
    expect(payloadHash({ ...s, contentLocale: "cs" })).toBe(
      payloadHash({ ...s, locale: "cs" })
    )
  })
})

describe("findDraft is locale-scoped", () => {
  const draft = (id: string, contentLocale: string | null) => ({
    documentId: id,
    submissionType: "wiki_edit",
    status: "draft",
    submittedByUserId: "u1",
    targetSlug: "article",
    contentLocale,
    updatedAt: "2026-09-30T00:00:00.000Z",
  })

  it("an en and a cs draft of the same article don't collide", async () => {
    const { strapi } = setup({
      [SUB]: [draft("s-cs", "cs"), draft("s-en", "en")],
    })
    const svc = createService({ strapi })
    expect(
      (await svc.findDraft("u1", "wiki_edit", "article", "cs"))?.documentId
    ).toBe("s-cs")
    expect(
      (await svc.findDraft("u1", "wiki_edit", "article", "en"))?.documentId
    ).toBe("s-en")
    expect(
      (await svc.findDraft("u1", "wiki_edit", "article"))?.documentId
    ).toBe("s-en")
  })

  it("a draft with no locale yet is the default locale's", async () => {
    const { strapi } = setup({ [SUB]: [draft("s-old", null)] })
    const svc = createService({ strapi })
    expect(
      (await svc.findDraft("u1", "wiki_edit", "article", "en"))?.documentId
    ).toBe("s-old")
    expect(await svc.findDraft("u1", "wiki_edit", "article", "cs")).toBeNull()
  })
})

describe("applyToLocale", () => {
  const ID = "lib00000000000000000001"

  it("creates the locale version, published, when the default is published", async () => {
    const { strapi, docs } = setup(
      {},
      {
        [LIBRARY]: [
          { documentId: ID, locale: "en", published: true, name: "Library" },
        ],
      }
    )
    strapi.contentType = vi.fn(() => ({
      attributes: {
        name: {
          type: "string",
          required: true,
          pluginOptions: { i18n: { localized: true } },
        },
      },
    }))
    const res = await applyToLocale(
      strapi,
      LIBRARY,
      ID,
      { summary: "Shrnutí" },
      { locale: "cs", defaultLocale: "en" }
    )
    expect(res).toEqual({ mode: "created_locale" })
    const cs = docs[LIBRARY]!.rows.find((r) => r.locale === "cs")
    expect(cs).toMatchObject({
      published: true,
      summary: "Shrnutí",
      // Required and localized: seeded from the default for a translator.
      name: "Library",
    })
  })

  it("refuses when the default-locale version is unpublished", async () => {
    const { strapi, docs } = setup(
      {},
      {
        [LIBRARY]: [{ documentId: ID, locale: "en", published: false }],
      }
    )
    await expect(
      applyToLocale(
        strapi,
        LIBRARY,
        ID,
        { summary: "Shrnutí" },
        { locale: "cs", defaultLocale: "en" }
      )
    ).rejects.toBeInstanceOf(ApplyRefusedError)
    expect(docs[LIBRARY]!.rows).toHaveLength(1)
  })

  it("goes through the publish guard for an existing locale version", async () => {
    const { strapi, docs } = setup(
      {},
      {
        [LIBRARY]: [
          { documentId: ID, locale: "en", published: true, summary: "E" },
          { documentId: ID, locale: "cs", published: true, summary: "C" },
        ],
      }
    )
    expect(
      await applyToLocale(
        strapi,
        LIBRARY,
        ID,
        { summary: "Nové" },
        { locale: "cs", defaultLocale: "en", fields: ["summary"] }
      )
    ).toEqual({ mode: "published" })
    expect(docs[LIBRARY]!.rows.map((r) => [r.locale, r.summary])).toEqual([
      ["en", "E"],
      ["cs", "Nové"],
    ])
  })

  it("refuses an unpublished translation rather than publishing it", async () => {
    const { strapi } = setup(
      {},
      {
        [LIBRARY]: [
          { documentId: ID, locale: "en", published: true },
          { documentId: ID, locale: "cs", published: false },
        ],
      }
    )
    await expect(
      applyToLocale(
        strapi,
        LIBRARY,
        ID,
        { summary: "x" },
        { locale: "cs", defaultLocale: "en" }
      )
    ).rejects.toBeInstanceOf(ApplyRefusedError)
  })
})

describe("library record changes in a non-default locale", () => {
  const ID = "lib00000000000000000001"

  it("a cs correction ignores website and writes summary to the cs version", async () => {
    const { strapi, docs } = setup(
      {},
      {
        [LIBRARY]: [
          {
            documentId: ID,
            locale: "en",
            published: true,
            slug: "lib",
            name: "Library",
            summary: "English",
            website: "https://en.example",
          },
        ],
      }
    )
    const outcome = await applyLibraryRecord(strapi, {
      documentId: "s1",
      submissionType: "correction",
      targetDocumentId: ID,
      contentLocale: "cs",
      fields: {
        kind: "record",
        summary: "Česky",
        website: "https://cs.example",
      },
    })
    expect(outcome).toBe("applied")
    const [en, cs] = docs[LIBRARY]!.rows
    expect(en).toMatchObject({
      summary: "English",
      website: "https://en.example",
    })
    expect(cs).toMatchObject({ locale: "cs", summary: "Česky" })
    expect(cs).not.toHaveProperty("website")
    expect(strapi.log.info).toHaveBeenCalledWith(
      expect.stringContaining("ignores shared fields website")
    )
  })

  it("a translation leaves the shared stamps and contentUpdatedAt alone", async () => {
    const STAMP = "2026-01-01T00:00:00.000Z"
    const { strapi, docs } = setup(
      {},
      {
        [LIBRARY]: [
          {
            documentId: ID,
            locale: "en",
            published: true,
            slug: "lib",
            name: "Library",
            summary: "English",
            verifiedSections: { hours: STAMP },
            lastVerifiedAt: STAMP,
            contentUpdatedAt: STAMP,
          },
          {
            documentId: ID,
            locale: "cs",
            published: true,
            name: "Knihovna",
            summary: "Staré",
          },
        ],
      }
    )
    const outcome = await applyLibraryRecord(strapi, {
      documentId: "s1",
      submissionType: "correction",
      targetDocumentId: ID,
      contentLocale: "cs",
      fields: {
        kind: "record",
        summary: "Česky",
        city: "Praha",
        openingTimes: {
          days: [
            {
              day: "monday",
              enabled: true,
              timeframes: [{ startTime: "09:00", endTime: "17:00" }],
            },
          ],
        },
      },
    })
    expect(outcome).toBe("applied")
    const written = docs[LIBRARY]!.update.mock.calls.map((c: any[]) => c[0])
    expect(written).toHaveLength(1)
    expect(written[0]).toMatchObject({ locale: "cs" })
    // city is localized (an address field); openingTimes is shared, so dropped.
    expect(written[0].data).toEqual({ summary: "Česky", city: "Praha" })
    const [en, cs] = docs[LIBRARY]!.rows
    expect(en).toMatchObject({
      verifiedSections: { hours: STAMP },
      lastVerifiedAt: STAMP,
      contentUpdatedAt: STAMP,
    })
    expect(cs).toMatchObject({ summary: "Česky" })
    expect(cs).not.toHaveProperty("verifiedSections")
    expect(cs).not.toHaveProperty("lastVerifiedAt")
    expect(cs).not.toHaveProperty("contentUpdatedAt")
  })

  it("is a noop when only shared fields were sent", async () => {
    const { strapi, docs } = setup(
      {},
      {
        [LIBRARY]: [{ documentId: ID, locale: "en", published: true }],
      }
    )
    expect(
      await applyLibraryRecord(strapi, {
        documentId: "s1",
        targetDocumentId: ID,
        contentLocale: "cs",
        fields: { kind: "record", website: "https://cs.example" },
      })
    ).toBe("noop")
    expect(docs[LIBRARY]!.update).not.toHaveBeenCalled()
  })

  it("the default locale keeps the full allowlist", async () => {
    const { strapi, docs } = setup(
      {},
      {
        [LIBRARY]: [{ documentId: ID, locale: "en", published: true }],
      }
    )
    expect(
      await applyLibraryRecord(strapi, {
        documentId: "s1",
        targetDocumentId: ID,
        contentLocale: "en",
        fields: { kind: "record", website: "https://en.example" },
      })
    ).toBe("applied")
    expect(docs[LIBRARY]!.rows[0]).toMatchObject({
      website: "https://en.example",
    })
  })
})

describe("article translations", () => {
  const article = (uid: string) => ({
    [uid]: [
      {
        documentId: "art1",
        locale: "en",
        published: true,
        slug: "existing",
        title: "Old",
      },
    ],
  })

  function withPolicy(made: ReturnType<typeof setup>) {
    made.services["content-moderation.submission-policy"] = {
      loadCapabilities: async () => ({ caps: editorCaps, tier: null }),
    }

    return made
  }

  it("a cs edit to an article that exists only in en creates the cs version", async () => {
    const made = withPolicy(setup({}, article(WIKI)))
    const outcome = await applyArticleSubmission(
      made.strapi,
      {
        documentId: "s1",
        submittedByUserId: "u1",
        targetSlug: "existing",
        contentLocale: "cs",
        draftData: { title: "Starý" },
      },
      "wiki"
    )
    expect(outcome).toBe("published")
    expect(
      made.docs[WIKI]!.rows.map((r) => [r.locale, r.title, r.published])
    ).toEqual([
      ["en", "Old", true],
      ["cs", "Starý", true],
    ])
  })

  it("a locale-scoped editor can't publish in another locale", async () => {
    const made = setup({}, article(WIKI))
    made.services["content-moderation.submission-policy"] = {
      loadCapabilities: async () => ({
        caps: { ...editorCaps, editorLocales: { docs: new Set(["en"]) } },
        tier: null,
      }),
    }
    expect(
      await applyArticleSubmission(
        made.strapi,
        {
          documentId: "s1",
          submittedByUserId: "u1",
          targetSlug: "existing",
          contentLocale: "cs",
          draftData: { title: "Starý" },
        },
        "wiki"
      )
    ).toBe("skipped_suggestion")
  })

  it("new article slugs are unique across every locale", async () => {
    const made = withPolicy(
      setup(
        {},
        {
          [WIKI]: [
            {
              documentId: "art1",
              locale: "cs",
              published: true,
              slug: "novy",
              title: "Nový",
            },
          ],
        }
      )
    )
    await applyArticleSubmission(
      made.strapi,
      {
        documentId: "s1",
        submittedByUserId: "u1",
        contentLocale: "en",
        draftData: { kind: "new_article", title: "Novy", body: [] },
      },
      "wiki"
    )
    expect(made.docs[WIKI]!.create.mock.calls[0]![0].data.slug).toBe("novy-2")
  })

  it("an approved journal translation awards journal_translated", async () => {
    const sub = {
      documentId: "s0000000000000000000009",
      submissionType: "blog_submission",
      status: "pending",
      submittedByUserId: "u1",
      targetSlug: "existing",
      contentLocale: "cs",
      fields: {},
      draftData: { title: "Starý", isTranslation: true },
    }
    const made = withPolicy(setup({ [SUB]: [sub] }, article(BLOG)))
    const award = vi.fn(async () => {})
    made.services["rewards.points"] = { award }
    const res = await createService({ strapi: made.strapi }).updateStatus(
      sub.documentId,
      "approved",
      REVIEWER
    )
    expect("data" in res).toBe(true)
    expect(made.docs[BLOG]!.rows.map((r) => r.locale)).toEqual(["en", "cs"])
    expect(award.mock.calls.map((c: unknown[]) => c.slice(1, 3))).toEqual([
      ["journal_translated", 15],
    ])
  })

  it("a journal edit flagged as a translation, to a locale that already exists, earns edit points", async () => {
    const sub = {
      documentId: "s0000000000000000000009",
      submissionType: "blog_submission",
      status: "pending",
      submittedByUserId: "u1",
      targetSlug: "existing",
      contentLocale: "en",
      fields: {},
      draftData: { title: "New", isTranslation: true },
    }
    const made = withPolicy(setup({ [SUB]: [sub] }, article(BLOG)))
    const award = vi.fn(async () => {})
    made.services["rewards.points"] = { award }
    await createService({ strapi: made.strapi }).updateStatus(
      sub.documentId,
      "approved",
      REVIEWER
    )
    expect(award.mock.calls.map((c: unknown[]) => c[1])).toEqual([
      "journal_edit_accepted",
    ])
  })
})

describe("backfillSubmissionLocales", () => {
  function withStore(strapi: any) {
    const kv = new Map<string, unknown>()
    strapi.store = vi.fn(() => ({
      get: vi.fn(async ({ key }: { key: string }) => kv.get(key)),
      set: vi.fn(async ({ key, value }: { key: string; value: unknown }) => {
        kv.set(key, value)
      }),
    }))

    return kv
  }

  it("sets the locale from draftData or fields, re-pins legacy hashes, and runs once", async () => {
    const pendingOld = {
      documentId: "s3",
      id: 3,
      submissionType: "correction",
      status: "pending",
      targetSlug: "lib",
      fields: { kind: "record", summary: "x", locale: "cs" },
      draftData: null,
      contentLocale: "en",
    }
    const tampered = {
      documentId: "s4",
      id: 4,
      submissionType: "correction",
      status: "pending",
      fields: { a: 1 },
      payloadHash: "not-a-match",
      contentLocale: null,
    }
    const { strapi, store } = setup({
      [SUB]: [
        {
          documentId: "s1",
          id: 1,
          submissionType: "wiki_edit",
          status: "draft",
          draftData: { locale: "cs" },
          contentLocale: null,
        },
        {
          documentId: "s2",
          id: 2,
          submissionType: "wiki_edit",
          status: "draft",
          draftData: { locale: "xx" },
          contentLocale: null,
        },
        { ...pendingOld, payloadHash: legacyPayloadHash(pendingOld) },
        tampered,
      ],
    })
    const kv = withStore(strapi)

    expect(await backfillSubmissionLocales(strapi)).toEqual({ updated: 4 })
    const rows = store[SUB]!
    expect(rows.map((r) => r.contentLocale)).toEqual(["cs", "en", "cs", "en"])
    // The legacy hash is re-pinned with the locale: still verifiable.
    expect(rows[2]!.payloadHash).toBe(payloadHash(rows[2]!))
    // A hash that never matched stays, so the row still reads as tampered.
    expect(rows[3]!.payloadHash).toBe("not-a-match")
    expect(kv.get("submission-locale-v1")).toBeTruthy()

    rows[0]!.contentLocale = null
    expect(await backfillSubmissionLocales(strapi)).toEqual({ updated: 0 })
    expect(rows[0]!.contentLocale).toBeNull()
  })

  it("leaves rows written with a locale alone", async () => {
    const current = {
      documentId: "s1",
      id: 1,
      submissionType: "wiki_edit",
      status: "pending",
      targetSlug: "a",
      draftData: { locale: "cs" },
      contentLocale: "en",
    }
    const { strapi, store } = setup({
      [SUB]: [{ ...current, payloadHash: payloadHash(current) }],
    })
    withStore(strapi)
    expect(await backfillSubmissionLocales(strapi)).toEqual({ updated: 0 })
    expect(store[SUB]![0]!.contentLocale).toBe("en")
  })
})

describe("direct edits are checked in the submission's locale (create and finalize)", () => {
  const headers = {
    "x-service-secret": "test-secret",
    "x-ba-user-id": "u1",
    "x-ba-user-email": "u1@example.com",
  }
  const DRAFT_ID = "d000000000000000000001"

  /** A wiki_editor whose Role Grant covers French only. */
  function frenchEditor(seed: Record<string, any[]> = {}) {
    process.env.STRAPI_BRIDGE_SECRET = "test-secret"
    const made = makeFakeStrapi({
      "api::user-profile.user-profile": [
        {
          documentId: "p1",
          baUserId: "u1",
          contributorRole: "wiki_editor",
          tier: "Reader",
        },
      ],
      "api::role-grant.role-grant": [
        {
          documentId: "rg1",
          baUserId: "u1",
          role: "wiki_editor",
          queue: "all",
          scopeLocale: "fr",
        },
      ],
      "api::library-affiliation.library-affiliation": [],
      [WIKI]: [{ documentId: "w1", slug: "a", title: "A" }],
      [SUB]: [],
      ...seed,
    })
    const { strapi, services } = made
    services["i18n.locales"] = {
      find: async () => [
        { code: "en", isDefault: true },
        { code: "fr", isDefault: false },
      ],
    }
    services["content-moderation.submission"] = createService({ strapi })
    services["content-moderation.submission-policy"] = createPolicy({ strapi })

    return { ...made, controller: createController({ strapi }) }
  }

  const ctxFor = (body: Record<string, unknown>, params = {}) =>
    ({
      params,
      request: { body, headers },
      state: {},
      unauthorized: vi.fn(),
      badRequest: vi.fn(),
      notFound: vi.fn(),
      set: vi.fn(),
    }) as any

  const directEdit = { title: "Nouveau", body: [] }

  it.each([
    ["fr", undefined],
    ["en", 403],
  ])("create in %s: status %s", async (locale, status) => {
    const { controller, store } = frenchEditor()
    const ctx = ctxFor({
      submissionType: "wiki_edit",
      targetSlug: "a",
      locale,
      draftData: { ...directEdit, locale },
    })
    await controller.create(ctx)
    expect(ctx.status).toBe(status)
    expect(store[SUB]).toHaveLength(status ? 0 : 1)
  })

  it("create takes an article's locale from draftData when the body names none", async () => {
    const { controller } = frenchEditor()
    const ctx = ctxFor({
      submissionType: "wiki_edit",
      targetSlug: "a",
      draftData: { ...directEdit, locale: "fr" },
    })
    await controller.create(ctx)
    expect(ctx.status).toBeUndefined()
  })

  it.each([
    ["fr", "pending"],
    ["en", "draft"],
  ])("finalize in %s leaves the draft %s", async (locale, after) => {
    const { controller, store } = frenchEditor({
      [SUB]: [
        {
          documentId: DRAFT_ID,
          status: "draft",
          submissionType: "wiki_edit",
          submittedByUserId: "u1",
          targetSlug: "a",
          fields: {},
          draftData: { ...directEdit, locale: "fr" },
          contentLocale: "fr",
        },
      ],
    })
    const ctx = ctxFor({ locale }, { id: DRAFT_ID })
    await controller.finalize(ctx)
    expect(ctx.status).toBe(after === "draft" ? 403 : undefined)
    expect(store[SUB]![0]!.status).toBe(after)
  })
})
