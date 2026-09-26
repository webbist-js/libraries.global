import { describe, expect, it, vi } from "vitest"

import submissionControllerFactory from "../../src/plugins/content-moderation/server/controllers/submission"
import cmRoutes from "../../src/plugins/content-moderation/server/routes/admin"
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
    const { strapi, store } = makeFakeStrapi({
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
})
