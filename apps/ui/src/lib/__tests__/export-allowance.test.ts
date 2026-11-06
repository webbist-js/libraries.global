import { describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

const { exportsPerDayOf, spendExport } = await import("../export-allowance")

describe("daily export allowance", () => {
  it("reads only a positive integer allowance", () => {
    expect(exportsPerDayOf({ limits: { exportsPerDay: 20 } })).toBe(20)
    for (const bad of [0, -1, 1.5, "20", null])
      expect(exportsPerDayOf({ limits: { exportsPerDay: bad } })).toBe(0)
    expect(exportsPerDayOf({})).toBe(0)
  })

  it("allows the allowance then refuses with a stable code", async () => {
    const user = { id: `u-${Math.random()}`, limits: { exportsPerDay: 2 } }
    expect(await spendExport(user)).toBeNull()
    expect(await spendExport(user)).toBeNull()
    const refused = await spendExport(user)
    expect(refused?.status).toBe(429)
    expect(await refused?.json()).toMatchObject({ code: "EXPORT_DAILY_LIMIT" })
    expect(Number(refused?.headers.get("retry-after"))).toBeGreaterThan(0)
  })

  it("refuses accounts without an allowance", async () => {
    const res = await spendExport({ id: "anon", limits: {} })
    expect(res?.status).toBe(429)
  })
})
