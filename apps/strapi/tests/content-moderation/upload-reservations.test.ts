import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import submissionController from "../../src/plugins/content-moderation/server/controllers/submission"
import uploadController from "../../src/plugins/content-moderation/server/controllers/upload"
import {
  cancelUpload,
  completeUpload,
  reserveUpload,
} from "../../src/plugins/content-moderation/server/utils/upload-reservations"
import { makeFakeStrapi } from "../helpers/fake-strapi"

const RES = "plugin::content-moderation.upload-reservation"
const OWN = "plugin::content-moderation.submission-upload"
const FILE = "plugin::upload.file"
const now = Date.now()
function bindFile(
  store: Record<string, any[]>,
  reservationId: string,
  fileId = 7
) {
  Object.assign(
    store[FILE].find((row) => row.id === fileId),
    {
      name: `upload-${reservationId}.png`,
      mime: "image/png",
      createdAt: new Date(now + 60_000).toISOString(),
    }
  )
}

function harness(seed: Record<string, any[]> = {}) {
  const fake = makeFakeStrapi(
    {
      [RES]: [],
      [OWN]: [],
      [FILE]: [
        {
          documentId: "file7",
          id: 7,
          size: 0.1,
          createdAt: new Date(now + 1000).toISOString(),
        },
      ],
      ...seed,
    },
    { uniqueKeys: { [OWN]: [["fileId"]], [RES]: [["reservationId"]] } }
  )
  const docs = fake.strapi.documents
  const adapters = new Map<string, any>()
  fake.strapi.documents = vi.fn((uid: string) => {
    if (!adapters.has(uid)) adapters.set(uid, docs(uid))

    return adapters.get(uid)
  })
  const original = fake.strapi.db.transaction
  const raw = vi.fn(async () => ({}))
  let tail = Promise.resolve<unknown>(undefined)
  // Model the database's advisory-lock ordering, including the existing fake's rollback.
  fake.strapi.db.transaction = vi.fn((work: any) => {
    const result = tail.then(() =>
      original((context: any) =>
        work({ ...context, trx: { ...context.trx, raw } })
      )
    )
    tail = result.catch(() => {})

    return result
  })
  const remove = vi.fn(async (file: { id: number }) => {
    const rows = fake.store[FILE]
    rows.splice(
      rows.findIndex((row) => row.id === file.id),
      1
    )
  })
  fake.services["upload.upload"] = { remove }

  return { ...fake, raw, remove }
}

