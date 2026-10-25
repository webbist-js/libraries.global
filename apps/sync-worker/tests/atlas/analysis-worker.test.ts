import { afterEach, expect, it, vi } from "vitest"

import {
  runAnalysisJob,
  analysisWorkerHealthy,
} from "../../src/atlas/analysis-worker"

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

it.each([
  ["network", 240000, "/calculate-network"],
  ["library", 90000, "/calculate"],
])(
  "keeps the %s job lease alive beyond its native request budget",
  async (kind, timeout, endpoint) => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-10-24T12:00:00Z"))
    vi.stubEnv("ANALYSIS_SERVICE_URL", "http://analysis.test")
    vi.stubEnv("ANALYSIS_SERVICE_TOKEN", "fixture-token")
    const requestTimeout = vi
      .spyOn(AbortSignal, "timeout")
      .mockReturnValue(new AbortController().signal)
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        Response.json({ state: "ready", resultKey: "a".repeat(64) })
      )
    vi.stubGlobal("fetch", fetcher)
    const updates: Record<string, any>[] = []
    const query: any = {}
    for (const method of ["where", "orderBy", "forUpdate", "skipLocked"])
      query[method] = vi.fn().mockReturnValue(query)
    query.first = vi.fn().mockResolvedValue({
      key: "job",
      attempts: 0,
      payload: JSON.stringify({ kind }),
    })
    query.update = vi.fn(async (value: Record<string, any>) =>
      updates.push(value)
    )
    const db: any = vi.fn().mockReturnValue(query)
    db.transaction = async (callback: (trx: any) => Promise<unknown>) =>
      callback(db)
    db.raw = vi.fn()

    expect(await runAnalysisJob(db, new AbortController().signal)).toBe(true)
    expect(requestTimeout).toHaveBeenCalledWith(timeout)
    expect(String(fetcher.mock.calls[0]![0])).toBe(
      `http://analysis.test${endpoint}`
    )
    expect(updates[1]!.claim_until.getTime() - Date.now()).toBe(
      Number(timeout) + 30000
    )
    expect(updates[2]).toMatchObject({
      state: "ready",
      result_key: "a".repeat(64),
      claim_until: null,
    })
    expect(query.where).toHaveBeenCalledWith({
      key: "job",
      claim_token: updates[1]!.claim_token,
    })
  }
)

it("reports stalled processing and shutdown as unhealthy while permitting a bounded network calculation", () => {
  const abort = new AbortController()
  expect(analysisWorkerHealthy(1000, abort.signal, 241000)).toBe(true)
  expect(analysisWorkerHealthy(1000, abort.signal, 331000)).toBe(false)
  abort.abort()
  expect(analysisWorkerHealthy(1000, abort.signal, 2000)).toBe(false)
})
