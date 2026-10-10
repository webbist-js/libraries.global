# libraries.global — Project Context for Claude

## What We Are Building

**libraries.global** is a comprehensive global index of libraries — every significant public, national, academic, monastic, parliamentary, and cultural library in the world. The goal is a definitive, navigable reference: every institution findable by continent → country → region → area → library, with rich detail pages for each entry.

This is not a search engine or aggregator. It is an atlas. The aesthetic and UX echoes scholarly reference works — a **light, accessible "warm paper" design** (v2, Sept 2026): ink-on-paper typography, indigo accents, borders over shadows, honest empty states. The pre-2026 dark "cartographic night" theme is retired.

**Core product pillars:**

1. **Atlas** — hierarchical location-based browsing (continent → country → region → area → library)
2. **Map** — interactive MapLibre GL globe with drill-down, clustering, and pin detail panels
3. **Search** — MeiliSearch-powered full-text search across all libraries
4. **Knowledge** (`/knowledge`, formerly Docs/Wiki) — platform knowledge base: how-tos, contribution guides, data and API. Stored as Strapi `wiki-article`, filed under `wiki-section` (the taxonomy: `name`, `slug`, `description`, `order`, `icon` as an Iconify id; the tint comes from `order` via `tintForOrder`). An article's home section is its `section` relation; the editor's extra picks in `docsSections` list it under more sections. `/knowledge` shows four pages per section with "Show all" to the section's tab (`?section=slug`); helpers in `components/docs/docs.config.ts`
5. **Journal** (`/journal`) — editorial content. Stored as Strapi `blog-article`

6. **Contribute** (`/contribute`) — moderated corrections, new libraries, library claims and edits, event feed connections, Knowledge and Journal suggestions, role applications, reviewed by community Moderators at `/contribute/moderation`; the hub adapts to the user's capabilities (see Future Goals §3)
7. **User profiles** (`/profile/[username]`) — tier, points, streaks, badges, activity and followed libraries, with Public / Limited / Private visibility and per-part privacy toggles
8. **Staff area** (`/staff`): a hidden section for a library's approved staff: publish record edits, decide community suggestions, post Notices, connect event feeds and, for Mobile libraries, keep the timetable and go live from the `/live` console; reachable from any page through the Staff Drawer (`Alt+S`). Teams (`/staff/team`) let a library service's organiser assign colleagues to its libraries

**Planned pillars (not yet built):** 9. **Events** — library events calendar with provider integration (see Future Goals)

---

## Scale target

**Build for every library on earth: about 2.9 million records.** Today there are hundreds, but the aim is the complete index, so every feature must still work at that size. Reasoning: `docs/adr/0004-design-for-three-million-libraries.md`.

Rules for new code:

- **Never load every library at once.** No endpoint, page, sitemap, build step or browser view may fetch, hold or loop over the whole library table. Cap every read at a fixed limit, or page through it.
- **Page by keyset, not offset.** Walk large tables with `id > after` in id order (see `/libraries/slugs` and its `meta.next`). A deep `start=` offset gets slower the further in it goes.
- **Count in the database.** Use grouped SQL (`utils/library-tally.ts`, `utils/library-location-counts.ts`) or `documents().count()`; never fetch rows only to count them in JS.
- **Ask Meilisearch the questions.** Filtered counts, facets, viewport (`_geoBoundingBox`) and "near me" queries go to the `library` index, not to Strapi row scans. Find libraries asks for one page plus facet counts (`apps/ui/src/lib/find-search.ts`) over fields the index derives for it (`apps/strapi/src/utils/library-search-fields.ts`: open-now hours, `needs` (every Gap key), completeness, a globe grid cell, and created/verified timestamps). Take totals from a facet count (the `locale` facet): `totalHits` stops at the index's `maxTotalHits` of 1,000.
- **Split outputs that grow with the index.** Sitemaps are an index of 10,000-URL files (`lib/sitemap/`); exports are capped by `limits.exportRows`.
- **Index what you filter or sort on.** Any library column used in a filter or sort needs a database index and, if it drives search or maps, a Meilisearch filterable attribute.
- **Bulk imports bypass per-row paths:** write in batches and reindex Meilisearch in batches, not one Document Service call and one sync per library.

Known places that don't meet this yet: the Atlas downloads every library (`GET /libraries/atlas`). It is replaced by the vector tiles plan in `docs/superpowers/plans/2026-09-30-atlas-vector-tiles.md`. Don't build new features on this endpoint.

Two bounded scans to keep bounded: Mobile stops live in their own Meilisearch index, `mobile-stop` (one document per mapped stop, timetable and place data only, no account ids or staff names; `utils/mobile-stop-index.ts`). The Atlas, Find libraries and Area pages page it with `stop_id > last` and take counts from facets, and `seed:mobile-stops` rebuilds it per vehicle in pages of 50. The hourly `mobile-local-midnight` job refreshes only the Mobile libraries whose local midnight has just passed: it filters `timezone $in` the zones now at 00:xx, pages by `id > after` and batch-loads Notices per page, on the `libraries.library_type` index. Never widen either to every library.

---

## Monorepo Structure

```
libraries.global/
├── apps/
│   ├── ui/            — Next.js 16 frontend (App Router)
│   ├── strapi/        — Strapi v5 CMS (headless backend + admin, custom plugins:
│   │                    content-moderation, rewards, topics, events,
│   │                    library-staff, mobile-libraries, access)
│   └── sync-worker/   — events provider sync worker (Eventbrite, Spydus, Solus,
│                        Aspen, iCal, TicketSource, WeGotTickets)
└── packages/
    ├── access/         — @repo/access: capabilities, entitlements, limits (pure TS)
    ├── strapi-types/   — Generated TypeScript types from Strapi schemas
    ├── events-crypto/  — AES-256-GCM shared encryption for provider credentials
    ├── event-providers/ — @repo/event-providers: Source Provider fetch/test code, shared by Strapi and the sync worker
    ├── design-system/  — shared theme css consumed by both apps
    └── shared-data/    — shared static data
```

**Package manager:** pnpm with workspaces.

---

## Tech Stack

### Frontend (`apps/ui`)

- **Next.js 16** — App Router, RSC-first, `server-only` guards on data fetching
- **TypeScript** — strict mode
- **Tailwind CSS v4** — utility classes; avoid arbitrary values unless necessary; use `T` tokens for inline styles
- **Better Auth** — authentication layer, backed by Strapi users-permissions; supports credentials + OAuth (GitHub, Google)
- **MeiliSearch** — search index (`library` index, client at `lib/meilisearch.ts`)
- **MapLibre GL** — dynamically imported map library for interactive globe/map views
- **Three.js** — continent globe canvases (`ContinentGlobeCanvas`, `ContinentDotCanvas`)
- **next-intl** — i18n routing and locale support
- **Strapi Blocks Content** — renders Strapi rich-text blocks (`StrapiBlocksContent`)
- **Framer Motion** (used selectively for scroll/fade animations)
- **@iconify/react** — icon library

### Backend (`apps/strapi`)

- **Strapi v5** — content API, draft/publish, i18n, custom field plugins
- **Custom field plugins:** `global::location-picker`, `global::timezone`, `global::opening-times`
- **Draft & Publish** enabled on all content types
- **i18n** enabled — `en` primary locale, others planned

### Infrastructure

- Strapi local dev: `http://127.0.0.1:1337`
- Media served from Strapi uploads or external CDN

---

## Data Model

The content hierarchy is strict and must be respected in all routing and UI:

```
Continent
  └── Country (iso2, capitalCity, regionTypeLabel, mapConfig)
        └── Region (typeLabel, mapConfig, areas, heroImage)
              └── Area (typeLabel)
                    └── Library ← core entity
```

Each Country's Place Labels (`regionTypeLabel`, `regionsSectionLabel`, `areaTypeLabel`, `areasSectionLabel`) say what it calls its Regions and Areas (Canton, County, District). They are UI only; `placeLabels(country, region)` in `components/location/location-page.helpers.ts` reads them. A Region can name its own Areas (`areaTypeLabel`, `areasSectionLabel` on Region, set from the place import profile's `regionLabels`: Greater London and the six metropolitan counties have boroughs, not districts), and that wins over the country's. A label edit, by hand in admin or from the import, reaches Find libraries only after `pnpm --filter @repo/strapi seed:meilisearch`.

### Library schema (core fields)

