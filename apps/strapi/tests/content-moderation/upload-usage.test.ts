import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import submissionControllerFactory from "../../src/plugins/content-moderation/server/controllers/submission"
import contentApiRoutes from "../../src/plugins/content-moderation/server/routes/content-api"
import createService from "../../src/plugins/content-moderation/server/services/submission"
import { makeFakeStrapi } from "../helpers/fake-strapi"

const UPLOAD = "plugin::content-moderation.submission-upload"
const FILE = "plugin::upload.file"

const ORIGINAL_SECRET = process.env.STRAPI_BRIDGE_SECRET
beforeEach(() => {
  process.env.STRAPI_BRIDGE_SECRET = "test-secret"
})
afterEach(() => {
  if (ORIGINAL_SECRET === undefined) delete process.env.STRAPI_BRIDGE_SECRET
  else process.env.STRAPI_BRIDGE_SECRET = ORIGINAL_SECRET
})

function harness() {
  const now = Date.now()
  const today = new Date(now).toISOString()
  const yesterday = new Date(now - 36 * 60 * 60 * 1000).toISOString()
  const made = makeFakeStrapi({
    [UPLOAD]: [
      { documentId: "up1", fileId: 1, baUserId: "u1", createdAt: today },
      { documentId: "up2", fileId: 2, baUserId: "u1", createdAt: today },
      { documentId: "up3", fileId: 3, baUserId: "u1", createdAt: yesterday },
      { documentId: "up4", fileId: 4, baUserId: "u2", createdAt: today },
    ],
    // `size` is in kilobytes, as Strapi's upload plugin stores it.
    [FILE]: [
      { documentId: "f1", id: 1, size: 100 },
      { documentId: "f2", id: 2, size: 50.5 },
      { documentId: "f3", id: 3, size: 999 },
      { documentId: "f4", id: 4, size: 7 },
    ],
  })
  made.services["content-moderation.submission"] = createService({
    strapi: made.strapi,
  })
  const ctx = (headers: Record<string, string>): any => ({
    request: { headers },
    set: vi.fn(),
    unauthorized: vi.fn(),
    badRequest: vi.fn(),
  })

  return {
    ...made,
    ctx,
    controller: submissionControllerFactory({ strapi: made.strapi }),
  }
}

describe("GET /uploads/usage", () => {
  it("is a content-api route with no users-permissions auth", () => {
    const route = contentApiRoutes.find((r) => r.path === "/uploads/usage")
    expect(route).toMatchObject({
      method: "GET",
      handler: "submission.uploadUsage",
      config: { auth: false },
    })
  })

  it("refuses without a valid bridge secret, and never reads the user header first", async () => {
    const { ctx, controller } = harness()
    const missing = ctx({ "x-ba-user-id": "u1" })
    await controller.uploadUsage(missing)
    expect(missing.unauthorized).toHaveBeenCalled()
    expect(missing.body).toBeUndefined()

    const wrong = ctx({ "x-service-secret": "nope", "x-ba-user-id": "u1" })
    await controller.uploadUsage(wrong)
    expect(wrong.unauthorized).toHaveBeenCalled()
    expect(wrong.body).toBeUndefined()
  })

  it("needs the user header once the secret checks out", async () => {
    const { ctx, controller } = harness()
    const c = ctx({ "x-service-secret": "test-secret" })
    await controller.uploadUsage(c)
    expect(c.badRequest).toHaveBeenCalled()
    expect(c.body).toBeUndefined()
  })

  it("answers today's file count and bytes for that user only", async () => {
    const { ctx, controller } = harness()
    const c = ctx({ "x-service-secret": "test-secret", "x-ba-user-id": "u1" })
    await controller.uploadUsage(c)
    // 100 KB + 50.5 KB; yesterday's file and u2's are not counted.
    expect(c.body).toEqual({ files: 2, bytes: 150_500 })

    const none = ctx({
      "x-service-secret": "test-secret",
      "x-ba-user-id": "u9",
    })
    await controller.uploadUsage(none)
    expect(none.body).toEqual({ files: 0, bytes: 0 })
  })
})
