import { describe, expect, it } from "vitest"

import { mapLimit } from "../../src/utils/map-limit"

const tick = () => new Promise<void>((r) => setTimeout(r, 1))

describe("mapLimit", () => {
  it("maps every item in order with at most `limit` in flight", async () => {
    let inFlight = 0
    let peak = 0
    const out = await mapLimit(
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      5,
      async (n, i) => {
        inFlight += 1
        peak = Math.max(peak, inFlight)
        await tick()
        await tick()
        inFlight -= 1

        return n * 10 + i
      }
    )
    expect(out).toEqual([10, 21, 32, 43, 54, 65, 76, 87, 98, 109, 120, 131])
    expect(peak).toBe(5)
  })

  it("handles an empty list and a limit larger than the list", async () => {
    await expect(mapLimit([], 5, async (n: number) => n)).resolves.toEqual([])
    await expect(mapLimit([1, 2], 50, async (n) => n + 1)).resolves.toEqual([
      2, 3,
    ])
  })

  it("rejects with the first error and stops starting new work", async () => {
    const started: number[] = []
    await expect(
      mapLimit([1, 2, 3, 4, 5, 6], 2, async (n) => {
        started.push(n)
        await tick()
        if (n === 2) throw new Error("boom")
      })
    ).rejects.toThrow("boom")
    await tick()
    await tick()
    expect(started.length).toBeLessThan(6)
  })

  it("treats a limit below 1 as 1", async () => {
    let inFlight = 0
    let peak = 0
    await mapLimit([1, 2, 3], 0, async () => {
      inFlight += 1
      peak = Math.max(peak, inFlight)
      await tick()
      inFlight -= 1
    })
    expect(peak).toBe(1)
  })
})
