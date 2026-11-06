import { createRequire } from "node:module"

import { CONTRIBUTION_ACTIONS } from "@repo/access"
import { describe, expect, it, vi } from "vitest"

const { recountRecognition } = createRequire(import.meta.url)(
  "../../scripts/recount-recognition.cjs"
)

function fakeClient(
  profiles: {
    id: number
    ba_user_id: string
    accepted_contributions: number
    last_contribution_at: string | null
  }[],
  totals: Record<string, { accepted: number; last_at: string }>
) {
  const sql: { text: string; params?: unknown[] }[] = []
  const query = vi.fn(async (text: string, params?: unknown[]) => {
    sql.push({ text, params })
    if (text.includes("FROM user_profiles")) {
      const [after, limit] = params as [number, number]

      return {
        rows: profiles.filter((p) => p.id > after).slice(0, limit),
      }
    }
    if (text.includes("FROM rw_point_events")) {
      const [ids] = params as [string[]]

      return {
        rows: ids.flatMap((id) =>
          totals[id] ? [{ ba_user_id: id, ...totals[id] }] : []
        ),
      }
    }

    return { rows: [] }
  })

  return { query, sql }
}

const profiles = [
  {
    id: 1,
    ba_user_id: "a",
    accepted_contributions: 0,
    last_contribution_at: null,
  },
  {
    id: 2,
    ba_user_id: "b",
    accepted_contributions: 3,
    last_contribution_at: "2026-10-01T00:00:00.000Z",
  },
  {
    id: 3,
    ba_user_id: "c",
    accepted_contributions: 9,
    last_contribution_at: null,
  },
]
const totals = {
  a: { accepted: 101, last_at: "2026-11-01T00:00:00.000Z" },
  b: { accepted: 3, last_at: "2026-10-01T00:00:00.000Z" },
}
const actions = [...CONTRIBUTION_ACTIONS]

describe("recount-recognition", () => {
  it("previews in a read-only transaction with bounded keyset pages and only qualifying positive events", async () => {
    const client = fakeClient(profiles, totals)
    const report = await recountRecognition(client, { actions, pageSize: 2 })
    expect(report).toEqual({
      mode: "preview",
      profiles: 3,
      changed: 2,
      contributors: 2,
      acceptedContributions: 104,
    })
    expect(client.sql[0]!.text).toBe("BEGIN TRANSACTION READ ONLY")
    expect(client.sql.at(-1)!.text).toBe("ROLLBACK")
    expect(client.sql.some((q) => q.text.startsWith("UPDATE"))).toBe(false)
    const pages = client.sql.filter((q) =>
      q.text.includes("FROM user_profiles")
    )
    expect(pages.map((q) => q.params)).toEqual([
      [0, 2],
      [2, 2],
    ])
    const events = client.sql.find((q) => q.text.includes("rw_point_events"))!
    expect(events.text).toContain("points > 0")
    expect(events.params![1]).toEqual(actions)
    expect(actions).not.toContain("daily_streak")
    expect(actions).not.toContain("manual_award")
  })
  it("writes only changed rows with --apply", async () => {
    const client = fakeClient(profiles, totals)
    await recountRecognition(client, { actions, apply: true })
    const updates = client.sql.filter((q) => q.text.includes("UPDATE"))
    expect(updates.map((q) => q.params)).toEqual([
      [1, 101, new Date("2026-11-01T00:00:00.000Z")],
      [3, 0, null],
    ])
    expect(client.sql.at(-1)!.text).toBe("COMMIT")
  })
  it("refuses to run without the qualifying action list", async () => {
    await expect(recountRecognition(fakeClient([], {}), {})).rejects.toThrow(
      /actions/
    )
  })
})
