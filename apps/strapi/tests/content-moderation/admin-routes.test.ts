import { describe, expect, it, vi } from "vitest"

import submissionControllerFactory from "../../src/plugins/content-moderation/server/controllers/submission"
import cmRoutes from "../../src/plugins/content-moderation/server/routes/admin"
import createService from "../../src/plugins/content-moderation/server/services/submission"
import rwRoutes from "../../src/plugins/rewards/server/routes/admin"
import { makeFakeStrapi } from "../helpers/fake-strapi"

const perm = (r: any) =>
  r.config.policies.find(
    (p: any) => typeof p === "object" && p.name === "admin::hasPermissions"
  )?.config.actions

describe("admin routes", () => {
  it("every moderation route checks a permission", () => {
    for (const r of cmRoutes) expect(perm(r)?.length).toBeGreaterThan(0)
    expect(
      perm(cmRoutes.find((r: any) => r.path === "/submissions/:id/status"))
    ).toEqual(["plugin::content-moderation.update"])
  })
  it("every rewards route checks a permission, and award needs award", () => {
    for (const r of rwRoutes) expect(perm(r)?.length).toBeGreaterThan(0)
    expect(perm(rwRoutes.find((r: any) => r.path === "/award"))).toEqual([
      "plugin::rewards.award",
    ])
  })
})

describe("submission controller", () => {
  it("blocks self-approval", async () => {
    const docId = "a1b2c3d4e5f6g7h8i9j0k1l2"
    const { strapi, store, services } = makeFakeStrapi({
      "plugin::content-moderation.submission": [
        {
          documentId: docId,
          status: "pending",
          submittedByEmail: "a@x.org",
          submittedByUserId: "user1",
          submissionType: "correction",
          targetEntityType: "library",
        },
      ],
    })

    services["content-moderation.submission"] = createService({ strapi })
    const controller = submissionControllerFactory({ strapi })
    const forbidden = vi.fn()
    const ctx = {
      params: { id: docId },
      request: { body: { status: "approved" } },
      state: { user: { id: "1", email: "A@x.org" } },
      badRequest: vi.fn(),
      forbidden,
    }

    await controller.updateStatus(ctx)

    expect(forbidden).toHaveBeenCalledWith(
      "You can't review your own submission."
    )
    const submission = store["plugin::content-moderation.submission"][0]
    expect(submission.status).toBe("pending")
  })

  it("blocks self-approval when the emails differ only by case and whitespace", async () => {
    const docId = "a1b2c3d4e5f6g7h8i9j0k1l3"
    const { strapi, store, services } = makeFakeStrapi({
      "plugin::content-moderation.submission": [
        {
          documentId: docId,
          status: "pending",
          submittedByEmail: " Mod@Example.org ",
          submittedByUserId: "user1",
          submissionType: "correction",
          targetEntityType: "library",
        },
      ],
    })
    services["content-moderation.submission"] = createService({ strapi })
    const controller = submissionControllerFactory({ strapi })
    const forbidden = vi.fn()
    await controller.updateStatus({
      params: { id: docId },
      request: { body: { status: "approved" } },
      state: { user: { id: "1", email: "mod@example.org" } },
      badRequest: vi.fn(),
      forbidden,
    })
    expect(forbidden).toHaveBeenCalled()
    expect(store["plugin::content-moderation.submission"][0].status).toBe(
      "pending"
    )
  })

  it("relationLabels pages with start/limit and a stable sort, never `pagination`", async () => {
    const { strapi } = makeFakeStrapi({
      "api::service.service": [
        { documentId: "svc00000000000000000001", name: "Wi-Fi" },
      ],
    })
    const perUid = new Map<string, any>()
    const fresh = strapi.documents
    strapi.documents = vi.fn((uid: string) => {
      if (!perUid.has(uid)) perUid.set(uid, fresh(uid))

      return perUid.get(uid)
    })
    const controller = submissionControllerFactory({ strapi })
    const ctx: any = { query: { type: "services" }, badRequest: vi.fn() }
    await controller.relationLabels(ctx)
    expect(ctx.body).toEqual({ data: { svc00000000000000000001: "Wi-Fi" } })
    const call = strapi.documents("api::service.service").findMany.mock
      .calls[0]?.[0]
    expect(call).not.toHaveProperty("pagination")
    expect(call).toMatchObject({ start: 0, limit: 500, sort: { name: "asc" } })
  })
})
