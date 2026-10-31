# Analytics after the dashboard rework

Reviewed on 29 October 2026 against the working tree and the pre-dashboard
commit `6083fc72`. This review covers the UI instrumentation, consent controller,
route exclusions, event allowlists, and the GTM configuration. The initial
connector check failed because its authorization had expired. The owner then
provided an authorized browser session; the current GA4 definitions and GTM
workspace were inspected there and the configuration delta was applied.

## What changed

Most existing instrumentation survived the route moves. Counting calls alone
would have missed the gaps: several controls moved into new components, and
article reading moved from window scrolling into an independent canvas.

| Surface                                | Review finding                                                                                                                                                                                                                                  | Resolution                                                                                                                                                                                                                       |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shared analytics provider              | Still mounted once per document, gated to production and consent. Client route views remain deduplicated; query strings, fragments and private referrers are excluded.                                                                          | Retained the provider and `lg_analytics` transport.                                                                                                                                                                              |
| Moderation                             | `/moderation` replaced routes beneath `/contribute`, exposing a gap in the original public-only controls.                                                                                                                                       | Public events remain blocked there. The owner has since requested coarse workspace measurement; see the workspace contract below.                                                                                                |
| Desktop and phone mastheads            | The desktop destination links retained metadata. Phone destination links, the Navigation/Contribute buttons, and the promoted Plans link lacked equivalent coverage.                                                                            | Restored `navigation_action` on the public controls. Toggling an already-open drawer closed does not count as another open.                                                                                                      |
| Footer links moved into Navigation     | Some links bypassed the previous instrumented components.                                                                                                                                                                                       | Applied the shared destination mapping to public menu links. Unknown/external links and private workspace destinations are not inferred from labels.                                                                             |
| Sidebar CTAs and homepage              | New Plans links with anchors and localized or absolute canonical URLs could lose attribution. The globe CTA now leads to About.                                                                                                                 | Shared canonical destination resolution; retained home pricing attribution and recorded the About destination.                                                                                                                   |
| Atlas and Find libraries               | Search, result buckets, near-me outcomes, layers, views, exports, selections and library actions are still instrumented.                                                                                                                        | No blanket restoration or renamed events needed.                                                                                                                                                                                 |
| Library records                        | Hero actions, follow/unfollow, correction/verification/photo/source outcomes and visit links retain their instrumentation. The old sidebar file still contains some helpers, but the rendered Visit component carries its own event attributes. | Retained the existing `library_action` and submission contracts. Visual relocation does not require a new event name.                                                                                                            |
| Services and networks                  | New directory/member journeys had no equivalent discovery coverage; page types fell into `other`, and country service routes could be classified as libraries.                                                                                  | Added network page types, network searches and bounded filter actions, confirmed result buckets, network selection and member-library selection.                                                                                 |
| Site search                            | The new modal had no events.                                                                                                                                                                                                                    | Added opening, debounced query requests, complete results, failures, scope changes and result selections. Pointer and keyboard selection share the same contract. Suggestions and one-character inputs do not count as searches. |
| Journal and Knowledge readers          | The body/scroll measurement used window height and missed the dashboard viewport. Modal-covered articles could continue accumulating visible time.                                                                                              | Measure against clipping ancestors and the toolbar, capture inner scrolling, and pause visible time while a dialog covers the reader. Retained the 30-second and 75%-progress threshold.                                         |
| Article header Share                   | The new clipboard button bypassed the existing article share component.                                                                                                                                                                         | Record `share` only after successful copying; use the article's public ID and type. A clipboard rejection records no share.                                                                                                      |
| Events and Community drives            | Event saves, registration/calendar handoffs, drive discovery and task outcomes remain present.                                                                                                                                                  | Retained their existing contracts. Drive sharing was intentionally removed when sharing was limited to articles; it should not be restored just to preserve old event counts.                                                    |
| Account, Staff, Contribute and miniapp | These are private or deliberately outside public GA collection. Drawer sections replace some former profile URLs.                                                                                                                               | Record bounded workspace views for account, Staff, editorial, Contribute and Moderation. Drawer views remain distinct from public page views; the miniapp stays excluded.                                                        |

An unreferenced Newsletter form is not an active signup surface. Do not add
synthetic `generate_lead` events to replace a form that is no longer displayed.
The existing beta, contact, newsletter and submission implementations retain
their success-only tracking where those forms are rendered.

## Event contract

Keep the current envelope: `event=lg_analytics`, `analytics.event_name` as the
event name, `analytics.schema_version=1`, and `analytics.transport=gtm`.
The discovery additions are compatible enum values and one optional parameter.
The workspace extension adds two event names and four categorical parameters,
using the same envelope and existing event tag; it adds no second page-view tag.

- `interaction_source` adds `sidebar`, `site_search`, `network_directory` and
  `network_members`.
- `search_type` adds `site` and `networks`.
- `content_type` adds `network`, `place` and `page` for public search results.
- `destination` adds `networks`, `about`, `legal`, `navigation`, `contribute`
  and `search`. These are fixed categories, not route strings.
