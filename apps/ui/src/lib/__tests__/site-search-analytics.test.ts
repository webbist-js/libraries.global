// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from "vitest"

import { installGoogleAnalytics } from "@/lib/google-analytics"
import type { SiteSearchResponse } from "@/lib/site-search"
import {
  captureSiteSearch,
  trackSiteSearchSelection,
} from "@/lib/site-search-analytics"

function setup(consent = true) {
  window.location.href = "https://libraries.global/knowledge?q=PRIVATE_QUERY"
  vi.spyOn(document.head, "append").mockImplementation(() => {})
  const controller = installGoogleAnalytics(window)!
  controller.setConsent(consent)

  return controller
}
const events = () =>
  (window.dataLayer ?? []).flatMap((row) => {
    const entry = row as { event?: string; analytics?: Record<string, string> }

    return entry.event === "lg_analytics" &&
      entry.analytics?.event_name !== "page_view"
      ? [entry.analytics!]
      : []
  })
const data = (count: number): SiteSearchResponse => ({
  items: [],
  counts: { libraries: count },
  estimated: [],
  unavailable: [],
})
afterEach(() => {
  delete window.librariesGlobalAnalytics
  delete window.dataLayer
  delete window.gtag
  vi.restoreAllMocks()
})

it("measures the submitted debounced search and its bounded result bucket once", () => {
  setup()
  const request = captureSiteSearch()
  request.complete(data(14))
  request.complete(data(14))
  expect(events().map((e) => e.event_name)).toEqual([
    "search",
    "search_results",
  ])
  expect(events()[1]).toMatchObject({
    interaction_source: "site_search",
    search_type: "site",
    result_bucket: "more_than_ten",
  })
  expect(JSON.stringify(events())).not.toContain("PRIVATE_QUERY")
})
it("distinguishes true zero from partial and failed requests", () => {
  setup()
  captureSiteSearch().complete(data(0))
  captureSiteSearch().complete({ ...data(0), unavailable: ["libraries"] })
  captureSiteSearch().failed()
  expect(
    events().filter((e) => e.event_name === "search_results")
  ).toHaveLength(1)
  expect(events().filter((e) => e.event_name === "search_error")).toHaveLength(
    2
  )
})
it("does not replay pending results across grant, withdrawal or navigation", () => {
  const controller = setup(false)
  const before = captureSiteSearch()
  controller.setConsent(true)
  before.complete(data(5))
  const revoked = captureSiteSearch()
  controller.setConsent(false)
  controller.setConsent(true)
  revoked.complete(data(5))
  const navigated = captureSiteSearch()
  window.location.pathname = "/events"
  controller.pageView()
  navigated.complete(data(5))
  expect(
    events().filter((e) => e.event_name === "search_results")
  ).toHaveLength(0)
})
it("selects a public result without sending its title, summary, query or href", () => {
  setup()
  trackSiteSearchSelection(
    {
      id: "libraries:public_document",
      group: "libraries",
      title: "PRIVATE_TITLE",
      summary: "PRIVATE_SUMMARY",
      href: "/library?q=PRIVATE_QUERY",
    },
    "libraries"
  )
  trackSiteSearchSelection(
    {
      id: "libraries:/fallback?PRIVATE_QUERY",
      group: "libraries",
      title: "PRIVATE_TITLE",
      summary: "",
      href: "/fallback?PRIVATE_QUERY",
    },
    "all"
  )
  expect(events()[0]).toMatchObject({
    event_name: "select_content",
    library_document_id: "public_document",
    search_scope: "libraries",
  })
  expect(events()[1]).not.toHaveProperty("library_document_id")
  expect(JSON.stringify(events())).not.toContain("PRIVATE_")
})
