import { beforeEach, describe, expect, it, vi } from "vitest"

/**
 * A knex-shaped fake: `db(table)` returns a chainable builder whose
 * `.update()` calls are recorded, and whose `.first()` reports the
 * `consecutive_failures` the test sets on `state.failures`.
 */
const { fakeDb, state } = vi.hoisted(() => {
  const state = {
    calls: [] as Record<string, unknown>[],
    failures: 1,
  }
  const fakeDb: any = (_table: string) => {
    const builder: any = {
      where: () => builder,
      update: async (data: Record<string, unknown>) => {
        state.calls.push(data)

        return 1
      },
      first: async () => ({ consecutive_failures: state.failures }),
    }

    return builder
  }
  fakeDb.raw = (s: string) => s

  return { fakeDb, state }
})

vi.mock("../../src/db", () => ({ default: fakeDb }))

import { updateCredentialStatus } from "../../src/pipeline/write-run"

beforeEach(() => {
  state.calls.length = 0
  state.failures = 1
  process.env.EVENTS_AUTOPAUSE_AFTER = "4"
})

describe("updateCredentialStatus", () => {
  it("resets the failure count on success", async () => {
    await updateCredentialStatus(7, { ok: true })
    expect(state.calls[0]).toMatchObject({
      last_sync_status: "ok",
      consecutive_failures: 0,
      last_error_code: null,
    })
  })

  it("records the code and pauses after the threshold", async () => {
    state.failures = 4
    await updateCredentialStatus(7, {
      ok: false,
      code: "auth_failed",
      message: "401 https://x.example/?t=s",
    })
    expect(
      state.calls.some(
        (c) => c.status === "paused" && c.paused_reason === "sync_failures"
      )
    ).toBe(true)
    expect(JSON.stringify(state.calls)).not.toContain("t=s")
  })

  it("doesn't pause before the threshold", async () => {
    state.failures = 2
    await updateCredentialStatus(7, {
      ok: false,
      code: "unreachable",
      message: "timeout",
    })
    expect(state.calls.some((c) => c.status === "paused")).toBe(false)
  })
})
