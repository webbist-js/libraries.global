import {
  captureAnalyticsEvent,
  pushAnalyticsEvent,
  resultBucket,
  type AnalyticsParameters,
} from "@/lib/analytics-events"
import type {
  SiteSearchItem,
  SiteSearchResponse,
  SiteSearchScope,
} from "@/lib/site-search"

/** Capture consent before the request; queries and result URLs never enter the payload. */
export function captureSiteSearch() {
  const parameters = {
    interaction_source: "site_search",
    search_type: "site",
  } as const
  const searched = captureAnalyticsEvent("search", parameters)
  const results = captureAnalyticsEvent("search_results", parameters)
  const failed = captureAnalyticsEvent("search_error", parameters)
  searched()

  return {
    complete(data: SiteSearchResponse) {
      // An incomplete response cannot establish a true zero or a reliable total.
      if (data.unavailable.length) return failed()

      return results({
        result_bucket: resultBucket(
          Object.values(data.counts).reduce(
            (total, count) => total + (count ?? 0),
            0
          )
        ),
      })
    },
    failed,
  }
}

const CONTENT_TYPES = {
  libraries: "library",
  places: "place",
  journal: "journal",
  knowledge: "knowledge",
  events: "event",
  pages: "page",
} as const

export function trackSiteSearchSelection(
  item: SiteSearchItem,
  scope: SiteSearchScope
) {
  // Result keys may fall back to URLs. Only a bounded public document/key is eligible.
  const id =
    item.group === "places"
      ? item.id.match(
          /^place:(?:continent|country|region):([A-Za-z0-9_-]{1,128})$/
        )?.[1]
      : item.id.slice(item.id.indexOf(":") + 1)
  const parameters: AnalyticsParameters = {
    interaction_source: "site_search",
    content_type: CONTENT_TYPES[item.group],
    search_scope: scope,
  }
  if (id && /^[A-Za-z0-9_-]{1,128}$/.test(id)) {
    if (item.group === "libraries") parameters.library_document_id = id
    else parameters.content_id = id
  }

  return pushAnalyticsEvent("select_content", parameters)
}
