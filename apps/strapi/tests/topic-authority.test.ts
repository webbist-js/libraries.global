import { afterEach, expect, it, vi } from "vitest"

import topicRoutes from "../src/api/topic/routes/topic"
import { loadCallerCapabilities } from "../src/utils/staff"
import { requireTopicModerator } from "../src/utils/topic-authority"

vi.mock("../src/utils/staff", () => ({ loadCallerCapabilities: vi.fn() }))
afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetAllMocks()
})
function context(headers = {}) {
  return { request: { headers }, unauthorized: vi.fn(), forbidden: vi.fn() }
}
it.each([
  {},
  { authorization: "Bearer readonly" },
  { "x-ba-user-id": "actor" },
])("rejects CMS callers without the authenticated bridge", async (headers) => {
  vi.stubEnv("STRAPI_BRIDGE_SECRET", "fixture-secret")
  const ctx = context(headers)
  expect(await requireTopicModerator({}, ctx)).toBe(false)
  expect(ctx.unauthorized).toHaveBeenCalled()
  expect(loadCallerCapabilities).not.toHaveBeenCalled()
})
it.each([
  { moderation: [] },
  { moderation: [{ queue: "index", locale: "en" }] },
  { moderation: [{ queue: "docs", locale: null }] },
])(
  "rejects ordinary or insufficiently scoped accounts",
  async ({ moderation }) => {
    vi.stubEnv("STRAPI_BRIDGE_SECRET", "fixture-secret")
    vi.mocked(loadCallerCapabilities).mockResolvedValue({ moderation } as never)
    const ctx = context({
      "x-service-secret": "fixture-secret",
      "x-ba-user-id": "actor",
    })
    expect(await requireTopicModerator({}, ctx)).toBe(false)
    expect(ctx.forbidden).toHaveBeenCalled()
  }
)
it("requires a live unrestricted index moderator grant", async () => {
  vi.stubEnv("STRAPI_BRIDGE_SECRET", "fixture-secret")
  vi.mocked(loadCallerCapabilities).mockResolvedValue({
    moderation: [{ queue: "index", locale: null }],
  } as never)
  expect(
    await requireTopicModerator(
      {},
      context({ "x-service-secret": "fixture-secret", "x-ba-user-id": "actor" })
    )
  ).toBe(true)
  expect(
    topicRoutes.routes
      .filter((route) => route.path !== "/topics/approved")
      .every((route) => route.config.auth === false)
  ).toBe(true)
})
