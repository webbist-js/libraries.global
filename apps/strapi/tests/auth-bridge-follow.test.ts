import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { makeFakeStrapi } from "./helpers/fake-strapi"
import controller from "../src/api/auth-bridge/controllers/auth-bridge"

const LIBRARY = "api::library.library"
const PROFILE = "api::user-profile.user-profile"

function ctx(body: Record<string, unknown>) {
  const c: any = {
    request: { body, header: { "x-service-secret": "s3cret" } },
    send: (b: unknown) => ((c.status = 200), (c.body = b)),
    unauthorized: (m: string) => ((c.status = 401), (c.body = m)),
    badRequest: (m: string) => ((c.status = 400), (c.body = m)),
    notFound: (m: string) => ((c.status = 404), (c.body = m)),
  }

  return c
}

describe("auth-bridge toggleFollow (E6)", () => {
  let fake: any
  beforeEach(() => {
    process.env.STRAPI_BRIDGE_SECRET = "s3cret"
    const { strapi } = makeFakeStrapi({
      [PROFILE]: [{ id: 1, documentId: "p1", baUserId: "u1" }],
      [LIBRARY]: [
        { id: 10, documentId: "pub", publishedAt: "2026-01-01T00:00:00.000Z" },
        { id: 11, documentId: "draft", publishedAt: null },
      ],
    })
    ;(globalThis as any).strapi = strapi
    fake = strapi
  })
  afterEach(() => {
    delete (globalThis as any).strapi
  })

  it("follows a published library", async () => {
    const c = ctx({
      baUserId: "u1",
      libraryDocumentId: "pub",
      action: "follow",
    })
    await controller.toggleFollow(c)

    expect(c.status).toBe(200)
    expect(c.body).toEqual({ following: true })
    const i = fake.db.query.mock.calls.findLastIndex(
      ([u]: [string]) => u === PROFILE
    )
    const { update } = fake.db.query.mock.results[i].value
    expect(update.mock.calls[0][0]).toEqual({
      where: { id: 1 },
      data: { followedLibraries: { connect: [{ id: 10 }] } },
    })
  })

  it("refuses to follow a library that is only a draft", async () => {
    const c = ctx({
      baUserId: "u1",
      libraryDocumentId: "draft",
      action: "follow",
    })
    await controller.toggleFollow(c)

    expect(c.status).toBe(404)
    const i = fake.db.query.mock.calls.findIndex(
      ([u]: [string]) => u === LIBRARY
    )
    const { findOne } = fake.db.query.mock.results[i].value
    expect(findOne.mock.calls[0][0].where).toEqual({
      documentId: "draft",
      publishedAt: { $notNull: true },
    })
  })
})
