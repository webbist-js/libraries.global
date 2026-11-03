import { afterEach, expect, it, vi } from "vitest"

import routes from "../src/plugins/content-moderation/server/routes/content-api"
import moderation from "../src/policies/moderation"
import serviceAuth from "../src/policies/service-auth"

afterEach(() => vi.unstubAllEnvs())

it("rejects missing service credentials even if a caller supplies an actor", () => {
  vi.stubEnv("STRAPI_BRIDGE_SECRET", "synthetic-policy-test")
  expect(serviceAuth({ request: { headers: { "x-ba-user-id": "1" } } })).toBe(
    false
  )
})

it("loads scopes once per request and observes revocation on the next request", async () => {
  vi.stubEnv("STRAPI_BRIDGE_SECRET", "synthetic-policy-test")
  const loadCapabilities = vi
    .fn()
    .mockResolvedValueOnce({
      caps: { moderation: [{ queue: "docs", locale: "fr" }] },
      role: "moderator",
    })
    .mockResolvedValueOnce({ caps: { moderation: [] }, role: "reader" })
  const strapi = { plugin: () => ({ service: () => ({ loadCapabilities }) }) }
  const request = () => ({
    state: {},
    request: {
      headers: {
        "x-service-secret": "synthetic-policy-test",
        "x-ba-user-id": "1",
      },
    },
  })
  const first = request()
  await expect(moderation(first, {}, { strapi })).resolves.toBe(true)
  await expect(moderation(first, {}, { strapi })).resolves.toBe(true)
  expect(loadCapabilities).toHaveBeenCalledTimes(1)
  await expect(moderation(request(), {}, { strapi })).rejects.toThrow(
    "You don't moderate any queue."
  )
})

it("declares the native policy on every moderation endpoint", () => {
  const protectedRoutes = routes.filter((route) =>
    route.handler.startsWith("moderation.")
  )
  expect(protectedRoutes.length).toBeGreaterThan(15)
  for (const route of protectedRoutes)
    expect(route.config.policies).toContain("global::moderation")
})
