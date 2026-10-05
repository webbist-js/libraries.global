import { createHash } from "node:crypto"

import { afterEach, describe, expect, it, vi } from "vitest"

import { makeFakeStrapi } from "./helpers/fake-strapi"
import { registerChangeRecordsMiddleware } from "../src/documentMiddlewares/change-records"
import { runWithChangeContext } from "../src/utils/change-context"
import { stableStringify } from "../src/utils/change-diff"

import librarySchema from "../src/api/library/content-types/library/schema.json"

const LIBRARY = "api::library.library"
const WIKI = "api::wiki-article.wiki-article"
const LIBRARY_CHANGE = "api::library-change.library-change"
const ARTICLE_CHANGE = "api::article-change.article-change"

const wikiSchema = {
  attributes: {
    title: { type: "string" },
    slug: { type: "uid" },
    body: { type: "dynamiczone", components: ["blocks.text"] },
    topics: { type: "relation", relation: "manyToMany" },
  },
}

type Mw = (ctx: any, next: () => Promise<unknown>) => Promise<unknown>

function setup(seed: Record<string, any[]> = {}) {
  const fake = makeFakeStrapi(seed, {
    contentTypes: { [LIBRARY]: librarySchema, [WIKI]: wikiSchema },
  })
  const { strapi, services } = fake
  let mw: Mw | undefined
  strapi.documents.use = vi.fn((fn: Mw) => {
    mw = fn
  })
  strapi.requestContext = { get: () => {} }
  services["i18n.locales"] = { getDefaultLocale: async () => "en" }
  registerChangeRecordsMiddleware({ strapi })
  const run = (
    uid: string,
    action: string,
    params: Record<string, any>,
    next: () => Promise<unknown>
  ) => {
    if (!mw) throw new Error("middleware not registered")

    return mw(
      { uid, action, params, contentType: strapi.contentType(uid) },
      next
    )
  }
  const rows = (uid: string) => fake.store[uid] ?? []

  return { ...fake, run, rows, getMw: () => mw }
}

const lib = () => ({
  documentId: "lib1",
  locale: "en",
  name: "Old Library",
  entityRef: "GB-OLD-001",
  services: [{ documentId: "s1" }],
  completeness: 10,
})

