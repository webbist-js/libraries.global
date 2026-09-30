import { describe, expect, it } from "vitest"

import { mapLimit } from "../map-limit"

describe("mapLimit", () => {
  it("maps every item in order with at most `limit` in flight", async () => {
    let inFlight = 0
    let most = 0
    const result = await mapLimit([1, 2, 3, 4, 5, 6, 7], 3, async (n) => {
      inFlight += 1
      most = Math.max(most, inFlight)
      await new Promise((r) => setTimeout(r, 8 - n))
      inFlight -= 1

      return n * 2
    })

    expect(result).toEqual([2, 4, 6, 8, 10, 12, 14])
    expect(most).toBe(3)
  })

  it("handles an empty list", async () => {
    expect(await mapLimit([], 4, async (n: number) => n)).toEqual([])
  })

  it("rejects when one item fails", async () => {
    await expect(
      mapLimit([1, 2], 2, async (n) => {
        if (n === 2) throw new Error("boom")

        return n
      })
    ).rejects.toThrow("boom")
  })
})
