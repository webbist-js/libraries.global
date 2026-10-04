import { describe, expect, it, vi } from "vitest"

import {
  registerLibraryPublishPlacesMiddleware,
  unpublishedPlaces,
} from "../src/documentMiddlewares/library-publish-places"

type Versions = { draft?: Record<string, unknown>; published?: unknown }
type Mw = (ctx: unknown, next: () => Promise<unknown>) => Promise<unknown>

/** `uid:documentId` → its draft and published versions. */
function fakeStrapi(docs: Record<string, Versions>) {
  const middlewares: Mw[] = []
  const documents = Object.assign(
    (uid: string) => ({
      findOne: vi.fn(
        async ({
          documentId,
          status,
        }: {
          documentId: string
          status: "draft" | "published"
        }) => docs[`${uid}:${documentId}`]?.[status] ?? null
      ),
    }),
    { use: (fn: Mw) => middlewares.push(fn) }
  )
  const strapi = {
    documents,
    contentType: () => ({ pluginOptions: { i18n: { localized: true } } }),
  }

  return { strapi, middleware: () => middlewares[0]! }
}

const LIB = "api::library.library"
const draftLibrary = {
  documentId: "lib",
  continent: { documentId: "eu", name: "Europe" },
  country: { documentId: "sc", name: "Scotland" },
  region: { documentId: "na", name: "North Ayrshire" },
  area: null,
}
const publishedParents = {
  "api::continent.continent:eu": { published: { documentId: "eu" } },
  "api::country.country:sc": { published: { documentId: "sc" } },
}

describe("unpublishedPlaces", () => {
  it("names each linked place with no published version", async () => {
    const { strapi } = fakeStrapi({
      [`${LIB}:lib`]: { draft: draftLibrary },
      ...publishedParents,
      "api::region.region:na": { draft: { documentId: "na" } },
    })

    expect(
      await unpublishedPlaces(strapi, { documentId: "lib", locale: "en" })
    ).toEqual(["region “North Ayrshire”"])
  })

  it("is empty when every linked place is published", async () => {
    const { strapi } = fakeStrapi({
      [`${LIB}:lib`]: { draft: draftLibrary },
      ...publishedParents,
      "api::region.region:na": { published: { documentId: "na" } },
    })

    expect(await unpublishedPlaces(strapi, { documentId: "lib" })).toEqual([])
  })
})

describe("library publish middleware", () => {
  it("refuses to publish a library into a draft region", async () => {
    const { strapi, middleware } = fakeStrapi({
      [`${LIB}:lib`]: { draft: draftLibrary },
      ...publishedParents,
    })
    registerLibraryPublishPlacesMiddleware({ strapi })
    const next = vi.fn()

    await expect(
      middleware()(
        { uid: LIB, action: "publish", params: { documentId: "lib" } },
        next
      )
    ).rejects.toThrow(/Publish the region “North Ayrshire” first/)
    expect(next).not.toHaveBeenCalled()
  })

  it("checks an update that publishes in the same call", async () => {
    // Strapi's create and update publish internally when status is
    // "published", without a separate publish action (REST writes do this).
    const { strapi, middleware } = fakeStrapi({
      [`${LIB}:lib`]: { draft: draftLibrary },
      ...publishedParents,
    })
    registerLibraryPublishPlacesMiddleware({ strapi })

    await expect(
      middleware()(
        {
          uid: LIB,
          action: "update",
          params: { documentId: "lib", status: "published", data: {} },
        },
        vi.fn()
      )
    ).rejects.toThrow(/region “North Ayrshire”/)
  })

  it("reads the places a create or update sets in its data", async () => {
    const { strapi, middleware } = fakeStrapi({
      [`${LIB}:lib`]: { draft: draftLibrary },
      ...publishedParents,
      "api::region.region:ayr": {
        draft: { documentId: "ayr", name: "South Ayrshire" },
      },
      "api::region.region:pub": { published: { documentId: "pub" } },
    })
    registerLibraryPublishPlacesMiddleware({ strapi })
    const next = vi.fn(async () => "ok")

    await expect(
      middleware()(
        {
          uid: LIB,
          action: "create",
          params: {
            status: "published",
            data: { region: { connect: [{ documentId: "ayr" }] } },
          },
        },
        next
      )
    ).rejects.toThrow(/region “South Ayrshire”/)

    // Moving the draft-region library to a published region may publish.
    await middleware()(
      {
        uid: LIB,
        action: "update",
        params: {
          documentId: "lib",
          status: "published",
          data: { region: "pub" },
        },
      },
      next
    )
    expect(next).toHaveBeenCalledTimes(1)
  })

  it("leaves other actions and content types alone", async () => {
    const { strapi, middleware } = fakeStrapi({})
    registerLibraryPublishPlacesMiddleware({ strapi })
    const next = vi.fn(async () => "ok")

    await middleware()(
      { uid: LIB, action: "update", params: { documentId: "lib" } },
      next
    )
    await middleware()(
      { uid: "api::region.region", action: "publish", params: {} },
      next
    )
    expect(next).toHaveBeenCalledTimes(2)
  })
})