describe("durable shared upload reservations", () => {
  it("serialises simultaneous reservations from independent upload adapters and admits at most 20", async () => {
    const { strapi, store, raw } = harness()
    const secondInstance = { ...strapi }
    const results = await Promise.allSettled(
      Array.from({ length: 30 }, (_, index) =>
        reserveUpload(
          index % 2 ? strapi : secondInstance,
          "writer",
          100,
          index % 3 ? "avatar" : "submission",
          now
        )
      )
    )
    expect(
      results.filter((result) => result.status === "fulfilled")
    ).toHaveLength(20)
    expect(
      results
        .filter((result) => result.status === "rejected")
        .every(
          (result) =>
            result.status === "rejected" && result.reason.status === 429
        )
    ).toBe(true)
    expect(store[RES]).toHaveLength(20)
    expect(raw).toHaveBeenCalledWith(
      "SELECT pg_advisory_xact_lock(hashtextextended(?, 0))",
      [`content-upload:writer:${new Date(now).toISOString().slice(0, 10)}`]
    )
  })

  it("shares the byte budget and counts legacy uploads using decimal KB", async () => {
    const { strapi } = harness({
      [OWN]: [
        {
          documentId: "old",
          fileId: 8,
          baUserId: "writer",
          createdAt: new Date(now).toISOString(),
        },
      ],
      [FILE]: [
        { documentId: "oldfile", id: 8, size: (50 * 1024 * 1024) / 1000 },
      ],
    })
    await expect(
      reserveUpload(strapi, "writer", 100, "article", now)
    ).rejects.toMatchObject({ status: 429, code: "bytes" })
    const independent = await reserveUpload(
      strapi,
      "other",
      100,
      "article",
      now
    )
    expect(independent.reservationId).toMatch(/^[0-9a-f-]{36}$/)
  })

  it("commits completion and ownership once, and does not double-count the completed file", async () => {
    const { strapi, store } = harness()
    const reservation = await reserveUpload(
      strapi,
      "writer",
      100,
      "article",
      now
    )
    bindFile(store, reservation.reservationId)
    await completeUpload(strapi, "writer", reservation.reservationId, 7, now)
    await completeUpload(strapi, "writer", reservation.reservationId, 7, now)
    expect(store[OWN]).toHaveLength(1)
    expect(store[RES][0]).toMatchObject({
      status: "completed",
      fileId: 7,
      bytes: 100,
    })
    for (let index = 0; index < 19; index++)
      await reserveUpload(strapi, "writer", 100, "avatar", now)
    expect(store[RES]).toHaveLength(20)
  })

  it("rolls ownership back if recording completion fails", async () => {
    const { strapi, store } = harness()
    const reservation = await reserveUpload(
      strapi,
      "writer",
      100,
      "article",
      now
    )
    bindFile(store, reservation.reservationId)
    strapi
      .documents(RES)
      .update.mockRejectedValueOnce(new Error("database failure"))
    await expect(
      completeUpload(strapi, "writer", reservation.reservationId, 7, now)
    ).rejects.toThrow("database failure")
    expect(store[OWN]).toEqual([])
    expect(store[RES][0].status).toBe("reserved")
  })

  it("assigns the chosen name only after checking the reserved upload, and retries safely", async () => {
    const { strapi, store } = harness()
    const reservation = await reserveUpload(
      strapi,
      "writer",
      100,
      "submission",
      now
    )
    bindFile(store, reservation.reservationId)
    await completeUpload(
      strapi,
      "writer",
      reservation.reservationId,
      7,
      now,
      "Reading room.png"
    )
    expect(store[FILE][0].name).toBe("Reading room.png")
    await completeUpload(
      strapi,
      "writer",
      reservation.reservationId,
      7,
      now,
      "Reading room.png"
    )
    expect(store[OWN]).toHaveLength(1)
    expect(store[RES][0].status).toBe("completed")
  })

  it("rolls the name back with ownership when completion fails", async () => {
    const { strapi, store } = harness()
    const reservation = await reserveUpload(
      strapi,
      "writer",
      100,
      "submission",
      now
    )
    bindFile(store, reservation.reservationId)
    strapi
      .documents(RES)
      .update.mockRejectedValueOnce(new Error("database failure"))
    await expect(
      completeUpload(
        strapi,
        "writer",
        reservation.reservationId,
        7,
        now,
        "Reading room.png"
      )
    ).rejects.toThrow("database failure")
    expect(store[FILE][0].name).toBe(`upload-${reservation.reservationId}.png`)
    expect(store[OWN]).toEqual([])
  })

  it("never renames a file that does not match the writer's reservation", async () => {
    const { strapi, store } = harness()
    const reservation = await reserveUpload(
      strapi,
      "writer",
      100,
      "submission",
      now
    )
    bindFile(store, "another-reservation")
    await expect(
      completeUpload(
        strapi,
        "writer",
        reservation.reservationId,
        7,
        now,
        "Reading room.png"
      )
    ).rejects.toMatchObject({ code: "upload_file_mismatch" })
    expect(store[FILE][0].name).toBe("upload-another-reservation.png")
    expect(store[OWN]).toEqual([])
  })

  it("refuses cross-user completions and foreign file ownership", async () => {
    const { strapi, store } = harness({
      [OWN]: [
        {
          documentId: "foreign",
          fileId: 7,
          baUserId: "other",
          createdAt: new Date(now).toISOString(),
        },
      ],
    })
    const reservation = await reserveUpload(
      strapi,
      "writer",
      100,
      "article",
      now
    )
    bindFile(store, reservation.reservationId)
    await expect(
      completeUpload(strapi, "other", reservation.reservationId, 7, now)
    ).rejects.toMatchObject({ status: 404 })
    await expect(
      completeUpload(strapi, "writer", reservation.reservationId, 7, now)
    ).rejects.toMatchObject({ status: 403 })
  })

  it("removes an unowned orphan before cancelling, but never deletes a committed file after an ambiguous response", async () => {
    const { strapi, store, remove } = harness()
    const first = await reserveUpload(strapi, "writer", 100, "submission", now)
    bindFile(store, first.reservationId)
    await cancelUpload(strapi, "writer", first.reservationId, 7)
    expect(remove).toHaveBeenCalledTimes(1)
    expect(store[RES][0].status).toBe("cancelled")
    store[FILE].push({
      documentId: "file9",
      id: 9,
      size: 0.1,
      createdAt: new Date(now + 2000).toISOString(),
    })
    const second = await reserveUpload(strapi, "writer", 100, "avatar", now)
    bindFile(store, second.reservationId, 9)
    await completeUpload(strapi, "writer", second.reservationId, 9, now)
    await cancelUpload(strapi, "writer", second.reservationId, 9)
    expect(remove).toHaveBeenCalledTimes(1)
    expect(store[FILE].some((file) => file.id === 9)).toBe(true)
  })

  it("does not release charged attempts when orphan cleanup fails", async () => {
    const { strapi, store, remove } = harness()
    const reservation = await reserveUpload(
      strapi,
      "writer",
      100,
      "submission",
      now
    )
    bindFile(store, reservation.reservationId)
    remove.mockRejectedValueOnce(new Error("storage offline"))
    await expect(
      cancelUpload(strapi, "writer", reservation.reservationId, 7)
    ).rejects.toThrow("storage offline")
    expect(store[RES][0].status).toBe("reserved")
  })

  it("fails closed without an advisory-lock transaction", async () => {
    const { strapi, store } = harness()
    strapi.db.transaction = async (work: any) => work({ trx: {} })
    await expect(
      reserveUpload(strapi, "writer", 100, "article", now)
    ).rejects.toMatchObject({ status: 503 })
    expect(store[RES]).toEqual([])
  })
  it("rejects an unrelated existing media file even with a valid daily reservation", async () => {
    const { strapi, store } = harness()
    const reservation = await reserveUpload(
      strapi,
      "writer",
      100,
      "article",
      now
    )
    store[FILE][0].name = "somebody-elses-file.png"
    store[FILE][0].mime = "image/png"
    await expect(
      completeUpload(strapi, "writer", reservation.reservationId, 7, now)
    ).rejects.toMatchObject({ status: 400, code: "upload_file_mismatch" })
    expect(store[OWN]).toEqual([])
  })
})

