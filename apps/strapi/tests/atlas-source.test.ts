import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import createController from "../src/api/atlas/controllers/atlas"
import { atlasSourceDto, atlasSourceRows } from "../src/utils/atlas-source"

const row = {
  id: 12,
  documentId: "library-one",
  locale: "en",
  publishedAt: "2026-10-01",
  name: "Library",
  slug: "library",
  mobileTimetable: { secretInternalField: true },
  heroImage: { private: true },
  email: "private@example.test",
  country: {
    documentId: "country",
    name: "Country",
    slug: "country",
    staff: "private",
  },
  amenities: [{ documentId: "wifi", name: "Wi-Fi", icon: { private: true } }],
}
describe("Atlas bounded source bridge", () => {
  beforeEach(() => {
    vi.stubEnv("ATLAS_ENABLED", "true")
    vi.stubEnv("STRAPI_BRIDGE_SECRET", "bridge-test")
    vi.stubEnv("ATLAS_SERVICE_TOKEN", "token-test")
  })
  afterEach(() => vi.unstubAllEnvs())
  const context = (body?: object) => ({
    request: {
      headers: {
        "x-service-secret": "bridge-test",
        "x-atlas-token": "token-test",
      },
      body,
    },
    query: {} as Record<string, string>,
    status: 200,
    body: undefined as any,
  })
  it("requires both independently configured service credentials", async () => {
    const strapi = { documents: vi.fn() },
      controller = createController({ strapi })
    const ctx = context()
    ctx.request.headers["x-atlas-token"] = "wrong"
    await controller.batch(ctx)
    expect(ctx.status).toBe(401)
    expect(strapi.documents).not.toHaveBeenCalled()
    vi.stubEnv("ATLAS_SERVICE_TOKEN", "")
    await controller.scan(context())
    expect(strapi.documents).not.toHaveBeenCalled()
  })
  it("rejects direct Reach requests without both private bridge credentials", async () => {
    const strapi = { documents: vi.fn() }
    const controller = createController({ strapi })
    for (const header of ["x-service-secret", "x-atlas-token"] as const) {
      const ctx = context({
        request: { schemaVersion: 1, libraryId: "one", mode: "walking" },
        userKey: "a".repeat(64),
        hourlyLimit: 100,
      })
      ctx.request.headers[header] = ""
      await controller.reach(ctx)
      expect(ctx.status).toBe(401)
    }
    expect(strapi.documents).not.toHaveBeenCalled()
  })
  it("decodes Strapi raw JSONB state before returning the query contract", async () => {
    const dictionary = { version: "jsonb-test", entries: [] }
    const manifest = { buildId: "test-build" }
    const state = {
      projection_revision: "2",
      indexed_through: "2",
      journal_floor: "0",
      query_epoch: "epoch",
      canonical_locale: "en",
      dictionary: JSON.stringify(dictionary),
      manifest: JSON.stringify(manifest),
      heartbeat_at: null,
    }
    const chain = {
      where: () => chain,
      whereNotNull: () => chain,
      min: () => chain,
      first: async () => state,
    }
    const pending: any = {
      whereNull: () => pending,
      count: () => pending,
      first: async () => ({ count: "2" }),
    }
    const controller = createController({
      strapi: {
        db: {
          connection: (table: string) =>
            table === "atlas_outbox" ? pending : chain,
        },
      },
    })
    const ctx = context()
    await controller.state(ctx)
    expect(ctx.body.dictionary).toEqual(dictionary)
    expect(ctx.body.manifest).toEqual(manifest)
    expect(ctx.body.indexedThrough).toBe("2")
    expect(ctx.body.pendingProjection).toBe(2)
  })
  it("rejects duplicate/oversized batches and raw source query options", async () => {
    const strapi = { documents: vi.fn() },
      controller = createController({ strapi })
    for (const documentIds of [
      [],
      ["same", "same"],
      Array.from({ length: 201 }, (_, i) => `library-${i}`),
    ]) {
      const ctx = context({ documentIds })
      await controller.batch(ctx)
      expect(ctx.status).toBe(400)
    }
    const ctx = context()
    ctx.query = { locale: "*" }
    await controller.scan(ctx)
    expect(ctx.status).toBe(400)
    expect(strapi.documents).not.toHaveBeenCalled()
  })
  it("scopes both the canonical scan cursor and its rows to the requested country", async () => {
    const library = {
      findFirst: vi.fn(async () => ({ id: 100 })),
      findMany: vi.fn(async () => []),
    }
    const controller = createController({
      strapi: { documents: () => library },
    })
    const ctx = context()
    ctx.query = { after: "0", limit: "200", country: "GB-ENG" }
    await controller.scan(ctx)
    expect(ctx.status).toBe(200)
    expect(ctx.body).toEqual({ rows: [], upper: 100, next: null })
    expect(library.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "published",
        locale: "en",
        filters: { country: { iso2: "GB-ENG" } },
      })
    )
    expect(library.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        filters: { country: { iso2: "GB-ENG" }, id: { $gt: 0, $lte: 100 } },
      })
    )
  })
  it("emits only public fields, with timetable presence rather than contents", () => {
    const source = atlasSourceDto(row)
    expect(source.mobileTimetable).toEqual({ present: true })
    expect(source.country).toEqual({
      documentId: "country",
      name: "Country",
      slug: "country",
    })
    expect(source.amenities).toEqual([
      { documentId: "wifi", name: "Wi-Fi", aliases: [] },
    ])
    expect(source).not.toHaveProperty("email")
    expect(source).not.toHaveProperty("heroImage")
  })
  it("reads published canonical rows with bounded Notices and translated facility aliases", async () => {
    const library = { findMany: vi.fn(async () => [row]) },
      notice = { findMany: vi.fn(async () => []) },
      options = {
        findMany: vi.fn(async () => [
          { documentId: "wifi", name: "Wi-Fi" },
          { documentId: "wifi", name: "Sans fil" },
        ]),
      }
    const strapi = {
      documents: (uid: string) =>
        uid === "api::library.library"
          ? library
          : uid === "api::library-notice.library-notice"
            ? notice
            : options,
    }
    const rows = await atlasSourceRows(strapi, { id: { $gt: 1 } }, 20, "en")
    expect(library.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        locale: "en",
        status: "published",
        limit: 20,
        sort: "id:asc",
      })
    )
    expect(notice.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 1001 })
    )
    expect(options.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ locale: "*", status: "published", limit: 2001 })
    )
    expect(rows[0]?.source.amenities?.[0]?.aliases).toEqual([
      "Wi-Fi",
      "Sans fil",
    ])
  })
  it("returns explicit source-window overflow instead of dropping Notices", async () => {
    const strapi = {
      documents: (uid: string) => ({
        findMany: vi.fn(async () =>
          uid === "api::library.library"
            ? [row]
            : uid === "api::library-notice.library-notice"
              ? Array.from({ length: 1001 }, () => ({}))
              : []
        ),
      }),
    }
    const ctx = context({ documentIds: [row.documentId] })
    await createController({ strapi }).batch(ctx)
    expect(ctx.status).toBe(400)
    expect(ctx.body.code).toBe("ATLAS_SOURCE_WINDOW")
  })
  it("resolves a published translated slug to one canonical source and keeps missing selections 404", async () => {
    const library = {
      findFirst: vi.fn(async () => ({ documentId: row.documentId })),
      findMany: vi.fn(async () => [row]),
    }
    const strapi = {
      documents: (uid: string) =>
        uid === "api::library.library"
          ? library
          : { findMany: vi.fn(async () => []) },
    }
    const controller = createController({ strapi }),
      ctx = context()
    ctx.query = { key: "knihovna", locale: "cs" }
    await controller.library(ctx)
    expect(ctx.body.source.documentId).toBe(row.documentId)
    expect(library.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ status: "published", locale: "cs" })
    )
    expect(library.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "published",
        locale: "en",
        limit: 1,
        filters: { documentId: row.documentId },
      })
    )
    library.findFirst.mockResolvedValueOnce(null as any)
    library.findMany.mockResolvedValueOnce([])
    await controller.library(ctx)
    expect(ctx.status).toBe(404)
  })
})
