# Public platform analytics

GA4 measures consented public-site activity. It does not represent all visitors, verified newsletter members, published contributions or paid memberships. Application records remain the source for operational and financial totals.

The measurement ID is `G-8M465CHXJ6`, hardcoded in `src/lib/google-analytics.ts`. The existing production gate requires `NODE_ENV=production`, `APP_ENV=production`, `APP_PUBLIC_URL=https://libraries.global` and the exact browser origin. Local and preview builds do not install the controller or click listeners.

## Consent and privacy

The controller starts denied and loads no Google script before grant. The selected cookie provider must restore saved choices after the controller mounts, call `window.librariesGlobalAnalytics?.setConsent(true)` on grant and `setConsent(false)` on withdrawal, and own persistence and analytics-cookie removal. This change does not install a cookie provider or enable collection by itself.

Page views and events share the same route policy. Auth, API, profile, Staff, contribution, live, development and email routes are excluded, including locale prefixes. Community proposal, new-drive and drive-editing routes are also excluded. Public membership marketing under `/contribute` remains excluded; home and Atlas plan links measure interest before entering that route. No checkout, payment or account events are emitted.

Payloads use a runtime allowlist of names, fixed categorical values and public content/library IDs. Link targets/text, form values, visitor coordinates, search terms, private record IDs, email addresses and user IDs stay out of event fields. Marked search forms check only whether the query is nonempty; no query value is sent. Page location contains only origin and pathname; page titles are categorical and external referrers contain only origin. Public entity context is accepted only when its server-rendered marker matches the current route.

Async actions capture consent and route at request start. Only a confirmed successful response can count; failures, stale search responses, navigation, withdrawal/regrant and requests started before consent are discarded. A request cannot replay its completion. Geolocation records request/success/denied/unavailable without position data. Honeypot submissions do not count as conversions.

## Event catalogue

| Event                                   | Implemented trigger                                                                                          | Parameters beyond common page context and `interaction_source`                  |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| `page_view`                             | Consent grant on an allowed page, then completed route changes; no query-only duplicate                      | Optional public library/content ID                                              |
| `library_action`                        | Directions, official site, catalogue, joining, booking and plan-visit links                                  | `action_type`, `library_document_id`                                            |
| `library_follow`                        | Confirmed follow/unfollow response                                                                           | `action_type`, `library_document_id`                                            |
| `search`                                | Explicit nonempty Find, home, Journal or Knowledge search submission                                         | `search_type`; no query                                                         |
| `search_results`, `search_error`        | Latest committed search resolves or fails                                                                    | `search_type`, success-only `result_bucket`                                     |
| `select_content`                        | Library grid/list/map, Atlas pin/search/recent/list, article result, public drive link or loaded event modal | `content_type`, public `content_id`/`library_document_id`, optional `view_mode` |
| `near_me`                               | Explicit location request and outcome, or clearing it                                                        | `action_type`                                                                   |
| `generate_lead`                         | Accepted beta request or newsletter subscription response                                                    | `submission_type`; acceptance is not verified email ownership                   |
| `submission_success`                    | Accepted public contact/feedback, library verification or contribution response on an allowed route          | `submission_type`                                                               |
| `correction_open`                       | User opens a library correction/verification panel                                                           | `action_type`, optional library ID from page context                            |
| `atlas_action`                          | Layer, filter, list/map view or projection action                                                            | `action_type`, optional `layer_name`/`view_mode`                                |
| `atlas_export`, `export_blocked`        | Successful response handed to the browser download, or server returns entitlement denial                     | `format`, `selection_mode`; no selected-ID array or file contents               |
| `content_engaged`                       | Journal/Knowledge article body reaches 75% after at least 30 seconds in a visible tab                        | `content_type`, `content_id`; once per consented article view                   |
| `share`                                 | Clipboard write succeeds or X share handoff is activated                                                     | `content_type`, optional public content ID, `method`; no shared URL/title       |
| `event_action`                          | Confirmed save/unsave, registration link, calendar subscription or ICS handoff                               | `action_type`, optional public event ID                                         |
| `drive_action`                          | Accepted task response on a public drive page                                                                | `action_type`, public drive ID                                                  |
| `membership_interest`, `upgrade_prompt` | Public home/Atlas plan CTA or explicit upgrade prompt                                                        | `action_type`; intent only                                                      |
| `mobile_service_action`                 | Timetable link, public stop selection or stop-calendar handoff                                               | `action_type`, optional public library/stop ID                                  |
| `navigation_action`                     | Selected main navigation entry or locale switch                                                              | `action_type`, `destination` or `target_locale`                                 |

