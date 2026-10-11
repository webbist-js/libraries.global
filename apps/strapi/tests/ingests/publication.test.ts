import { createRequire } from "node:module"

import { describe, expect, it } from "vitest"

const { forEachBounded } = createRequire(import.meta.url)(
  "../../scripts/publish-ready-libraries.cjs"
)

describe("bounded library publication", () => {
  it("caps concurrent writes and visits each record once", async () => {
    let active = 0,
      maximum = 0
    const visited: number[] = []
    await forEachBounded([1, 2, 3, 4, 5], 2, async (row: number) => {
      active++
      maximum = Math.max(maximum, active)
      await new Promise((resolve) => setTimeout(resolve, 1))
      visited.push(row)
      active--
    })
    expect(maximum).toBe(2)
    expect(visited.sort()).toEqual([1, 2, 3, 4, 5])
  })
  it("stops dispatch after a failure and settles in-flight work", async () => {
    const started: number[] = [],
      settled: number[] = []
    const failure = new Error("Publication failed")
    await expect(
      forEachBounded([1, 2, 3, 4], 2, async (row: number) => {
        started.push(row)
        if (row === 1) throw failure
        await new Promise((resolve) => setTimeout(resolve, 5))
        settled.push(row)
      })
    ).rejects.toBe(failure)
    expect(started).toEqual([1, 2])
    expect(settled).toEqual([2])
    await expect(forEachBounded([], 5, async () => {})).rejects.toThrow(
      /Concurrency/
    )
  })
})
