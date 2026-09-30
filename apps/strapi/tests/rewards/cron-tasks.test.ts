import { describe, expect, it, vi } from "vitest"

import cronTasks from "../../config/cron-tasks"

const tick = () => new Promise<void>((r) => setTimeout(r, 1))

describe("config/cron-tasks", () => {
  it("has no sayHelloJob", () => {
    expect(Object.keys(cronTasks)).not.toContain("sayHelloJob")
    expect(Object.keys(cronTasks)).toEqual(
      expect.arrayContaining(["quickWinsRefreshJob"])
    )
  })

  it("refreshes quick wins five at a time and survives one failing", async () => {
    let inFlight = 0
    let peak = 0
    const done: string[] = []
    const computeAndSave = vi.fn(async (id: string) => {
      inFlight += 1
      peak = Math.max(peak, inFlight)
      await tick()
      await tick()
      inFlight -= 1
      if (id === "u3") throw new Error("nope")
      done.push(id)
    })
    const profiles = Array.from({ length: 12 }, (_, i) => ({
      baUserId: `u${i + 1}`,
    }))
    const strapi: any = {
      log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
      db: { query: vi.fn(() => ({ findMany: vi.fn(async () => profiles) })) },
      service: vi.fn(() => ({ computeAndSave })),
    }

    await (cronTasks as any).quickWinsRefreshJob.task({ strapi })

    expect(computeAndSave).toHaveBeenCalledTimes(12)
    expect(peak).toBe(5)
    expect(done).toHaveLength(11)
    expect(strapi.log.warn).toHaveBeenCalledTimes(1)
  })
})