| Field                                       | Type                   | Notes                                                                                                                                                                   |
| ------------------------------------------- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `name`                                      | string                 | i18n                                                                                                                                                                    |
| `slug`                                      | uid                    | not i18n (stable across locales)                                                                                                                                        |
| `entityRef`                                 | string                 | unique global ref (e.g. `GB-BL-001`)                                                                                                                                    |
| `libraryType`                               | enum                   | National, Public, Academic, University, Parliamentary, State, Municipal, Special, Monastic, Archive, Private, Cultural, Digital, Mobile, Other                          |
| `operationalStatus`                         | enum                   | open, temporarily_closed, permanently_closed, seasonal, appointment_only, planned, unknown                                                                              |
| `operatorType`                              | enum                   | National Government, Regional Government, Municipality, University, Religious Institution, Private Foundation, Independent, Volunteer Managed, Community Managed, Other |
| `foundedYear` / `openedYear` / `closedYear` | string                 |                                                                                                                                                                         |
| `location`                                  | custom field           | lat/lng via `global::location-picker`                                                                                                                                   |
| `openingTimes`                              | custom field           | structured schedule via `global::opening-times`                                                                                                                         |
| `timezone`                                  | custom field           |                                                                                                                                                                         |
| `featured`                                  | boolean                | marks "Pillar Institutions" — the most significant libraries per location                                                                                               |
| `collectionStats`                           | component (repeatable) | structured stats (volumes, manuscripts, etc.)                                                                                                                           |
| `libraryStats`                              | component (repeatable) | operational stats (visits/year, staff, etc.)                                                                                                                            |
| `services`                                  | relation (m2m)         | linked `service` entries                                                                                                                                                |
| `amenities`                                 | relation (m2m)         | linked `amenity` entries                                                                                                                                                |
| `accessibility`                             | relation (m2m)         | linked `accessibility` entries                                                                                                                                          |
| `iiifEndpoint`                              | string                 | IIIF manifest endpoint for digital collections                                                                                                                          |
| `lastVerifiedAt`                            | datetime               | last human-verified date                                                                                                                                                |
| `gaps`                                      | JSON array             | missing completeness sections, from the `@repo/shared-data` registry; recomputed with `completeness` by `refreshLibraryCompleteness`                                    |
| `verifiedSections`                          | JSON                   | not i18n; per-section last-verified stamps (hours, status, address, contact) from approved Verifications and edits; the latest feeds `lastVerifiedAt`                   |

**URL pattern:** `/{continentSlug}/{countrySlug}/{regionSlug}/{librarySlug}`

---

## Frontend Architecture

### Routing

All routes are under `app/[locale]/`. Key routes:

