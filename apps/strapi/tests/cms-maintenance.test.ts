import { expect, it, vi } from "vitest"

import {
  cmsMaintenanceStatus,
  runCmsMaintenance,
  recordMaintenanceSuccess,
  observeMaintenance,
} from "../src/utils/cms-maintenance"

function fixture() {
  const values = new Map<string, unknown>()

  return {
    db: { dialect: { client: "sqlite" } },
    store: ({ key }: { key: string }) => ({
      get: async () => values.get(key),
      set: async ({ value }: { value: unknown }) => {
        values.set(key, structuredClone(value))
      },
    }),
  }
}
it("records actual successes, retries failures, and continues other jobs", async () => {
  const strapi = fixture()
  const failed = vi
    .fn()
    .mockRejectedValueOnce(new Error("temporary"))
    .mockResolvedValue(undefined)
  const other = vi.fn().mockResolvedValue(undefined)
  const jobs = [
    { id: "purge", interval: 60_000, run: failed },
    { id: "other", interval: 60_000, run: other },
  ]
  const now = new Date()
  expect(await runCmsMaintenance(strapi, now, jobs)).toMatchObject({
    ok: false,
    failed: ["purge"],
  })
  expect((await cmsMaintenanceStatus(strapi, now, jobs)).stale).toEqual([
    "purge",
  ])
  await runCmsMaintenance(strapi, now, jobs)
  expect(other).toHaveBeenCalledTimes(1)
  expect((await cmsMaintenanceStatus(strapi, now, jobs)).ok).toBe(true)
  expect(
    (await cmsMaintenanceStatus(strapi, new Date(+now + 421_000), jobs)).ok
  ).toBe(false)
})
it("observes external plugin jobs without scheduling duplicate sweeps", async () => {
  const strapi = fixture()
  const job = {
    id: "mobile-live-stop",
    interval: 300_000,
    external: true,
    run: vi.fn(),
  }
  expect((await cmsMaintenanceStatus(strapi, new Date(), [job])).ok).toBe(false)
  await recordMaintenanceSuccess(strapi, job.id)
  await runCmsMaintenance(strapi, new Date(), [job])
  expect(job.run).not.toHaveBeenCalled()
  expect((await cmsMaintenanceStatus(strapi, new Date(), [job])).ok).toBe(true)
})

it("marks a plugin job unhealthy immediately when its scheduled work fails", async () => {
  const strapi = fixture()
  const job = {
    id: "mobile-live-retention",
    interval: 86_400_000,
    external: true,
    run: vi.fn(),
  }
  await recordMaintenanceSuccess(strapi, job.id)
  await expect(
    observeMaintenance(strapi, job.id, async () => {
      throw new Error("storage unavailable")
    })
  ).rejects.toThrow()
  expect((await cmsMaintenanceStatus(strapi, new Date(), [job])).ok).toBe(false)
  await observeMaintenance(strapi, job.id, async () => {})
  expect((await cmsMaintenanceStatus(strapi, new Date(), [job])).ok).toBe(true)
})
