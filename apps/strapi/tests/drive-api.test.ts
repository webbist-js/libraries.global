import type { DriveInput } from "@repo/shared-data"
import { beforeEach, describe, expect, it } from "vitest"

import { makeFakeStrapi } from "./helpers/fake-strapi"
import controllerFactory from "../src/api/drive/controllers/drive"
import serviceFactory from "../src/api/drive/services/drive"
import { ROLE_GRANT } from "../src/utils/role-grants"

const DRIVE = "api::drive.drive"

/** A `DriveInput` that satisfies `validateDrive` out of the box. */
function validInput(overrides: Partial<DriveInput> = {}): DriveInput {
  return {
    title: "Fill in opening hours for Yorkshire libraries",
    summary: "Add real opening hours to records that are missing them.",
    steps: [
      "Pick a library from the list.",
      "Find its real opening hours.",
      "Submit a correction.",
    ],
    focus: { kind: "gaps", gaps: ["hours"] },
    scope: { places: { region: ["yorkshire"] } },
    unit: "library",
    startsAt: "2026-10-10T00:00:00.000Z",
    endsAt: "2026-10-20T00:00:00.000Z",
    goalPercent: 80,
    whereToLook: { name: "", url: "", licenceNote: "" },
    ...overrides,
  }
}

function drive(i: number, extra: Record<string, unknown> = {}) {
  return {
    id: i,
    documentId: `drive${i}`,
    locale: "en",
    title: `Drive ${i}`,
    slug: `drive-${i}`,
    summary: "A drive for the test fixtures, long enough to validate.",
    steps: [{ text: "Step one." }],
    focus: { kind: "gaps", gaps: ["hours"] },
    scope: { places: { region: ["yorkshire"] } },
    unit: "library",
    startsAt: "2026-10-01T00:00:00.000Z",
    endsAt: "2026-10-30T00:00:00.000Z",
    goalPercent: 100,
    status: "open",
    pinned: false,
    featured: false,
    createdByUserId: "ba:someone",
    publishedAt: "2026-09-01T00:00:00.000Z",
    ...extra,
  }
}

function build(seed: Record<string, unknown[]> = {}) {
  const fake = makeFakeStrapi({ [DRIVE]: [], ...seed })
  const strapiStub: any = {
    ...fake.strapi,
    contentType: () => ({ uid: DRIVE }),
  }
  const service = serviceFactory({ strapi: strapiStub } as any)
  fake.services[DRIVE] = service
  const controller = controllerFactory({ strapi: strapiStub } as any)

  return { ...fake, service, controller }
}

/**
 * How `@strapi/core`'s koa response helpers actually answer: `createError`
 * (via `http-errors`) builds `{ data: null, error: { status, name, message,
 * details } }`, with `details` taken from the method's *second* argument —
 * passing an object as the *first* (message) argument, as the original
 * `ctx.badRequest({ errors })` bug did, makes `message` fall back to the
 * status's default text and loses whatever was meant to be the message.
 * Modelling that here is what would have caught it.
 */
const HTTP_ERROR_NAMES: Record<number, string> = {
  400: "BadRequestError",
  401: "UnauthorizedError",
  403: "ForbiddenError",
  404: "NotFoundError",
  409: "ConflictError",
}
const DEFAULT_MESSAGES: Record<number, string> = {
  400: "Bad Request",
  401: "Unauthorized",
  403: "Forbidden",
  404: "Not Found",
  409: "Conflict",
}

function httpError(c: any, status: number) {
  return (message?: unknown, details: Record<string, unknown> = {}) => {
    c.status = status
    c.body = {
      data: null,
      error: {
        status,
        name: HTTP_ERROR_NAMES[status] ?? "Error",
        message:
          typeof message === "string" ? message : DEFAULT_MESSAGES[status],
        details,
      },
    }
  }
}

function ctx({
  body,
  params = {},
  query = {},
  secret = "s3cret",
  baUserId,
}: {
  body?: unknown
  params?: Record<string, string>
  query?: Record<string, unknown>
  secret?: string | null
  baUserId?: string
} = {}) {
  const headers: Record<string, string> = {}
  if (secret !== null) headers["x-service-secret"] = secret
  if (baUserId) headers["x-ba-user-id"] = baUserId
  const c: any = { request: { body, headers }, params, query }
  c.badRequest = httpError(c, 400)
  c.unauthorized = httpError(c, 401)
  c.forbidden = httpError(c, 403)
  c.notFound = httpError(c, 404)
  c.conflict = httpError(c, 409)

  return c
}

