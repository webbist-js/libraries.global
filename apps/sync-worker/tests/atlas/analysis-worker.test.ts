import { afterEach, expect, it, vi } from "vitest"

import {
  runAnalysisJob,
  analysisWorkerHealthy,
  retryAnalysisDatabase,
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
  expect(analysisWorkerHealthy(0, abort.signal, 2000)).toBe(false)
  expect(analysisWorkerHealthy(1000, abort.signal, 241000)).toBe(true)
  expect(analysisWorkerHealthy(1000, abort.signal, 331000)).toBe(false)
  abort.abort()
  expect(analysisWorkerHealthy(1000, abort.signal, 2000)).toBe(false)
})

it.each(["ECONNRESET", "ECONNREFUSED", "57P01", "57P03"])(
  "resumes the worker after a temporary %s database interruption",
  async (code) => {
    vi.useFakeTimers()
    const error = Object.assign(new Error("Database interrupted"), { code })
    const operation = vi
      .fn()
      .mockRejectedValueOnce(error)
      .mockResolvedValue(undefined)
    const onError = vi.fn()
    const running = retryAnalysisDatabase(
      operation,
      new AbortController().signal,
      { onError }
    )

    await vi.advanceTimersByTimeAsync(999)
    expect(operation).toHaveBeenCalledTimes(1)
    expect(onError).toHaveBeenCalledWith(error)
    await vi.advanceTimersByTimeAsync(1)
    await running
    expect(operation).toHaveBeenCalledTimes(2)
  }
)

it("keeps finite runs and permanent database errors fail-fast", async () => {
  const signal = new AbortController().signal
  const disconnected = Object.assign(new Error("Disconnected"), {
    code: "ECONNRESET",
  })
  const schemaError = Object.assign(new Error("Missing table"), {
    code: "42P01",
  })

  await expect(
    retryAnalysisDatabase(vi.fn().mockRejectedValue(disconnected), signal, {
      once: true,
    })
  ).rejects.toBe(disconnected)
  await expect(
    retryAnalysisDatabase(vi.fn().mockRejectedValue(schemaError), signal)
  ).rejects.toBe(schemaError)
})

it("stops promptly when shutdown interrupts a database retry", async () => {
  vi.useFakeTimers()
  const abort = new AbortController()
  const operation = vi
    .fn()
    .mockRejectedValue(
      Object.assign(new Error("Disconnected"), { code: "ECONNRESET" })
    )
  const running = retryAnalysisDatabase(operation, abort.signal, {
    onError: vi.fn(),
  })
  await vi.advanceTimersByTimeAsync(0)
  abort.abort()

  await running
  expect(operation).toHaveBeenCalledTimes(1)
  expect(vi.getTimerCount()).toBe(0)
})
