import type { Pool } from "pg"
import { describe, expect, it, vi } from "vitest"

vi.mock("../config", () => ({
  apiAccessActive: (m: { revoked?: boolean } | null) =>
    Boolean(m && !m.revoked),
  apiConfig: () => ({ mode: "sandbox", overage: false }),
}))
import { createApiKey, keyDigest } from "../store"

const snapshot = { status: "active", revoked: false }
function database(revoked = false) {
  const query = vi.fn(async (sql: string) => ({
    rows: sql.includes("select subscription_id,snapshot")
      ? [{ subscription_id: "sub_api", snapshot: { ...snapshot, revoked } }]
      : sql.includes("from api_accounts")
        ? [{ team_id: "team", closed_at: null }]
        : [{ count: "1000" }],
  }))
  const release = vi.fn()

  return {
    pool: {
      query,
      connect: async () => ({ query, release }),
    } as unknown as Pool,
    query,
    release,
  }
}
describe("unlimited API credentials", () => {
  it("creates another credential without resetting usage or imposing a key count cap", async () => {
    const { pool, query, release } = database()
    const result = await createApiKey(pool, "team", "organiser", {
      name: "Another application",
      scopes: ["search:read"],
      expiresAt: null,
    })
    const insert = query.mock.calls.find(([sql]) =>
      sql.includes("insert into api_keys")
    ) as unknown as [string, unknown[]]
    expect(insert[1]).toContain(keyDigest(result.secret))
    expect(insert[1]).not.toContain(result.secret)
    expect(
      query.mock.calls.some(
        ([sql]) =>
          sql.includes("count(*)") ||
          /(?:insert|update|delete).*api_periods/.test(sql)
      )
    ).toBe(false)
    expect(release).toHaveBeenCalledOnce()
  })
  it("still refuses credentials without settled, valid API access", async () => {
    const { pool, query } = database(true)
    await expect(
      createApiKey(pool, "team", "organiser", {
        name: "App",
        scopes: ["search:read"],
        expiresAt: null,
      })
    ).rejects.toThrow("api_access_required")
    expect(
      query.mock.calls.some(([sql]) => sql.includes("insert into api_keys"))
    ).toBe(false)
  })
})
