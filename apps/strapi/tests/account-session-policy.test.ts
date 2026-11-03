import { describe, expect, it, vi } from "vitest"

import policy from "../src/policies/account-session"

describe("native account session policy", () => {
  it("rejects forged identity headers without a valid cookie session", async () => {
    const getSession = vi.fn(async () => null)
    const strapi = {
      plugin: () => ({
        service: () => ({ getAuth: () => ({ api: { getSession } }) }),
      }),
    }
    const ctx = { request: { headers: { "x-ba-user-id": "123" } }, state: {} }
    await expect(policy(ctx, {}, { strapi })).rejects.toThrow(
      "Sign in required"
    )
    expect(ctx.state).toEqual({})
  })
  it("uses only the verified cookie identity and never refreshes an unforwarded cookie", async () => {
    const getSession = vi.fn(async () => ({ user: { id: "7" } }))
    const strapi = {
      plugin: () => ({
        service: () => ({ getAuth: () => ({ api: { getSession } }) }),
      }),
    }
    const ctx = {
      request: {
        headers: { cookie: "session=synthetic", "x-ba-user-id": "123" },
      },
      state: {},
    }
    expect(await policy(ctx, {}, { strapi })).toBe(true)
    expect(ctx.state).toEqual({ accountUser: { id: "7" } })
    expect(getSession).toHaveBeenCalledWith({
      headers: expect.any(Headers),
      query: { disableRefresh: true },
    })
  })
})