| Route                                                 | Component                                                                                                                       |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `/`                                                   | HomePage                                                                                                                        |
| `/libraries`                                          | FindLibraryPage (faceted search/browse — "Find libraries")                                                                      |
| `/community`                                          | Noticeboard: community drives (CommunityPage)                                                                                   |
| `/community/leaderboard`, `/community/suggestions`    | Leaderboard; option votes (moved out of Contribute)                                                                             |
| `/community/drives/[slug]`                            | DriveDetailPage (a Drive's page: task panel, Your part)                                                                         |
| `/community/drives/new`, `/[slug]/edit`               | DriveBuilder (editorial board only: create, edit a Drive)                                                                       |
| `/community/propose`                                  | DriveBuilder (proposal mode: propose a drive)                                                                                   |
| `/[continent]`                                        | ContinentDetailPage                                                                                                             |
| `/[continent]/[country]`                              | CountryDetailPage                                                                                                               |
| `/[continent]/[country]/[region]`                     | RegionDetailPage                                                                                                                |
| `/[continent]/[country]/[region]/[library]`           | LibraryDetailPage                                                                                                               |
| `/map`                                                | Atlas: AtlasExplorer (MapLibre GL full-screen)                                                                                  |
| `/knowledge/[section]/[slug]`                         | DocsArticlePage (Knowledge article)                                                                                             |
| `/journal/[section]/[slug]`                           | BlogArticlePage (Journal article)                                                                                               |
| `/contribute/index`, `/new`, `/[slug]`                | Index editor: find a library, add one, improve a record                                                                         |
| `/contribute/knowledge`                               | Knowledge editor landing: write new / edit existing                                                                             |
| `/contribute/knowledge/new?type=`                     | Article editor (TipTap) for a new Knowledge or Journal article                                                                  |
| `/contribute/knowledge/[slug]`, `/journal/[slug]`     | Article editor for an existing article, incl. translations                                                                      |
| `/contribute/knowledge/apply?role=`                   | Role Application: apply to be a Knowledge or Journal editor                                                                     |
| `/contribute/moderation`, `/[documentId]`             | Moderation queue and review page (Moderators only)                                                                              |
| `/contribute/moderation/suggestions`                  | Option suggestions (editorial board only)                                                                                       |
| `/staff`                                              | Staff area index: your libraries as cards, "Your team" card                                                                     |
| `/staff/[slug]`                                       | Staff shell (`StaffShell`): Overview, then the tabs below. Staff pages are addressed by the library's slug; APIs by document id |
| `/staff/[slug]/edit`, `/notices`, `/traffic`, `/team` | Edit record (the Index editor in staff mode), Notices, Traffic (Team), Team (Team)                                              |
| `/staff/[slug]/timetable`, `/live`                    | Timetable editor and Go live tab (Mobile libraries only; 404 otherwise)                                                         |
| `/staff/[slug]/events`                                | Event feeds: a library's feeds; `/connect`, `/[feedId]/replace`, `/[feedId]/organisation` (Eventbrite OAuth)                    |
| `/staff/team`                                         | Team organiser (`TeamOrganiser`): invite, assign, remove; members see it read only                                              |
| `/staff/team/join/[token]`                            | Accept a team invite (the signed-in email must match)                                                                           |
| `/live`, `/live/[documentId]`                         | Mobile live console: pick a vehicle; one library's console (phone-first, no site chrome, own manifest and CSP)                  |
| `/auth/*`                                             | Auth flows (sign in, register, OAuth, reset password)                                                                           |

`/staff/**` and `/live/**` are hidden sections: `robots: { index: false, follow: false }` in their layouts, disallowed in `app/robots.ts`, never listed by `lib/sitemap/`, and 404 for anyone who is not staff of that library (`loadStaffPage` in `lib/staff/server.ts` is the server authority; signed out goes to `/auth/signin?callbackUrl=`). They render no Contribute tabs. The old `/contribute/staff/**`, `/contribute/events/**` and `/staff/invite/[token]` routes are deleted with no redirects (pre-launch).

### Data fetching

- All data fetching happens in RSC page components via `lib/strapi-api/content/server.ts`
- Client components receive data as props — no client-side Strapi calls
- Map pin data fetched client-side via `/api/map/*` endpoints (for real-time filtering)
- Search uses MeiliSearch client directly from the browser

### Auth

- **Better Auth** manages the session cookie (JWE, 30-day cache)
- Auth is backed entirely by Strapi users-permissions
- Custom plugins: `strapiAuthPlugin` (credentials), `strapiOAuthPlugin` (OAuth → Strapi JWT sync), `strapiSessionPlugin` (validates Strapi JWT on every session access)
- Session includes `strapiJWT` for making authenticated Strapi API calls on behalf of the user
- Auth pages: `/auth/signin`, `/auth/register`, `/auth/forgot-password`, `/auth/change-password`

---

## Access model

Three axes that never mix (spec: `docs/superpowers/specs/2026-09-26-access-contribution-pro-implementation-design.md` §3; role grants and moderation: `docs/superpowers/specs/2026-09-29-community-moderation-and-audit-design.md` §3; pricing: `docs/superpowers/specs/2026-09-27-pricing-and-membership.md`):

| Axis                                                            | Source                                                                       | Governs                                                                   |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| **Contributor Role** + **Library Claims**                       | `role-grant` rows, `library-affiliation`                                     | **Capabilities**: what you may submit, edit directly, connect or moderate |
| **Tier** (Points)                                               | rewards plugin                                                               | Contribution quotas and earned Pro only. Never trust.                     |
| **Plan** (`public`, `free`, `pro`, `team`; `supporter` planned) | Entitlement grants, verifications, earned Pro, Team membership; `paid` later | **Entitlements**: Pro features and limits                                 |

**Money never buys trust:** no plan or entitlement changes a role, points, tier, badges or moderation. `CapabilityInput` has no plan fields, and type-level tests in `packages/access` fail if one is added.

- **Roles come from Role Grants** (`api::role-grant.role-grant`), not from Strapi Users & Permissions roles (every account holds the U&P `Authenticated` role, which guards nothing) and not from Strapi admin roles. A grant gives one person one role, with `queue` (`all`, `index`, `knowledge`, `journal` or `applications`; read only for `moderator`), `scopeLocale` (`null` means every locale; read for `moderator`, `wiki_editor` and `journal_editor`; stored under that name because `locale` is reserved by Strapi), `source` (`admin`, `claim`, `application`, `migration`), `grantedBy`, `reason` and `expiresAt`. A person's roles are the union of their unexpired grants, so one person can hold several, each with its own scope. Staff add and expire grants in the Content Manager. Code writes them only through `createGrant` in `apps/strapi/src/utils/role-grants.ts`: an approved Library Claim (`grantVerifiedLibrarian`, `source: "claim"`) and an approved Role Application (`source: "application"`). `erase-account.ts` deletes them with the account.
- **`user-profile.contributorRole` is derived** and is for display only: the highest unexpired grant in `CONTRIBUTOR_ROLES` order (`highestRole`), with `isVerifiedLibrarian` true when a `verified_librarian` grant exists. Only `syncDerivedRole` writes them, run by the `role-grant` lifecycle (`src/lifeCycles/roleGrant.ts`) and by a daily cron for grants that expired (`resyncExpiredRoleGrants`). A boot migration (`migrateContributorRolesToGrants`, core-store guarded) turned every earlier `contributorRole` into a global grant. Never decide access from `contributorRole`.
- **Contributor roles:** `reader` (no grants), `contributor`, `verified_librarian`, `wiki_editor` (Knowledge: `docs.directEdit` in its locales), `journal_editor` (Journal: `journal.directEdit` in its locales), `moderator` (Moderation Scopes only: the queue and locale of each grant) and `editorial_board` (both editors in every locale, moderates every queue, and alone decides option suggestions). An editor's approved article change publishes at once in a locale they hold; anyone else's approved article lands as a Strapi draft (or a new draft article) unless the Moderator chooses **Approve and publish**.
- **Moderators** are community users with a `moderator` or `editorial_board` grant. They review on the site at `/contribute/moderation` (Future Goals §3; `docs/adr/0005-moderation-runs-in-the-frontend.md`). Strapi re-reads the caller's grants on every moderation request and checks each submission with `canModerate`: the queue (`QUEUE_OF_SUBMISSION_TYPE`) and locale must be in scope, and nobody reviews their own submission. The owner keeps the thin Strapi admin queue: admin users whose admin role has the `content-moderation` plugin's "Access the moderation queue" and "Update submission status" permissions (`docs/strapi-role-permissions.md`). Reviewer ids are stored as `ba:<Better Auth id>` or `admin:<admin id>`.
- **`@repo/access`** (`packages/access`, pure TS, imported by the UI and Strapi) exports `resolveCapabilities`, `canSubmit`, `canModerate`, `canDirectEdit`, `canStaff`, `resolveStaffRole`, `SUBMISSION_TYPES`, `MODERATION_QUEUES`, `QUEUE_OF_SUBMISSION_TYPE`, `Capability`, `RoleGrant`, `ModerationScope`, `toSessionCapabilities`, `fromSessionCapabilities`; `resolveEntitlements`, `can`, `canForLibrary`, `limitOf`, `FEATURES`, `LIBRARY_SCOPED_FEATURES`, `PlanKey`, `PlanSource`, `Feature`, `Limit`, `EARNED_PRO_HOLD_DAYS`, `isEarnedProTier`; `contributionLimits`, `TIER_NAMES`, `ROLE_APPLICATION_MIN_ACCEPTED`; `CONTRIBUTOR_ROLES`, `GRANTABLE_ROLES`, `highestRole`, `promoteRole`. `CapabilityInput` is exactly `{ signedIn, grants, claims }`; `claims` contains approved library-scoped `StaffClaim` memberships and never includes a plan. Rebuild after changes (`pnpm --filter @repo/access build`); test with `cd packages/access && pnpm test`.
- **Session fields** (Better Auth `customSession`, built by `buildSessionAccess` in `lib/session-access.ts`): `capabilities`, `claimedLibraryIds`, `staffLibraries` (`{ id, role, canGoLive, name, slug, libraryType }[]`), `teamLibraryIds` (the libraries of the viewer's active, unexpired Teams), `teams` (`{ id, name, slug, role: "organiser" | "member", libraryCount }[]`), `moderationScopes` (`{ queue, locale }[]`), `editorLocales` (`{ docs, journal }`, each `"all"` or a list of locales), `contributorRole` (the derived label), `plan`, `planSource`, `features`, `limits` (e.g. `exportRows`: free 0, pro 10,000, team 50,000), `dismissedPrompts` (prompts hidden in Settings; keys from `DISMISSIBLE_PROMPTS` in `@repo/shared-data`) and `profileLoaded`. They come from the Strapi `session-profile` bridge (`lib/session-profile.ts`), which returns Role Grants as `roleGrants` (capabilities) and plan grants as `grants` (entitlements); neither feeds the other. The profile is cached per user for 60 s. A profile write (`/api/profile/me`) calls `invalidateSessionProfile`, and a Role Grant write in Strapi posts `{ baUserId }` to `POST /api/internal/session/invalidate` (bridge-secret gated), so a role change usually shows on the next request. That call is best effort and per instance: the 60 s TTL is the guarantee, and other changes made in Strapi admin take effect within 60 s. `profileLoaded: false` means the bridge failed: no capabilities, plan `free`.
- **Server helpers** (`lib/access-server.ts`): `requireCapability(user, cap)` returns 401/403; `sessionCapabilities(user)` rebuilds `Capabilities` from the session for `canModerate` and `canDirectEdit` pre-checks; `requireEntitlement(user, feature)` returns 401/402 with `{ feature, upgradeUrl: "/contribute/membership" }`; `requireEntitlementForLibrary(user, feature, libraryDocumentId)` does the same for the library-scoped features (`library.team`, `library.traffic`), which pass only when the library is in the session's `teamLibraryIds`; `requireStaff(user, libraryDocumentId, action)` pre-checks a staff action against `staffLibraries` with `canStaff`. Gate every Pro route with `requireEntitlement`, and every Team-tab route with `requireEntitlementForLibrary`. Missing session fields mean deny; missing `limits` mean a cap of 0.
- **Client hooks** (`lib/access-client.ts`): `useCapabilities()` → `{ has, claimedLibraryIds, moderationScopes, canDirectEdit(kind, locale), ready }` and `useEntitlements()` → `{ plan, can, canForLibrary(feature, libraryDocumentId), ready }`; `useStaff()` → the session's `staffLibraries` and `teams`. UI only: they hide or explain, and the server decides.
- **Staff area** (`/staff`, its own hidden section; spec `docs/superpowers/specs/2026-10-07-staff-round-2-design.md`, which wins over `2026-10-06-staff-area-design.md` where they differ; IA map `2026-10-07-site-ia-roles-and-paths.md`): approved owner/editor affiliations give library-scoped access; proposers never count. An affiliation comes from an approved Library Claim (`source: "claim"`) or from a Team organiser's assignment (`source: "team"`, below). `useStaff()` exposes the session memberships for UI pre-checks, and `requireStaffMember` in Strapi re-reads them on every write. Ordinary staff edits publish through content-moderation’s staff routes with an audited `draft → approved` Submission, `reviewerKind: "staff"`, `source: "staff"` Change Records and no Points (ADR-0006). Placement, address, coordinates, type, slug, entity reference, home base and permanent closure become pending `library_edit` requests. Staff decide other people’s pending `correction` Submissions on their own library; Moderators still see them and the first decision wins. Editing, Notices, timetables, event feeds and live sharing stay free. Staff pages are addressed by the library's slug (`/staff/[slug]/…`: `loadStaffPage(slug)` resolves the id from the session's `staffLibraries`, and links come from `staffLibraryHref(slug, suffix)` in `lib/staff/paths.ts`); the staff APIs (`/api/staff/[documentId]/…`) and the live console (`/live/[documentId]`) stay on the document id. The shell (`app/[locale]/staff/[slug]/layout.tsx`, `_components/StaffShell.tsx`) is `PageHero` with its `chips` and `meta` props, a `LibrarySwitcher` and `SectionTabs`: Overview (pending-suggestion badge), Edit record, Timetable and Go live (Mobile only), Notices, Event feeds, Traffic and Team (lock plus a "Team" tag when the library is not covered). `/contribute/index/[slug]` redirects staff of that library to `/staff/{slug}/edit`. The **Staff Drawer** (`components/staff/StaffDrawer.tsx`, on the ds `Drawer`; trigger `StaffDrawerTab`, a fixed right-edge tab at `lg` and up, hidden on `/map`, `/live` and `/staff/**`) opens from any page with `Alt+S`, from "Staff drawer" in the user menu, and shows the current library's live strip (Mobile), suggestions count, quick links, "Drives that include your library" and "Open staff area". It defaults to the page's library when the viewer is staff of it (`lib/staff/current-library.ts`, set by `LibraryDetailPage`'s `CurrentLibraryMarker`), else the last used (`localStorage` `lg.staff.drawer.library`), else the first; data from `GET /api/staff/[documentId]/drawer` → Strapi `library-staff` `GET /libraries/:documentId/drawer`. `library-staff` owns membership, access reports, audit and health; `content-moderation` owns publishing and suggestion decisions; `mobile-libraries` owns timetables' live state. Per-library email invites are gone: the round-1 `staff-invite` type, `/staff/invite/[token]` and the vouched claim they filed are deleted. New staff arrive by a Moderator-approved claim or a Team assignment. The library page shows one staff card (`StaffLibraryEntry`: "You run this library", Go live for Mobile, "Open the staff area"); the footer carries no staff shortcuts.
- **Teams** (`plugin::access.team`, `plugin::access.team-member`): a Team is an organisation entity for one library service, not a per-person grant. Fields: `name`, `slug`, `seats` (default 5), `status` (`active`, `lapsed`), `source` (`admin`, `checkout`), `verifiedAt` (null = unverified; set only by an admin, so money never buys trust), `expiresAt`, `libraries` (m2m), `notes`. A `team-member` holds `baUserId` (null while invited), `email`, `teamRole` (`organiser`, `member`), `status` (`invited`, `active`, `removed`), `tokenHash` and the invite stamps; active plus invited members never exceed `seats` (409 `no_seats`). Being an active member of an active, unexpired Team gives plan `pro` personally (`planSource: "team"`) and the library-scoped features (`LIBRARY_SCOPED_FEATURES`: `library.team`, `library.traffic`) on the Team's libraries only: `canForLibrary(e, feature, libraryDocumentId)` is true for those iff `teamLibraryIds.has(id)`, and `can(e, feature)` otherwise; a personal `team` entitlement grant alone no longer unlocks them. The organiser invites by email (`POST /access/teams/:id/invites`, optional pre-assignment), the invitee accepts at `/staff/team/join/[token]` with the matching signed-in email, and the organiser assigns members to the Team's libraries as owner or editor (`PUT /access/teams/:id/members/:memberId` with `assignments`). On a **verified** Team an assignment upserts the `library-affiliation` at once (`source: "team"`, `verificationMethod: "team"`, `teamMember`, `staffRole`, `approvedAt`), which runs the existing lifecycle (`hasStaff`, audit `joined`, emails to the other owners); on an **unverified** Team (a future self-serve checkout) it files a `library_claim` with `verificationMethod: "vouching"` for a Moderator instead. `remove` and `unassign` delete only that member's `source: "team"` affiliations; a lapse flips `status` and nothing else, so levels and `canGoLive` stay as set. Every team write takes an advisory lock on the Team. The session carries `teamLibraryIds` and `teams`; Strapi's `utils/team-access.ts` (`loadTeamInputs`, `hasLibraryFeature`) feeds `loadEntitlementInputs` and replaces every `hasTeamFeature` check. Content API routes `/access/teams/mine`, `/access/teams/:id/invites`, `/access/teams/join/:token`, `/accept`, `/access/teams/:id/members/:memberId` are bridge-gated with `X-Ba-User-Id` plus an organiser check in Strapi; Next proxies them under `app/api/staff/team/**` (`proxyStaff`, `base: "access"`). UI: `/staff/team` (`components/staff/TeamOrganiser.tsx`: seats used, libraries covered, members table, invite, resend/revoke, team role, per-library level `SegmentedControl` Owner/Editor, remove; members read only with "Ask {organiser}") and the library's Team tab (`PlanGatePanel` plus who has access, Leave and Report when uncovered; staff list with level select, Remove, Can go live `Switch` for Mobile, "Send invite" for organisers, pending invites and "Recent changes" when covered).
- **The `access` plugin** (`apps/strapi/src/plugins/access`) owns the admin's People (moved from content-moderation, with `plugin::access.manage-roles`), Teams (`manage-teams`: table, create/edit with a libraries picker, verified switch and expiry, members and invites) and Plans (`manage-plans`: grant or revoke a plan or a verification by email or id with a reason and expiry) pages, and the `people`, `teams` and `plans` services. The collections `role-grant`, `entitlement-grant`, `pro-verification` and `library-affiliation` stay `api::` types in their current tables; only `team` and `team-member` are plugin types, hidden from the Content Manager (the Teams page edits them). `library-affiliation` gains `source` (`claim`, `team`; null = legacy claim) and `teamMember`. Register permissions in `server/bootstrap`; `docs/strapi-role-permissions.md` lists them. Indexes in `HOT_PATH_INDEXES`: `team_members(ba_user_id)`, `team_members(token_hash)`, `team_members(team_id, status)`.
- **Moderator removal of staff:** `POST /api/content-moderation/moderation/staff/:affiliationDocumentId/remove` (bridge plus `moderate.queue` with an `index` or `all` scope) deletes the affiliation, and the lifecycle ends the person's live sessions, emails and audits. Next proxies it as `POST /api/moderation/staff/[affiliationId]/remove`; the claim review panel and the "who has access" list (for a Moderator reading a staff access report) offer "Remove from staff". Owners on a covered library and Team organisers remove directly; anyone can leave unless they are the last owner.
- **Library Notices**: `api::library-notice.library-notice` has no generic write routes. Staff writes are bridge-gated, actor fields are private and the public library reader only serves a published parent. Notices use inclusive local dates, with a 30-day default end; temporary closures and changed hours affect page status and search, and Mobile notices cancel visits by service/day/stop. Reindex library and mobile stops after commit.
- **Strapi is authoritative.** The content-moderation `submission-policy` loads capabilities from the user's unexpired grants (`activeGrants`, at most 50) and runs `canSubmit` (with the submission's locale for direct article edits), the Role Application eligibility rules and the tier quotas in `create`, `saveDraft` and `finalize`. The moderation routes re-check scope on every request. Next route checks are fast pre-checks, never the only gate.
- **Pro sources** (`planSource`): `team` (an active `team-member` row in an active, unexpired Team: plan `pro`, plus the library-scoped Team features on that Team's libraries), `grant` (an `entitlement-grant` row: plan `pro` or `team`, optional `expiresAt`), `verified` (a `pro-verification` row: library staff, student or charity; staff create these by hand until self-serve verification ships), `earned` (Archivist tier or above, 1,500 points, plus a 90-day hold in `user-profile.earnedProUntil` after dropping below) and `paid` (reserved: no checkout until P-D1). The highest plan wins; at equal plan the order is paid, team, grant, verified, earned (`SOURCE_ORDER`).
- **Admin-only collections:** `entitlement-grant`, `pro-verification` and `role-grant` have `routes: []` (no REST). They're visible in the content-manager, edited more comfortably from the `access` plugin's People and Plans pages, and read only by the secret-gated `session-profile` bridge (and, for role grants, the submission policy). `plugin::access.team` and `team-member` are hidden from the Content Manager and edited from the Teams page. The audit collections `library-change` and `article-change` have `routes: []` too (Future Goals §3).
- **Plans page:** `/contribute/membership` (`app/[locale]/contribute/membership/page.tsx`, the Contribute section's Membership tab; components in `contribute/_components/membership/`). All plan copy and prices come from `lib/plans.ts`, labelled "Prices are placeholders"; the compare matrix is `lib/plan-compare.ts`. Never hard-code an amount elsewhere.
- **Live Pro features:** Atlas export, CSV or GeoJSON from the Atlas list view: `POST /api/export/atlas` is gated by `requireEntitlement("atlas.export")` and capped at `limits.exportRows`; its rows come from the bridge-secret-gated Strapi action `POST /api/libraries/export`. And change history values (`library.history`): every visitor sees a library's Changes section (field names and the 24-month histogram), and the page stays `force-static`; for a session with `library.history` the timeline reloads its batches from `GET /api/libraries/[slug]/history` (the segment holds a documentId), which asks Strapi for previous → next values (`?values=1` plus the bridge secret) only when `requireEntitlement(user, "library.history")` passes. Team is bought per library service and comes with a Team organiser; each seat gives its holder Pro. "Team organiser: assign staff to your libraries" (`library.team`) and "Choose who can go live" are live; "Traffic reports" (`library.traffic`) is a scaffold (`lib/staff/traffic-source.ts`: `SampleTrafficSource` by default, `VercelTrafficSource` throws `not_configured`) and stays "coming soon" with the remaining Pro/Team features (`PRO_FEATURE_COPY` in `lib/plans.ts`). The membership page's staff paragraph links to `/staff` for staff and to the claim flow otherwise; "Ask about Team for your service" stays a mailto (`TEAM_CONTACT_HREF`) until checkout exists.

---

## Design System

All design decisions flow from `lib/design-tokens.ts` (`T`). **Never hardcode colors or fonts** that exist in the token system.

### Color tokens (`T`) — v2 light system (light-only, no dark mode)

```ts
T.bg.void // #FAF8F4 — page root (warm paper)
T.bg.space // #F1EDE5 — deeper band: footer, cover strips
T.bg.deep // #FFFFFF — card / panel surface
T.bg.surface // #FBFAF7 — nested surface: row hover, inputs
T.bg.muted // #F3F0EA — muted fills: disabled, neutral chips
T.bg.muted2 // #EFEBE3 — nav hover, segmented-control track

T.ink.base // #17162B — primary text
T.ink.dim // #55536A — secondary text
T.ink.low / faint / ghost // alpha ramp of ink for tertiary states

T.border.line // #E7E3DB — standard border (borders carry elevation; no shadows)
T.border.hi // #D9D3C9 — prominent border
T.border.divider // #F0ECE5 — hairline dividers

T.accent.primary // #4338CA — indigo: CTAs, links, focus, active states
T.accent.primaryHover // #3730A3
T.accent.chip // #ECEBFB — active filter chips
T.accent.ok // #2F5D3A — success/open (on #E6EFE6)
T.accent.danger // #A13A1A — errors (on #F6E3DA)
```

Library-type tint pairs live in `TYPE_TINT` / `tintForLibraryType()` (same file): national purple `#ECE8F6/#4A3F8C`, public green `#E6EFE6/#2F5D3A`, academic blue `#E4ECF5/#28496E`, special rust `#F6E3DA/#8A3F22`, neutral `#F3F0EA/#55536A` — used for badges, card monograms, and stat cards.

### Typography (`T.font`)

| Token          | Font           | Use                                                  |
| -------------- | -------------- | ---------------------------------------------------- |
| `T.font.serif` | Newsreader     | Display headings, card titles, large stat numerals   |
| `T.font.mono`  | JetBrains Mono | Coordinates and technical data ONLY (used sparingly) |
| `T.font.sans`  | Figtree        | Body copy, UI chrome, labels, buttons (site default) |

**Rules:** Serif for display + big data values. Mono is restricted to coordinates/technical strings — the old mono-uppercase eyebrow pattern is retired except for sparing true-metadata use. Pill radii (999px) for buttons/badges, 20–24px for cards, 14px for inputs. The only sanctioned shadow is the card hover: `0 12px 28px rgba(23,22,43,.08)`.

### Accessibility baseline (non-negotiable)

- Global `:focus-visible` — 3px `#4338CA` outline (in globals.css; never suppress)
- Skip-to-content link in the root layout; `#main` landmark
- `prefers-reduced-motion` kill-switch is global
- Status is always conveyed as color + icon + text (never color alone)
- Filters use `fieldset`/`legend`; hours use semantic `<table>` with `th scope="row"`; counts update via `aria-live`
- Honest empty states over fake data ("Hours not added yet", "No photo yet" monograms)

### Design System components (`components/ds/`)

All shared UI primitives live here. Always check `ds/index.ts` before building a new component.

| Component               | Purpose                                                                                                                                                                                           |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Eyebrow`               | Section label with optional index number and extending bar rule                                                                                                                                   |
| `SectionHeader`         | Section heading with italic serif suffix (`italic` prop)                                                                                                                                          |
| `PageHero`              | The only hero band for primary pages — breadcrumb, eyebrow pill, serif title, lead, slot; `chips` (a pills row under the breadcrumb) and `meta` (a meta line under the title) for the staff shell |
| `SearchField`           | Site-wide search pill (magnifier, sr-only label, clear button) — use in hero slots                                                                                                                |
| `EditorialSection`      | Two-column image + rich-text editorial block from CMS                                                                                                                                             |
| `CtaBannerSection`      | Full-width CTA banner with radial gradient and aurora CTA link                                                                                                                                    |
| `LocationGridBrowser`   | Bordered grid of location cards — rank prefix, serif name, subtitle, hover arrow                                                                                                                  |
| `LocationContributeCTA` | Contribute / correction prompt banner                                                                                                                                                             |
| `Breadcrumb`            | Location breadcrumb trail                                                                                                                                                                         |
| `Card`                  | General-purpose content card                                                                                                                                                                      |
| `Badge`                 | Status/type badge                                                                                                                                                                                 |
| `StatBlock`             | Stat display block                                                                                                                                                                                |
| `StatCard`              | Tinted stat tile (icon, serif numeral, label): profile tabs, My submissions                                                                                                                       |
| `ChoiceCard`            | Radio option as a card (tinted icon, title, hint): role, affiliation, visibility choices                                                                                                          |
| `Notice`                | Tinted notice with icon and title (`ok`, `info`, `warn`); status never colour alone                                                                                                               |
| `DismissiblePrompt`     | Prompt a reader can hide (`PromptDismissButton`): per session, or in Settings                                                                                                                     |
| `MetaRow`               | Key-value metadata row                                                                                                                                                                            |
| `EmptyState`            | Empty/not-found state                                                                                                                                                                             |
| `Pager`                 | Pagination control                                                                                                                                                                                |
| `Switch`                | `role="switch"` toggle, 44 px target: settings, live sharing, who can go live                                                                                                                     |
| `SegmentedControl`      | Radio group on the `T.bg.muted2` track: Yes / No / Not sure, Owner / Editor, 7/30/90 days                                                                                                         |
| `StatusBadge`           | Tone (`ok`, `info`, `warn`, `danger`, `neutral`) + icon + text; optional pulse with a reduced-motion fallback: live states, health, feeds                                                         |
| `Sheet`                 | Side or bottom sheet with focus trap, Escape and inert background: publish confirm, stop drawer, console sheets, paste dialog                                                                     |
| `HealthList`            | Record health rows: status dot, label, sub-line, optional outlined action                                                                                                                         |
| `PlanGatePanel`         | Locked Team or Pro tab: plan pill, serif title, checklist, "stay free" line, two CTAs, sample preview, optional "Coming soon"                                                                     |
| `PlanChip`              | "Team plan" (indigo) or "Staff access · free" (neutral) in the staff band                                                                                                                         |
| `KpiTile`               | Traffic tile: label, serif value, change with arrow and text, never colour alone                                                                                                                  |
| `BarSeries`             | Simple bars with a "Show as a table" toggle that renders a real `<table>`                                                                                                                         |
| `LibrarySwitcher`       | "Your libraries (n)" select with a type icon, in the staff band and drawer                                                                                                                        |
| `PublishBar`            | Sticky "{n} unpublished changes · Discard · Publish" bar with an `aria-live` count: staff edit, timetable                                                                                         |
| `DiffCard`              | Field, Now (rust, struck) and Suggested (green), source and actions: suggestions, timetable review                                                                                                |
| `QrCode`                | Server-rendered SVG QR code (`qrcode`): the Go live tab's console link                                                                                                                            |

### Primary CTA pattern

Primary CTAs are indigo pills: `bg-(--t-accent-primary) hover:bg-(--t-accent-primary-hover) text-white rounded-full font-semibold`. Secondary actions are white pills with a `--t-border-hi` border. The old aurora-cyan CTA constants in `lib/styles.ts` are deprecated — do not use them in new code.

### Inline styles vs Tailwind

- **Use inline styles** (via `style={{}}`) for design-token values — colours, fonts, letter-spacing, specific pixel measurements
- **Use Tailwind** for layout, spacing scales, responsive breakpoints, and hover/group state that needs pseudo-classes
- This is intentional — it keeps token values inspectable and prevents Tailwind's purger from stripping dynamic values

### Header pattern

v2 pages use normal in-flow light heroes — the header renders solid from the start. The legacy `data-transparent-header` + `-mt-14` scroll-reveal pattern is retired for v2 pages (the CSS machinery still exists in globals.css for any stragglers). **Never add `overflow-x-hidden` or `overflow: hidden` to the page wrapper or `<main>`** — it breaks `position: sticky`.

### Section hero pattern (PageHero)

Every primary page — Find libraries (`/libraries`), Journal, Events, Knowledge, Contribute — and their search/sub pages open with `PageHero` from `components/ds`. Tinted `T.bg.space` band with a hairline rule; breadcrumb, then an eyebrow pill (Iconify icon + label + optional indigo accent) and a serif `title` on the left (`*italic*` markup renders indigo italic via `parseHeroText`); `lead` plus the children slot on the right. Put the section's primary control in the slot: a `SearchField` first, then any status line. Use `compact` for task/search pages. Never hand-roll a hero h1/band; if a page needs something `PageHero` can't do, add a prop to it. The page wrapper is a plain `T.bg.void` div (`relative isolate flex min-h-screen w-full flex-col`).

### Page shell pattern (v2)

Detail pages follow the POC single-flow layout: breadcrumb → in-flow hero (badges, serif clamp title, action pills) → sticky anchor nav → main column + sticky sidebar, all on `T.bg.void` paper with white section cards. See `components/library/LibraryDetailPage.tsx` for the canonical implementation.

---

## Key Conventions

### File organisation

- `components/ds/` — design system primitives (generic, reusable)
- `components/elementary/` — layout primitives (Container, etc.)
- `components/global/` — site-wide chrome (GlobalHeader, GlobalFooter, GlobalLink)
- `components/[feature]/` — feature-specific components (continent, country, region, library, map, wiki, blog)
- `components/staff/`: the Staff area: `StaffDrawer` and `StaffDrawerTab` (the drawer and its edge tab), `TeamOrganiser`, `StaffNotices`, `LibraryNoticeForm`; the shell lives beside its routes in `app/[locale]/staff/[slug]/_components/`
- `components/mobile/`: Mobile libraries: `TimetableEditor`, `MobileRouteMap`, and `live/` (the console, `GoLiveToday`, `ConsolePreview`, `LiveSharingSettings`, `LiveSessionsTable`, `LivePrivacyCard`)
- `components/home/` — homepage-specific components
- `lib/` — utilities, API clients, tokens, helpers
- `app/[locale]/` — Next.js route segments (pages are thin — pass data to `*DetailPage` components)

### Naming

- Page components: `{Entity}DetailPage` (e.g. `LibraryDetailPage`, `CountryDetailPage`)
- DS components: PascalCase noun (`PageHero`, `LocationGridBrowser`)
- Always export named (not default) from DS files; default export is for Next.js page files only

### Strapi data fetching

- All fetch functions live in `lib/strapi-api/content/server.ts`
- Use `PublicStrapiClient` for public reads, `PrivateStrapiClient` for auth-gated operations
- Respect `draftMode()` — pass `status: dm.isEnabled ? "draft" : "published"`
- Never call Strapi from client components

### Map helpers

Basemap attribution and bounding boxes: `components/map/map.helpers.ts`. Location pages use `components/location/LocationHeroMap.tsx`.

---

## Future Goals

### 1. Events & Provider Integration

Libraries host events (talks, exhibitions, reading groups). The plan:

- Add an `Event` content type to Strapi (title, description, date/time, location, library relation, eventType)
- Integrate external event providers (Eventbrite, Meetup, library-specific APIs) via a sync job
- Display events on library detail pages under a new "Events" tab
- Add a global `/events` browse page with calendar and map views
- Events should be filterable by library type, location, and category

**Event Feeds (built, 2026-10):** a library's staff connect its events platform from the Staff area's Event feeds tab, `/staff/[slug]/events` (`components/event-feeds/`, rendered inside the staff shell: `LibraryFeedsSection` as a card list, `FeedRow` with a `StatusBadge`, `ConnectFeedForm` with `ChoiceCard`s; proxy `lib/event-feed-proxy.ts`, routes `app/api/contribute/event-feeds/*`, whose Eventbrite callback redirects to `/staff/[slug]/events/[feedId]/organisation`). The public library page's empty events state sends non-staff to the claim flow and staff to that tab. Providers and their fields come from one registry, `EVENT_PROVIDERS` in `@repo/shared-data`; provider code lives in `@repo/event-providers`, shared by Strapi (in-process connection tests) and the sync worker. Values are sealed with `@repo/events-crypto` (AES-256-GCM, AAD = credential documentId, or `:pending` for a replacement under review) and are `private`. Only Strapi admin users with "Reveal event credentials" can read one, and each reveal is logged in `plugin::events.credential-event` (append-only, no routes). Every new value is an `event_feed` Submission (index queue) carrying only masked hints and the test result; approval activates it (`feeds.approveSubmission`), rejection destroys it. Pause, resume, disconnect and withdraw are direct. Feeds belong to the library: any current claimant manages them; group feeds are admin-only. The worker auto-pauses a feed after `EVENTS_AUTOPAUSE_AFTER` failed syncs and Strapi's 15-minute cron emails the claimants. Rotate the key with `pnpm --filter @repo/strapi events:rekey`. Spec: `docs/superpowers/specs/2026-10-05-event-feed-credentials-design.md`. Still open: the worker has no production host.

### 2. User Accounts & Profiles

Built: accounts (Better Auth + Strapi users) and profile pages at `/profile/[username]` with avatar, bio, followed libraries, and Public / Limited / Private visibility plus per-part toggles (`publicPrefs`). Still to come:

- **Visit log** — record libraries visited with date and notes
- **Collection notes** — personal annotation layer on library entries

### 3. Contribution & moderation (built)

Community-verified accuracy, reviewed by community Moderators on the site and by the owner in Strapi admin. Hardened in P-A; specs: `docs/superpowers/specs/2026-09-26-access-contribution-pro-implementation-design.md` §4–5 and `docs/superpowers/specs/2026-09-29-community-moderation-and-audit-design.md` (plan: `docs/superpowers/plans/2026-09-30-community-moderation-and-audit.md`, which wins where they differ).

- **Plugins:** `content-moderation` (the Submission and Review Event collections, `submission-policy`, the site's moderation API in `server/controllers/moderation.ts` and `server/services/moderation.ts`, history reads in `server/services/history.ts`, `server/services/notifications.ts`, and the owner's admin queue in `admin/src/pages/ModerationDashboard.tsx` with its review modal and per-type panels in `admin/src/components/`), `rewards` (points, streaks, tiers, badges, leaderboard), `topics` (curated topics, fed by `topic_suggestion`), `library-staff` (staff membership, the Overview's health aggregate and drawer data, access reports, the `staff-audit` log, Notices routes), `mobile-libraries` (live settings, sessions and events, the 5-minute sweep and the kill switch) and `access` (the admin's People, Teams and Plans pages; the Team content types and content-API routes). Strapi loads each plugin from its built `dist/`, so run `pnpm --filter @repo/strapi build:plugins` after changing plugin code.
- **Submission types and queues** (`QUEUE_OF_SUBMISSION_TYPE`): `index` takes `correction`, `new_library`, `library_claim`, `library_edit` (claimants only), `topic_suggestion` and `event_feed` (claimants only, gated by the `events.feed` capability); `knowledge` takes `wiki_edit` (a suggestion, or a direct block edit for an editor in that locale); `journal` takes `blog_submission`; `applications` takes `role_application`.
- **Locale on every Submission:** `contentLocale` (the payload field is `locale`; default `en`, checked against Strapi's configured locales, `GET /api/content-moderation/locales`). Drafts are found by user, type, target and locale, the payload hash includes it, the queue filters by it and `canModerate` checks it. Article apply finds the article by slug in that locale and creates the locale version when it's missing; Journal translations award `journal_translated`. The Index editor's translation mode (`/contribute/index/[slug]?locale=xx`, linked as "Translate this record" from the library page) edits only `LOCALIZED_LIBRARY_FIELDS` (`@repo/shared-data`), and the library apply ignores every other field outside the default locale.
- **State machine** (`content-moderation/server/utils/transitions.ts`): `draft → pending → approved | rejected | needs_info`, and `needs_info → pending | approved | rejected`; `approved` and `rejected` are final. ADR-0006 adds `draft → approved` only for staff publishing their own library, with no point award. Drafts are editable only while `draft`, finalizing pins a `reviewedPayloadHash`, approval runs once, and point awards are idempotent. Every transition, `finalize` included, writes a Review Event (`plugin::content-moderation.review-event`: from, to, reviewer, note) in the same transaction; they're append-only and hidden from the Content Manager. No self-review on either surface (`canModerate`, `isSelfReview` in `utils/reviewer.ts`).
- **On approval:** `new_library` creates a draft library, filed under the Moderator's target (`draftData.moderatorTarget`, set with `PUT /moderation/submissions/:documentId/target`) before the submitter's choice; **Approve and publish** publishes it once continent, country and region are set. `library_claim` upserts a `library-affiliation` and creates a `verified_librarian` Role Grant (`source: "claim"`) if the user has none. `library_edit` and a record `correction` (`fields.kind: "record"`, only the changed fields plus `previous`; sent by the Index editor and by the correction drawer's structured editors) are applied to the library through the allowlist in `utils/library-record.ts` and published (C-L1). Opening hours go through the `global::opening-times` normaliser (overlaps refused), option relations arrive as `{ connect, disconnect }`, and `suggestedOptions` names link an existing option or are logged as an `option-suggestion`; a `correction` carrying the library page's Yes/No facility answers (`fields.kind: "facilities"`) connects or disconnects the mapped accessibility/amenity/service entries (`FACILITY_CHECKLIST` in `@repo/shared-data`), records confirmed "No"s in `library.absentFacilities`, and publishes; `wiki_edit` and `blog_submission` go through `utils/article-apply.ts`: a new article (`draftData.kind: "new_article"`) is created, a direct edit (`body`/`title`, editors only) is published, a suggestion with content (`proposedBody`) is written to the article's draft version (or published, when the Moderator chooses **Approve and publish**), and the submission's locale picks the language, so a translation creates that locale version; `topic_suggestion` approves the topic; a shared photo (`correction` with `fields.kind: "photo"`, the submitter's own upload only) becomes the library's hero image if it has none, else joins the gallery, with the credit and licence as its caption (`utils/library-photo.ts`); `event_feed` activates the connected or replaced feed (rejection destroys it); `role_application` creates the `wiki_editor` or `journal_editor` grants (`source: "application"`, one per requested locale, or one for every locale). New libraries, new articles and applications record what they created in `resultDocumentId`. Every type awards points (`journal_accepted` for Journal) except `role_application`.
- **Moderation on the site:** Strapi's `/api/content-moderation/moderation/*` routes (list with status, queue, type, locale and search filters; detail with the record's live values, or the live article and, for a translation, its source locale; status; target; events; stats; relation labels; option suggestions) take the bridge secret plus `X-Ba-User-Id`, re-read the caller's grants on every request (403 without a Moderation Scope), and answer 404 for a submission that's missing or out of scope, so scope can't be probed; your own submission is 403. Next proxies them under `app/api/moderation/*` through `lib/moderation-proxy.ts`: `requireCapability("moderate.queue")`, writes 30 and reads 120 a minute per user, allowlisted query parameters and body keys, identity from the session. Pages: `/contribute/moderation` (the Moderation tab, shown only with `moderate.queue`), `/contribute/moderation/[documentId]` (the review page: per-type panels from `components/moderation/`, Approve, Approve and publish where it applies, Needs changes and Reject, a note required for the last two, and the Review Event thread) and `/contribute/moderation/suggestions` (editorial board only). The admin queue shares the same service methods.
- **Role Applications:** `/contribute/knowledge/apply?role=wiki_editor|journal_editor` (`components/contribute/RoleApplicationForm.tsx`), linked from the Knowledge and Journal landings and `RolesTable`. It shows "{n} of 5 accepted changes" from `acceptedCount` in `/api/contribute/standing` and disables the form below `ROLE_APPLICATION_MIN_ACCEPTED` (5 approved submissions that aren't applications); the form takes a role, languages (none means all), a 20–2,000 character statement and up to five sample links, and shows any open or decided application with the moderator's note. `submission-policy` enforces the same rules, plus no open application for that role and no grant that already covers it. Plan, Tier and Points never count.
- **Notifications** (`server/services/notifications.ts`, templates in `server/utils/email-templates.ts`): queued after the transition commits, off the request path, and never block or undo it. The submitter is emailed when a submission is approved, rejected or sent back (respecting `notifPrefs.editsReviewed`, except Role Application decisions, which always send); a Role Application reaching `pending` emails `MODERATORS_EMAIL` (default `moderators@libraries.global`). Links use `APP_PUBLIC_URL`. Without Mailgun or Mailtrap credentials (`server/utils/email-config.ts`) every email is logged and skipped.
- **Audit trail:** the document-service middleware `apps/strapi/src/documentMiddlewares/change-records.ts` (registered in `src/index.ts`) records every library write as Change Records (`api::library-change.library-change`: one row per changed field, grouped by `batchId`, with `action`, `contentLocale`, `versionStatus`, `source` (`submission`, `admin`, `api_token`, `import`, `system`), actor, reviewer and `submissionDocumentId`) and every Knowledge or Journal write as an Article Change (`api::article-change.article-change`: `created`, `edited`, `translated`, `published`, `unpublished` or `deleted`, with a `bodyHash` but no body diff). The actor comes from `utils/change-context.ts`: the moderation apply's context, else the admin user, the API token (`import` when its name starts with `import` or `ingest`) or the bridge user, else `system`. Inserts run inside the caller's transaction, so an approval whose record can't be written rolls back. `strapi.db.query` writes (derived fields) bypass it by design. `CHANGE_RECORDS_ENABLED=false` is the emergency kill switch and logs loudly at boot. Both collections are append-only, with no REST routes.
- **History:** public content-moderation routes `GET /libraries/:documentId/history` (published Change Batches; previous → next only with `values=1` and the bridge secret), `GET /libraries/:documentId/history/stats` (24 months of batches, top fields, actions, verification months) and `GET /articles/:kind/:documentId/history`. The library page's **Changes** section (`LibraryChangesSection`, `ChangeHistogram`, `LibraryChangeTimeline`) shows them, Pro values as in the Access model; Knowledge and Journal articles show `ArticleEditHistory`. Usernames appear only when the contributor's profile activity is public. A one-off boot backfill (`backfillLibraryHistory`) gives every approved `library_edit` and record `correction` from before Change Records one batch of field names; claims, facility answers, photos and free-text corrections are not backfilled.
- **UI:** the `/contribute` hub adapts to `useCapabilities()`; tabs Hub, Index editor (`index`, `index/new`, `index/[slug]`, plus `correct/[slug]` and `claim`), Knowledge editor (`knowledge`, `knowledge/new`, `knowledge/[slug]`, `knowledge/journal/[slug]`, `knowledge/apply`), My submissions, Moderation (Moderators only) and Membership. There is no Staff tab: the Staff area is its own section at `/staff`, reached from the hub's "Look after your library" card, the Contribute menu's "Your libraries" card (Staff area, then Edit record and Event feeds for the selected library), the user menu's "Staff area" and the Staff Drawer; event feeds moved there (`/staff/[slug]/events`). Community (leaderboard, suggestions, drives) is its own section at `/community`. The article editor lives in `components/contribute/article-editor/` (TipTap; `articleBlocks.ts` converts to and from the Strapi dynamic zone).
- **Contribute menu** (the header's primary action, `components/global/GlobalContributeMenu.tsx`; the pure card model is `buildContributeMenu` in `lib/contributor-shortcuts.ts`, the data `useContributeMenu` in `hooks/useContributeMenu.ts`): a 640 px panel of small cards, one per kind of work, that combine for people with several roles rather than picking a menu by the highest role. "Your work" first: Your library/libraries (`staff.area`: Staff area, then Edit record with its suggestions waiting and Event feeds for the selected library, with a Library select when there are several; the choice is shared with the drawer's `lg.staff.drawer.library`), Your team (Team members and organisers, with a Staff area line when no library is assigned), Knowledge (`docs.directEdit`), Journal (`journal.directEdit`) and Review (`moderate.queue`, the queue with how many are waiting). Then "Everyone": Drives (the featured drive with its progress, All drives, New drive for `drives.manage`, else Propose a drive) and Contribute (Add a library, All ways to contribute, My submissions with "{n} in review"); then a Membership row with the plan. It opens signed out too, with a sign-in card; while the session loads only the Everyone cards show, so privileged cards never flash. The counts and the featured drive load only while the panel is open (`/api/drives/featured`, which now carries progress; `/api/moderation/stats`; `/api/staff/[documentId]/drawer`; `/api/contribute/standing`) and never block the cards. The mobile menu's Contribute section (`GlobalContributorShortcuts`, one accordion per card, Membership last) reads the same model; the footer carries no editor shortcuts. The Staff drawer is not in this menu: the edge tab, `Alt+S` and the user menu open it. The **Editorial drawer** (`components/editorial/EditorialDrawer.tsx`, mounted by `EditorialDrawerMount`, state in `lib/editorial/drawer.ts`) is its twin for anyone holding `docs.directEdit`, `journal.directEdit`, `moderate.queue` or `drives.manage`: an edge tab (under the staff tab when both show), `Alt+E` and "Editorial drawer" in the user menu open it, and each section follows one capability: Review (pending count, queue, option suggestions for the board), Knowledge and Journal (write, edit, with the editor's languages) and Drives (board only). One drawer is open at a time.
- **Structured corrections:** the "Suggest a correction" drawer and the hub's correction step load the record from `/api/contribute/library/[slug]` and open the Index editor's own fields for the chosen category (`components/contribute/CorrectionEditor.tsx`, rules in `correction.logic.ts`): hours, address, name, links, open status, accessibility, services and amenities. Collections and "Something else" stay free text and are applied by hand. The moderator's review panel shows the library's live values and option names from Strapi (`utils/record-review.ts`), never the contributor's.
- **Suggested additions:** contributors post a new accessibility feature, service, amenity or library type directly from `/community/suggestions`, or name one in a correction, which records it once a moderator approves (`plugin::content-moderation.option-suggestion`, one per list and name, with requests and libraries); signed-in contributors vote on an undecided one from there or the Contribute hub (`option-vote`, one per user, up to 5 new suggestions a contributor a day). "Facilities" is `amenities`' public label. A suggestion moves New → Under review → Planned → Added or Not adding (with a public board note on Planned and Not adding), or Removed, hidden from everyone, including the board. The editorial board reviews at `/contribute/moderation/suggestions` (or the moderation admin's Suggestions tab), monthly: accepting an accessibility/amenity/service name creates (or reuses) the option and links it to every library that asked; accepting a library type only renames it to the schema enum's spelling, and is refused until the enum has the value (mark it Planned until then); a declined or removed name stays declined.
- **Content safety:** `@repo/shared-data` `content-safety.ts` (the `obscenity` matcher plus link rules: adult domains and TLDs, shorteners, non-http schemes) runs in the forms and, authoritatively, in `submission-policy.checkContent` on create and finalize. Real place names are allowed (`SAFE_TERMS`, plus the target library's own name and address).
- **Still to come (P-C):** the `needs_info` thread and resubmission (C-M1, C-M2): the contributor sees the moderator's note but can't reply, or edit and resubmit; applying free-text `correction` changes (they still only award points).
- **Drives (D1, built):** board-run, time-boxed campaigns that focus contributors on filling a Gap across a scoped set of Libraries. The shared rules — Drive Scope and Focus as a Meilisearch filter and as a predicate, and whether a Submission's fields fill a Focus — live in `packages/shared-data/drives.ts`, so Strapi and the UI never drift. `api::drive.drive` has `draftAndPublish: false`; its own `status` (draft → scheduled → open → closed/cancelled) is the only lifecycle marker, and `bySlug` never serves a draft. Public reads (`GET /api/drives?state=`, `/drives/by-slug/:slug`, `/:documentId/stats`, `/leaderboard`, `/in-review`, `/mine`) need no auth; board writes (create, update, actions — pin, unpin, feature, unfeature, cancel, reorder, open, close — and `POST /drives/lifecycle/run`) are bridge-gated and re-check the caller's Role Grants (`drives.manage`, held only by `editorial_board`) on every request, the same two-step pattern as the other bridge-gated routes in this codebase. The `driveLifecycle` cron (`"7 * * * *"`, an advisory lock) opens scheduled Drives, closes finished ones and snapshots the rest; `CRON_ENABLED=false` stops it (and every other scheduled job) without touching the on-demand lifecycle route, which Playwright calls directly so tests don't wait for the clock. Approved Submissions carry `driveDocumentId`, checked by `submission-policy` and recorded on approval as a hidden `drive-credit` row; the moderation queue filters by `?drive=` and offers "Next in this drive". UI: Noticeboard cards at `/community`, the Drive page at `/community/drives/[slug]` (task panel, Your part), and the board builder at `/community/drives/new` and `/[slug]/edit` (`DriveBoardActions`, gated by `drives.manage`). Proposals: a non-board contributor proposes a drive as a `drive_proposal` Submission in the `index` queue (`/community/propose`, the builder in proposal mode); `submission-policy` enforces the standing rule (5 accepted Submissions, no other open proposal); approval creates the drive through `createDrive`; a Moderator's date change is stored as `draftData.moderatorEdit` (`PUT /moderation/submissions/:documentId/drive-dates`), re-pinning the payload hash. Points: `drive_task_accepted` +2 per accepted task, `drive_finished` +25 for each helper with 5 or more accepted tasks when a drive meets its goal, `drive_proposal_accepted` +10. Five drive badges are counted from `drive_credits`. Ribbons on a profile come from `GET /user-profiles/by-username/:username/drives`. A thank-you email goes out when a drive closes (`notifPrefs.drives`), sent by `recogniseClosedDrives` in the hourly lifecycle. Touchpoints beyond the Noticeboard and drive pages: the homepage and Contribute hub (`GET /api/drives/featured`), the library page's drive note (`GET /api/drives/for-library/[documentId]`), location pages ("Drives here") and Find libraries ("There's a drive for this search", "Propose a drive from these results"), and proposing from any of them (`POST /api/drives/proposals`).

### 4. Search Enhancements

- Geo-bounding search (search within current map viewport)
- Faceted filters by `openingTimes` (open now), `accessibility`, `services`, `amenities`
- "Nearby libraries" on library detail pages (MeiliSearch geo radius query)
- Search results page at `/search`

### 5. IIIF & Digital Collections

Libraries with `iiifEndpoint` can expose their digital collections. Plan:

- IIIF viewer embedded in library detail page under a "Digital Collections" tab
- Browse manuscripts, maps, and digitised works inline
- Link to external IIIF viewers (Universal Viewer, Mirador)

### 6. Internationalisation Expansion

- i18n runs on next-intl and the Strapi i18n plugin; primary locale English
- Built: a locale on every Submission, the Index editor's translation mode and article translations (§3); pages fall back to the default locale when a translation is missing, with a "Not yet translated into …" line and `noindex` (`lib/locale-fallback.ts`); Meilisearch indexes every locale (`locale: "*"` in `apps/strapi/config/plugins.ts`, `locale` filterable), and every search filters by the route locale when it is in `LIVE_LOCALES` (`lib/live-locales.ts`), else the default locale
- `LIVE_LOCALES` stays `[en]` until a locale has content; adding one is a one-line change in `lib/live-locales.ts`
- Planned: French, Spanish, Arabic (RTL support), Japanese

---

## Development Notes

- **Strapi local dev:** `http://127.0.0.1:1337` — must be running for local UI development
- **Meilisearch local dev:** container `librariesglobal-meilisearch` on `http://localhost:7701` (port 7700 is occupied by an unrelated project's container — do not touch it). Fresh instance, or an index's shape changed? Run `pnpm --filter @repo/strapi seed:meilisearch`: it rebuilds the library, Knowledge and Journal indexes from Strapi using the plugin's own config (`config/plugins.ts`). The plugin only live-syncs the collections in its core-store list, which it empties if Strapi boots while Meilisearch is down; re-tick them on the admin Meilisearch page if publishes stop reaching search. Ingest scripts (`apps/strapi/scripts/ingests/`) need `STRAPI_API_TOKEN` and `STRAPI_BRIDGE_SECRET`: without the secret Strapi drops `?status=draft` and every write publishes. A library can't be published while its continent, country, region or area is a draft (Strapi would drop the link).
- **Node 22 required** (`nvm use`) — a v20 shell will start but violates `engines`
- **TypeScript types** for Strapi are generated into `packages/strapi-types` — regenerate after schema changes
- **Lint** runs on pre-commit via ESLint + SonarJS; fix all errors before committing (warnings are tolerated)
- **Tests in multi-step builds:** while working, run only the test files a change creates or touches. Run the full Strapi and UI suites, the typecheck and the plugin build once, at the end of the work, before the final review.
- **No `overflow-x-hidden` on page wrappers** — it breaks sticky headers and negative margin heroes
- **`-mt-14` hero pattern** requires the parent chain to have no `overflow: hidden` ancestors
- Always use `formatStrapiMediaUrl()` for Strapi media URLs — it handles relative `/uploads/` paths and absolute CDN paths
- The `entityRef` field (e.g. `GB-BL-001`) is the stable external identifier for a library — use it for cross-referencing and data imports
- World places: `apps/strapi/scripts/ingests/gazetteer/` (README) adds every country's Regions and Areas from GeoNames (England from a curated ONS list) and sets Place Labels; it only adds, never renames, moves or deletes.
- `@repo/shared-data` is consumed from its built `dist/` by both apps: rebuild with `pnpm --filter @repo/shared-data build` after editing it, or the old output keeps shipping.
- **Mobile libraries:** one record per vehicle; its non-localised `mobileTimetable` field (`global::mobile-timetable`, rules in `packages/shared-data/mobile-timetable/`) holds the Cycle, Stops and Visits, and route order follows arrival time. Staff publish the timetable from `/staff/[slug]/timetable`; contributor suggestions carry the hash of the timetable they loaded, so a later change needs a new suggestion. Stops are searched from the `mobile-stop` Meilisearch index, kept in step by the timetable middleware, Notices and the hourly local-midnight job (`utils/mobile-stop-index.ts`). Live sharing runs from the Go live tab and the `/live` console (`mobile-libraries` plugin). Operations: `docs/operations/mobile-libraries.md`; live console configuration, privacy and device behaviour: `docs/mobile-live.md`.
- **Environment:** `MOBILE_LIVE_ENABLED=false` (Strapi; mirrored in `turbo.json`) refuses new live writes, ends active sessions with `kill_switch` and hides public live sharing; the default is on. `MOBILE_LIVE_STEPUP_SECRET` (both apps, must match) signs the "Confirm it's you" cookie; unset, both fall back to `STRAPI_BRIDGE_SECRET`, and rotating it expires every confirmation. `TRAFFIC_SOURCE` (UI) picks the Traffic tab's source: `sample` (default, deterministic from the documentId) or `vercel` (not yet implemented: `VercelTrafficSource` throws `not_configured`). Each is listed in `apps/ui/.env.local.example` and `apps/strapi/.env.example`.
- **Meilisearch keys and reseeds:** the public search-only key (`NEXT_PUBLIC_MEILISEARCH_SEARCH_KEY`) must allow `search` on `mobile-stop` as well as the library, Knowledge and Journal indexes; a Strapi bootstrap step extends the key's index list, so regenerate the key if it predates the stop index. Rebuild search on a running instance with `pnpm --filter @repo/strapi seed:meilisearch` (libraries, Knowledge, Journal; it loads Notices so closures index) and `pnpm --filter @repo/strapi seed:mobile-stops` (every vehicle's mapped stops, in pages of 50). Check `[mobile-stop]` warnings if search is stale.

### Testing access

- `cd qa/tests/playwright && pnpm seed:access` seeds the local fixture users (`FIXTURES` in `helpers/access-fixtures.ts`): one per Contributor Role, with `moderator-global` as the Moderator (every queue and locale); a French Knowledge-queue Moderator (`moderator-knowledge-fr`); a French Journal editor (`journal-editor-fr`); an `applicant` with five accepted submissions, for the Role Application spec; one each for granted, earned and verified Pro; one Team (`team`, a personal `team` plan grant); `staff-owner` and `staff-editor` (approved claims on the same library, as owner and editor); `team-organiser` (the organiser of a verified Team covering that library, with an active seat); `mobile-owner` (owner of a Mobile library with the Westmere sample timetable and live sharing on); and two not yet onboarded. Roles are written as Role Grants, and each seed leaves every fixture with exactly its own grants. Run it from that directory only (it reads `qa/tests/playwright/.env`; keys are in `.env.example`), with the local UI and Strapi running. The seed loads Strapi headlessly, so it needs a built Strapi: run `pnpm --filter @repo/strapi build:plugins && pnpm --filter @repo/strapi build` first, and again after Strapi changes. It's safe to re-run.
- **Local-only guard:** the seed refuses `NODE_ENV=production` and any non-local `BASE_URL`, `STRAPI_URL` or `BA_DATABASE_URL`. Role Grants, plan grants, verifications and profiles are written through a headless Strapi Document Service process, never REST.
- `npx playwright test --project=access` (same directory) runs the role, plan, export, onboarding, moderation (tab visibility, scope filtering, self-review, approve and publish, needs-info note), Role Application, `staff-area` (a staff publish, a moderated field going to the queue, a staff decision on a suggestion, a non-staff 404, the drawer) and `team` (invite, join with the matching email, assign as editor, the affiliation appearing at once on a verified Team, unassign, the seat cap) E2E. The project only exists when asked for, so it stays out of CI and the default runs.
- Fixture credentials are in the git-ignored `qa/tests/playwright/TEST-USERS.local.md`. Never commit it or paste from it.

---

## Agent skills

### Issue tracker

Issues live as local markdown files under `.scratch/<feature>/`. See `docs/agents/issue-tracker.md`.

### Triage labels

Uses canonical five-state vocabulary (needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context — one `CONTEXT.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.
