---
title: Dashboard migration inventory
description: Route ownership, functionality parity and the Atlas review gate.
---

# Dashboard migration

The dashboard now owns Atlas, Find libraries, continent/country/region pages,
library details and library service/network pages through the persistent
`[locale]/(dashboard)/layout.tsx` route group. Public URLs and page metadata still
come from their existing feature routes. Journal, Knowledge, Community, Events and Home now share that route group as well; the current batch is awaiting local review.

The HTML reference specifies layout and spatial relationships; existing
application components and behavior remain the source of truth. The review
steering replaces floating panels with panels aligned to workspace edges, makes
Contribute and profile icon-only rounded-square buttons, and replaces the account
popover with a full profile drawer.

## Route and functionality inventory

Paths below omit the optional locale prefix. Route files under
`apps/ui/src/app/[locale]` own the public pages; geography path helpers and
`lib/navigation.ts` remain authoritative.

| Family and routes                                                                                               | Current functionality to retain                                                                                                                                      | Shell destination                                                         | Batch                                      |
| --------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------ |
| `/map`                                                                                                          | Explore Search/Filters/Layers; Inspect library/stop/analysis; Map/List; mobile sheet; controls, legends, counts, feedback, contributions, plans, exports             | Global rail beside existing Atlas workspace; compact global bar on phones | A                                          |
| `/libraries`                                                                                                    | Search/filter/results, library links, empty/error recovery                                                                                                           | Discovery sidebar and main results                                        | B                                          |
| `/{continent}`, `/{continent}/{country}`, `/{continent}/{country}/{region}`                                     | Geography hero, child browsing, maps, insights, featured libraries, follows, events, drives, contribution prompts                                                    | Place navigation left, existing content main, contextual preview right    | B                                          |
| `/{continent}/{country}/{region}/{library}`                                                                     | Visit details/hours/notices, mobile stops/times, facilities, history, claims, corrections, verification, follows, events, staff actions                              | Library identity/anchors left; details main; visit context where usable   | B                                          |
| `/library-networks`, `/library-networks/{slug}`                                                                 | Directory filters, network library lists, affiliations, mandates/claims and permissions                                                                              | Network context left; existing content main                               | B                                          |
| `/{continent}/{country}/library-services[/{slug}]`                                                              | Country directory and validated canonical network redirect                                                                                                           | Preserve alias/redirect, no invented geographic ownership                 | B                                          |
| `/journal`, `/journal/search`, `/journal/{section}/{slug}`                                                      | CMS editorial composition; URL search/section/origin/sort/page/view/language; cards, article blocks, discussion, reader actions, history, author and related content | Browsing sidebar morphs to reading context; supporting metadata right     | C                                          |
| `/`, `/about`                                                                                                   | Existing homepage sections, discovery, contribution and project entry points                                                                                         | Dashboard composition after earlier gates                                 | Later                                      |
| `/community`, `/community/{suggestions,leaderboard,discussions,supporters,propose}`, drive/detail/editor routes | Discussions/moderation, suggestions/votes, rewards, drives, proposal/edit flows                                                                                      | Section sidebar; preserve forms and permissions                           | Later                                      |
| `/knowledge`, `/knowledge/search`, `/knowledge/{section}/{slug}`                                                | Documentation hierarchy, search, shared article blocks, languages and editing                                                                                        | Knowledge-specific navigation                                             | Later                                      |
| `/events`, `/events/{documentId}`                                                                               | Search/filter, geography, detail/modal, saved events and export                                                                                                      | Events-specific context                                                   | Later                                      |
| `/profile`, `/profile/{username}[/{following,badges,contributions}]`                                            | Owner/public/limited/private distinction, following, recognition, contributions                                                                                      | Large account workspace; explicit public-profile routes                   | B account workspace; public pages retained |
| `/profile/{settings,notifications,membership,onboarding}`                                                       | Privacy, notifications, security/connections/sessions, account/data, membership and onboarding                                                                       | Reuse account sections in drawer; onboarding stays a route                | B account sections; onboarding later       |
| `/contribute/**`                                                                                                | Index wizard/corrections, autosave/drafts/submissions, publishing, moderation, claims and membership aliases                                                         | Preserve workflow routes; navigation entry becomes a drawer               | Entry A; workflows later                   |
| `/staff/**`                                                                                                     | Verified library workspaces, edits, feeds, notices, traffic, networks, Team/API/billing/widgets                                                                      | Retain authorized entry points and current tools                          | Later                                      |
| `/plans`, `/membership` and membership aliases                                                                  | Catalogue, membership routing, sandbox billing                                                                                                                       | Preserve until dedicated migration                                        | Later                                      |
| `/legal[/{slug}]`, `/privacy`, `/terms`, `/email/preferences`                                                   | Legal index/documents/aliases and signed email preferences                                                                                                           | Explicit public/utility treatment                                         | Later                                      |
| `/beta`, `/auth/**`, `/live/**`, `/embed/w/{publicId}`, `/dev/**`                                               | Independent beta entrance, auth, operational console, host embeds, local previews                                                                                    | Explicit shell exceptions; unchanged by A                                 | Exception                                  |
| `/api/**`, sitemaps, robots, Markdown/text exports, public assets                                               | Existing server authorization, metadata and non-HTML contracts                                                                                                       | No dashboard shell                                                        | Exception                                  |

## Batch A control parity

