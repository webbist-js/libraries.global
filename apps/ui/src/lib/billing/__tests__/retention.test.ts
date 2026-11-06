import type { Pool } from "pg"
import { describe, expect, it, vi } from "vitest"

import { purgeBillingMetadata } from "../retention"

describe("billing retention", () => {
  it("removes only completed webhook event references older than 90 days", async () => {
    const query = vi.fn(async (_sql: string, _params?: unknown[]) => ({
      rows: [],
      rowCount: 2,
    }))
    const result = await purgeBillingMetadata(
      { query } as unknown as Pool,
      new Date("2026-12-01T00:00:00Z")
    )
    expect(result).toEqual({ events: 2 })
    expect(query.mock.calls[0]?.[0]).toContain(
      "state in ('complete','ignored')"
    )
    expect(query.mock.calls[0]?.[1]).toEqual([new Date("2026-09-02T00:00:00Z")])
  })
  it("reports an undeployed schema without failing the job", async () => {
    const query = vi.fn().mockRejectedValue({ code: "42P01" })
    expect(await purgeBillingMetadata({ query } as unknown as Pool)).toEqual({
      configured: false,
    })
  })
})
