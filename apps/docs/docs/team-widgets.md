---
title: Team widgets
description: Team-owned library selections, widget publication, public rendering and Strapi authority.
---

# Team widgets

The staff section at `/staff/teams/widgets` lets active Team members create library finders, directories, comparison charts and statistic cards. Widgets use published platform records; uploads and arbitrary user datasets are outside this release. The Team API add-on is not required.

## Ownership and source selection

A reusable library selection holds source definitions, explicit additions/exclusions, comparison groups and membership mode. A widget adds its presentation and publication history. Multiple widgets can reference the same selection.

Sources include covered Team libraries, Library Networks, manually chosen published libraries and bounded catalogue filters. Approved personal staff assignments can be imported into a fixed selection. Pending claims do not qualify. A Team organiser can confirm a primary network for new-widget defaults without changing the Team's covered libraries, claims or staff permissions.

Follow-source selections resolve current public membership. Fixed selections pin library identities while their published facts refresh. Changing a shared definition updates widget drafts; each published revision keeps the definition copied at publication. New public service members can join public widgets automatically. Staff authority for additions follows the implemented service batch-review workflow; widget selection never fulfils a claim.

The initial interface supports English, Czech and French content selection. Missing published translations fall back to English with a record-level notice. Opening information describes regular recorded hours and links to the original record for temporary changes; widgets do not assert live opening status.

## Strapi storage and authority

The access plugin owns four private collection types: `widget-selection`, `widget`, `widget-release` and `widget-audit`. They have no generic public REST routes. Team records hold a primary-network reference and an operator-managed branding entitlement.

Next routes under `/api/staff/team/{teamId}/widgets` resolve the Better Auth session, enforce same-origin writes, apply request/rate limits and allowlist fields and paths. Dedicated Strapi controllers verify the server bridge secret. The widgets service rechecks current membership and Team status on every operation and serialises writes under the existing Team advisory lock.

| Actor                   | Allowed actions                                                                                                          |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Active member           | Create/edit selections and widget drafts, duplicate, preview, request organiser review and inspect published embed code. |
| Active organiser        | Member actions plus publish, manage exact allowed origins, restore to draft, pause, unpublish and archive.               |
| Inactive Team organiser | Read retained work and pause, unpublish or archive.                                                                      |
| Anonymous visitor       | Consume an available published projection, subject to the environment's beta/staging gates.                              |

Draft saves require the current version. Conflicts retain local edits and offer loading the current server version or reapplying local changes for review. Publishing validates the current configuration, source data, licences and origins, creates an immutable release and changes the live pointer atomically. The public address stays stable. Restoring creates a separate selection/draft, without changing the live pointer. Archive retains a tombstone; public IDs are never reassigned.

The optional Widget branding entitlement is granted/revoked from the existing CMS Team editor. It is checked at save, publication and delivery. It can remove the Powered-by line, but never map attribution or source credits. No new commercial price or checkout is implied.

## Public delivery

`/embed/w/{publicId}` is a standalone document and hosted view, without account providers, site navigation or tracking scripts. Strapi returns only allowlisted published facts, effective branding and current source credits. It excludes private Team fields, member identities, draft configuration, evidence and unresolved/excluded record references.

Published membership and record revisions are checked on each load. Populated public facts have a bounded process cache with a 30-second maximum retention; publication/membership checks precede cache reuse. Dataset redistribution permissions, Team expiry, widget state and branding are rechecked independently. Unknown or restricted redistribution blocks publication/delivery rather than silently dropping credits or records.

Only the exact standalone embed route receives a per-widget `frame-ancestors` policy. Exact HTTPS origins are required in production; loopback HTTP origins are allowed for development. Previously published origins remain allowed to frame a neutral unavailable card after pause, lapse, unpublication or archive; the separate data check still denies all library facts. Normal pages keep their existing framing policy, and beta/staging gates still run first. A CSP-blocked frame cannot render a fallback card, so copied snippets include a hosted-view link outside the iframe.

The optional `/embed/resize.js` helper accepts resize messages only from the script's origin and the matching iframe window/public ID, with bounded integer heights. The sender verifies its parent origin. Without the helper, the fixed-height iframe remains usable. Geolocation is requested only after a visitor click and stays in page memory; denial leaves town search available.

## Data interpretation and bounds

Maps and lists use the same selected records, including records without coordinates. Comparisons distinguish recorded yes, recorded no and unknown values. Percentages use recorded answers as their denominator and include a table alternative. Named groups may overlap.

Engineering safeguards are distinct from commercial allowances:

- 2,000 selected libraries and 2,000 total comparison-group assignments per selection.
- 100 stored widgets and 100 reusable selections per Team, including retained work.
- 10 source definitions, 12 comparison groups and 20 exact allowed origins.
- Paginated staff/visitor lists and a 50-revision history view.

Oversized selections require narrowing and never silently truncate. Usage shows lifetime data-load counts, not unique visitors. Blocked-frame counts are incomplete browser CSP reports. Widgets do not store visitor identities, searches, locations or page URLs; normal request limiting uses the application's existing transient limiter.

## Verification

Build shared contracts and the access plugin before generating types; Strapi loads the plugin's compiled schema exports. After schema changes, run `pnpm generate:types` in `apps/strapi`.

The feature tests cover authority, publication/version conflicts, fixed versus live sources, unpublication, licences, branding, privacy, geolocation denial, translations and resize validation. The opt-in `qa/tests/playwright/e2e/access/widgets.spec.ts` uses the existing local Team fixtures and checks the real Strapi-backed creation/publication flow, narrow layouts, external framing, restoration and pause.

The local framing fixture uses `/usr/bin/openssl` on macOS/Linux to create a temporary self-signed HTTPS certificate. Its disposable Chromium process accepts that fixture certificate; the application still enforces its ordinary origin policy. Fixture keys are removed after the run and never stored in the repository.

Use the repository's existing database and at most one Next.js/Strapi server. Local browser tests should use the same hostname as the Next server and configured application URL. Do not run a headless Strapi fixture writer alongside a running Strapi server.

The broader service, affiliation and grouped-claim implementation is documented in [Library Networks](library-networks.md).