| Existing control/state                                            | Dashboard placement and preservation rule                                                                                                                                            |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Home, Atlas, Find libraries, Community, Journal, Knowledge        | Real locale-aware rail links; no prototype-only replacement destinations                                                                                                             |
| Language selector                                                 | Existing selector in global navigation; preserve query parameters                                                                                                                    |
| Contribute menu                                                   | Left modal drawer; reuse `useContributeMenu` and `ContributeMenuPanel`, including combined roles, selected staff library, review counts, publishing, drives and membership           |
| Account                                                           | Existing identity, profile/following/badges, notifications, membership/support, settings, sign-out and staff/editorial tools remain reachable; Batch B now embeds the full workspace |
| About/legal and supplementary destinations                        | Navigation drawer, because Atlas hides the site footer                                                                                                                               |
| Explore Search/Filters/Layers                                     | Existing Atlas components, 400px panel/72px collapsed rail and controls retained                                                                                                     |
| Inspect and analysis                                              | Existing selected record/stop and independent analysis tabs, minimize/reopen, remove/Undo and mounted local state retained                                                           |
| Camera, projection, filters, layers, service, selection, Map/List | Existing validated URL restoration and query/data cache behavior retained                                                                                                            |
| Reach and other analyses                                          | Existing explicit calculation, scope/origin, limits, stale/pending/partial/error/unsupported/missing versus zero semantics retained                                                  |
| Map controls, key, attribution, counts, exports                   | Remain within Atlas coordinate space; global rail consumes layout width, not an overlay over the map                                                                                 |
| Mobile Explore/Inspect, Map/List and sheet sizing                 | Existing mobile workspace retained below compact global controls; safe-area behavior retained                                                                                        |
| Staff/editorial/event/contact dialogs                             | Existing global mounts and server checks retained; shell overlays must yield appropriately without discarding drafts                                                                 |
| Loading/error/empty/WebGL fallback                                | Same Atlas layout owns navigation while existing loading and recovery content renders                                                                                                |

## Implementation and gate

1. Inventory routes, controls and existing behavior before moving presentation.
2. Keep one persistent shell across the dashboard route group. The rail remains
   stationary while page context changes.
3. Reuse page components, data loaders, public URLs, metadata, permissions,
   contribution workflows and current recovery states.
4. Put geographic hierarchy/search in the left panel; maps and contribution
   context in the right panel. Library anchors occupy the left panel and the
   existing visit components occupy the right.
5. On compact screens, open section navigation in the same modal drawer contract
   as global navigation. Keep the existing Find filter drawer and Atlas sheets.
6. Tag genuine parent/child links for directional page motion. Sidebar context
   morphs in place; sibling links, filters and background refresh do not claim
   hierarchy. Native Back/Forward remains native and restores workspace scroll.
7. Exercise route/state restoration, forms, focus, dismissal, geometry,
   translations, reduced motion and browser fallback. Inspect rendered evidence.
8. Record results and remaining acceptance gaps; stop before Journal.

The global rail and page panels meet the top/bottom workspace edges. Cards inside
panels keep the established designs. Global overlays have one shell owner;
profile, staff and editorial tools supersede shell overlays. The Atlas map stays
live under its existing motion owner and is excluded from page snapshots.

Rollback is the dashboard route-group adoption and the page presentation wrappers.
The existing feature components and data loaders remain available. Account
navigation now has one profile-workspace owner rather than a popover presentation.

## Baseline constraints

The initial working tree was clean. The existing local fixture services were
unavailable; no replacement database or stack was created. Atlas rendered its
unavailable-data states before synthetic browser responses were installed.
An initial English-route redirect came from starting the dev server with a
hostname different from the configured application origin. Matching the hostname
resolved it without a routing change. Real CMS/account/entitlement acceptance
remains pending until the existing fixture services are available.

Gate results and artifacts are recorded after implementation. Sensitive local
operational details and authenticated artifacts must remain outside public docs.

## Shared shell and Batch B implementation

- `DashboardShell` composes server-owned session/header reads, `DashboardFrame`
  and the existing `MainContent`. The route group persists across Atlas,
  geography, library, directory and network navigation.
- The rail is 96px wide; below 768px it becomes a 56px compact bar with
  safe-area allowances. It uses the supplied three-book mark in the masthead’s ink
  colour, inset main-menu hover areas and an avatar that fills its button.
  The icon-only More control sits above Contribute with extra separation.
  Critical navigation icons are bundled locally.
- Native scrollbars share one global theme in `styles/scrollbars.css`: slim
  controls, muted ink thumbs and transparent tracks over the existing warm
  surfaces. Atlas/About overrides are consolidated, dark masthead controls keep
  contrast, intentionally hidden tab strips stay hidden and forced colours defer
  to system styling. No scrolling library or smooth-scroll behavior is added.
- More receives the same CMS footer sections, supplemental links and published
  policy destinations as the footer, using the root layout’s existing reads.
  One shared model preserves pricing labels and legal publication rules.
- The Atlas map key/count/view bar is content-sized and centered in the available
  map area, capped at 720px with a 14px corner radius. Its existing controls,
  legends and analysis shortcuts retain their behavior.
- Contribute reuses its existing role-aware model, library selector, counts,
  cards and destinations in an edge-aligned drawer.
- `DashboardPage` owns the fixed context/content regions. The main and context
  panels scroll independently on wider screens. Compact screens use a section
  drawer and a single page scroll area. The existing responsive components,
  headings and card designs remain in use.
- Continent/country/region loaders, count availability semantics, featured
  libraries, events, drives, place search and contribution prompts remain intact.
  Areas retain their existing filtered Find URLs; no area page is invented.
- Library correction/verification context still wraps the original page
  components. Visit information moved to the right and anchor navigation moved
  left; hours, mobile timetables, notices, history, discussions and staff actions
  keep their current owners.