const BOARD_GRANT = (baUserId: string) => ({
  documentId: `rg-${baUserId}`,
  baUserId,
  role: "editorial_board",
  queue: "all",
  scopeLocale: null,
  expiresAt: null,
})

beforeEach(() => {
  process.env.STRAPI_BRIDGE_SECRET = "s3cret"
})

describe("drive.createDrive", () => {
  it("stores a scheduled drive with a slug (draftAndPublish is off, so no status: published option)", async () => {
    const { service, store } = build()
    const result = await service.createDrive(validInput(), "board-1")

    expect("errors" in result).toBe(false)
    expect(store[DRIVE]).toHaveLength(1)
    const row = store[DRIVE][0]
    expect(row.status).toBe("scheduled")
    expect(row.slug).toBe("fill-in-opening-hours-for-yorkshire-libraries")
    expect(row.createdByUserId).toBe("ba:board-1")
  })

  it("returns validateDrive's errors for an invalid input", async () => {
    const { service, store } = build()
    const result: any = await service.createDrive(
      validInput({ title: "no" }),
      "board-1"
    )

    expect(result.errors).toContain(
      "Give the drive a title of 3 to 120 characters."
    )
    expect(store[DRIVE]).toHaveLength(0)
  })

  it("returns an error, not a crash, for a body missing focus or scope", async () => {
    const { service } = build()
    const { focus: _focus, ...withoutFocus } = validInput()
    const withoutFocusResult: any = await service.createDrive(
      withoutFocus as never,
      "board-1"
    )
    expect(withoutFocusResult.errors).toContain("Choose what the drive is for.")

    const { scope: _scope, ...withoutScope } = validInput()
    const withoutScopeResult: any = await service.createDrive(
      withoutScope as never,
      "board-1"
    )
    expect(withoutScopeResult.errors).toContain(
      "Limit the drive to places or to a list of libraries."
    )
  })

  it("creates unpinned regardless of how many drives are already pinned", async () => {
    const seeded = Array.from({ length: 6 }, (_, i) =>
      drive(i + 1, { pinned: true, status: "open" })
    )
    const { service } = build({ [DRIVE]: seeded })
    const result: any = await service.createDrive(
      validInput({ title: "A seventh unpinned drive" }),
      "board-1"
    )

    expect("errors" in result).toBe(false)
  })

  it("refuses to create pinned when six drives are already pinned", async () => {
    const seeded = Array.from({ length: 6 }, (_, i) =>
      drive(i + 1, { pinned: true, status: "open" })
    )
    const { service, store } = build({ [DRIVE]: seeded })
    const result: any = await service.createDrive(
      { ...validInput({ title: "A seventh pinned drive" }), pinned: true },
      "board-1"
    )

    expect(result.errors).toEqual(["Six drives are already pinned."])
    expect(result.status).toBe(409)
    expect(store[DRIVE]).toHaveLength(6)
  })
})

describe("drive.updateDrive", () => {
  it("allows a title edit on an open drive", async () => {
    const { service, store } = build({
      [DRIVE]: [drive(1, { status: "open" })],
    })
    const result: any = await service.updateDrive("drive1", {
      title: "A clearer title for this drive",
    })

    expect("errors" in result).toBe(false)
    expect(store[DRIVE][0].title).toBe("A clearer title for this drive")
  })

  it("refuses a focus change on an open drive", async () => {
    const { service, store } = build({
      [DRIVE]: [drive(1, { status: "open" })],
    })
    const result: any = await service.updateDrive("drive1", {
      focus: { kind: "gaps", gaps: ["contact"] },
    })

    expect(result.status).toBe(409)
    expect(result.errors[0]).toMatch(/only the title, summary/i)
    expect(store[DRIVE][0].focus).toEqual({ kind: "gaps", gaps: ["hours"] })
  })

  it("allows a focus change while still draft or scheduled", async () => {
    const { service, store } = build({
      [DRIVE]: [drive(1, { status: "scheduled" })],
    })
    const result: any = await service.updateDrive("drive1", {
      focus: { kind: "gaps", gaps: ["contact"] },
    })

    expect("errors" in result).toBe(false)
    expect(store[DRIVE][0].focus).toEqual({ kind: "gaps", gaps: ["contact"] })
  })

  it("404s a missing drive", async () => {
    const { service } = build()
    const result: any = await service.updateDrive("nope", { title: "x" })
    expect(result.errors).toEqual(["Drive not found."])
    expect(result.status).toBe(404)
  })
})

