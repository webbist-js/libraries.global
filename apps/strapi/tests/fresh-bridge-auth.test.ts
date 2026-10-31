import { afterEach, expect, it, vi } from "vitest"

import { requireFreshBridgeAuth } from "../src/utils/fresh-bridge-auth"

afterEach(() => vi.unstubAllEnvs())
it.each([
  undefined,
  "invalid",
  new Date(Date.now() - 600_000).toISOString(),
  new Date(Date.now() + 60_000).toISOString(),
])(
  "rejects missing, invalid, stale or future session assertions",
  (created) => {
    vi.stubEnv("STRAPI_BRIDGE_SECRET", "fixture")
    const ctx = {
      request: {
        headers: {
          "x-service-secret": "fixture",
          "x-ba-user-id": "actor",
          "x-ba-session-created-at": created,
        },
      },
      status: 200,
      body: {},
    }
    expect(requireFreshBridgeAuth(ctx)).toBe(false)
    expect(ctx.status).toBe(403)
    expect(ctx.body).toMatchObject({ error: "reauthentication_required" })
  }
)
it("never trusts a fresh timestamp without the authenticated bridge", () => {
  vi.stubEnv("STRAPI_BRIDGE_SECRET", "fixture")
  expect(
    requireFreshBridgeAuth({
      request: {
        headers: {
          "x-service-secret": "wrong",
          "x-ba-user-id": "actor",
          "x-ba-session-created-at": new Date().toISOString(),
        },
      },
    })
  ).toBe(false)
})
it("accepts a current session asserted by the authenticated UI", () => {
  vi.stubEnv("STRAPI_BRIDGE_SECRET", "fixture")
  expect(
    requireFreshBridgeAuth({
      request: {
        headers: {
          "x-service-secret": "fixture",
          "x-ba-user-id": "actor",
          "x-ba-session-created-at": new Date().toISOString(),
        },
      },
    })
  ).toBe(true)
})
