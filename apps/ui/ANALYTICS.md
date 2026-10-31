# Platform analytics

GA4 measures consented public-site and workspace activity. It does not represent all visitors, verified newsletter members, published contributions or paid memberships. Application records remain the source for operational and financial totals.

The measurement ID is `G-8M465CHXJ6`, hardcoded in `src/lib/google-analytics.ts`. The existing production gate requires `NODE_ENV=production`, `APP_ENV=production`, `APP_PUBLIC_URL=https://libraries.global` and the exact browser origin. Local and preview builds do not install the controller or click listeners.

## Consent and privacy

The controller starts denied and loads no Google script before grant. The built-in EN/CS/FR banner offers equally accessible accept/reject actions and a persistent Cookie choices control. It restores the saved choice only after controller installation. The first-party `lg.analytics-consent.v1` localStorage entry contains only the analytics choice, schema version and expiry, lasting 180 days. Missing, invalid or expired choices start denied. Withdrawal sets the disable flag, removes `_ga`/`_ga_*` cookies and reloads the document to unload Google code; other tabs observe preference changes. Essential beta/account storage is preserved. This is a first-party basic-consent implementation; it requires no vendor account.

Public page views and discovery events share the same route policy. Auth, API, profile, Staff, contribution, live, development and email routes are excluded from public discovery, including locale prefixes. Community proposal, new-drive and drive-editing routes are also excluded. Workspace measurement uses the separate categorical contexts below. The optional checkout channel has its own route, payload and release gates.

Payloads use a runtime allowlist of names, fixed categorical values and public content/library IDs. Link targets/text, form values, visitor coordinates, search terms, private record IDs, email addresses and user IDs stay out of event fields. Marked search forms check only whether the query is nonempty; no query value is sent. Page location contains only origin and pathname; page titles are categorical and external referrers contain only origin. Public entity context is accepted only when its server-rendered marker matches the current route.

Async actions capture consent and route at request start. Only a confirmed successful response can count; failures, stale search responses, navigation, withdrawal/regrant and requests started before consent are discarded. A request cannot replay its completion. Measurement failures cannot change an accepted application outcome; existing tabs without the new controller methods skip measurement. Geolocation records request/success/denied/unavailable without position data. Honeypot submissions do not count as conversions.

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

### Homepage layout changes

The homepage search and Near me controls retain their `home` attribution and
existing consent-aware request/completion handling. Moving the pricing section
does not retire its interest metric: the closing Plans link and the staff
section’s Team-plan link emit `membership_interest` with `home_plans` and
`action_type=compare`. Published pillar, Journal, event and drive links use
`select_content` with public IDs; public section links use `navigation_action`
with `interaction_source=home`. Each link has one delegated analytics marker.
The carousel’s movement, decorative globe and fictional reach illustration emit
no passive events. No query text, link labels, coordinates or private staff IDs
are added to the payload.

The contribution invitation uses `navigation_action`, source `home`, destination
`contribute` for both the visitor’s registration link and the member’s contribution
link. This measures contribution intent, not successful account creation. Drive
cards retain `select_content` with the public drive ID; browsing the manual drive
carousel emits no event.

## Emission and GTM ownership

Use `pushAnalyticsEvent` for immediate explicit actions, `captureAnalyticsEvent` before async operations and `analyticsAttributes` for selected server-rendered links/buttons or search forms. Add event names/fields and fixed values to `src/lib/analytics-events.ts` before using them; do not add generic click, form or URL extraction. `prepare` is a controller method used by the async helper.

