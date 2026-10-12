import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { makeFakeStrapi } from "./helpers/fake-strapi"
import controller from "../src/api/paid-membership/controllers/paid-membership"

const UID = "api::paid-membership.paid-membership"
const PROFILE = "api::user-profile.user-profile"
const membership = {
  mode: "sandbox",
  plan: "pro",
  status: "active",
  interval: "month",
  currency: "gbp",
  unitAmount: 500,
  memberSince: "2026-10-01T12:00:00Z",
  periodEnd: "2026-11-01T12:00:00Z",
  paidThrough: "2026-11-01T12:00:00Z",
  pastDueSince: null,
  cancelAtPeriodEnd: false,
  revoked: false,
}
function ctx(body: unknown, secret = "fixture") {
  const c: any = {
    request: { body, header: { "x-service-secret": secret } },
    unauthorized: () => {
      c.status = 401
    },
    badRequest: () => {
      c.status = 400
    },
    status: 200,
  }

  return c
}
let fake: ReturnType<typeof makeFakeStrapi>
const enqueue = vi.fn(async () => ({}))
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(new Date("2026-10-12T12:00:00Z"))
  process.env.STRAPI_BRIDGE_SECRET = "fixture"
  enqueue.mockClear()
  fake = makeFakeStrapi({
    [PROFILE]: [{ id: 1, baUserId: "owner", username: "owner" }],
    [UID]: [],
  })
  Object.assign(fake.strapi.db.connection, {
    client: { config: { client: "sqlite" } },
  })
  fake.strapi.service = () => ({ enqueue })
  ;(globalThis as any).strapi = fake.strapi
})
afterEach(() => {
  vi.useRealTimers()
  delete (globalThis as any).strapi
})
describe("private paid membership projection", () => {
  it("requires service authentication and an allowlisted projection", async () => {
    const forged = ctx(
      { baUserId: "owner", subscriptionId: "sub_1", revision: 1, membership },
      "bad"
    )
    await controller.sync(forged)
    expect(forged.status).toBe(401)
    const malformed = ctx({
      baUserId: "owner",
      subscriptionId: "sub_1",
      revision: 1,
      membership: { ...membership, plan: "admin" },
    })
    await controller.sync(malformed)
    expect(malformed.status).toBe(400)
    expect(fake.store[UID]).toHaveLength(0)
  })
  it("ignores duplicate/older revisions and queues one essential welcome", async () => {
    await controller.sync(
      ctx({
        baUserId: "owner",
        subscriptionId: "sub_1",
        revision: 2,
        membership,
      })
    )
    await controller.sync(
      ctx({
        baUserId: "owner",
        subscriptionId: "sub_1",
        revision: 1,
        membership: { ...membership, status: "unpaid" },
      })
    )
    await controller.sync(
      ctx({
        baUserId: "owner",
        subscriptionId: "sub_1",
        revision: 2,
        membership,
      })
    )
    expect(fake.store[UID]?.[0]).toMatchObject({ revision: 2, membership })
    expect(enqueue).toHaveBeenCalledTimes(1)
    expect(enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        emailPreference: "transactional",
        kind: "billing_update",
        baUserId: "owner",
      })
    )
    expect(fake.store[PROFILE]?.[0]).toEqual({
      id: 1,
      baUserId: "owner",
      username: "owner",
    })
  })
  it("refuses reassignment and does not recreate deleted profiles", async () => {
    fake.store[UID]?.push({
      id: 1,
      subscriptionId: "sub_1",
      baUserId: "other",
      revision: 1,
      membership,
    })
    const wrong = ctx({
      baUserId: "owner",
      subscriptionId: "sub_1",
      revision: 3,
      membership,
    })
    await controller.sync(wrong)
    expect(wrong.status).toBe(409)
    const missing = ctx({
      baUserId: "erased",
      subscriptionId: "sub_2",
      revision: 1,
      membership,
    })
    await controller.sync(missing)
    expect(missing.status).toBe(410)
  })
  it("rolls back the projection if the essential notification cannot be persisted", async () => {
    enqueue.mockRejectedValueOnce(new Error("queue unavailable"))
    await expect(
      controller.sync(
        ctx({
          baUserId: "owner",
          subscriptionId: "sub_1",
          revision: 1,
          membership,
        })
      )
    ).rejects.toThrow("queue unavailable")
    expect(fake.store[UID]).toHaveLength(0)
  })
})
