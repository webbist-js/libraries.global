import { afterEach, describe, expect, it, vi } from "vitest"

import createController from "../../src/plugins/access/server/controllers/api-accounts"
import createService from "../../src/plugins/access/server/services/api-accounts"

const teamId = "team00000000000000000001"
const requestId = "2f1c6c64-1a51-4f6a-a2cf-5c0f5a0b8d11"

function fakeStrapi(
  options: {
    existing?: { documentId: string }[]
    members?: { baUserId: string; teamRole: string; status: string }[]
  } = {}
) {
  const enqueue = vi.fn(async () => ({}))
  const create = vi.fn(async () => ({ documentId: teamId }))
  const update = vi.fn(async () => ({}))
  const memberCreate = vi.fn(async () => ({}))
  const requireOrganiser = vi.fn(async () => ({}))
  const strapi = {
    db: {
      transaction: async (work: (t: { trx: unknown }) => unknown) =>
        work({ trx: {} }),
      query: () => ({ findOne: async () => ({ username: "person" }) }),
    },
    documents: (uid: string) =>
      uid === "plugin::access.team"
        ? {
            findMany: async () => options.existing ?? [],
            findOne: async () => ({ name: "Org" }),
            update,
          }
        : {
            findMany: async (q: { filters: Record<string, unknown> }) =>
              q.filters.baUserId === undefined || q.filters.team
                ? (options.members ?? [])
                : [],
            create: memberCreate,
          },
    plugin: () => ({ service: () => ({ create, requireOrganiser }) }),
    service: () => ({ enqueue }),
  }

  return { strapi, enqueue, create, update, memberCreate, requireOrganiser }
}

afterEach(() => vi.unstubAllEnvs())

describe("API account organisation bridge", () => {
  it("creates a free, unverified organisation with the buyer as organiser", async () => {
    const f = fakeStrapi()
    const service = createService({ strapi: f.strapi as never })
    const result = await service.createOrganisation({
      requestId,
      baUserId: "user-1",
      email: "Person@Example.test",
      name: " Person ",
    })
    expect(result).toEqual({ teamId })
    expect(f.create).toHaveBeenCalledWith(
      { name: "Person", libraryDocumentIds: [] },
      "self-service"
    )
    const data = (
      f.update.mock.calls[0] as unknown as [{ data: Record<string, unknown> }]
    )[0].data
    expect(data).toMatchObject({
      billingAccountId: requestId,
      verifiedAt: null,
    })
    // No payment or lifecycle state is written.
    for (const field of ["status", "expiresAt", "source"])
      expect(data).not.toHaveProperty(field)
    expect(f.memberCreate.mock.calls[0]).toEqual([
      expect.objectContaining({
        data: expect.objectContaining({
          baUserId: "user-1",
          email: "person@example.test",
          teamRole: "organiser",
          status: "active",
        }),
      }),
    ])
  })
  it("is idempotent by request id and still requires the caller to organise it", async () => {
    const f = fakeStrapi({ existing: [{ documentId: teamId }] })
    const service = createService({ strapi: f.strapi as never })
    expect(
      await service.createOrganisation({
        requestId,
        baUserId: "user-1",
        email: "p@example.test",
        name: "Org",
      })
    ).toEqual({ teamId })
    expect(f.create).not.toHaveBeenCalled()
    expect(f.requireOrganiser).toHaveBeenCalledWith(teamId, "user-1")
  })
  it("rejects malformed requests before any write", async () => {
    const f = fakeStrapi()
    const service = createService({ strapi: f.strapi as never })
    await expect(
      service.createOrganisation({
        requestId: "not-a-uuid",
        baUserId: "user-1",
        email: "p@example.test",
        name: "Org",
      })
    ).rejects.toMatchObject({ status: 400 })
    expect(f.create).not.toHaveBeenCalled()
  })
  it("sends one deduplicated usage warning per active organiser", async () => {
    const f = fakeStrapi({
      members: [
        { baUserId: "organiser-1", teamRole: "organiser", status: "active" },
        { baUserId: "member-1", teamRole: "member", status: "active" },
      ],
    })
    const service = createService({ strapi: f.strapi as never })
    const result = await service.notice(teamId, {
      periodStart: "2026-11-03T09:30:00.000Z",
      dimension: "cap",
      threshold: 100,
    })
    expect(result).toEqual({ sent: 1 })
    expect(f.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        baUserId: "organiser-1",
        kind: "billing_update",
        eventKey: `api-warning:${teamId}:2026-11-03T09:30:00.000Z:cap:100:organiser-1`,
        href: "/developers/usage",
      })
    )
    await expect(
      service.notice(teamId, {
        periodStart: "2026-11-03T09:30:00.000Z",
        dimension: "keys",
        threshold: 90,
      })
    ).rejects.toMatchObject({ status: 400 })
  })
  it("requires the bridge secret", async () => {
    vi.stubEnv("STRAPI_BRIDGE_SECRET", "fixture")
    const f = fakeStrapi()
    const controller = createController({ strapi: f.strapi as never })
    const ctx = {
      request: { header: { "x-service-secret": "wrong" }, body: {} },
      params: {},
      unauthorized: vi.fn(),
      set: vi.fn(),
      body: undefined as unknown,
      status: 200,
    }
    await controller.organisation(ctx)
    expect(ctx.unauthorized).toHaveBeenCalled()
    expect(f.create).not.toHaveBeenCalled()
  })
})
