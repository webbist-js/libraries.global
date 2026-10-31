// @vitest-environment happy-dom
import { StrictMode } from "react"
import { afterEach, expect, it, vi } from "vitest"

import { SearchResultsAnalytics } from "@/components/providers/SearchResultsAnalytics"
import type * as AnalyticsEvents from "@/lib/analytics-events"
import { cleanup, render } from "@/test/render"

const { track } = vi.hoisted(() => ({ track: vi.fn() }))
vi.mock("@/lib/analytics-events", async (importOriginal) => ({
  ...(await importOriginal<typeof AnalyticsEvents>()),
  pushAnalyticsEvent: track,
}))
afterEach(() => {
  cleanup()
  track.mockReset()
})
it("counts a confirmed directory zero once under Strict Mode, without the query", () => {
  const props = {
    source: "network_directory" as const,
    searchType: "networks" as const,
    searchKey: "q=PRIVATE_QUERY",
    count: 0,
  }
  const view = render(
    <StrictMode>
      <SearchResultsAnalytics {...props} />
    </StrictMode>
  )
  view.rerender(
    <StrictMode>
      <SearchResultsAnalytics {...props} />
    </StrictMode>
  )
  expect(track).toHaveBeenCalledTimes(1)
  expect(track).toHaveBeenCalledWith("search_results", {
    interaction_source: "network_directory",
    search_type: "networks",
    result_bucket: "zero",
  })
  expect(JSON.stringify(track.mock.calls)).not.toContain("PRIVATE_QUERY")
})
