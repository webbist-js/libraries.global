import { afterEach, beforeEach, expect, it, vi } from "vitest"

vi.mock("../src/utils/internal-notifications/events", () => ({
  collectAuthEvents: vi.fn(),
  collectContentEvents: vi.fn().mockResolvedValue(0),
}))
vi.mock("node:timers/promises", () => ({ setTimeout: vi.fn() }))
import { collectAuthEvents } from "../src/utils/internal-notifications/events"
import { internalNotifications } from "../src/utils/internal-notifications/service"

const row = {
  id: 1,
  eventKey: "source:1",
  kind: "contribution",
  title: "Submitted",
  detail: "A Library correction",
  eventAt: "2026-10-23T12:00:00Z",
  attempts: 0,
}
function fixture() {
  const ignore = vi.fn().mockResolvedValue(undefined)
  const onConflict = vi.fn().mockReturnValue({ ignore })
  const insert = vi.fn().mockReturnValue({ onConflict })
  const save = vi.fn().mockResolvedValue({})
  const find = vi.fn().mockResolvedValue([row])
  const storeValue: Record<string, { until?: number }> = {}
  const strapi = {
    db: {
      connection: vi.fn().mockReturnValue({ insert }),
      dialect: { client: "sqlite" },
      query: vi.fn(() => ({
        findMany: find,
        update: save,
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      })),
    },
    store: ({ key }: { key: string }) => ({
      get: async () => storeValue[key],
      set: async ({ value }: { value: { until?: number } }) => {
        storeValue[key] = value
      },
    }),
    log: { warn: vi.fn() },
  }

  return { strapi, save, find, storeValue }
}
beforeEach(() => {
  vi.stubEnv("INTERNAL_NOTIFICATIONS_ENABLED", "true")
  vi.stubEnv("INTERNAL_NOTIFICATIONS_DRY_RUN", "false")
  vi.stubEnv("INTERNAL_NOTIFICATIONS_SINCE", "2026-10-23T00:00:00Z")
  vi.stubEnv(
    "SLACK_INTERNAL_WEBHOOK_URL",
    "https://hooks.slack.com/services/T123/B123/fixture"
  )
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("ok")))
  vi.mocked(collectAuthEvents).mockResolvedValue(undefined)
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})
it("marks a delivery sent only after Slack confirms acceptance", async () => {
  const { strapi, save } = fixture()
  expect(
    await internalNotifications(strapi).run(new Date("2026-10-23T12:00:00Z"))
  ).toMatchObject({ sent: 1, failed: 0 })
  expect(save).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({ state: "sent" }),
    })
  )
})
it("persists a channel-wide cooldown on throttling and makes no calls during it", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        new Response("", { status: 429, headers: { "retry-after": "600" } })
      )
  )
  const { strapi, save, storeValue } = fixture()
  const service = internalNotifications(strapi)
  await service.run(new Date("2026-10-23T12:00:00Z"))
  expect(save).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({
        state: "pending",
        attempts: 1,
        lastError: "slack_rate_limited",
      }),
    })
  )
  expect(storeValue.cooldown.until).toBeGreaterThan(Date.now())
  vi.mocked(fetch).mockClear()
  await service.run(new Date("2026-10-23T12:01:00Z"))
  expect(fetch).not.toHaveBeenCalled()
})
it("keeps content delivery available when the account bridge is down", async () => {
  vi.mocked(collectAuthEvents).mockRejectedValue(new Error("unavailable"))
  const { strapi } = fixture()
  expect(
    await internalNotifications(strapi).run(new Date("2026-10-23T12:00:00Z"))
  ).toMatchObject({ queuedSourcesFailed: 1, sent: 1 })
})
it("retains a permanent failure and pauses until an operator retries", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(new Response("", { status: 403 }))
  )
  const { strapi, save, storeValue } = fixture()
  await internalNotifications(strapi).run(new Date("2026-10-23T12:00:00Z"))
  expect(save).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({
        state: "failed",
        lastError: "slack_http_403",
      }),
    })
  )
  expect(storeValue.cooldown.until).toBe(Number.MAX_SAFE_INTEGER)
})
it("dry runs collect events without posting or marking anything sent", async () => {
  vi.stubEnv("INTERNAL_NOTIFICATIONS_DRY_RUN", "true")
  const { strapi, save } = fixture()
  expect(
    await internalNotifications(strapi).run(new Date("2026-10-23T12:00:00Z"))
  ).toMatchObject({ dryRun: true, sent: 0 })
  expect(fetch).not.toHaveBeenCalled()
  expect(save).not.toHaveBeenCalled()
})
