import { expect, it, vi } from "vitest"

import { requireFreshAdminAuth } from "../src/utils/fresh-admin-auth"

it("uses original login time and denies refreshed tokens from an old session", async () => {
  const now = Date.now()
  const findOne = vi.fn().mockResolvedValue({
    metadata: { loginAt: new Date(now - 600_000).toISOString() },
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + 3_600_000).toISOString(),
  })
  const strapi = { db: { query: vi.fn(() => ({ findOne })) } }
  const ctx = {
    state: { user: { id: 42 }, session: { id: "session" } },
    status: 200,
    body: {},
  }
  expect(await requireFreshAdminAuth(strapi, ctx, now)).toBe(false)
  expect(ctx.status).toBe(403)
  findOne.mockResolvedValueOnce({
    metadata: { loginAt: new Date(now).toISOString() },
    expiresAt: new Date(now + 3_600_000).toISOString(),
  })
  expect(await requireFreshAdminAuth(strapi, ctx, now)).toBe(true)
  expect(findOne).toHaveBeenLastCalledWith(
    expect.objectContaining({
      where: {
        sessionId: "session",
        userId: "42",
        origin: "admin",
        status: "active",
      },
    })
  )
})
it("fails closed for missing or legacy administrator session metadata", async () => {
  const strapi = {
    db: {
      query: () => ({ findOne: vi.fn().mockResolvedValue({ metadata: {} }) }),
    },
  }
  expect(await requireFreshAdminAuth(strapi, { state: {} })).toBe(false)
  expect(
    await requireFreshAdminAuth(strapi, {
      state: { user: { id: 1 }, session: { id: "legacy" } },
    })
  ).toBe(false)
})
