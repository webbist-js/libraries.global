// @vitest-environment happy-dom
import { act, renderHook, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

const events = vi.hoisted(() => ({ results: vi.fn(), error: vi.fn() }))
vi.mock("@/lib/analytics-events", () => ({
  captureAnalyticsEvent: (name: string) =>
    name === "search_results" ? events.results : events.error,
  resultBucket: String,
}))
import { useArticleSearch } from "./useArticleSearch"

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((ok, fail) => {
    resolve = ok
    reject = fail
  })

  return { promise, resolve, reject }
}

describe("shared article search request handling", () => {
  it("ignores late query results and measures only the latest response", async () => {
    vi.clearAllMocks()
    const old = deferred<{ hits: string[] }>()
    const current = deferred<{ hits: string[] }>()
    const search = vi
      .fn()
      .mockReturnValueOnce(old.promise)
      .mockReturnValueOnce(current.promise)
    const view = renderHook(
      ({ query }) =>
        useArticleSearch({ query, locale: "en", kind: "journal", search }),
      { initialProps: { query: "old" } }
    )
    view.rerender({ query: "current" })
    await act(async () => current.resolve({ hits: ["latest"] }))
    await act(async () => old.resolve({ hits: ["obsolete"] }))
    expect(view.result.current.results).toEqual(["latest"])
    expect(events.results).toHaveBeenCalledExactlyOnceWith({
      result_bucket: "1",
    })
  })

  it("shows loading for the same query in a new locale and clears a removed query", async () => {
    const french = deferred<{ hits: string[] }>()
    const search = vi
      .fn()
      .mockResolvedValueOnce({ hits: ["English"] })
      .mockReturnValueOnce(french.promise)
    const view = renderHook(
      ({ query, locale }) =>
        useArticleSearch({ query, locale, kind: "knowledge", search }),
      { initialProps: { query: "library", locale: "en" } }
    )
    await waitFor(() => expect(view.result.current.searched).toBe(true))
    view.rerender({ query: "library", locale: "fr" })
    expect(view.result.current).toMatchObject({ loading: true, results: [] })
    view.rerender({ query: "", locale: "fr" })
    await act(async () => french.resolve({ hits: ["French"] }))
    expect(view.result.current).toMatchObject({
      active: false,
      loading: false,
      searched: false,
      results: [],
    })
  })

  it("does not report stale failures as errors for a subsequent search", async () => {
    vi.clearAllMocks()
    const old = deferred<{ hits: string[] }>()
    const search = vi
      .fn()
      .mockReturnValueOnce(old.promise)
      .mockRejectedValueOnce(new Error("current unavailable"))
    const view = renderHook(
      ({ query }) =>
        useArticleSearch({ query, locale: "en", kind: "journal", search }),
      { initialProps: { query: "old" } }
    )
    view.rerender({ query: "current" })
    await waitFor(() => expect(view.result.current.searched).toBe(true))
    await act(async () => old.reject(new Error("stale unavailable")))
    expect(view.result.current.results).toEqual([])
    expect(events.error).toHaveBeenCalledTimes(1)
  })
})