- Find reuses its filters, hide/show state, mobile drawer, result views, query
  parsing, sort/pagination and error handling. Service/network directories retain
  filters, canonical country aliases, sourced relationships and authority checks.
- The installed Next runtime already supplies React's transition API. No React
  package upgrade or experimental Next flag is required. Page-level named
  transitions distinguish parent/child motion from sidebar context continuity;
  the persistent rail and live Atlas map are isolated from movement.
- Atlas and Find URL synchronization yields to accepted navigation. Delayed map
  camera/selection writes cannot cancel a move to another section, and Find
  avoids replacing an unchanged search URL during hydration. Native Next history
  state is retained.
- `useDashboardScroll` remembers workspace positions in browser memory and
  restores native history traversal. Explicit page navigation starts at the
  heading. Section-drawer anchors hand focus to their destination after closing.

## Full profile workspace

- `ProfileDrawerTrigger` replaces the old account menu in every header. One lazy
  root mount owns the drawer. Opening a person's own profile opens the workspace;
  **View public profile** explicitly opens their public route. Other people's
  public profile routes and visibility checks remain in place.
- The drawer uses the remaining workspace width. Identity sits above an underline
  section row, which scrolls horizontally at compact widths. Public-profile,
  edit, sign-out and authorized workspace actions occupy a compact toolbar;
  there is no nested vertical navigation column.
- Overview, contributions, following, recognition, notifications, membership,
  settings/privacy, sign-in/security and data/account controls reuse the existing
  feature components. Network affiliations and followed-drive cards retain their
  data loaders. Unavailable data stays distinct from an empty profile.
- The authenticated workspace read derives identity from the server session,
  returns private/no-store data, and never accepts a username as owner authority.
  The client query is keyed by actor and locale and rejects a mismatched actor.
  Account changes and session errors close the workspace without restoring old
  owner content on a round trip.
- Normal account navigation switches drawer sections without changing the page
  URL. Native/new-tab entries and provider return URLs use
  `/map?account=<section>`; the mount consumes that entry while retaining Atlas
  query state. No bookmark compatibility layer was added for the closed beta.
- Profile saves stay in the drawer, including username changes. Unsaved profile
  edits require confirmation before dismissal, changing sections, opening the
  public profile or signing out. Existing
  autosaved privacy/notification controls retain their behavior. Account deletion,
  sign-out and billing operations retain their existing server checks.
- Staff/editorial/support handoff closes the profile drawer and restores focus
  before opening the existing destination dialog. Sign-out remains reachable.

## Batch A review evidence (before Batch B)

The deterministic browser suite runs across Chromium, Firefox and WebKit,
sequentially with one worker. It covers:

- Real hydrated Atlas with public synthetic read responses.
- Direct English entry without a locale prefix, plus French/Czech journeys.
- Main-region geometry and one main landmark.
- Contribution content, modal focus containment, Escape and explicit focus return.
- Navigation destinations and nested language selection.
- 320px, 390px, 768px and 1100px layouts, plus a 1024px by 360px short viewport.
- Navigation with 200% text size and no horizontal page overflow.
- Direct library selection, reload, Map/List, native Back/Forward and preserved
  selection when changing language from French to Czech.
- No serious/critical axe findings in global navigation or the navigation drawer.

Before/after public-fixture screenshots are in ignored
`.scratch/dashboard-batch-a/`, including desktop, phone, tablet and Contribute
views. The previous shell was restored temporarily for baseline capture and the
new layout was restored automatically afterwards. GPU canvases are masked for
comparisons; the list fallback is also exercised. Firefox rendered the live map
during the interaction checks. These images are manually inspected artifacts,
not automatically accepted snapshot updates.

The baseline-only capture is excluded from ordinary test runs. The cross-section
CMS test is explicitly pending in each engine until
`QA_DASHBOARD_LIVE_CONTENT=1` is run with the existing local fixture services.
Those skips are not passing live-integration checks. Both Journal and sign-in
depend on CMS content, including the sign-in page's Journal teaser.

Verification on the Batch A working tree:

| Check                                                                     | Result                                                                                              |
| ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Full frontend unit suite, one worker                                      | 3,433 passed; 26 skipped; 476 files passed and three skipped                                        |
| Final shell/global/Atlas/layout regression run after bundled-icon changes | 179 passed in 35 files                                                                              |
| Frontend and Playwright TypeScript checks                                 | Both passed                                                                                         |
| Scoped frontend ESLint                                                    | Zero errors; five warnings for complexity, an existing image element and an Atlas hook dependency   |
| Scoped browser-suite ESLint                                               | Passed without warnings                                                                             |
| Chromium/Firefox/WebKit final gate, one worker                            | 18 passed with reduced motion explicitly verified; six skips described above                        |
| Earlier default-motion browser matrix                                     | 15 passed before the final icon changes and English-entry test                                      |
| Production compilation                                                    | Passed with `next build --experimental-build-mode compile`, one build worker and capped Node memory |

The browser suite uses synthetic public reads. Component tests exercise account,
support and staff/editorial handoff, including route/account changes; these do
not replace the live role and entitlement matrix. The full unit run logged
external icon-service connection failures while exiting successfully; the new
shell's critical controls now use bundled icons.

Compilation disabled source-map uploads temporarily and restored the original
Next configuration afterwards. It validates the optimized client/server output,
not full prerender/release acceptance. The installed Sentry integration warns
that this experimental build mode is not fully supported; its existing
configuration deprecation warnings remain. No release or deployment was made.

Reproduce the frontend checks with `pnpm --filter @repo/ui typecheck` and
`pnpm --filter @repo/ui test` using `NODE_OPTIONS=--max-old-space-size=4096`.
The browser command and fixture restrictions are documented in
`qa/tests/playwright/README.md`. Run finite checks sequentially.

