import { createRequire } from "node:module"

import { describe, expect, it, vi } from "vitest"

/**
 * strapi-plugin-meilisearch registers the outermost document middleware, and
 * unpatched it awaits `next()` inside a try whose catch logs and returns
 * undefined. Every error beneath it (a validation error, a database error,
 * a change-record failure meant to roll the write back) vanished, and REST
 * answered 404. patches/strapi-plugin-meilisearch@0.16.5.patch rethrows what
 * `next()` throws, and still runs the write when the plugin's own lookup
 * fails first.
 */
const require = createRequire(import.meta.url)
const plugin = require("strapi-plugin-meilisearch/strapi-server") as {
  register: (args: { strapi: unknown }) => Promise<void>
}

type Mw = (ctx: unknown, next: () => Promise<unknown>) => Promise<unknown>

async function pluginMiddleware(listened: () => Promise<string[]>) {
  let mw: Mw | undefined
  const services: Record<string, unknown> = {
    store: { getListenedContentTypes: listened },
    meilisearch: { entriesQuery: () => ({ locale: "*" }) },
    contentType: {},
  }
  const strapi = {
    documents: { use: (fn: Mw) => (mw = fn) },
    plugin: () => ({ service: (name: string) => services[name] }),
    log: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
  }
  await plugin.register({ strapi })

  return { mw: mw!, log: strapi.log }
}

const ctx = {
  uid: "api::library.library",
  action: "update",
  params: { documentId: "lib" },
}

describe("Meilisearch document middleware", () => {
  it("lets an error from the write itself reach the caller", async () => {
    const { mw } = await pluginMiddleware(async () => ["api::library.library"])
    const boom = new Error("Publish the region first")

    await expect(
      mw(ctx, async () => {
        throw boom
      })
    ).rejects.toBe(boom)
  })

  it("still writes when its own lookup fails before the write", async () => {
    const { mw, log } = await pluginMiddleware(async () => {
      throw new Error("store unavailable")
    })
    const next = vi.fn(async () => ({ documentId: "lib" }))

    await expect(mw(ctx, next)).resolves.toEqual({ documentId: "lib" })
    expect(next).toHaveBeenCalledTimes(1)
    expect(log.error).toHaveBeenCalled()
  })
})
