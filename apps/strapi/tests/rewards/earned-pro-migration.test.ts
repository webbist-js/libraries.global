import { createRequire } from "node:module"

import { CONTRIBUTION_ACTIONS } from "@repo/access"
import { describe, expect, it, vi } from "vitest"

const migration = createRequire(import.meta.url)(
  "../../database/migrations/2026.11.01T00.00.00.earned-pro-activity.js"
)

describe("earned-Pro activity migration", () => {
  it("backfills from qualifying positive historical events, using the same actions as live awards", async () => {
    const knex = {
      schema: {
        hasTable: vi.fn().mockResolvedValue(true),
        hasColumn: vi.fn().mockResolvedValue(true),
      },
      raw: vi.fn(),
    }
    await migration.up(knex)
    expect(knex.raw).toHaveBeenCalledWith(
      expect.stringContaining("MAX(e.awarded_at) + INTERVAL '30 days'"),
      [...CONTRIBUTION_ACTIONS]
    )
    expect(knex.raw.mock.calls[0][0]).toContain("e.points > 0")
    expect(knex.raw.mock.calls[0][0]).toContain("e.ba_user_id = p.ba_user_id")
  })
  it("skips a fresh database before its schema exists", async () => {
    const knex = {
      schema: { hasTable: vi.fn().mockResolvedValue(false) },
      raw: vi.fn(),
    }
    await migration.up(knex)
    expect(knex.raw).not.toHaveBeenCalled()
  })
})