describe("change-records middleware", () => {
  const savedFlag = process.env.CHANGE_RECORDS_ENABLED
  afterEach(() => {
    if (savedFlag === undefined) delete process.env.CHANGE_RECORDS_ENABLED
    else process.env.CHANGE_RECORDS_ENABLED = savedFlag
  })

  it("writes one row per changed field with a shared batchId", async () => {
    const { strapi, run, rows } = setup({ [LIBRARY]: [lib()] })
    const params = {
      documentId: "lib1",
      data: { name: "New Library", services: ["s2", "s1"] },
    }
    await run(LIBRARY, "update", params, () =>
      strapi.documents(LIBRARY).update(params)
    )
    const written = rows(LIBRARY_CHANGE)
    expect(written).toHaveLength(2)
    expect(new Set(written.map((r) => r.batchId)).size).toBe(1)
    expect(written[0].batchId).toMatch(/^[0-9a-f-]{36}$/)
    const byField = Object.fromEntries(written.map((r) => [r.field, r]))
    expect(byField.name).toMatchObject({
      action: "update",
      libraryDocumentId: "lib1",
      entityRef: "GB-OLD-001",
      contentLocale: "en",
      versionStatus: "draft",
      previous: '"Old Library"',
      next: '"New Library"',
      source: "system",
      actorKind: "system",
      actorId: "system",
    })
    expect(byField.services).toMatchObject({
      previous: ["s1"],
      next: ["s1", "s2"],
    })
    expect(typeof byField.name.changedAt).toBe("string")
  })

  // Strapi's JSON field stringifies objects but passes a string through as
  // is, and Postgres rejects `Old Library` as jsonb: a string value must
  // reach the query engine already encoded. Strapi parses it back on read.
  it("encodes string values as JSON text for the jsonb columns", async () => {
    const { strapi, run, rows } = setup({
      [LIBRARY]: [{ ...lib(), phone: "01234 567890", foundedYear: null }],
    })
    const params = {
      documentId: "lib1",
      data: { phone: null, foundedYear: "1850" },
    }
    await run(LIBRARY, "update", params, () =>
      strapi.documents(LIBRARY).update(params)
    )
    const byField = Object.fromEntries(
      rows(LIBRARY_CHANGE).map((r) => [r.field, r])
    )
    expect(byField.phone).toMatchObject({
      previous: '"01234 567890"',
      next: null,
    })
    expect(byField.foundedYear).toMatchObject({
      previous: null,
      next: '"1850"',
    })
    for (const r of rows(LIBRARY_CHANGE)) {
      for (const v of [r.previous, r.next])
        if (typeof v === "string") expect(() => JSON.parse(v)).not.toThrow()
    }
  })

  it("writes nothing for a no-op update", async () => {
    const { strapi, run, rows } = setup({ [LIBRARY]: [lib()] })
    const params = {
      documentId: "lib1",
      data: { name: "Old Library", services: ["s1"] },
    }
    await run(LIBRARY, "update", params, () =>
      strapi.documents(LIBRARY).update(params)
    )
    expect(rows(LIBRARY_CHANGE)).toHaveLength(0)
  })

  it("ignores completeness changes", async () => {
    const { strapi, run, rows } = setup({ [LIBRARY]: [lib()] })
    const params = { documentId: "lib1", data: { completeness: 80 } }
    await run(LIBRARY, "update", params, () =>
      strapi.documents(LIBRARY).update(params)
    )
    expect(rows(LIBRARY_CHANGE)).toHaveLength(0)
  })

  it("records actor fields from the change context", async () => {
    const { strapi, run, rows } = setup({ [LIBRARY]: [lib()] })
    const params = { documentId: "lib1", data: { name: "Via submission" } }
    await runWithChangeContext(
      {
        source: "submission",
        actorKind: "contributor",
        actorId: "ba:u1",
        actorName: "Ada",
        reviewerId: "admin:3",
        submissionDocumentId: "sub9",
      },
      () =>
        run(LIBRARY, "update", params, () =>
          strapi.documents(LIBRARY).update(params)
        ) as Promise<unknown>
    )
    expect(rows(LIBRARY_CHANGE)[0]).toMatchObject({
      source: "submission",
      actorKind: "contributor",
      actorId: "ba:u1",
      actorName: "Ada",
      reviewerId: "admin:3",
      submissionDocumentId: "sub9",
    })
  })

  it("records a publish with a real difference as publish rows", async () => {
    const { strapi, run, rows } = setup({
      [LIBRARY]: [
        {
          ...lib(),
          name: "Draft Name",
          __published: { ...lib(), publishedAt: "2026-01-01T00:00:00Z" },
        },
      ],
    })
    const params = { documentId: "lib1" }
    await run(LIBRARY, "publish", params, () =>
      strapi
        .documents(LIBRARY)
        .update({ documentId: "lib1", status: "published", data: {} })
    )
    const written = rows(LIBRARY_CHANGE)
    expect(written).toHaveLength(1)
    expect(written[0]).toMatchObject({
      action: "publish",
      versionStatus: "published",
      field: "name",
      previous: '"Old Library"',
      next: '"Draft Name"',
    })
  })

  it("records a publish with no field difference as one * row", async () => {
    const { strapi, run, rows } = setup({ [LIBRARY]: [lib()] })
    await run(LIBRARY, "publish", { documentId: "lib1" }, () =>
      strapi
        .documents(LIBRARY)
        .update({ documentId: "lib1", status: "published", data: {} })
    )
    expect(rows(LIBRARY_CHANGE)).toEqual([
      expect.objectContaining({
        action: "publish",
        field: "*",
        versionStatus: "published",
      }),
    ])
  })

  it("records create, delete and unpublish as * snapshots", async () => {
    const { strapi, run, rows } = setup({ [LIBRARY]: [lib()] })
    const created = (await run(
      LIBRARY,
      "create",
      { data: { name: "Brand New" } },
      () => strapi.documents(LIBRARY).create({ data: { name: "Brand New" } })
    )) as { documentId: string }
    await run(LIBRARY, "unpublish", { documentId: "lib1" }, async () => {
      const row = (strapi as any).documents(LIBRARY)
      await row.update({ documentId: "lib1", data: { publishedAt: null } })
    })
    await run(LIBRARY, "delete", { documentId: "lib1" }, () =>
      strapi.documents(LIBRARY).delete({ documentId: "lib1" })
    )
    const written = rows(LIBRARY_CHANGE)
    expect(written.map((r) => [r.action, r.field])).toEqual([
      ["create", "*"],
      ["unpublish", "*"],
      ["delete", "*"],
    ])
    expect(written[0]).toMatchObject({
      libraryDocumentId: created.documentId,
      versionStatus: "draft",
      previous: null,
    })
    expect(written[0].next.name).toBe("Brand New")
    expect(written[1].previous.name).toBe("Old Library")
    expect(written[2]).toMatchObject({ next: null })
    expect(written[2].previous.name).toBe("Old Library")
  })

  it("records a delete of every locale (locale *) once per locale", async () => {
    const { strapi, store, run, rows } = setup({
      [LIBRARY]: [lib(), { ...lib(), locale: "fr", name: "Bibliotheque" }],
    })
    const base = strapi.documents.getMockImplementation()!
    strapi.documents.mockImplementation((uid: string) => {
      const repo = base(uid)
      if (uid !== LIBRARY) return repo

      // The fake store has no "*" locale; list every row for the document.
      return {
        ...repo,
        findMany: vi.fn(async ({ filters }: any) =>
          store[LIBRARY]!.filter((d) => d.documentId === filters.documentId.$eq)
        ),
      }
    })
    await run(
      LIBRARY,
      "delete",
      { documentId: "lib1", locale: "*" },
      async () => {
        store[LIBRARY]!.splice(0)
      }
    )
    const written = rows(LIBRARY_CHANGE)
    expect(written.map((r) => [r.contentLocale, r.action, r.field])).toEqual([
      ["en", "delete", "*"],
      ["fr", "delete", "*"],
    ])
    expect(written[1].previous.name).toBe("Bibliotheque")
    expect(written[0].batchId).toBe(written[1].batchId)
  })

  it("ignores entityRef changes but keeps the entityRef column", async () => {
    const { strapi, run, rows } = setup({ [LIBRARY]: [lib()] })
    const params = {
      documentId: "lib1",
      data: { entityRef: "GB-NEW-001", name: "Renamed" },
    }
    await run(LIBRARY, "update", params, () =>
      strapi.documents(LIBRARY).update(params)
    )
    const written = rows(LIBRARY_CHANGE)
    expect(written.map((r) => r.field)).toEqual(["name"])
    expect(written[0].entityRef).toBe("GB-NEW-001")
  })

  it("records a first publish as one * row with the snapshot", async () => {
    const { strapi, run, rows } = setup({
      [LIBRARY]: [{ ...lib(), publishedAt: null }],
    })
    await run(LIBRARY, "publish", { documentId: "lib1" }, () =>
      strapi
        .documents(LIBRARY)
        .update({ documentId: "lib1", status: "published", data: {} })
    )
    const written = rows(LIBRARY_CHANGE)
    expect(written).toHaveLength(1)
    expect(written[0]).toMatchObject({
      action: "publish",
      versionStatus: "published",
      field: "*",
      previous: null,
    })
    expect(written[0].next.name).toBe("Old Library")
    expect(written[0].next.services).toEqual(["s1"])
  })

  it("records an update that creates a locale version as one * row", async () => {
    const { store, run, rows } = setup({ [LIBRARY]: [lib()] })
    await run(
      LIBRARY,
      "update",
      { documentId: "lib1", locale: "fr", data: { name: "Bibliotheque" } },
      async () => {
        store[LIBRARY]!.push({ ...lib(), locale: "fr", name: "Bibliotheque" })
      }
    )
    const written = rows(LIBRARY_CHANGE)
    expect(written).toHaveLength(1)
    expect(written[0]).toMatchObject({
      action: "update",
      versionStatus: "draft",
      contentLocale: "fr",
      field: "*",
      previous: null,
    })
    expect(written[0].next.name).toBe("Bibliotheque")
  })

  it("records a publish with a locale array once per listed locale", async () => {
    const published = (locale: string) => ({
      ...lib(),
      locale,
      publishedAt: "2026-01-01T00:00:00Z",
    })
    const { store, run, rows } = setup({
      [LIBRARY]: [
        { ...lib(), name: "EN draft", __published: published("en") },
        {
          ...lib(),
          locale: "fr",
          name: "FR draft",
          __published: published("fr"),
        },
        {
          ...lib(),
          locale: "de",
          name: "DE draft",
          __published: published("de"),
        },
      ],
    })
    await run(
      LIBRARY,
      "publish",
      { documentId: "lib1", locale: ["fr", "de"] },
      async () => {
        for (const row of store[LIBRARY]!)
          if (row.locale === "fr" || row.locale === "de") {
            const { __published: _p, ...draft } = row
            row.__published = structuredClone(draft)
          }
      }
    )
    const written = rows(LIBRARY_CHANGE)
    expect(written.map((r) => [r.contentLocale, r.field, r.next])).toEqual([
      ["fr", "name", '"FR draft"'],
      ["de", "name", '"DE draft"'],
    ])
    expect(new Set(written.map((r) => r.batchId)).size).toBe(1)
    expect(written.every((r) => r.action === "publish")).toBe(true)
  })

  it("takes a published delete's previous from the published version", async () => {
    const { strapi, run, rows } = setup({
      [LIBRARY]: [
        {
          ...lib(),
          name: "Unpublished draft edit",
          __published: { ...lib(), publishedAt: "2026-01-01T00:00:00Z" },
        },
      ],
    })
    await run(LIBRARY, "delete", { documentId: "lib1" }, () =>
      strapi.documents(LIBRARY).delete({ documentId: "lib1" })
    )
    const written = rows(LIBRARY_CHANGE)
    expect(written).toHaveLength(1)
    expect(written[0]).toMatchObject({
      action: "delete",
      field: "*",
      versionStatus: "published",
    })
    expect(written[0].previous.name).toBe("Old Library")
  })

  it("inserts a library write's rows with one createMany", async () => {
    const { strapi, run, rows } = setup({ [LIBRARY]: [lib()] })
    const params = {
      documentId: "lib1",
      data: { name: "New Library", services: ["s2"] },
    }
    await run(LIBRARY, "update", params, () =>
      strapi.documents(LIBRARY).update(params)
    )
    const calls = strapi.db.query.mock.results.flatMap(
      (r: any) => r.value.createMany.mock.calls
    )
    expect(calls).toHaveLength(1)
    expect(calls[0][0].data).toHaveLength(2)
    expect(rows(LIBRARY_CHANGE)).toHaveLength(2)
    expect(rows(LIBRARY_CHANGE)[0].publishedAt).toBeInstanceOf(Date)
  })

  it("records an import's create as one * row without reading the library back", async () => {
    const { strapi, run, rows } = setup()
    const actor = {
      source: "import" as const,
      actorKind: "token" as const,
      actorId: "ingest-uk",
    }
    await runWithChangeContext(actor, async () =>
      run(LIBRARY, "create", { data: { name: "Imported" } }, () =>
        strapi.documents(LIBRARY).create({ data: { name: "Imported" } })
      )
    )
    const written = rows(LIBRARY_CHANGE)
    expect(written).toHaveLength(1)
    expect(written[0]).toMatchObject({
      action: "create",
      field: "*",
      source: "import",
      actorId: "ingest-uk",
    })
    expect(written[0].next.name).toBe("Imported")
    // Relations the create didn't return aren't recorded as empty.
    expect(written[0].next).not.toHaveProperty("services")
    const reads = strapi.documents.mock.results
      .map((r: any) => r.value.findOne.mock.calls.length)
      .reduce((a: number, b: number) => a + b, 0)
    expect(reads).toBe(0)
  })

  it("rejects the outer write when the change-record insert fails", async () => {
    const { strapi, run } = setup({ [LIBRARY]: [lib()] })
    const base = strapi.db.query.getMockImplementation()!
    strapi.db.query.mockImplementation((uid: string) =>
      uid === LIBRARY_CHANGE
        ? {
            ...base(uid),
            createMany: vi.fn(async () => {
              throw new Error("insert failed")
            }),
          }
        : base(uid)
    )
    const params = { documentId: "lib1", data: { name: "New" } }
    await expect(
      run(LIBRARY, "update", params, () =>
        strapi.documents(LIBRARY).update(params)
      )
    ).rejects.toThrow("insert failed")
  })

  it("writes nothing when CHANGE_RECORDS_ENABLED=false", async () => {
    process.env.CHANGE_RECORDS_ENABLED = "false"
    const { strapi, run, rows } = setup({ [LIBRARY]: [lib()] })
    expect(strapi.log.warn).toHaveBeenCalledTimes(1)
    const params = { documentId: "lib1", data: { name: "New" } }
    await run(LIBRARY, "update", params, () =>
      strapi.documents(LIBRARY).update(params)
    )
    expect(rows(LIBRARY_CHANGE)).toHaveLength(0)
    expect(rows(LIBRARY)[0].name).toBe("New")
  })

  it("writes kind translated for an article update in a new locale", async () => {
    const body = [{ __component: "blocks.text", id: 1, text: "Bonjour" }]
    const { store, run, rows } = setup({
      [WIKI]: [
        {
          documentId: "w1",
          locale: "en",
          title: "Hello",
          slug: "hello",
          body: [{ __component: "blocks.text", id: 2, text: "Hello" }],
        },
      ],
    })
    await runWithChangeContext(
      {
        source: "admin",
        actorKind: "admin",
        actorId: "admin:1",
        editSummary: "French translation",
      },
      () =>
        run(
          WIKI,
          "update",
          { documentId: "w1", locale: "fr", data: { title: "Bonjour" } },
          async () => {
            store[WIKI]!.push({
              documentId: "w1",
              locale: "fr",
              title: "Bonjour",
              slug: "hello",
              body,
            })
          }
        ) as Promise<unknown>
    )
    const written = rows(ARTICLE_CHANGE)
    expect(written).toHaveLength(1)
    expect(written[0]).toMatchObject({
      articleKind: "wiki",
      articleDocumentId: "w1",
      slug: "hello",
      contentLocale: "fr",
      versionStatus: "draft",
      kind: "translated",
      actorKind: "admin",
      actorId: "admin:1",
      editSummary: "French translation",
      bodyHash: createHash("sha256")
        .update(
          stableStringify([{ __component: "blocks.text", text: "Bonjour" }])
        )
        .digest("hex"),
    })
  })

  it("writes kind edited for an article update in an existing locale", async () => {
    const { strapi, run, rows } = setup({
      [WIKI]: [
        { documentId: "w1", locale: "en", title: "Hello", slug: "hello" },
      ],
    })
    const params = { documentId: "w1", data: { title: "Hello again" } }
    await run(WIKI, "update", params, () =>
      strapi.documents(WIKI).update(params)
    )
    expect(rows(ARTICLE_CHANGE)).toEqual([
      expect.objectContaining({ kind: "edited", contentLocale: "en" }),
    ])
  })

  it("passes untracked uids and actions through with zero extra calls", async () => {
    const { strapi, run } = setup()
    const next = vi.fn(async () => ({ ok: true }))
    await expect(
      run("api::region.region", "update", { documentId: "r1" }, next)
    ).resolves.toEqual({ ok: true })
    await run(LIBRARY, "findMany", {}, next)
    await run(LIBRARY_CHANGE, "create", { data: {} }, next)
    expect(next).toHaveBeenCalledTimes(3)
    expect(strapi.documents).not.toHaveBeenCalled()
  })
})