describe("drive board gate (controller)", () => {
  it("refuses without the bridge secret (401)", async () => {
    const { controller } = build()
    const c = ctx({ body: validInput(), secret: null })
    await controller.create(c)

    expect(c.status).toBe(401)
    expect(c.body.error.message).toBe("Missing or invalid service secret")
  })

  it("refuses a wrong secret, not just a missing one (401)", async () => {
    const { controller } = build()
    const c = ctx({ body: validInput(), secret: "wrong-secret" })
    await controller.create(c)

    expect(c.status).toBe(401)
    expect(c.body.error.message).toBe("Missing or invalid service secret")
  })

  it("refuses a valid secret with no X-Ba-User-Id (401 'Missing user')", async () => {
    const { controller } = build()
    const c = ctx({ body: validInput() })
    await controller.create(c)

    expect(c.status).toBe(401)
    expect(c.body.error.message).toBe("Missing user")
  })

  it("refuses a non-board caller (403)", async () => {
    const { controller } = build({
      [ROLE_GRANT]: [
        {
          documentId: "rg1",
          baUserId: "mod-1",
          role: "moderator",
          queue: "index",
          scopeLocale: null,
          expiresAt: null,
        },
      ],
    })
    const c = ctx({ body: validInput(), baUserId: "mod-1" })
    await controller.create(c)

    expect(c.status).toBe(403)
  })

  it("allows an editorial_board caller through", async () => {
    const { controller, store } = build({
      [ROLE_GRANT]: [BOARD_GRANT("board-1")],
    })
    const c = ctx({ body: validInput(), baUserId: "board-1" })
    await controller.create(c)

    expect(c.status).toBeUndefined()
    expect(c.body.data.status).toBe("scheduled")
    expect(store[DRIVE]).toHaveLength(1)
  })

  it("400s with the real messages in error.details.errors, not 'Bad Request'", async () => {
    const { controller } = build({ [ROLE_GRANT]: [BOARD_GRANT("board-1")] })
    const c = ctx({
      body: validInput({ title: "no" }),
      baUserId: "board-1",
    })
    await controller.create(c)

    expect(c.status).toBe(400)
    expect(c.body.error.message).toBe("Invalid drive")
    expect(c.body.error.details.errors).toContain(
      "Give the drive a title of 3 to 120 characters."
    )
  })

  it("400s a reorder with a non-numeric pinOrder, with the message in details.errors", async () => {
    const { controller } = build({
      [DRIVE]: [drive(1, { status: "open" })],
      [ROLE_GRANT]: [BOARD_GRANT("board-1")],
    })
    const c = ctx({
      body: { action: "reorder", pinOrder: "two" },
      params: { documentId: "drive1" },
      baUserId: "board-1",
    })
    await controller.act(c)

    expect(c.status).toBe(400)
    expect(c.body.error.message).toBe("Invalid action")
    expect(c.body.error.details.errors).toEqual(["pinOrder must be a number."])
  })

  it("update: a title-only body on an open drive passes (pins down driveInputFromBody's parsing)", async () => {
    const { controller, store } = build({
      [DRIVE]: [drive(1, { status: "open" })],
      [ROLE_GRANT]: [BOARD_GRANT("board-1")],
    })
    const c = ctx({
      body: { title: "A clearer title for this drive" },
      params: { documentId: "drive1" },
      baUserId: "board-1",
    })
    await controller.update(c)

    expect(c.status).toBeUndefined()
    expect(c.body.data.title).toBe("A clearer title for this drive")
    expect(store[DRIVE][0].title).toBe("A clearer title for this drive")
  })
})