## Release acceptance and lessons

- Run the CMS-dependent cross-section journey and the appropriate real fixture
  role/entitlement, account-switching, export and calculation acceptance suites.
- Measure production bundle size, layout shift and interaction timing with the
  representative content/analysis fixtures before setting release budgets. Dev
  server timings and synthetic fixtures are not a production performance pass.
- Keep the container-width rule, explicit focus opener and primitive-owned portal
  layers when adding the geography and Journal sidebars. These were concrete
  issues found during this gate.
- Reassess rail width and compact navigation with real usage before extending the
  shell. At 1440px desktop width, the new main region starts at x=112/y=0 and
  occupies the full viewport height; the old header consumed 57px above it.

## Batch B review evidence

This working tree is based on `6083fc72a813fc0396ad1bfaa561feea0621356e`
(`codex/atlas-dashboard-shell`); changes remain uncommitted for review.

The gate covers the shell steering, complete profile drawer, all location levels,
library details, Find and service/network routes. Existing page components,
loaders and permissions remain authoritative.

| Check                                                              | Result                                                                                              |
| ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| Full frontend unit suite, one worker                               | 3,459 passed; 26 skipped; 480 files passed and three skipped                                        |
| Frontend and Playwright TypeScript                                 | Both passed                                                                                         |
| Scoped frontend ESLint                                             | Zero errors; remaining complexity, image and Atlas dependency warnings                              |
| Scoped browser-suite ESLint                                        | Passed without warnings                                                                             |
| Chromium/Firefox/WebKit acceptance, one worker                     | 45 passed; three deliberate baseline-capture exclusions                                             |
| Real CMS cross-section journey                                     | Passed in all three engines with the live-content gate enabled                                      |
| Map-toolbar evidence after completing the synthetic record payload | Firefox follow-up passed                                                                            |
| Production compilation                                             | Passed with `next build --experimental-build-mode compile`, one build worker and capped Node memory |

The final browser gate includes native Back/Forward and scroll restoration,
explicit hierarchy motion, drawer focus and dismissal, 200% text, compact layouts,
missing-library recovery and zero serious/critical axe findings in the checked
navigation/panels. Profile saves, dirty dismissal and return links use existing
components with a synthetic account/API fixture. Owner-read unit tests cover
session identity, private caching and unavailable/missing data; real account-role,
entitlement and provider billing acceptance remain separate release checks.

Firefox 146 has a partial native transition API without transition types. Its
hierarchy/history journey verifies the immediate functional fallback. Chromium
and WebKit verify directional animation, with reduced-motion and unsupported-API
cases also exercised. Headless Chromium's WebGL fallback exercises List/history;
map-capable engines exercise the centered map key, its popover and view controls.
These capability paths are annotated in the browser tests.

The CMS journey exposed a delayed Atlas URL write canceling outgoing navigation.
Atlas and Find now yield URL synchronization to accepted route changes; Find also
skips unchanged initial-state replacements. The corrected cross-section journey
and the full browser matrix pass. Private account actions and canceled dirty-edit
navigation do not announce a route departure.

Public and synthetic-account screenshots are in ignored
`.scratch/dashboard-batch-b/`; Atlas controls and map-key evidence are in
`.scratch/dashboard-batch-a/`. Representative desktop, phone and tablet images
were inspected. GPU canvas pixels are hidden temporarily during capture so the
controls above them remain visible. These are review artifacts, not automatically
accepted production baselines. Authenticated customer state is excluded.

Compilation disabled source-map uploads temporarily and restored the original
Next configuration byte-for-byte. It verifies optimized client/server compilation,
not full prerendering, real provider flows or production performance. Existing
Sentry experimental-build/configuration warnings remain. The full unit suite
also logged external icon-service connection errors while exiting successfully.

Batch B stops at its review gate. Journal has not been migrated. No release was
promoted. The existing local app/CMS/search services remain available for review.

## Motion research and scrollbar follow-up

The current page policy uses ancestry-based Link transition types and page-level
React ViewTransition boundaries. The masthead persists; named context regions
morph and content uses the existing 60px/400ms directional recipe. Atlas retains
its separate panel-motion owner. Native browser history restores workspace scroll
without an explicit directional type. Reduced motion and partial browser APIs
retain functional navigation.