Atlas typing/autocomplete, passive camera movements, automatic view fallbacks and restored correction drafts are not actions. No Atlas share affordance currently exists. Registration, calendar, X and download events are handoffs, not proof that the external task completed. Search-result buckets are `zero`, `one`, `two_to_ten`, `more_than_ten`; network failures are not zero-result searches.

## Emission and GTM migration

Use `pushAnalyticsEvent` for immediate explicit actions, `captureAnalyticsEvent` before async operations and `analyticsAttributes` for selected server-rendered links/buttons or search forms. Add event names/fields and fixed values to `src/lib/analytics-events.ts` before using them; do not add generic click, form or URL extraction. `prepare` is a controller method used by the async helper.

The direct Google tag is currently the only collection owner. Each accepted action produces one `gtag("event", name, sanitizedParameters)` and this consented data-layer envelope:

```js
window.dataLayer.push(
  { analytics: null },
  {
    event: "lg_analytics",
    analytics: {
      event_name: "library_action",
      interaction_source: "library_hero",
      action_type: "catalogue",
      library_document_id: "PUBLIC_DOCUMENT_ID",
      page_location:
        "https://libraries.global/en/europe/example/region/library",
      page_referrer: "https://libraries.global/libraries",
      page_title: "library",
      page_type: "library",
      content_locale: "en",
      schema_version: 1,
      transport: "direct",
    },
  }
)
```

The unpublished GTM container `GTM-M8GLG9F2` is reserved for the consent-provider migration. Its base tag expects `lg_analytics_ready`, which this implementation does not emit. Both draft triggers additionally require `analytics.transport=gtm`, schema version 1 and the exact production hostname. The event trigger allowlists the catalogue's event names and the native tag maps explicit data-layer fields; both tags require `analytics_storage`. The current `transport=direct` envelope cannot fire those draft tags.

Before publishing GTM event tags, replace the direct loader and sends in one reviewed change, add supported Consent Initialization defaults/updates, supply sanitized base context, switch the envelope transport to `gtm`, then emit `lg_analytics_ready` with that context before the first manual page view. Preserve route suppression and sanitized SDK context, including for automatic SDK engagement. A parallel GTM installation would double collection.

Keep Enhanced Measurement history, scroll, outbound, site search, form, video and download events disabled for this stream. `send_page_view:false` does not suppress history-based Enhanced Measurement. Disable Google signals and ad personalization. All GTM collection tags must require `analytics_storage` and use the exact production hostname.

## Reports and acceptance

`library_action` and `generate_lead` are the configured GA4 key events. Use measured sessions with a library detail view as the denominator for library action rate, scoped to the same dates, stream and consented population. Read search success/error counts separately and distinguish lead acceptance from verification. Fourteen event-scoped dimensions are registered in GA: `page_type`, `interaction_source`, `action_type`, `content_type`, `search_type`, `result_bucket`, `submission_type`, `content_locale`, `destination`, `target_locale`, `layer_name`, `view_mode`, `format` and `selection_mode`.

Do not register public library/content IDs as ordinary custom dimensions across the whole catalogue: high cardinality can collapse reports into `(other)`. Team traffic remains a separate server-side reporting task with authorised library scope and completeness checks; this PR does not expose property-wide GA access or implement that dashboard.

Before production activation, verify a consent-refused visit sends no tag or event, grant emits one sanitized page view, withdrawal blocks further collection and removes provider-owned cookies, and navigation into private routes suppresses events. Verify explicit events once in GA DebugView/Realtime using a consented test visit after normal release promotion. No production test traffic is sent by the automated source tests.
