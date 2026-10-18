import { it, expect } from "vitest"

import { articleEventTime } from "./article-event-time"

it("captures Bogotá wall time independent of the writer's browser zone", () => {
  expect(articleEventTime("2026-10-16T11:00", "America/Bogota")).toBe(
    "2026-10-16T16:00:00.000Z"
  )
  expect(articleEventTime("2026-10-16T11:00", "Europe/Prague")).toBe(
    "2026-10-16T09:00:00.000Z"
  )
  expect(articleEventTime("", "UTC")).toBeNull()
})
it("rejects nonexistent DST wall times, malformed dates and invalid named zones", () => {
  expect(() => articleEventTime("2026-03-29T02:30", "Europe/Prague")).toThrow()
  expect(() => articleEventTime("2026-02-30T11:00", "UTC")).toThrow()
  expect(() => articleEventTime("2026-10-16T11:00", "invalid/zone")).toThrow()
})