This matches the [current Next.js approach](https://nextjs.org/docs/app/guides/view-transitions).
[Automatic Link prefetching runs in production](https://nextjs.org/docs/app/api-reference/components/link),
so cold development navigation is not a production performance measurement.
Loading UI and Suspense boundaries must follow the same shell as adoption expands.
The homepage keeps its toolbar in `HomepageFrame`, with its server data and
content inside a Suspense boundary. `PageLoader` assembles the shared three-book
mark while that content is pending: back book, middle, front, then the square
cut-out. It loops without holding up ready content, pauses off-screen or in a
hidden tab, and shows the completed static mark for reduced motion. Other route
loading templates retain their existing page-shaped skeletons. The isolated
animation is available in Storybook under `Patterns/PageLoader`.
The user confirmed the existing motion now feels better, so this follow-up keeps
the transition engine and adds no animation dependency.

[Motion](https://motion.dev/docs/react-layout-animations) remains an option for
local, interruptible layout interactions. Adding another router wrapper currently
offers little benefit: [next-view-transitions](https://github.com/shuding/next-view-transitions)
documents limits around Suspense/streaming, while
[next-transition-router](https://github.com/ismamz/next-transition-router) also
intentionally excludes native Back/Forward transitions.

The scrollbar/logo follow-up was inspected in Chromium, Firefox and WebKit using
public pages and the navigation drawer. Native wheel scrolling and geometry
passed; the logo resolves to the same ink colour as the masthead. Hidden Atlas tab
strips remain hidden, and Chromium forced-colour emulation restores automatic
system scrollbar colours. The Firefox test environment reports scrollbar width as none even
against inline requests; its resolved theme colours and scrolling were verified,
without overriding browser visibility preferences. Screenshots and the style
report are under `.scratch/dashboard-batch-b/scrollbar*`. Root-layout ESLint and
formatting passed. The earlier full unit/browser/compilation evidence predates
this styling-only follow-up.

## Location refinement preview

The library and place redesign references now inform a shared record layout:
compact context identity and parent navigation, a breadcrumb/action toolbar,
contained hero, separate recorded-data metric tiles, supporting actions and
modular content panels. `DashboardPage` owns the responsive overview / aside /
sections slots. `RecordContextIdentity`, `RecordToolbar` and `RecordMetrics`
share the presentation across library, continent, country and region pages;
Atlas and Find retain their existing exploration layouts.

Library pages reuse the existing media switch, opening-hours logic, facility
answers, correction workflow, claims/staff tools, community, source credits and
export/citation actions. Contribution and drive widgets adapt to the supporting
rail. Services and record gaps sit alongside each other when space permits.
Source/status/reuse panels split according to available content width. Mobile
and digital library branches remain in place. Counts describe recorded data;
no sample figures or interactions from the mockup were substituted for live
content.

Place pages move the existing map into the hero, retain contextual search and
child coverage browsing, and move detailed index breakdowns after discovery.
Region library search/filtering precedes sub-area browsing and featured national
libraries. The national-library guidance now refers to its position below the
results. Country service/network navigation remains available in the overview.
The shared Find loading boundary no longer renders an extra global header.

This is a visual review gate. The full unit/E2E/build suite is deliberately
reserved for the location wrap-up. Targeted ESLint reports no errors (existing
complexity and hook warnings remain). Frontend TypeScript checking passed.
A local Chromium review checked Europe,
England, Greater London, Alexandria, Abbey Wood Library and Bibliotheca
Alexandrina; all returned 200 with one main landmark and no page errors.
Library/region layouts were inspected at 390, 768, 1100, 1440 and 1680 pixels
without horizontal page overflow. Section drawers, place filtering/sorting,
Next history-state preservation, photo/map switching, citation navigation and
unsent facility-answer selection were inspected. No contribution was submitted.
Local screenshots and review reports are under `.scratch/dashboard-refinement/`.
The headless browser used the WebGL fallback, so live map rendering remains a
manual browser review item.

## Editorial and hierarchy refinement

Section sidebars and mobile section drawers share a fixed heading, a single
scrolling middle and a fixed bottom CTA. The Knowledge filter header stays
visible while the guide tree scrolls. Journal subscription content lives in the
middle, leaving its primary contribution CTA at the bottom. Browser-history
restoration targets the middle scroller. Site search stays in page toolbars;
the masthead contains navigation and account actions.

Location context rails now show page anchors and a clickable, bounded place /
library hierarchy instead of a second child-place menu. A place-specific Add a
library / Propose a drive card remains at the bottom, with the real submissions
link. Published library previews use one bounded, locale-scoped index query;
ancestors and available counts come from the existing page data. Active and empty
drive panels now live in the supporting rail. Unknown statistics remain unknown.

Journal and Knowledge public routes, readers, search screens and loading states
now share the persistent dashboard layout. URL paths and editorial data loaders
remain intact. Journal browsing uses collection, section and writer navigation;
the reading rail adds reading progress and related stories. Knowledge reuses the
existing searchable/collapsible guide tree. Reader actions, translation handling,
body rendering, history, discussions and previous/next guide links remain with
their existing feature owners.

Journal has an optional, non-localized `entriesAdded` integer for editorial data
releases. It is absent from contributor forms and only exposed as a count badge
for Index-origin articles. Data-drop previews use the existing Data section and
a bounded language-scoped query. Existing records are not populated by parsing
numbers from their text.

Journal also has a localized repeatable `sources` field using the new
`content.article-source` component: title, optional HTTP(S) URL, publisher,
access date and note. It supports print-only references. CMS writes and reviewed
submissions share source validation and canonicalization; submitted component IDs
are discarded. Citations round-trip through editor drafts, recovery, translation
loading, review previews, revision comparison and publication snapshots. The
public sidebar renders only authored sources and stays absent for empty lists.
Ordinary article-body links are not promoted into citations. No published
articles were edited or backfilled as part of the interface change.

Focused validation passed: frontend and CMS typechecks; 45 UI tests, 44 CMS
tests and 13 shared citation tests. Desktop and mobile browser checks covered
location hierarchy, Journal/Knowledge reader navigation with a persistent shell,
section drawers, reading progress, overflow and search keyboard controls. The
full regression suite remains deferred for the review gate. Headless map views
used the existing WebGL fallback, so map interaction still needs manual review.

### Search discovery inventory (before batch C)

The earlier batch introduced a shared search placeholder. Batch C replaces it with the working search described in [Site search](site-search.md). Search remains in page toolbars and the ordinary public header; the masthead search button was removed during review.

The configured public Meilisearch indexes are `library`, `blog-article`,
`wiki-article` and `event`. Their current searchable fields support:

| Result group              | Available presentation                                                                                                                       | Additional work for the sitewide modal                                                                                     |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Libraries                 | Name/alias, type, summary, city, place hierarchy, image and record route; recorded visitor details where the public projection provides them | Reuse the locale-scoped index and existing canonical route builder                                                         |
| Journal                   | Title, summary, author, section, date, image, locale and reading time                                                                        | Reuse public Index/community metadata; add `entriesAdded` to the index allowlist if counts should appear in search results |
| Knowledge                 | Title, summary, section/category, locale and reading time                                                                                    | Reuse existing index; add any extra public status metadata explicitly                                                      |
| Events                    | Title, summary, library/place, date/time/timezone, type and price/free status                                                                | Reuse existing reviewed upcoming/ongoing event visibility predicate and event modal/deep-link owner                        |
| Places                    | Continent, country, region and area names, ancestry and recorded-library counts                                                              | Add a dedicated public place projection so places with no library records remain discoverable                              |
| Library services/networks | Name, type, country/region and public member/service context                                                                                 | Add a bounded public network projection and canonical routes                                                               |
| Drives                    | Name, focus, public scope, active dates and accepted progress                                                                                | Add an active/published public drive projection                                                                            |
| Discussions               | Approved public discussion title, subject and contextual library/article                                                                     | Add a moderation-aware projection; exclude pending/private messages and reports                                            |
| Profiles                  | Public username/display name and opted-in public roles/activity                                                                              | Add a visibility-aware projection; never search account email, private preferences or staff-only affiliations              |
| Site destinations         | Atlas, Find, plans, contribution routes, help and legal pages                                                                                | Maintain a small translated destination catalogue                                                                          |

A first implementation can federate the four existing indexes into grouped,
bounded results with locale selection, keyboard navigation and stable record
links. Current Journal/Knowledge search covers title/summary/taxonomy metadata,
not complete article bodies or the new citation text. Rich snippets, body search,
source matching, extra groups and personalized recent/followed items require
explicit public projections and separate design decisions. Existing result
limits, draft/public boundaries and profile/moderation privacy rules continue to
apply.

## Dashboard batch C

Community now has persistent section navigation, an owner-only standing card and contextual contribution actions. The existing noticeboard, leaderboard, voting, discussion moderation, drive participation and supporter privacy flows retain their routes and permission checks. The contribution drawer uses the existing capability model, real submission counts and library selection; its centre scrolls independently of the membership footer.

Journal now shares the contained hero and pill controls used by Knowledge. Featured stories, contributor field notes and data updates use published article metadata. Counts appear only when `entriesAdded` is supplied on an Index article. Reader sidebars order the contents, article metadata, managed sources and index context. Find libraries and Events use the same fixed-width filter rail and footer CTA; their search, filter, calendar and modal flows remain owned by the existing feature components. Home joins the persistent shell and retains its data-driven globe, published counts and content sections.

[Site search](site-search.md) documents the server projection and result boundaries. Its [Knowledge article draft](proposals/site-search-knowledge-article.md) stays unpublished until release acceptance. No production content or deployment is part of this batch.

Journal also supports shortest-read sorting before pagination and Save for later. Saved IDs are kept in versioned browser storage (up to 100); the Saved view resolves them through the existing public article browse API, so withdrawn articles are excluded. They are not synced to an account.

### Batch C local review evidence

Frontend typecheck and touched-file lint passed (complexity warnings remain).
Focused public-search, account-drawer, contribution-permission, event, discovery
and locale suites passed, alongside the shared article-browse tests. Two local
Playwright regressions exercise the real search endpoint and keyboard/recent-query
flow without mocking route imports. The live CMS returned shortest-read results
in ascending reading-time order after reloading the rebuilt shared dependency.

Desktop review covered each Community section, Journal landing/reader/Saved,
Knowledge, Find, Events and Home. Section rails measured 320px; phone views at
390px had no document overflow. Drawer footers remained fixed while their centres
scrolled. A normal Chrome session confirmed the signed-in profile drawer and
homepage globe; headless Chromium could not create the globe's WebGL context.
The full regression suite, production acceptance and article publication remain
release-gated.

## Dashboard batch D: Staff and Contribute

Staff and Contribute now share the persistent dashboard route group. URLs stay
under `/staff` and `/contribute`; route-module imports include `(dashboard)`.
Both workspaces use a 320px section sidebar with a fixed identity, scrolling
navigation and a pinned guidance card. On phones the same navigation and CTA
open in the section drawer. Search remains in the content toolbar.

Staff destinations cover Your libraries, Services & networks, Members &
libraries, Billing & seats, Widgets, API access and Claim a library. Team tools
appear for Team members; the existing server checks still distinguish members,
organisers, verified service scopes and library staff authority. Opening a staff
library changes the sidebar to its record tools, including mobile-only live
sharing. The single-library overview is now accessible without an automatic
redirect. Library cards show real health checks and canonical slug-based actions.
Unavailable summaries retain unknown values rather than showing zero work.

The contribution hub separates quick record tasks from written articles. Quick
fixes load the existing structured correction or photo editor, including source
validation, photo licensing, saved drafts and review submission. Skip rotates the
opportunities locally; opening and closing an editor moves focus to the work and
back to its trigger. Drafts and requests for changes resume through the existing
actor-owned submission flow. Accepted/pending totals come from the server count
endpoint, not the four recent submissions shown in the supporting rail. Tier,
points and progress use the existing rewards service.

Knowledge editing, moderation, submissions and membership remain full working
sections. Their existing locale gates, review scopes, no-self-review checks,
withdraw/revision controls and account-change guards are retained. Membership
reuses the personal billing and recognition dashboard. Team billing, API key
creation/revocation, widgets, affiliations and claims keep their existing APIs
and permissions; mockup sample prices, keys, usage and approvals are not fixtures.

The source of the visual reference is `Library dashboard redesign (5).zip`.
`Contribute.dc.html` is the current contribution design; `Contribute v1.dc.html`
is an older alternative. Mockup scripts describe interaction intent only.

### Batch D local review evidence

125 focused tests pass across staff overview/onboarding/not-found behavior,
mobile-library tabs, Team management, API controls, contributor permissions,
Knowledge locale handling, moderation, submission navigation, membership and
the contribution menu. Touched-file lint has no errors; existing complexity
warnings remain. The UI typecheck passes. The full suite was not run.

Desktop review covered the signed-in Team-only state, Team members and coverage,
and the contribution hub. Phone review at 390px covered Team navigation, billing,
membership and the hub: one main landmark, no document overflow, and a section
drawer whose middle scrolls while its footer stays at the bottom. Opening and
closing correction editors moves focus to the work and back to the originating
action. Actual CMS records populate quick fixes; mobile timetables and confirmed
facility answers are included when calculating missing sections. Existing
verified-library states are exercised by the focused component tests. Review did
not send invitations, change assignments, publish records, pay invoices or create
API keys. No production content or deployment is part of this batch.

### Staff/Contribute final state pass

The masthead now includes Staff for hydrated library staff and Team members
(including lapsed Teams that still need their billing/workspace). A paid plan,
editorial role, moderator role or pending claim alone does not expose it. The
same destination appears in the mobile/More menu. Short mastheads keep the brand
and Profile/Contribute controls fixed, with only their middle destinations
scrolling. Section sidebars remain 320px; their footers include bottom safe-area
clearance.

Verified active Team-only accounts retain the Add a library sidebar action,
using the same eligibility rule as the staff overview. Team membership, role,
status and covered-library changes now invalidate the private account boundary.
Library-specific navigation also works for records resolved beyond the capped
session summary; it retains mobile-only controls, review counts and Team locks.
Mobile record drawers include the library identity and a return to Your libraries.
Long identities are clamped visually while retaining the complete accessible text.

Skipped quick fixes have an explanatory empty state and a restore action; focus
stays on usable controls. Photo tasks keep their action through sign-in. Failed
resume-work and Team-summary reads explain what happened rather than inventing
an empty queue or an inactive/unverified Team. Mobile library suggestions use
Stops & times in the Index editor as well as the hub.

The shared membership-link normalizer now preserves `/contribute/membership`;
it was previously sending the contribution drawer's live account link to Plans.
Public pricing and transactional checkout destinations retain their behavior.

The final focused checks cover 119 UI tests and 18 shared-link tests. Browser
review confirms the 320px sidebar, fixed footer and independently scrolling
masthead at 1280×600, phone navigation at 390px, Escape/focus restoration and
closing the mobile drawer when the desktop sidebar returns. Role combinations
and unavailable data are exercised with isolated fixtures; the signed-in local
Team account was used for browser checks. No memberships, records, invitations,
payments or API keys were changed during review.

The final UI typecheck and shared-data build pass. Lint reports no errors;
existing complexity/style warnings remain. The full regression suite was not run.

The masthead and mobile/More menu also include Moderation for users with the
`moderate.queue` capability, including scoped moderators. This shortcut points
to the existing moderation workspace and respects its queue permissions.

Scrollbars now enter through the global stylesheet, including embedded pages.
Chromium/Safari use the shared rounded thumb, hover and pressed colors; Firefox
uses the same theme with its native thin scrollbar. Intentional hidden tab-strip
scrollbars and forced-color preferences remain supported.

Staff and Editorial drawers use the shared edge-aligned presentation: a 440px
right panel on desktop, full width on smaller screens, a fixed header/footer
and a scrolling middle. Their edge tabs and keyboard shortcuts remain. On-demand
workspaces stay mounted through the Radix exit animation, then release their
private state. Session/role changes reset the retained workspace immediately.

Shared drawer and modal motion uses transform/opacity, a 240ms entrance and
160ms exit, with no animation under reduced motion. Related routes retain their
directional transitions; unrelated sections crossfade. Context rails retain
native view-transition morphing. Profile, contact, event, correction, drive-task,
Atlas-plan and beta-welcome close/handoff paths allow the exit to complete.

The masthead sits above drawers and below modal dialogs. Dashboard drawer
backdrops leave the desktop rail visible; on phones, panels and backdrops fit
between the top masthead and bottom navigation, including safe-area insets.
Focus moves without scrolling the page. Hierarchical page transitions combine
a 32px directional move with concurrent fades (240ms movement, 150ms exit,
220ms entrance); there is no blank interval between the two pages. Unrelated
sections crossfade and reduced-motion preferences remove these animations.

Loading fallbacks now share the dashboard rail, pinned CTA, toolbar and current
card/reader layouts. Location/library/network routes, Events, Community and
Contribute have fallbacks; Knowledge and Journal no longer add obsolete inner
sidebars. Staff loading uses its contained hero and persistent navigation.
Search, profile and event placeholders match their result/summary/list shapes.

This pass passed 129 focused tests across 18 files. Desktop and phone browser
checks covered fixed drawer geometry, middle-only scrolling, close/focus return,
profile-to-editorial handoff, search dismissal and themed scrollbars. The full
regression suite remains deferred to the final review gate.

Route focus targets are declared in heading markup. The dashboard scroll helper
falls back to the persistent main landmark for streamed headings that are not
yet focusable, avoiding pre-hydration DOM attribute mutations. Loading rails
do not expose mobile drawers containing placeholder navigation.

The final UI typecheck passes. Focused lint has no errors; complexity and
dependency warnings remain. Existing local applications were reused.

Moderation now lives independently at `/moderation`, including submission reviews,
staff review details, discussion review and suggested additions. It has its own
account boundary, queue sidebar, toolbar and pinned reviewer guidance. Queue
pages register their existing server-filtered views with the sidebar, preserving
counts and filtered return links without a second navigation row. The Contribute
drawer retains an authorized shortcut, while its section tabs stay focused on
contribution work. Masthead, editorial tools, notifications, email links and
role-application destinations point to the independent section.

Query-only queue navigation dismisses the mobile section drawer and completes
the global navigation indicator. The focused checks cover role scopes, private
page access, queue return filters, own-section navigation and generated
notification destinations; the full regression suite remains deferred.

## Final public pages and phone layout

About, Plans and Legal now share the dashboard layout with the other public
sections. Legal documents retain their standalone shell when reached outside the
closed-beta gate. Their text, revision history, contact links and print action
are unchanged. Authentication, email actions, the beta entrance, host embeds and
the mobile live console remain independent utility surfaces.

Networks follows Libraries in the masthead. Navigation places Plans and pricing
above the supplementary destinations. About, Legal and network sidebars also
link to relevant contribution or Team actions; the homepage keeps its plan
comparison section.

The network directory keeps name, kind, country and region filters. Member
library pages now filter the entire published network before pagination, with
text, country, region, library type, all selected recorded facilities and
name/update sorting. Totals describe matching records. Facets describe the
network independently of the current filter. The member map shows the current
result page and links to the full network in Atlas. Unknown facilities remain
unknown. Public projections do not include staff affiliations or review evidence.

Phone layouts use bottom shortcuts for Atlas, Community, Contribute, Journal
and the existing profile drawer. The top menu retains Find libraries, Networks,
Knowledge and permission-filtered workspaces. Top-bar breadcrumbs show the
immediate parent as a compact back link; complete hierarchy is available in
section navigation. Library and location pages add horizontally scrollable
section chips. Drawer headers and footers stay fixed around the scrollable
middle. Sidebar CTAs use compact, content-width actions and retain phone touch
targets and safe-area spacing.

Physical library pages separate Opening hours from Plan your visit. Visit
contacts and official links precede the address, transport and admission details.
The hours metric links to the hours section. Source credits use a dedicated
component; attribution and licence details remain available, with record IDs and
field coverage behind each source disclosure.

The miniapp remains outside the dashboard route group. Changes to phone website
navigation are scoped to dashboard classes, not the live console, its host
routing, authentication, timetable, offline installation or operational controls.

Knowledge corrections are in `dashboard-guide-content.mjs`. The production
helper previews every guide in English, French and Czech, refuses unrelated
drafts and stages body-only changes with before-images and read-back checks.
It never publishes. The search guide remains a separate release draft in
[Searching Libraries Global](proposals/site-search-knowledge-article.md).

Public profile routes also share the dashboard shell. Their existing overview,
contributions, following and recognition tabs retain the same privacy checks.
The account photo opens the personal profile drawer; Public profile remains an
explicit page destination. Authentication and recovery pages keep a focused
utility shell rather than a dashboard masthead.

### Remaining-route audit

Onboarding now uses the dashboard masthead, toolbar, section navigation and
responsive reading canvas. Its profile form, visibility controls, account guard
and save actions are retained. Initial entry uses the shared logo loader.

Direct `/profile`, `/profile/settings`, `/profile/notifications` and
`/profile/membership` requests open the corresponding account drawer on the
Atlas. Locale and query parameters are preserved, including billing returns.
Public `/profile/[username]` pages remain full dashboard pages. Account forms
are shared with the drawer rather than rendered through a second site header.

The remaining pages outside the dashboard have specific reasons to stand alone:

- `/auth/*`: sign-in, registration, verification and recovery flows.
- `/beta`: the public beta-access gate.
- `/email/preferences`: token-based email preferences, with no-referrer metadata.
- `/live/*` and `/embed/w/[publicId]`: the mobile console and embedded widgets.
- `/dev/*`: development previews, unavailable in production.
- `/membership`, `/terms` and `/privacy`: redirect-only entry points.

Error and missing-page screens retain their utility layouts. Feature pages
inside the dashboard inherit their section shell; nested task pages do not add
another masthead. The standalone mobile console is unchanged.

### Page transitions

The persistent dashboard shell owns one Suspense boundary. During navigation it
keeps the current, revealed page until the destination is ready; initial entry
uses the existing logo loader. Route-level skeleton boundaries would interrupt
this handoff and should not be reintroduced. Feature-local loading states still
belong to their controls and results.

`DashboardRouteTransition` pairs content canvases, including Atlas. Its nested
sidebar and toolbar boundaries exclude those controls from the moving snapshot.
Atlas-to-place content slides left, with the destination entering from the right;
returning to Atlas reverses it. Geographic ancestry uses a subtle 32px
horizontal slide and fade, reversed for parent destinations. Other section links
use 24px vertical slides and fades, following the visible sidebar order. The
shared link reads that order on mouse, keyboard or touch intent, including CMS
and permission-dependent navigation. Query-only and anchor changes do not trigger
page movement. Browser history without a transition type uses a quiet crossfade.

The global rail remains live outside the snapshots. Canvas snapshots clip at
its edge, the record toolbar stays anchored, and section navigation stays in
place for every transition. Switching sections replaces its contents immediately. Atlas names its individual panels only during
its own internal transitions, so map controls can move with the content during
route changes. The Explore sidebar remains anchored while its contents are replaced. Reduced-motion CSS removes animation durations; unsupported
browsers and stable React embeds retain normal navigation without animation.