- `navigation_action.action_type=filter` records site-search scope changes and
  network facet submissions without a text query.
- `search_scope` is optional on `select_content` and `navigation_action`.
  Its values are `all`, `libraries`, `journal`, `knowledge` and `events`.
- `page_type` adds `membership`, `network_index` and `network` classifications.

The site-search backend queries all groups; scope tabs filter the results in
the modal. A scope change records a filter action, not another backend search.
An incomplete backend response records `search_error`, never a false zero.
An entirely successful response records one `search_results` event with a
bucketed total. Result selections include only their public identity and type;
fallback URL-based result keys are not sent as identifiers.

Network result events describe confirmed result views, including direct URLs
with a text query. They are not a count of distinct visitors or distinct query
strings. Facet-only submissions record a filter action rather than a textual
search. No facet values or visitor coordinates are collected.

The platform intentionally omits `search_term`. Google's recommended `search`
event defines that parameter, but this implementation uses the existing event
name only for privacy-preserving counts. Search-term reports are therefore not
a promised output of this contract. Do not enable automatic query collection to
fill them.

## Configuration and release checks

The Search scope custom dimension, Version 2 data-layer variable, and existing
public-event tag mapping were applied and published on 29 October 2026. The
workspace initially had no pending changes; publication included only the new
variable and the event tag's additional parameter. The steps below describe
the applied delta and the checks to retain for the frontend release.

Check the current GTM workspace first. Apply this small delta to the current
container rather than importing an old full-container snapshot:

1. Add a Version 2 Data Layer Variable for `analytics.search_scope`.
2. Add `search_scope` to the existing GA4 public-event tag's event parameters,
   using that variable. Keep the existing consent checks, exact hostname,
   schema and transport conditions.
3. Add an event-scoped GA4 custom dimension named **Search scope**, parameter
   `search_scope`, if it is not already registered. The existing dimensions
   accept the new categorical values without being recreated.
4. Extend the existing event-name whitelist with `workspace_view` and
   `workspace_action` when applying the workspace configuration below. Do not
   add broad click/history/form triggers, a second Google tag, or automatic
   page views.
5. Review report filters: Plans now uses `/plans` and `page_type=membership`;
   services use `network_index`/`network`; drawer openings use
   `navigation_action`. Historical profile-route page views are not comparable
   to drawer opens. Segment site search by `search_type=site` and
   `interaction_source=site_search`. Annotate the actual deployment date:
   correcting network page classifications also changes the library-view
   denominator in historical comparisons.
6. In Tag Assistant/DebugView on the release candidate, verify consent grant,
   withdrawal, initial view, client navigation, phone navigation, drawer opens,
   search/zero/error/scope/selection, article reading, clipboard sharing and
   network discovery. Check for one event per interaction. Confirm that
   workspaces send only bounded categories, and `/live`, authentication, API,
   invitation and checkout routes remain outside this workspace channel.

No new key event is proposed. `library_action` still measures public library
intent; `generate_lead` remains limited to accepted beta/newsletter leads.
Menu opens, search attempts, shares and filter changes are engagement signals,
not verified visits, accepted contributions or purchases.

The Analytics connector is read-only; the authorized browser session was used
for configuration writes. Operator evidence and publication details are kept
in private workspace storage. The public-discovery and workspace configurations
are ready for the UI release. Publishing GTM does not deploy the frontend changes or prove that unreleased
UI events have arrived in production. Check the new events after deployment.

An internal-traffic exclusion was also configured for the owner's current
browser connection and its Active state was verified. The address values are
not stored in this document. Such filters apply to future incoming traffic,
not historical reports, and must be updated if the connection's addresses change.

The container still reports its denied-consent diagnostic. Live Tag Assistant
verification on 29 October showed all four defaults denied, then
`analytics_storage=granted` after acceptance while all three advertising
settings stayed denied. A GA4 Page View appeared in Hits Sent with `gcs=G101`
and `traffic_type=internal`. Refusal unloaded Google tags; navigating while
refused kept them absent. Reacceptance sent one current-route view, without
replaying the refused journey. Home to Knowledge produced two page views and
one navigation event. History-based page views and automatic click, search,
form, scroll, video and download events are disabled in the web stream.

These observations verify the consent split and sampled outgoing events; they
do not establish the exact cause or clearance date of the aggregate diagnostic.
They also do not prove processed GA4 reports for these test hits: the active
internal-traffic exclusion deliberately removes them. Keep the exclusion active.

The second-administrator recommendation was left alone. A second
administrator requires a separately chosen account and an explicit access
decision.

## Validation

Focused tests exercise the real consent controller and data-layer envelope,
plus click/submit delegation, moderation exclusions, page classifications,
pointer and keyboard site search, result deduplication, partial failures,
clipboard failure, and reading inside a clipped canvas or behind a modal.
They use an isolated browser environment, not live Google traffic. Local and
preview builds continue to skip the analytics provider.

The earlier public-discovery run passed 88 tests across 13 files. Workspace
validation is recorded below. The full UI typecheck passed after the workspace
controller integration. Focused lint has no errors; complexity/style warnings remain in some
larger existing components. All 58 protected miniapp files still match the
baseline recorded before the dashboard rework.

