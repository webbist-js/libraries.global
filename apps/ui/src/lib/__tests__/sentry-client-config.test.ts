// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from "vitest"

const { init } = vi.hoisted(() => ({ init: vi.fn() }))
vi.mock("@sentry/nextjs", () => ({ init }))
vi.mock("@/lib/env-vars", () => ({ getEnvVar: vi.fn() }))
vi.mock("@/lib/navigation", () => ({
  routing: { locales: ["en", "cs", "fr"] },
}))

afterEach(() => {
  vi.resetModules()
  init.mockClear()
})

it("keeps replay off and scrubs browser fault request data", async () => {
  window.location.href = "https://libraries.global/libraries"
  await import("../../../sentry.client.config")
  const options = init.mock.calls[0]?.[0]
  expect(options).toMatchObject({
    integrations: [],
    sendDefaultPii: false,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
  })
  const event = {
    request: {
      url: "https://libraries.global/auth/callback?code=PRIVATE_CODE",
      data: "PRIVATE_BODY",
      cookies: "PRIVATE_COOKIE",
      query_string: "PRIVATE_QUERY",
      headers: { authorization: "PRIVATE_TOKEN", "user-agent": "browser" },
    },
  }
  expect(options.beforeSend(event).request).toEqual({
    url: "https://libraries.global/auth/callback",
    headers: { "user-agent": "browser" },
  })
})