describe("drive.act", () => {
  it("refuses to pin a seventh drive when six are already pinned", async () => {
    const seeded = [
      ...Array.from({ length: 6 }, (_, i) =>
        drive(i + 1, { pinned: true, status: "open" })
      ),
      drive(7, { pinned: false, status: "scheduled" }),
    ]
    const { service } = build({ [DRIVE]: seeded })
    const result: any = await service.act("drive7", "pin", {})

    expect(result.errors).toEqual(["Six drives are already pinned."])
    expect(result.status).toBe(409)
  })

  it("refuses to pin a closed or cancelled drive, naming the actual status", async () => {
    const { service } = build({
      [DRIVE]: [
        drive(1, { status: "closed" }),
        drive(2, { status: "cancelled" }),
      ],
    })
    const closed: any = await service.act("drive1", "pin", {})
    expect(closed.status).toBe(409)
    expect(closed.errors).toEqual(["A closed drive can't be pinned."])

    const cancelled: any = await service.act("drive2", "pin", {})
    expect(cancelled.status).toBe(409)
    expect(cancelled.errors).toEqual(["A cancelled drive can't be pinned."])
  })

  it("feature moves the feature from another drive", async () => {
    const seeded = [
      drive(1, { pinned: true, featured: true }),
      drive(2, { pinned: true, featured: false }),
    ]
    const { service, store } = build({ [DRIVE]: seeded })
    const result: any = await service.act("drive2", "feature", {})

    expect("errors" in result).toBe(false)
    expect(result.data.featured).toBe(true)
    const other = store[DRIVE].find((d: any) => d.documentId === "drive1")
    expect(other.featured).toBe(false)
  })

  it("refuses to feature an unpinned drive", async () => {
    const { service } = build({
      [DRIVE]: [drive(1, { pinned: false, featured: false })],
    })
    const result: any = await service.act("drive1", "feature", {})

    expect(result.errors).toEqual(["Only a pinned drive can be featured."])
    expect(result.status).toBe(409)
  })

  it("refuses to feature a closed drive even if it was left pinned", async () => {
    const { service } = build({
      [DRIVE]: [drive(1, { pinned: true, status: "closed" })],
    })
    const result: any = await service.act("drive1", "feature", {})
    expect(result.status).toBe(409)
  })

  it("unpins and clears the feature together", async () => {
    const { service, store } = build({
      [DRIVE]: [drive(1, { pinned: true, featured: true })],
    })
    const result: any = await service.act("drive1", "unpin", {})

    expect(result.data.pinned).toBe(false)
    expect(result.data.featured).toBe(false)
    expect(store[DRIVE][0].pinned).toBe(false)
  })

  it("unfeatures without touching pinned", async () => {
    const { service, store } = build({
      [DRIVE]: [drive(1, { pinned: true, featured: true })],
    })
    const result: any = await service.act("drive1", "unfeature", {})

    expect(result.data.featured).toBe(false)
    expect(store[DRIVE][0].pinned).toBe(true)
  })

  it("reorders with a numeric pinOrder", async () => {
    const { service, store } = build({ [DRIVE]: [drive(1)] })
    const result: any = await service.act("drive1", "reorder", {
      pinOrder: 3,
    })

    expect(result.data.pinOrder).toBe(3)
    expect(store[DRIVE][0].pinOrder).toBe(3)
  })

  it("cancels an open drive, setting closedReason and closedAt", async () => {
    const { service, store } = build({
      [DRIVE]: [drive(1, { status: "open", pinned: true, featured: true })],
    })
    const result: any = await service.act("drive1", "cancel", {})

    expect(result.data.status).toBe("cancelled")
    expect(result.data.closedReason).toBe("cancelled")
    expect(result.data.closedAt).toBeTruthy()
    expect(result.data.pinned).toBe(false)
    expect(store[DRIVE][0].status).toBe("cancelled")
  })

  it("refuses to cancel a drive that already closed, never touching its closedReason/closedAt", async () => {
    const { service, store } = build({
      [DRIVE]: [
        drive(1, {
          status: "closed",
          closedReason: "goal",
          closedAt: "2026-09-01T00:00:00.000Z",
        }),
      ],
    })
    const result: any = await service.act("drive1", "cancel", {})

    expect(result.status).toBe(409)
    expect(result.errors).toEqual(["This drive has already closed."])
    expect(store[DRIVE][0].closedReason).toBe("goal")
    expect(store[DRIVE][0].closedAt).toBe("2026-09-01T00:00:00.000Z")
  })

  it("refuses to cancel a drive that's already cancelled, naming the actual status", async () => {
    const { service } = build({
      [DRIVE]: [drive(1, { status: "cancelled" })],
    })
    const result: any = await service.act("drive1", "cancel", {})

    expect(result.status).toBe(409)
    expect(result.errors).toEqual(["This drive has already been cancelled."])
  })

  it("answers 400 'Unknown action' for anything unrecognised, including open/close", async () => {
    const { service } = build({ [DRIVE]: [drive(1)] })
    for (const action of ["open", "close", "nonsense"]) {
      const result: any = await service.act("drive1", action, {})
      expect(result.errors).toEqual(["Unknown action"])
      expect(result.status).toBe(400)
    }
  })

  it("404s a missing drive", async () => {
    const { service } = build()
    const result: any = await service.act("nope", "pin", {})
    expect(result.status).toBe(404)
  })
})

