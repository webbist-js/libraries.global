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
    summary: "A drive.",
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
  const c: any = {
    request: { body, headers },
    params,
    query,
    badRequest: (m: unknown) => ((c.status = 400), (c.body = m)),
    unauthorized: (m: unknown) => ((c.status = 401), (c.body = m)),
    forbidden: (m: unknown) => ((c.status = 403), (c.body = m)),
    notFound: (m: unknown) => ((c.status = 404), (c.body = m)),
  }

  return c
}

beforeEach(() => {
  process.env.STRAPI_BRIDGE_SECRET = "s3cret"
})

describe("drive.createDrive", () => {
  it("stores a published drive with status scheduled and a slug", async () => {
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

describe("drive board gate (controller)", () => {
  it("refuses without the bridge secret (401)", async () => {
    const { controller } = build()
    const c = ctx({ body: validInput(), secret: null })
    await controller.create(c)

    expect(c.status).toBe(401)
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
      [ROLE_GRANT]: [
        {
          documentId: "rg1",
          baUserId: "board-1",
          role: "editorial_board",
          queue: "all",
          scopeLocale: null,
          expiresAt: null,
        },
      ],
    })
    const c = ctx({ body: validInput(), baUserId: "board-1" })
    await controller.create(c)

    expect(c.status).toBeUndefined()
    expect(c.body.data.status).toBe("scheduled")
    expect(store[DRIVE]).toHaveLength(1)
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
})
