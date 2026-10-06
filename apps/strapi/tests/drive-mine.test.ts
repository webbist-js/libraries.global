import { beforeEach, describe, expect, it } from "vitest"

import { makeFakeStrapi } from "./helpers/fake-strapi"
import controllerFactory from "../src/api/drive/controllers/drive"
import serviceFactory from "../src/api/drive/services/drive"

const DRIVE = "api::drive.drive"
const SUBMISSION = "plugin::content-moderation.submission"
const CREDIT = "api::drive-credit.drive-credit"

const docId = (s: string) => s.padEnd(24, "0")
const HOURS = docId("drvhours1")
const OTHER = docId("drvother1")

const sub = (
  n: number,
  status: string,
  extra: Record<string, unknown> = {}
) => ({
  documentId: docId(`sub${n}`),
  driveDocumentId: HOURS,
  submittedByUserId: "u1",
  status,
  ...extra,
})

const credit = (n: number, extra: Record<string, unknown> = {}) => ({
  documentId: docId(`cr${n}`),
  driveDocumentId: HOURS,
  baUserId: "u1",
  submissionDocumentId: docId(`sub${n}`),
  ...extra,
})

function build(seed: Record<string, unknown[]> = {}) {
  const fake = makeFakeStrapi(
    {
      [DRIVE]: [
        { documentId: HOURS, status: "open" },
        { documentId: docId("drvdraft1"), status: "draft" },
      ],
      ...seed,
    } as any,
    { tables: { cm_submissions: SUBMISSION, drive_credits: CREDIT } }
  )
  const strapiStub: any = {
    ...fake.strapi,
    contentType: () => ({ uid: DRIVE }),
  }
  const service = serviceFactory({ strapi: strapiStub } as any)
  fake.services[DRIVE] = service
  const controller = controllerFactory({ strapi: strapiStub } as any)

  return { ...fake, service, controller }
}

function ctx({
  documentId = HOURS,
  secret = "s3cret",
  baUserId = "u1",
}: {
  documentId?: string
  secret?: string | null
  baUserId?: string | null
} = {}) {
  const headers: Record<string, string> = {}
  if (secret !== null) headers["x-service-secret"] = secret
  if (baUserId) headers["x-ba-user-id"] = baUserId
  const c: any = { request: { headers }, params: { documentId }, query: {} }
  c.set = (k: string, v: string) => {
    c.headers = { ...c.headers, [k]: v }
  }
  c.unauthorized = (message: string) => {
    c.status = 401
    c.body = { error: { status: 401, message } }
  }
  c.notFound = (message: string) => {
    c.status = 404
    c.body = { error: { status: 404, message } }
  }

  return c
}

beforeEach(() => {
  process.env.STRAPI_BRIDGE_SECRET = "s3cret"
})

describe("drive.mine (service)", () => {
  it("counts the caller's tagged submissions and credits for this drive only", async () => {
    const { service } = build({
      [SUBMISSION]: [
        sub(1, "pending"),
        sub(2, "needs_info"),
        sub(3, "approved"),
        sub(4, "rejected"),
        // Not sent yet, someone else's, another drive's:
        sub(5, "draft"),
        sub(6, "pending", { submittedByUserId: "u2" }),
        sub(7, "pending", { driveDocumentId: OTHER }),
      ],
      [CREDIT]: [
        credit(3),
        // An untagged approval credited to this drive after review:
        credit(8),
        credit(9, { baUserId: "u2" }),
        credit(10, { driveDocumentId: OTHER }),
      ],
    })

    expect(await service.mine(HOURS, "u1")).toEqual({
      sent: 4,
      inReview: 2,
      accepted: 2,
    })
  })

  it("is all zeros for someone who hasn't helped", async () => {
    const { service } = build()
    expect(await service.mine(HOURS, "u9")).toEqual({
      sent: 0,
      inReview: 0,
      accepted: 0,
    })
  })
})

describe("GET /drives/:documentId/mine (controller)", () => {
  it("answers for the bridge's user, never cached", async () => {
    const { controller } = build({ [SUBMISSION]: [sub(1, "pending")] })
    const c = ctx()
    await controller.mine(c)

    expect(c.status).toBeUndefined()
    expect(c.body.data).toEqual({ sent: 1, inReview: 1, accepted: 0 })
    expect(c.headers?.["Cache-Control"]).toBe("no-store")
  })

  it("needs the bridge secret and a user", async () => {
    const { controller } = build()
    const noSecret = ctx({ secret: "wrong" })
    await controller.mine(noSecret)
    expect(noSecret.status).toBe(401)

    const noUser = ctx({ baUserId: null })
    await controller.mine(noUser)
    expect(noUser.status).toBe(401)
  })

  it("is 404 for a missing or draft drive", async () => {
    const { controller } = build()
    const missing = ctx({ documentId: docId("nope") })
    await controller.mine(missing)
    expect(missing.status).toBe(404)

    const draft = ctx({ documentId: docId("drvdraft1") })
    await controller.mine(draft)
    expect(draft.status).toBe(404)
  })
})