describe("drive.bySlug", () => {
  it("returns the drive for a known slug", async () => {
    const { service } = build({ [DRIVE]: [drive(1)] })
    const result = await service.bySlug("drive-1")
    expect(result).toMatchObject({ documentId: "drive1" })
  })

  it("returns null for an unknown slug (the controller turns this into 404)", async () => {
    const { service } = build({ [DRIVE]: [drive(1)] })
    expect(await service.bySlug("no-such-drive")).toBeNull()
  })

  it("returns null for a draft drive's slug — draft is never public", async () => {
    const { service } = build({ [DRIVE]: [drive(1, { status: "draft" })] })
    expect(await service.bySlug("drive-1")).toBeNull()
  })

  it("controller: 404s a draft drive's slug", async () => {
    const { controller } = build({
      [DRIVE]: [drive(1, { status: "draft" })],
    })
    const c = ctx({ params: { slug: "drive-1" } })
    await controller.bySlug(c)
    expect(c.status).toBe(404)
  })

  it("serves a cancelled drive's slug — only draft is excluded", async () => {
    const { service } = build({ [DRIVE]: [drive(1, { status: "cancelled" })] })
    expect(await service.bySlug("drive-1")).toMatchObject({
      documentId: "drive1",
    })
  })

  it("controller: 404s a missing slug", async () => {
    const { controller } = build({ [DRIVE]: [drive(1)] })
    const c = ctx({ params: { slug: "no-such-drive" } })
    await controller.bySlug(c)
    expect(c.status).toBe(404)
  })

  it("controller: 200s a known slug", async () => {
    const { controller } = build({ [DRIVE]: [drive(1)] })
    const c = ctx({ params: { slug: "drive-1" } })
    await controller.bySlug(c)
    expect(c.status).toBeUndefined()
    expect(c.body.data.documentId).toBe("drive1")
  })
})

describe("drive.listPublic", () => {
  it("orders pinned first, then pinOrder, then startsAt, and leaves out createdByUserId", async () => {
    const seeded = [
      drive(1, {
        status: "open",
        pinned: false,
        startsAt: "2026-10-01T00:00:00.000Z",
      }),
      drive(2, {
        status: "open",
        pinned: true,
        pinOrder: 2,
        startsAt: "2026-10-05T00:00:00.000Z",
      }),
      drive(3, {
        status: "open",
        pinned: true,
        pinOrder: 1,
        startsAt: "2026-10-02T00:00:00.000Z",
      }),
    ]
    const { service } = build({ [DRIVE]: seeded })
    const results = await service.listPublic("open")

    expect(results.map((r: any) => r.documentId)).toEqual([
      "drive3",
      "drive2",
      "drive1",
    ])
    for (const r of results) expect(r).not.toHaveProperty("createdByUserId")
  })

  it("orders closed drives by closedAt desc and defaults to a limit of 5", async () => {
    const seeded = Array.from({ length: 7 }, (_, i) =>
      drive(i + 1, {
        status: "closed",
        closedAt: `2026-09-${String(10 + i).padStart(2, "0")}T00:00:00.000Z`,
      })
    )
    const { service } = build({ [DRIVE]: seeded })
    const results = await service.listPublic("closed")

    expect(results).toHaveLength(5)
    expect(results.map((r: any) => r.documentId)).toEqual([
      "drive7",
      "drive6",
      "drive5",
      "drive4",
      "drive3",
    ])
  })

  it("only serves open, scheduled or closed — draft and cancelled fall back to open", async () => {
    const seeded = [
      drive(1, { status: "open" }),
      drive(2, { status: "draft" }),
      drive(3, { status: "cancelled" }),
    ]
    const { service } = build({ [DRIVE]: seeded })

    const openResult = await service.listPublic("open")
    expect(openResult.map((r: any) => r.documentId)).toEqual(["drive1"])

    // An unrecognised/disallowed state falls back to "open" rather than
    // leaking draft or cancelled drives.
    const draftRequested = await service.listPublic("draft")
    expect(draftRequested.map((r: any) => r.documentId)).toEqual(["drive1"])
    const cancelledRequested = await service.listPublic("cancelled")
    expect(cancelledRequested.map((r: any) => r.documentId)).toEqual(["drive1"])
  })

  it("controller: reads ?state=, not ?status= (stripped by strip-draft-status for public callers)", async () => {
    const { controller } = build({
      [DRIVE]: [
        drive(1, { status: "open" }),
        drive(2, { status: "closed", closedAt: "2026-09-01T00:00:00.000Z" }),
      ],
    })
    const c = ctx({ query: { state: "closed" } })
    await controller.list(c)

    expect(c.body.data.map((d: any) => d.documentId)).toEqual(["drive2"])
  })
})
