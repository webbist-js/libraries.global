import { afterEach, describe, expect, it, vi } from "vitest"

import createController from "../../src/plugins/access/server/controllers/api-data"

// This file is in tests/access; paths resolve from that directory.
const teamId = "team00000000000000000001"
const libraryId = "library00000000000000001"
const entityRef = "europe:united-kingdom:england:bristol:central-library"
const context = (secret = "fixture") => ({
  request: { header: { "x-service-secret": secret } },
  params: { id: teamId, entityRef: undefined as string | undefined },
  query: {} as Record<string, string>,
  set: vi.fn(),
  unauthorized: vi.fn(),
  status: 200,
  body: undefined as unknown,
})
afterEach(() => vi.unstubAllEnvs())
describe("Team API internal data adapter", () => {
  it("requires the bridge secret and notices Team lapse immediately", async () => {
    vi.stubEnv("STRAPI_BRIDGE_SECRET", "fixture")
    const findOne = vi.fn(async () => ({ status: "lapsed", expiresAt: null }))
    const controller = createController({
      strapi: { documents: () => ({ findOne }) },
    })
    const untrusted = context("wrong")
    await controller.status(untrusted)
    expect(untrusted.unauthorized).toHaveBeenCalled()
    expect(findOne).not.toHaveBeenCalled()
    const trusted = context()
    await controller.status(trusted)
    expect(trusted.body).toEqual({ active: false })
  })
  it("selects published records and removes private fields and source notes", async () => {
    vi.stubEnv("STRAPI_BRIDGE_SECRET", "fixture")
    const findMany = vi.fn(async () => [
      {
        documentId: libraryId,
        entityRef,
        name: "Library",
        privateStaffEmail: "hidden",
        sourceRecords: [
          { dataset: "source", url: "https://example.org", notes: "internal" },
        ],
      },
    ])
    const controller = createController({
      strapi: {
        documents: (uid: string) => ({
          findMany: uid.includes("dataset")
            ? async () => [
                {
                  key: "source",
                  publisher: "Publisher",
                  licence: "CC0",
                  notes: "private correspondence",
                },
              ]
            : findMany,
        }),
      },
    })
    const ctx = context()
    ctx.params.entityRef = entityRef
    await controller.libraries(ctx)
    expect(findMany.mock.calls[0]?.[0]).toMatchObject({
      status: "published",
      locale: "en",
      limit: 1,
      filters: { entityRef: { $eq: entityRef } },
    })
    expect(ctx.body).toMatchObject({
      data: { entityRef },
      meta: { nextCursor: null },
    })
    expect(JSON.stringify(ctx.body)).not.toContain("hidden")
    expect(JSON.stringify(ctx.body)).not.toContain("internal")
    expect(JSON.stringify(ctx.body)).not.toContain("private correspondence")
    expect(JSON.stringify(ctx.body)).toContain("CC0")
  })

  it.each(["", libraryId, "europe:gb:eng:../users"])(
    "rejects malformed library reference %s without querying records",
    async (reference) => {
      vi.stubEnv("STRAPI_BRIDGE_SECRET", "fixture")
      const documents = vi.fn()
      const controller = createController({ strapi: { documents } })
      const ctx = context()
      ctx.params.entityRef = reference
      await controller.libraries(ctx)
      expect(ctx.status).toBe(404)
      expect(documents).not.toHaveBeenCalled()
    }
  )

  it("returns 404 when no published record matches the reference", async () => {
    vi.stubEnv("STRAPI_BRIDGE_SECRET", "fixture")
    const findMany = vi.fn(async () => [])
    const controller = createController({
      strapi: { documents: () => ({ findMany }) },
    })
    const ctx = context()
    ctx.params.entityRef = entityRef
    await controller.libraries(ctx)
    expect(ctx.status).toBe(404)
    expect(ctx.body).toEqual({ error: { code: "not_found" } })
    expect(findMany).toHaveBeenCalledOnce()
  })

  it("keeps list pagination cursors independent of entityRef addressing", async () => {
    vi.stubEnv("STRAPI_BRIDGE_SECRET", "fixture")
    const findMany = vi.fn(async () => [
      { documentId: libraryId, entityRef },
      {
        documentId: "library00000000000000002",
        entityRef: "europe:gb:eng:next",
      },
    ])
    const controller = createController({
      strapi: { documents: () => ({ findMany }) },
    })
    const ctx = context()
    ctx.query = { after: "library00000000000000000", limit: "1" }
    await controller.libraries(ctx)
    expect(findMany.mock.calls[0]?.[0]).toMatchObject({
      filters: { documentId: { $gt: ctx.query.after } },
      limit: 2,
    })
    expect(ctx.body).toMatchObject({
      data: [{ entityRef }],
      meta: { nextCursor: libraryId },
    })
  })
})
