import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"

import submissionControllerFactory from "../../src/plugins/content-moderation/server/controllers/submission"
import createPolicy from "../../src/plugins/content-moderation/server/services/submission-policy"
import { makeFakeStrapi } from "../helpers/fake-strapi"

const PROFILE = "api::user-profile.user-profile"
const SUB = "plugin::content-moderation.submission"
const ROLE_GRANT = "api::role-grant.role-grant"

const row = (
  n: number,
  status: string,
  extra: Record<string, unknown> = {}
) => ({
  documentId: `sub${String(n).padStart(20, "0")}`,
  submittedByUserId: "u1",
  submissionType: "correction",
  status,
  ...extra,
})

function harness(seed: Record<string, any[]> = {}, tier = "Reader") {
  const f = makeFakeStrapi({
    [PROFILE]: [{ documentId: "p1", baUserId: "u1", tier }],
    [SUB]: [
      row(1, "pending"),
      row(2, "needs_info"),
      row(3, "pending"),
      row(4, "approved"),
      row(5, "approved"),
      row(6, "approved", { submissionType: "role_application" }),
      row(7, "draft"),
      row(8, "pending", { submittedByUserId: "u2" }),
    ],
    ...seed,
  })
  const policy = createPolicy({ strapi: f.strapi })
  f.services["content-moderation.submission-policy"] = policy

  return {
    ...f,
    policy,
    controller: submissionControllerFactory({ strapi: f.strapi }),
  }
}

describe("submission-policy.pendingQuota", () => {
  it("counts what's waiting against the tier's pending limit", async () => {
    const { policy } = harness()
    expect(await policy.pendingQuota("u1")).toEqual({ pending: 3, limit: 5 })
  })

  it("follows the tier, and staff get Curator quotas", async () => {
    expect(await harness({}, "Cartographer").policy.pendingQuota("u1")).toEqual(
      { pending: 3, limit: 20 }
    )
    const staff = harness({
      [ROLE_GRANT]: [
        {
          documentId: "rg1",
          baUserId: "u1",
          role: "moderator",
          queue: "all",
          scopeLocale: null,
          expiresAt: null,
        },
      ],
    })
    expect(await staff.policy.pendingQuota("u1")).toEqual({
      pending: 3,
      limit: 100,
    })
  })
})

describe("GET /submissions/my/accepted-count", () => {
  let saved: string | undefined
  beforeAll(() => {
    saved = process.env.STRAPI_BRIDGE_SECRET
    process.env.STRAPI_BRIDGE_SECRET = "test-secret"
  })
  afterAll(() => {
    if (saved === undefined) delete process.env.STRAPI_BRIDGE_SECRET
    else process.env.STRAPI_BRIDGE_SECRET = saved
  })

  const ctxFor = (headers: Record<string, string>): any => ({
    request: { headers },
    set: vi.fn(),
    unauthorized: vi.fn(),
  })

  it("adds the pending count and limit to the accepted count", async () => {
    const { controller } = harness()
    const ctx = ctxFor({
      "x-service-secret": "test-secret",
      "x-ba-user-id": "u1",
    })
    await controller.acceptedCount(ctx)
    expect(ctx.unauthorized).not.toHaveBeenCalled()
    expect(ctx.body).toEqual({
      data: { accepted: 2, pending: 3, pendingLimit: 5 },
    })
  })

  it("still needs the bridge secret", async () => {
    const { controller } = harness()
    const ctx = ctxFor({ "x-service-secret": "nope", "x-ba-user-id": "u1" })
    await controller.acceptedCount(ctx)
    expect(ctx.unauthorized).toHaveBeenCalled()
    expect(ctx.body).toBeUndefined()
  })
})