Staff traffic reports still require a separate, scoped reporting integration.
Restoring public UI events does not connect those reports or make consented
GA activity equal the platform's total usage.

References: [GTM data layer](https://developers.google.com/tag-platform/tag-manager/datalayer),
[custom-event triggers](https://support.google.com/tagmanager/answer/7679219),
[event-scoped custom dimensions](https://support.google.com/analytics/answer/14239696),
[GA4 event reference](https://developers.google.com/analytics/devguides/collection/ga4/reference/events).

## Workspace coverage and consent revision

The original exclusion was a conservative public-discovery scope, not a GA4
restriction. The owner requested workspace adoption and workflow measurement
on 29 October. The implementation now supports two additional events:

| Event              | Meaning                                   | Parameters                                                 |
| ------------------ | ----------------------------------------- | ---------------------------------------------------------- |
| `workspace_view`   | A route or drawer section actually opened | `workspace_area`, `workspace_section`, `workspace_surface` |
| `workspace_action` | A menu selection or workflow response     | The same categories, `action_type`, `action_outcome`       |

`workspace_area` is one of `account`, `staff`, `contribute`, `moderation` or
`editorial`. Sections are enumerated per area. Surface is `page` or `drawer`;
outcome is `intent`, `success` or `error`. Menu selections use `intent` and
never count as a completed workflow. Error events carry no response text,
status message or submitted data.

Workspace routes emit `workspace_view` instead of public `page_view`. The tag
context uses a synthetic path such as `/workspace/staff/page/events`, a generic
title and an empty referrer. Names, slugs, record/team/user IDs, invitation
tokens and query strings never enter that context. Drawer events use the same
categories and synthetic paths. Opening an account drawer does not create a
public profile page view. Reopening the same already-open section and blocked
unsaved-changes navigation produce no extra drawer view.

Coverage includes shared Staff/Contribute/Moderation navigation, masthead links
to workspaces, profile/staff/editorial drawer opening, account section changes,
non-draft submission creation/finalization, the correction wizard on workspace
routes, article submission/withdrawal, staff notice saves, staff record
publishing and moderation decisions. Async actions capture consent before
starting and report one response only while the consent and route still match.
The public correction wizard keeps its existing public success event; the
workspace channel does not emit a second success event for that public form.
Draft autosaves are deliberately not counted as submissions.

This is product analytics, not a complete audit log. Server-side submission
history, staff audit and widget audit records remain authoritative. GA totals
exclude refusals, blockers and internal traffic; do not use them to judge an
individual staff member or claim an exact count of all moderation decisions.
Team member administration, widget edits, event feed management and account
settings have categorized views and navigation coverage, but do not yet have
individual mutation-outcome events. Add those only through the same bounded
contract when those specific funnels need analysis. Pricing, checkout and API
purchase instrumentation belong to the parallel checkout work and are not
changed by this extension. The independent `/live` miniapp remains excluded.

Consent payload version 2 describes the wider purpose in English, French and
Czech. Previous version-1 grants are not reused; visitors see the new choice
before collection. Version-1 refusals stay refused. The storage key stays
stable so already-open tabs receive preference changes. Withdrawal still
clears GA cookies, disables collection and reloads to unload the SDK.

### Configuration and release acceptance

The workspace patch was built from a fresh export of the clean GTM workspace.
It adds four Version-2 data-layer variables and corresponding event-tag
parameters: `workspace_area`, `workspace_section`, `workspace_surface` and
`action_outcome`. It extends the existing exact event-name regex by the two
workspace events. The base tag, hostname, schema, transport and consent checks
are unchanged. Those four parameters are registered as event-scoped GA4 custom
dimensions; `action_type` was already registered. No key events are added.

The workspace delta was applied through the GTM editor and published as
version 4, **Dashboard analytics: consented workspace usage**. The review showed
exactly four added variables and two modified entities (the existing event tag
and trigger), with no deletions. All four event-scoped GA4 dimensions were saved
and read back; the property now has 19 definitions. Operator backups remain in
private storage. No browser or account-access permissions were changed.

Before deploying the wider collection, update the existing published
privacy/cookie paragraphs alongside the release. The
proposed replacement copy is in [workspace analytics release copy](analytics-workspace-release.md).
Publishing the application is a separate operator action. After deployment,
verify one consented workspace view, one drawer section change, a successful
submission and one refused moderation decision in Tag Assistant. Check the
synthetic URL and absence of IDs on every hit. Verify report ingestion from a
consenting, non-internal release check; do not disable the owner's IP filter to
make their own tests appear in reports.

Workspace acceptance passed 182 tests across 15 files. After consolidating
the route classifier and drawer link metadata, the relevant five-file rerun
passed all 50 tests. The final full UI typecheck passed. Focused lint reported
no errors; larger existing components retain complexity/style warnings.

The final strict-value validator rerun passed 31 tests across its three
contract, drawer and delegated-click files. All 58 protected miniapp files
match the baseline from before this rework.
