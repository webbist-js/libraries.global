import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { makeFakeStrapi } from "./helpers/fake-strapi"
import controller from "../src/api/auth-bridge/controllers/auth-bridge"

const LIBRARY = "api::library.library"
const DRIVE = "api::drive.drive"
const PROFILE = "api::user-profile.user-profile"

function ctx(
  body: Record<string, unknown>,
  query: Record<string, unknown> = {}
) {
  const c: any = {
    query,
    request: { body, header: { "x-service-secret": "s3cret" } },
    send: (b: unknown) => ((c.status = 200), (c.body = b)),
    unauthorized: (m: string) => ((c.status = 401), (c.body = m)),
    badRequest: (m: string) => ((c.status = 400), (c.body = m)),
    forbidden: (m: string) => ((c.status = 403), (c.body = m)),
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

describe("auth-bridge follows for drives", () => {
  let fake: any
  let store: any
  beforeEach(() => {
    process.env.STRAPI_BRIDGE_SECRET = "s3cret"
    const made = makeFakeStrapi({
      [PROFILE]: [
        {
          id: 1,
          documentId: "p1",
          baUserId: "u1",
          followedDrives: [{ id: 20, documentId: "open-drive" }],
        },
      ],
      [DRIVE]: [
        // One row per locale: the follow links the first.
        { id: 20, documentId: "open-drive", status: "open", locale: "en" },
        { id: 21, documentId: "open-drive", status: "open", locale: "fr" },
        { id: 30, documentId: "closed-drive", status: "closed", locale: "en" },
        { id: 40, documentId: "draft-drive", status: "draft", locale: "en" },
      ],
    })
    fake = made.strapi
    store = made.store
    ;(globalThis as any).strapi = fake
  })
  afterEach(() => {
    delete (globalThis as any).strapi
  })

  const profileUpdates = () =>
    fake.db.query.mock.results
      .filter(
        (_: unknown, i: number) => fake.db.query.mock.calls[i][0] === PROFILE
      )
      .flatMap((r: any) => r.value.update.mock.calls.map((c: any[]) => c[0]))

  it("follows a drive that isn't a draft, linking its first row", async () => {
    const c = ctx({
      baUserId: "u1",
      driveDocumentId: "open-drive",
      action: "follow",
    })
    await controller.toggleFollow(c)

    expect(c.status).toBe(200)
    expect(c.body).toEqual({ following: true })
    expect(profileUpdates()).toEqual([
      {
        where: { id: 1 },
        data: { followedDrives: { connect: [{ id: 20 }] } },
      },
    ])
  })

  it("follows a closed drive too", async () => {
    const c = ctx({
      baUserId: "u1",
      driveDocumentId: "closed-drive",
      action: "follow",
    })
    await controller.toggleFollow(c)

    expect(c.status).toBe(200)
    expect(profileUpdates()[0].data).toEqual({
      followedDrives: { connect: [{ id: 30 }] },
    })
  })

  it("is not found for a draft drive, and links nothing", async () => {
    const c = ctx({
      baUserId: "u1",
      driveDocumentId: "draft-drive",
      action: "follow",
    })
    await controller.toggleFollow(c)

    expect(c.status).toBe(404)
    expect(profileUpdates()).toEqual([])
    expect(store[PROFILE][0].followedDrives).toEqual([
      { id: 20, documentId: "open-drive" },
    ])
  })

  it("is not found for a drive that doesn't exist", async () => {
    const c = ctx({
      baUserId: "u1",
      driveDocumentId: "no-such-drive",
      action: "follow",
    })
    await controller.toggleFollow(c)

    expect(c.status).toBe(404)
    expect(profileUpdates()).toEqual([])
  })

  it("unfollows by unlinking every locale row of the drive", async () => {
    const c = ctx({
      baUserId: "u1",
      driveDocumentId: "open-drive",
      action: "unfollow",
    })
    await controller.toggleFollow(c)

    expect(c.status).toBe(200)
    expect(c.body).toEqual({ following: false })
    expect(profileUpdates()[0].data).toEqual({
      followedDrives: { disconnect: [{ id: 20 }, { id: 21 }] },
    })
  })

  it("refuses a library and a drive at once, or an unknown action", async () => {
    const both = ctx({
      baUserId: "u1",
      libraryDocumentId: "pub",
      driveDocumentId: "open-drive",
      action: "follow",
    })
    await controller.toggleFollow(both)
    expect(both.status).toBe(400)

    const odd = ctx({
      baUserId: "u1",
      driveDocumentId: "open-drive",
      action: "toggle",
    })
    await controller.toggleFollow(odd)
    expect(odd.status).toBe(400)
    expect(profileUpdates()).toEqual([])
  })

  it("reports whether the user follows a drive", async () => {
    const yes = ctx({}, { baUserId: "u1", driveDocumentId: "open-drive" })
    await controller.followStatus(yes)
    expect(yes.body).toEqual({ following: true })

    const no = ctx({}, { baUserId: "u1", driveDocumentId: "closed-drive" })
    await controller.followStatus(no)
    expect(no.body).toEqual({ following: false })

    const missing = ctx({}, { baUserId: "u1" })
    await controller.followStatus(missing)
    expect(missing.status).toBe(400)
  })
})

describe("account follower notifications", () => {
  let fake: ReturnType<typeof makeFakeStrapi>
  let enqueue: ReturnType<typeof vi.fn>
  beforeEach(() => {
    process.env.STRAPI_BRIDGE_SECRET = "s3cret"
    fake = makeFakeStrapi({
      [PROFILE]: [
        {
          id: 1,
          documentId: "p1",
          baUserId: "reader",
          username: "reader",
          profileVisibility: "public",
          followedProfiles: [],
        },
        {
          id: 2,
          documentId: "p2",
          baUserId: "owner",
          username: "owner",
          profileVisibility: "public",
        },
      ],
    })
    enqueue = vi.fn(async () => ({}))
    fake.services["api::notification.notification"] = { enqueue }
    ;(globalThis as any).strapi = fake.strapi
  })
  afterEach(() => {
    delete (globalThis as any).strapi
  })
  const request = (action = "follow", targetUsername = "owner") =>
    ctx({ baUserId: "reader", targetUsername, action })

  it("records an anonymous alert once for repeated follows", async () => {
    await controller.toggleFollowUser(request())
    // The fake stores connect instructions rather than resolving relations.
    fake.store[PROFILE][0].followedProfiles = [{ id: 2 }]
    await controller.toggleFollowUser(request())
    expect(enqueue).toHaveBeenCalledTimes(1)
    expect(enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        baUserId: "owner",
        kind: "new_follower",
        emailPreference: "newFollowers",
      })
    )
    expect(enqueue.mock.calls[0][0].body).not.toContain("reader")
  })

  it("keeps the relation unchanged if notification persistence fails", async () => {
    enqueue.mockRejectedValueOnce(new Error("Queue unavailable"))
    await expect(controller.toggleFollowUser(request())).rejects.toThrow(
      "Queue unavailable"
    )
    expect(fake.store[PROFILE][0].followedProfiles).toEqual([])
  })

  it("rejects malformed actions, private targets and self-follow", async () => {
    const malformed = request("unexpected")
    await controller.toggleFollowUser(malformed)
    expect(malformed.status).toBe(400)
    const self = request("follow", "reader")
    await controller.toggleFollowUser(self)
    expect(self.status).toBe(400)
    fake.store[PROFILE][1].profileVisibility = "private"
    const privateTarget = request()
    await controller.toggleFollowUser(privateTarget)
    expect(privateTarget.status).toBe(403)
    expect(enqueue).not.toHaveBeenCalled()
  })
})