GTM owns collection. Each accepted action queues one sanitized data-layer event in this form; the app does not send a parallel direct Google analytics event:

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
      transport: "gtm",
    },
  }
)
```

GTM container `GTM-M8GLG9F2` is the single collection owner. The app emits no direct `gtag("config")` or `gtag("event")` commands. It queues consent defaults and updates before loading the container, following [Google’s basic consent-mode sequence](https://developers.google.com/tag-platform/security/guides/consent?consentmode=basic). Only analytics storage can be granted; advertising storage, ad user data and personalization stay denied.

On the first allowed consented page, sanitized `lg_analytics_ready` context initializes the native Google tag before manual `lg_analytics` events. Both GTM triggers require `analytics.transport=gtm`, schema version 1 and the exact production hostname. The event trigger allowlists the public catalogue and the two workspace event names below. Both native tags require `analytics_storage`. There is no noscript iframe or pre-consent Google preload. Configure the base tag with `send_page_view=false`, `cookie_expires=15552000` (180 days), `cookie_update=false`, Google signals disabled and ad personalization disabled.

The container is a separate release artifact: its reviewed draft must be published before production collection is considered enabled. Never reintroduce the direct loader alongside it.

Keep Enhanced Measurement history, scroll, outbound, site search, form, video and download events disabled for this stream. `send_page_view:false` does not suppress history-based Enhanced Measurement. Disable Google signals and ad personalization. All GTM collection tags must require `analytics_storage` and use the exact production hostname.

## Workspace measurement

`workspace_view` records an opened account, Staff, Contribute, Moderation or
editorial surface. `workspace_action` records an explicit selection or workflow
outcome. Both use the allowlists in `src/lib/workspace-analytics.ts`:
`workspace_area`, `workspace_section`, `workspace_surface`, and, for actions,
`action_type` and `action_outcome`. They share the consented `lg_analytics`
transport with public events, but replace private locations with a generic
workspace address and categorical title. They never send private record IDs,
form contents or account identifiers. Billing, invitations and API keys remain
outside the workspace channel.

Consent schema version 2 asks again before using an earlier acceptance for this
wider purpose. Earlier refusals remain valid. GTM version 4 includes these two
event names and their bounded parameters. See the [UI review](../docs/docs/analytics-ui-review.md)
and [matching disclosure copy](../docs/docs/analytics-workspace-release.md) for
the configuration record and production verification still required after deployment.

## Pricing and checkout funnel

`CHECKOUT_ANALYTICS_ENABLED=true` enables a separate `lg_checkout` data-layer channel. It defaults off. The existing production origin/build gates and explicit analytics consent still apply. Before enabling it, publish the matching cookie/privacy disclosures and reviewed GTM configuration. The regular public channel continues to exclude private page views and Staff activity.

Only `/plans`, `/staff/teams/new`, `/staff/teams/billing`, `/developers`, `/developers/keys`, `/developers/usage`, the legacy `/staff/teams/api` entry and `/contribute/membership/checkout` can emit these checkout events, with locale prefixes handled. Pricing actions are restricted to `/plans`. Checkout context uses the virtual location `/checkout`, a categorical title and an empty referrer. Actual private routes, queries, Team names/IDs, account IDs, email, provider/session IDs, form values, seat counts and amounts are excluded.

| Event              | Trigger                                                                                                   |
| ------------------ | --------------------------------------------------------------------------------------------------------- |
| `pricing_action`   | Explicit billing-period, Team-open/close, service-type, API selection or continue action                  |
| `begin_checkout`   | Personal checkout starts, annual Team review opens, or API consent review opens                           |
| `checkout_step`    | Personal billing review opens, Team creation succeeds or the organiser explicitly continues to API review |
| `checkout_handoff` | A successful checkout response is about to navigate to Stripe                                             |
| `checkout_error`   | Checkout fails; no error message or provider detail is sent                                               |

Fields are fixed `product`, `billing_interval`, optional `api_addon`, `billing_mode`, `action_type` and `checkout_step`. `billing_mode` is included where the caller has an authoritative mode; otherwise it is omitted. `begin_checkout` also carries public product IDs in `analytics.items`. Handoffs and errors use the same captured-consent rules as other async events. A handoff does not mean payment succeeded.

GTM must handle `lg_checkout` separately, require analytics consent, schema version 1, transport `gtm` and the exact production hostname, and allowlist only these five names. Map `analytics.event_name` to the GA4 event name, map the fixed fields above, and map `analytics.items` to the `items` event parameter. Keep automatic tracking disabled. Preview refused consent, withdrawal, private-route exclusions and duplicate prevention before publishing. Register product/interval/add-on/mode/step dimensions only if needed for reports.

There is deliberately no `purchase` or `refund` emission. Those need a settled invoice, a stable transaction identifier and deduplication, including consent handling across provider returns. Never emit `purchase` from a return URL, an already-active membership, a checkout click or a subscription renewal snapshot. Google documents the recommended ecommerce events and transaction fields in [Measure ecommerce](https://developers.google.com/analytics/devguides/collection/ga4/ecommerce?client_type=gtm). Application and Stripe records remain the financial source of truth.

## Reports and acceptance

`library_action` and `generate_lead` are the configured GA4 key events. Use measured sessions with a library detail view as the denominator for library action rate, scoped to the same dates, stream and consented population. Read search success/error counts separately and distinguish lead acceptance from verification. Public-discovery dimensions are `page_type`, `interaction_source`, `action_type`, `content_type`, `search_type`, `result_bucket`, `submission_type`, `content_locale`, `destination`, `target_locale`, `layer_name`, `view_mode`, `format`, `selection_mode` and `search_scope`. Workspace dimensions add `workspace_area`, `workspace_section`, `workspace_surface` and `action_outcome`.

Do not register public library/content IDs as ordinary custom dimensions across the whole catalogue: high cardinality can collapse reports into `(other)`. Team traffic remains a separate server-side reporting task with authorised library scope and completeness checks; this PR does not expose property-wide GA access or implement that dashboard.

Before production activation, verify a consent-refused visit sends no tag or event, grant emits one sanitized page view, withdrawal blocks further collection, clears analytics cookies and unloads Google code, and navigation into private routes suppresses events. Verify explicit events once in GA DebugView/Realtime using a consented test visit after normal release promotion. No production test traffic is sent by the automated source tests.

## Beta release sequence

1. Review and merge the candidate PR into `dev`; review a release PR into `main`. Preserve the invitation gate and sandbox billing.
2. Prepare and publish matching CMS cookie, privacy and beta disclosures, preserving unrelated content and revision history. The current policy promises advance notice for material changes; review that obligation before activation. The new analytics processing must be disclosed and explicitly opted into before it starts.
3. Confirm the native GTM mappings, consent checks, hostname/schema/transport filters, disabled automatic tracking and 180-day cookie settings. Preview before publishing the accepted container version.
4. Verify exact-main checks/images and the operator’s required backup/isolated-data/rollback acceptance. Confirm the deployed revision and service health.
5. In a fresh beta browser, verify no Google request/storage before consent or after rejection. Accept once: verify one sanitized page view and each sampled action once. Change public routes/locales; visit private routes; withdraw and reload; verify no later collection and no analytics cookies. Repeat a saved rejection and cross-tab withdrawal. Confirm mobile layout and keyboard access.
6. Confirm representative consented events in GA DebugView/Realtime, then use the read-only MCP for bounded report checks after processing. Empty reports do not establish zero platform usage. Record exact source/container revisions and evidence privately.

Verify the selected property's event/user retention and reset behavior before publishing a disclosure. Record configuration reads privately and state the accepted values in the CMS notice. Aggregate reporting, cookie expiry and GA data retention are separate controls; a previous configuration read is not proof of current settings.
