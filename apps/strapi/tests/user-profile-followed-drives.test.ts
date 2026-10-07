import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { makeFakeStrapi } from "./helpers/fake-strapi"
import factory from "../src/api/user-profile/controllers/user-profile"

const PROFILE = "api::user-profile.user-profile"

const DRIVES = [
  { id: 20, documentId: "d-open", slug: "open-drive", status: "open" },
  { id: 30, documentId: "d-closed", slug: "closed-drive", status: "closed" },
  // A draft never surfaces, even if a follow somehow points at one.
  { id: 40, documentId: "d-draft", slug: "draft-drive", status: "draft" },
  // A second locale row of a followed drive is listed once.
  { id: 21, documentId: "d-open", slug: "open-drive", status: "open" },
]

function ctx(
  params: Record<string, string>,
  query: Record<string, unknown> = {},
  secret?: string
) {
  const c: any = {
    params,
    query,
    request: { headers: secret ? { "x-service-secret": secret } : {} },
    send: (b: unknown) => ((c.status = 200), (c.body = b)),
    notFound: (m: string) => ((c.status = 404), (c.body = m)),
    forbidden: (m: string) => ((c.status = 403), (c.body = m)),
    unauthorized: (m: string) => ((c.status = 401), (c.body = m)),
    badRequest: (m: string) => ((c.status = 400), (c.body = m)),
  }

  return c
}

describe("followedDrives on a profile", () => {
  let controller: any

  beforeEach(() => {
    process.env.STRAPI_BRIDGE_SECRET = "s3cret"
    const { strapi } = makeFakeStrapi({
      [PROFILE]: [
        {
          documentId: "pFan",
          username: "fan",
          baUserId: "uFan",
          profileVisibility: "public",
          followedDrives: DRIVES,
        },
        {
          documentId: "pShy",
          username: "shy",
          baUserId: "uShy",
          profileVisibility: "public",
          publicPrefs: { showFollows: false },
          followedDrives: DRIVES,
        },
      ],
    })
    ;(globalThis as any).strapi = strapi
    controller = factory({
      strapi: { ...strapi, contentType: () => ({ uid: PROFILE }) },
    } as any)
  })
  afterEach(() => {
    delete (globalThis as any).strapi
  })

  it("lists each followed drive once, as documentId and slug, never a draft", async () => {
    const c = ctx({ username: "fan" })
    await controller.findByUsername(c)

    expect(c.status).toBe(200)
    expect(c.body.data.followedDrives).toEqual([
      { documentId: "d-open", slug: "open-drive" },
      { documentId: "d-closed", slug: "closed-drive" },
    ])
  })

  it("hides them when the owner switched follows off, except from the owner", async () => {
    const anon = ctx({ username: "shy" })
    await controller.findByUsername(anon)
    expect(anon.body.data.followedDrives).toEqual([])
    expect(anon.body.data.followedLibraries).toEqual([])

    const owner = ctx({ username: "shy" }, { ownerBaUserId: "uShy" }, "s3cret")
    await controller.findByUsername(owner)
    expect(
      owner.body.data.followedDrives.map((d: any) => d.documentId)
    ).toEqual(["d-open", "d-closed"])
  })

  it("comes back on the owner's own profile read", async () => {
    const c = ctx({})
    c.request.headers = { "x-service-secret": "s3cret", "x-ba-user-id": "uFan" }
    await controller.findMe(c)

    expect(c.status).toBe(200)
    expect(c.body.data.followedDrives).toHaveLength(2)
  })
})
