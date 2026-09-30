import { describe, expect, it, vi } from "vitest"

import { makeFakeStrapi } from "./helpers/fake-strapi"
import { registerCatalogueLinkMiddleware } from "../src/documentMiddlewares/catalogue"

const LIBRARY = "api::library.library"

function build() {
  const faked = makeFakeStrapi({
    [LIBRARY]: [
      { documentId: "l1", name: "A", catalogueUrl: "https://cat.example/one" },
    ],
  })
  const linkLibrary = vi.fn(async () => null)
  faked.services["api::catalogue.catalogue"] = { linkLibrary }
  let handler: any = null
  faked.strapi.documents.use = vi.fn((fn: any) => (handler = fn))
  registerCatalogueLinkMiddleware({ strapi: faked.strapi })
  const run = async (context: Record<string, unknown>) => {
    const result = await handler(context, async () => ({ documentId: "l1" }))
    await new Promise((r) => setImmediate(r))

    return result
  }

  return { ...faked, linkLibrary, run }
}

describe("catalogue link document middleware (E5)", () => {
  it("does nothing when the written catalogueUrl equals the stored one", async () => {
    const { run, linkLibrary } = build()
    await run({
      uid: LIBRARY,
      action: "update",
      params: {
        documentId: "l1",
        data: { catalogueUrl: "https://cat.example/one", name: "A2" },
      },
    })

    expect(linkLibrary).not.toHaveBeenCalled()
  })

  it("links when the catalogueUrl changes, and on create", async () => {
    const { run, linkLibrary } = build()
    await run({
      uid: LIBRARY,
      action: "update",
      params: {
        documentId: "l1",
        data: { catalogueUrl: "https://cat.example/two" },
      },
    })
    expect(linkLibrary).toHaveBeenCalledWith("l1")

    await run({
      uid: LIBRARY,
      action: "create",
      params: { data: { catalogueUrl: "https://cat.example/three" } },
    })
    expect(linkLibrary).toHaveBeenCalledTimes(2)
  })

  it("never reads the record for writes that don't touch catalogueUrl", async () => {
    const { run, linkLibrary, strapi } = build()
    await run({
      uid: LIBRARY,
      action: "update",
      params: { documentId: "l1", data: { name: "B" } },
    })

    expect(linkLibrary).not.toHaveBeenCalled()
    expect(strapi.documents).not.toHaveBeenCalled()
  })
})