describe("trusted upload bridge", () => {
  beforeEach(() => vi.stubEnv("STRAPI_BRIDGE_SECRET", "secret"))
  afterEach(() => vi.unstubAllEnvs())
  function context(
    headers: Record<string, string>,
    body: Record<string, unknown> = {}
  ): any {
    return {
      request: { headers, body },
      set: vi.fn(),
      unauthorized: vi.fn(),
      badRequest: vi.fn(),
    }
  }
  it("checks the secret before trusting a user header", async () => {
    const { strapi, store } = harness()
    const ctx = context(
      { "x-ba-user-id": "writer" },
      { bytes: 100, purpose: "article" }
    )
    await uploadController({ strapi }).reserve(ctx)
    expect(ctx.unauthorized).toHaveBeenCalled()
    expect(store[RES]).toEqual([])
  })
  it("makes the legacy ownership endpoint require both secret and reservation", async () => {
    const { strapi, store } = harness()
    const noSecret = context(
      { "x-ba-user-id": "writer", "x-ba-user-email": "writer@example.test" },
      { fileId: 7 }
    )
    await submissionController({ strapi }).recordUpload(noSecret)
    expect(noSecret.unauthorized).toHaveBeenCalled()
    const noReservation = context(
      {
        "x-service-secret": "secret",
        "x-ba-user-id": "writer",
        "x-ba-user-email": "writer@example.test",
      },
      { fileId: 7 }
    )
    await submissionController({ strapi }).recordUpload(noReservation)
    expect(noReservation.badRequest).toHaveBeenCalled()
    expect(store[OWN]).toEqual([])
  })
})
