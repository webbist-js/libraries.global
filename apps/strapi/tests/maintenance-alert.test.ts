import { afterEach, expect, it, vi } from "vitest"

import { cmsMaintenanceStatus } from "../src/utils/cms-maintenance"
import { maintenanceHealthEvent } from "../src/utils/internal-notifications/maintenance"

vi.mock("../src/utils/cms-maintenance", () => ({
  cmsMaintenanceStatus: vi.fn(),
}))
afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetAllMocks()
})
it("waits for operational activation before monitoring new jobs", async () => {
  vi.stubEnv("CMS_MAINTENANCE_REQUIRED", "false")
  expect(await maintenanceHealthEvent({} as never)).toBeNull()
  expect(cmsMaintenanceStatus).not.toHaveBeenCalled()
})
it("produces a bounded, daily-deduplicated operational alert for missed runs", async () => {
  vi.stubEnv("CMS_MAINTENANCE_REQUIRED", "true")
  vi.mocked(cmsMaintenanceStatus).mockResolvedValue({
    ok: false,
    stale: ["notification-retention"],
  })
  const first = await maintenanceHealthEvent(
    {} as never,
    new Date("2026-10-31T10:00:00Z")
  )
  const next = await maintenanceHealthEvent(
    {} as never,
    new Date("2026-10-31T11:00:00Z")
  )
  expect(first?.eventKey).toBe(next?.eventKey)
  expect(first).toMatchObject({ kind: "service_alert" })
  expect(first).not.toHaveProperty("actorId")
  vi.mocked(cmsMaintenanceStatus).mockResolvedValue({ ok: true, stale: [] })
  expect(await maintenanceHealthEvent({} as never)).toBeNull()
})
