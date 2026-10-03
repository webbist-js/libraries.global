# libraries.global — Project Context for Claude

## What We Are Building

**libraries.global** is a comprehensive global index of libraries — every significant public, national, academic, monastic, parliamentary, and cultural library in the world. The goal is a definitive, navigable reference: every institution findable by continent → country → region → area → library, with rich detail pages for each entry.

This is not a search engine or aggregator. It is an atlas. The aesthetic and UX echoes scholarly reference works — a **light, accessible "warm paper" design** (v2, Sept 2026): ink-on-paper typography, indigo accents, borders over shadows, honest empty states. The pre-2026 dark "cartographic night" theme is retired.

**Core product pillars:**

1. **Atlas** — hierarchical location-based browsing (continent → country → region → area → library)
2. **Map** — interactive MapLibre GL globe with drill-down, clustering, and pin detail panels
3. **Search** — MeiliSearch-powered full-text search across all libraries
4. **Knowledge** (`/knowledge`, formerly Docs/Wiki) — platform knowledge base: how-tos, contribution guides, data and API. Stored as Strapi `wiki-article`
5. **Journal** (`/journal`) — editorial content. Stored as Strapi `blog-article`

6. **Contribute** (`/contribute`) — moderated corrections, new libraries, library claims and edits, Knowledge and Journal suggestions, role applications and Region/Area requests, reviewed by community Moderators at `/contribute/moderation`; the hub adapts to the user's capabilities (see Future Goals §3)
7. **User profiles** (`/profile/[username]`) — tier, points, streaks, badges, activity and followed libraries, with Public / Limited / Private visibility and per-part privacy toggles

**Planned pillars (not yet built):** 8. **Events** — library events calendar with provider integration (see Future Goals)

---

## Scale target

**Build for every library on earth: about 2.9 million records.** Today there are hundreds, but the aim is the complete index, so every feature must still work at that size. Reasoning: `docs/adr/0004-design-for-three-million-libraries.md`.

Rules for new code:

- **Never load every library at once.** No endpoint, page, sitemap, build step or browser view may fetch, hold or loop over the whole library table. Cap every read at a fixed limit, or page through it.
- **Page by keyset, not offset.** Walk large tables with `id > after` in id order (see `/libraries/slugs` and its `meta.next`). A deep `start=` offset gets slower the further in it goes.
- **Count in the database.** Use grouped SQL (`utils/library-tally.ts`, `utils/library-location-counts.ts`) or `documents().count()`; never fetch rows only to count them in JS.
- **Ask Meilisearch the questions.** Filtered counts, facets, viewport (`_geoBoundingBox`) and "near me" queries go to the `library` index, not to Strapi row scans.
- **Split outputs that grow with the index.** Sitemaps are an index of 10,000-URL files (`lib/sitemap/`); exports are capped by `limits.exportRows`.
- **Index what you filter or sort on.** Any library column used in a filter or sort needs a database index and, if it drives search or maps, a Meilisearch filterable attribute.
- **Bulk imports bypass per-row paths:** write in batches and reindex Meilisearch in batches, not one Document Service call and one sync per library.

Known places that don't meet this yet: the Atlas downloads every library (`GET /libraries/atlas`), and location-page maps stop at 500 pins (`/libraries/map-pins`). Both are replaced by the vector tiles plan in `docs/superpowers/plans/2026-09-30-atlas-vector-tiles.md`. Don't build new features on either endpoint.

---

## Monorepo Structure

```
libraries.global/
├── apps/
│   ├── ui/            — Next.js 16 frontend (App Router)
│   ├── strapi/        — Strapi v5 CMS (headless backend + admin, custom plugins:
│   │                    content-moderation, rewards, topics, events)
│   └── sync-worker/   — events provider sync worker (Eventbrite, Spydus, Solus,
│                        Aspen, iCal, TicketSource, WeGotTickets)
└── packages/
    ├── access/         — @repo/access: capabilities, entitlements, limits (pure TS)
    ├── strapi-types/   — Generated TypeScript types from Strapi schemas
    ├── events-crypto/  — AES-256-GCM shared encryption for provider credentials
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
- GeoJSON boundary files served from `public/boundaries/`

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

**URL pattern:** `/{continentSlug}/{countrySlug}/{regionSlug}/{librarySlug}`

---

## Frontend Architecture

### Routing

All routes are under `app/[locale]/`. Key routes:

| Route                                             | Component                                                      |
| ------------------------------------------------- | -------------------------------------------------------------- |
| `/`                                               | HomePage                                                       |
| `/libraries`                                      | FindLibraryPage (faceted search/browse — "Find libraries")     |
| `/[continent]`                                    | ContinentDetailPage                                            |
| `/[continent]/[country]`                          | CountryDetailPage                                              |
| `/[continent]/[country]/[region]`                 | RegionDetailPage                                               |
| `/[continent]/[country]/[region]/[library]`       | LibraryDetailPage                                              |
| `/map`                                            | Atlas: AtlasExplorer (MapLibre GL full-screen)                 |
| `/knowledge/[section]/[slug]`                     | DocsArticlePage (Knowledge article)                            |
| `/journal/[section]/[slug]`                       | BlogArticlePage (Journal article)                              |
| `/contribute/index`, `/new`, `/[slug]`            | Index editor: find a library, add one, improve a record        |
| `/contribute/knowledge`                           | Knowledge editor landing: write new / edit existing            |
| `/contribute/knowledge/new?type=`                 | Article editor (TipTap) for a new Knowledge or Journal article |
| `/contribute/knowledge/[slug]`, `/journal/[slug]` | Article editor for an existing article, incl. translations     |
| `/contribute/knowledge/apply?role=`               | Role Application: apply to be a Knowledge or Journal editor    |
| `/contribute/moderation`, `/[documentId]`         | Moderation queue and review page (Moderators only)             |
| `/contribute/moderation/suggestions`              | Option suggestions (editorial board only)                      |
| `/auth/*`                                         | Auth flows (sign in, register, OAuth, reset password)          |

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

| Axis                                                            | Source                                                      | Governs                                                                   |
| --------------------------------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------- |
| **Contributor Role** + **Library Claims**                       | `role-grant` rows, `library-affiliation`                    | **Capabilities**: what you may submit, edit directly, connect or moderate |
| **Tier** (Points)                                               | rewards plugin                                              | Contribution quotas and earned Pro only. Never trust.                     |
| **Plan** (`public`, `free`, `pro`, `team`; `supporter` planned) | Entitlement grants, verifications, earned Pro; `paid` later | **Entitlements**: Pro features and limits                                 |

**Money never buys trust:** no plan or entitlement changes a role, points, tier, badges or moderation. `CapabilityInput` has no plan fields, and type-level tests in `packages/access` fail if one is added.

- **Roles come from Role Grants** (`api::role-grant.role-grant`), not from Strapi Users & Permissions roles (every account holds the U&P `Authenticated` role, which guards nothing) and not from Strapi admin roles. A grant gives one person one role, with `queue` (`all`, `index`, `knowledge`, `journal` or `applications`; read only for `moderator`), `scopeLocale` (`null` means every locale; read for `moderator`, `wiki_editor` and `journal_editor`; stored under that name because `locale` is reserved by Strapi), `source` (`admin`, `claim`, `application`, `migration`), `grantedBy`, `reason` and `expiresAt`. A person's roles are the union of their unexpired grants, so one person can hold several, each with its own scope. Staff add and expire grants in the Content Manager. Code writes them only through `createGrant` in `apps/strapi/src/utils/role-grants.ts`: an approved Library Claim (`grantVerifiedLibrarian`, `source: "claim"`) and an approved Role Application (`source: "application"`). `erase-account.ts` deletes them with the account.
- **`user-profile.contributorRole` is derived** and is for display only: the highest unexpired grant in `CONTRIBUTOR_ROLES` order (`highestRole`), with `isVerifiedLibrarian` true when a `verified_librarian` grant exists. Only `syncDerivedRole` writes them, run by the `role-grant` lifecycle (`src/lifeCycles/roleGrant.ts`) and by a daily cron for grants that expired (`resyncExpiredRoleGrants`). A boot migration (`migrateContributorRolesToGrants`, core-store guarded) turned every earlier `contributorRole` into a global grant. Never decide access from `contributorRole`.
- **Contributor roles:** `reader` (no grants), `contributor`, `verified_librarian`, `wiki_editor` (Knowledge: `docs.directEdit` in its locales), `journal_editor` (Journal: `journal.directEdit` in its locales), `moderator` (Moderation Scopes only: the queue and locale of each grant) and `editorial_board` (both editors in every locale, moderates every queue, and alone decides option suggestions). An editor's approved article change publishes at once in a locale they hold; anyone else's approved article lands as a Strapi draft (or a new draft article) unless the Moderator chooses **Approve and publish**.
- **Moderators** are community users with a `moderator` or `editorial_board` grant. They review on the site at `/contribute/moderation` (Future Goals §3; `docs/adr/0005-moderation-runs-in-the-frontend.md`). Strapi re-reads the caller's grants on every moderation request and checks each submission with `canModerate`: the queue (`QUEUE_OF_SUBMISSION_TYPE`) and locale must be in scope, and nobody reviews their own submission. The owner keeps the thin Strapi admin queue: admin users whose admin role has the `content-moderation` plugin's "Access the moderation queue" and "Update submission status" permissions (`docs/strapi-role-permissions.md`). Reviewer ids are stored as `ba:<Better Auth id>` or `admin:<admin id>`.
- **`@repo/access`** (`packages/access`, pure TS, imported by the UI and Strapi) exports `resolveCapabilities`, `canSubmit`, `canModerate`, `canDirectEdit`, `SUBMISSION_TYPES`, `MODERATION_QUEUES`, `QUEUE_OF_SUBMISSION_TYPE`, `Capability`, `RoleGrant`, `ModerationScope`, `toSessionCapabilities`, `fromSessionCapabilities`; `resolveEntitlements`, `can`, `limitOf`, `FEATURES`, `PlanKey`, `PlanSource`, `Feature`, `Limit`, `EARNED_PRO_HOLD_DAYS`, `isEarnedProTier`; `contributionLimits`, `TIER_NAMES`, `ROLE_APPLICATION_MIN_ACCEPTED`; `CONTRIBUTOR_ROLES`, `GRANTABLE_ROLES`, `highestRole`, `promoteRole`. `CapabilityInput` is exactly `{ signedIn, grants, claims }`. Rebuild after changes (`pnpm --filter @repo/access build`); test with `cd packages/access && pnpm test`.
- **Session fields** (Better Auth `customSession`, built by `buildSessionAccess` in `lib/session-access.ts`): `capabilities`, `claimedLibraryIds`, `moderationScopes` (`{ queue, locale }[]`), `editorLocales` (`{ docs, journal }`, each `"all"` or a list of locales), `contributorRole` (the derived label), `plan`, `planSource`, `features`, `limits` (e.g. `exportRows`: free 0, pro 10,000, team 50,000) and `profileLoaded`. They come from the Strapi `session-profile` bridge (`lib/session-profile.ts`), which returns Role Grants as `roleGrants` (capabilities) and plan grants as `grants` (entitlements); neither feeds the other. The profile is cached per user for 60 s. A profile write (`/api/profile/me`) calls `invalidateSessionProfile`, and a Role Grant write in Strapi posts `{ baUserId }` to `POST /api/internal/session/invalidate` (bridge-secret gated), so a role change usually shows on the next request. That call is best effort and per instance: the 60 s TTL is the guarantee, and other changes made in Strapi admin take effect within 60 s. `profileLoaded: false` means the bridge failed: no capabilities, plan `free`.
- **Server helpers** (`lib/access-server.ts`): `requireCapability(user, cap)` returns 401/403; `sessionCapabilities(user)` rebuilds `Capabilities` from the session for `canModerate` and `canDirectEdit` pre-checks; `requireEntitlement(user, feature)` returns 401/402 with `{ feature, upgradeUrl: "/contribute/membership" }`. Gate every Pro route with `requireEntitlement`. Missing session fields mean deny; missing `limits` mean a cap of 0.
- **Client hooks** (`lib/access-client.ts`): `useCapabilities()` → `{ has, claimedLibraryIds, moderationScopes, canDirectEdit(kind, locale), ready }` and `useEntitlements()` → `{ plan, can, ready }`. UI only: they hide or explain, and the server decides.
- **Strapi is authoritative.** The content-moderation `submission-policy` loads capabilities from the user's unexpired grants (`activeGrants`, at most 50) and runs `canSubmit` (with the submission's locale for direct article edits), the Role Application eligibility rules and the tier quotas in `create`, `saveDraft` and `finalize`. The moderation routes re-check scope on every request. Next route checks are fast pre-checks, never the only gate.
- **Pro sources** (`planSource`): `grant` (an `entitlement-grant` row: plan `pro` or `team`, optional `expiresAt`), `verified` (a `pro-verification` row: library staff, student or charity; staff create these by hand until self-serve verification ships), `earned` (Archivist tier or above, 1,500 points, plus a 90-day hold in `user-profile.earnedProUntil` after dropping below) and `paid` (reserved: no checkout until P-D1). The highest plan wins; at equal plan the order is paid, grant, verified, earned.
- **Admin-only collections:** `entitlement-grant`, `pro-verification` and `role-grant` have `routes: []` (no REST). They're visible in the content-manager and read only by the secret-gated `session-profile` bridge (and, for role grants, the submission policy). The audit collections `library-change` and `article-change` have `routes: []` too (Future Goals §3).
- **Plans page:** `/contribute/membership` (`app/[locale]/contribute/membership/page.tsx`, the Contribute section's Membership tab; components in `contribute/_components/membership/`). All plan copy and prices come from `lib/plans.ts`, labelled "Prices are placeholders"; the compare matrix is `lib/plan-compare.ts`. Never hard-code an amount elsewhere.
- **Live Pro features:** Atlas export, CSV or GeoJSON from the Atlas list view: `POST /api/export/atlas` is gated by `requireEntitlement("atlas.export")` and capped at `limits.exportRows`; its rows come from the bridge-secret-gated Strapi action `POST /api/libraries/export`. And change history values (`library.history`): every visitor sees a library's Changes section (field names and the 24-month histogram), and the page stays `force-static`; for a session with `library.history` the timeline reloads its batches from `GET /api/libraries/[slug]/history` (the segment holds a documentId), which asks Strapi for previous → next values (`?values=1` plus the bridge secret) only when `requireEntitlement(user, "library.history")` passes. Every other Pro feature is "coming soon" (`PRO_FEATURE_COPY` in `lib/plans.ts`).

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

| Component               | Purpose                                                                                  |
| ----------------------- | ---------------------------------------------------------------------------------------- |
| `Eyebrow`               | Section label with optional index number and extending bar rule                          |
| `SectionHeader`         | Section heading with italic serif suffix (`italic` prop)                                 |
| `PageHero`              | The only hero band for primary pages — breadcrumb, eyebrow pill, serif title, lead, slot |
| `SearchField`           | Site-wide search pill (magnifier, sr-only label, clear button) — use in hero slots       |
| `EditorialSection`      | Two-column image + rich-text editorial block from CMS                                    |
| `CtaBannerSection`      | Full-width CTA banner with radial gradient and aurora CTA link                           |
| `LocationGridBrowser`   | Bordered grid of location cards — rank prefix, serif name, subtitle, hover arrow         |
| `LocationContributeCTA` | Contribute / correction prompt banner                                                    |
| `Breadcrumb`            | Location breadcrumb trail                                                                |
| `Card`                  | General-purpose content card                                                             |
| `Badge`                 | Status/type badge                                                                        |
| `StatBlock`             | Stat display block                                                                       |
| `MetaRow`               | Key-value metadata row                                                                   |
| `EmptyState`            | Empty/not-found state                                                                    |
| `Pager`                 | Pagination control                                                                       |

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

### Map panel pattern (LibraryPinPanel)

Selected-pin panels are white v2 cards (`#fff` bg, `#E7E3DB` border, 20px radius) with a serif name, type-tinted badge (`tintForLibraryType`), and an indigo "Explore" CTA pill.

---

## Key Conventions

### File organisation

- `components/ds/` — design system primitives (generic, reusable)
- `components/elementary/` — layout primitives (Container, etc.)
- `components/global/` — site-wide chrome (GlobalHeader, GlobalFooter, GlobalLink)
- `components/[feature]/` — feature-specific components (continent, country, region, library, map, wiki, blog)
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

- Constants, type guards, and pure utilities: `components/map/map.helpers.ts`
- Shared types: `components/map/map.types.ts`
- Selected-pin panel: `components/map/LibraryPinPanel.tsx`
- All rendering logic (layers, sources, event handlers) stays in `components/map/InteractiveMap.tsx`

---

## Future Goals

### 1. Events & Provider Integration

Libraries host events (talks, exhibitions, reading groups). The plan:

- Add an `Event` content type to Strapi (title, description, date/time, location, library relation, eventType)
- Integrate external event providers (Eventbrite, Meetup, library-specific APIs) via a sync job
- Display events on library detail pages under a new "Events" tab
- Add a global `/events` browse page with calendar and map views
- Events should be filterable by library type, location, and category

### 2. User Accounts & Profiles

Built: accounts (Better Auth + Strapi users) and profile pages at `/profile/[username]` with avatar, bio, followed libraries, and Public / Limited / Private visibility plus per-part toggles (`publicPrefs`). Still to come:

- **Visit log** — record libraries visited with date and notes
- **Collection notes** — personal annotation layer on library entries

### 3. Contribution & moderation (built)

Community-verified accuracy, reviewed by community Moderators on the site and by the owner in Strapi admin. Hardened in P-A; specs: `docs/superpowers/specs/2026-09-26-access-contribution-pro-implementation-design.md` §4–5 and `docs/superpowers/specs/2026-09-29-community-moderation-and-audit-design.md` (plan: `docs/superpowers/plans/2026-09-30-community-moderation-and-audit.md`, which wins where they differ).

- **Plugins:** `content-moderation` (the Submission and Review Event collections, `submission-policy`, the site's moderation API in `server/controllers/moderation.ts` and `server/services/moderation.ts`, history reads in `server/services/history.ts`, `server/services/notifications.ts`, and the owner's admin queue in `admin/src/pages/ModerationDashboard.tsx` with its review modal and per-type panels in `admin/src/components/`), `rewards` (points, streaks, tiers, badges, leaderboard) and `topics` (curated topics, fed by `topic_suggestion`). Strapi loads each plugin from its built `dist/`, so run `pnpm --filter @repo/strapi build:plugins` after changing plugin code.
- **Submission types and queues** (`QUEUE_OF_SUBMISSION_TYPE`): `index` takes `correction`, `new_library`, `library_claim`, `library_edit` (claimants only), `topic_suggestion` and `location_request`; `knowledge` takes `wiki_edit` (a suggestion, or a direct block edit for an editor in that locale); `journal` takes `blog_submission`; `applications` takes `role_application`.
- **Locale on every Submission:** `contentLocale` (the payload field is `locale`; default `en`, checked against Strapi's configured locales, `GET /api/content-moderation/locales`). Drafts are found by user, type, target and locale, the payload hash includes it, the queue filters by it and `canModerate` checks it. Article apply finds the article by slug in that locale and creates the locale version when it's missing; Journal translations award `journal_translated`. The Index editor's translation mode (`/contribute/index/[slug]?locale=xx`, linked as "Translate this record" from the library page) edits only `LOCALIZED_LIBRARY_FIELDS` (`@repo/shared-data`), and the library apply ignores every other field outside the default locale.
- **State machine** (`content-moderation/server/utils/transitions.ts`): `draft → pending → approved | rejected | needs_info`, and `needs_info → pending | approved | rejected`; `approved` and `rejected` are final. Drafts are editable only while `draft`, finalizing pins a `reviewedPayloadHash`, approval runs once, and point awards are idempotent. Every transition, `finalize` included, writes a Review Event (`plugin::content-moderation.review-event`: from, to, reviewer, note) in the same transaction; they're append-only and hidden from the Content Manager. No self-review on either surface (`canModerate`, `isSelfReview` in `utils/reviewer.ts`).
- **On approval:** `new_library` creates a draft library, filed under the Moderator's target (`draftData.moderatorTarget`, set with `PUT /moderation/submissions/:documentId/target`) before the submitter's choice, and under the Region or Area of an approved Location Request it references; **Approve and publish** publishes it once continent, country and region are set. `library_claim` upserts a `library-affiliation` and creates a `verified_librarian` Role Grant (`source: "claim"`) if the user has none. `library_edit` and a record `correction` (`fields.kind: "record"`, only the changed fields plus `previous`; sent by the Index editor and by the correction drawer's structured editors) are applied to the library through the allowlist in `utils/library-record.ts` and published (C-L1). Opening hours go through the `global::opening-times` normaliser (overlaps refused), option relations arrive as `{ connect, disconnect }`, and `suggestedOptions` names link an existing option or are logged as an `option-suggestion`; a `correction` carrying the library page's Yes/No facility answers (`fields.kind: "facilities"`) connects or disconnects the mapped accessibility/amenity/service entries (`FACILITY_CHECKLIST` in `@repo/shared-data`), records confirmed "No"s in `library.absentFacilities`, and publishes; `wiki_edit` and `blog_submission` go through `utils/article-apply.ts`: a new article (`draftData.kind: "new_article"`) is created, a direct edit (`body`/`title`, editors only) is published, a suggestion with content (`proposedBody`) is written to the article's draft version (or published, when the Moderator chooses **Approve and publish**), and the submission's locale picks the language, so a translation creates that locale version; `topic_suggestion` approves the topic; a shared photo (`correction` with `fields.kind: "photo"`, the submitter's own upload only) becomes the library's hero image if it has none, else joins the gallery, with the credit and licence as its caption (`utils/library-photo.ts`); `role_application` creates the `wiki_editor` or `journal_editor` grants (`source: "application"`, one per requested locale, or one for every locale); `location_request` creates the Region or Area, published, with a slug unique within its parent and the Moderator's name and type label if they changed them. New libraries, new articles, Regions, Areas and applications record what they created in `resultDocumentId`. Every type awards points (`journal_accepted` for Journal) except `role_application` and `location_request`.
- **Moderation on the site:** Strapi's `/api/content-moderation/moderation/*` routes (list with status, queue, type, locale and search filters; detail with the record's live values, or the live article and, for a translation, its source locale; status; target; events; stats; relation labels; option suggestions) take the bridge secret plus `X-Ba-User-Id`, re-read the caller's grants on every request (403 without a Moderation Scope), and answer 404 for a submission that's missing or out of scope, so scope can't be probed; your own submission is 403. Next proxies them under `app/api/moderation/*` through `lib/moderation-proxy.ts`: `requireCapability("moderate.queue")`, writes 30 and reads 120 a minute per user, allowlisted query parameters and body keys, identity from the session. Pages: `/contribute/moderation` (the Moderation tab, shown only with `moderate.queue`), `/contribute/moderation/[documentId]` (the review page: per-type panels from `components/moderation/`, Approve, Approve and publish where it applies, Needs changes and Reject, a note required for the last two, and the Review Event thread) and `/contribute/moderation/suggestions` (editorial board only). The admin queue shares the same service methods.
- **Role Applications:** `/contribute/knowledge/apply?role=wiki_editor|journal_editor` (`components/contribute/RoleApplicationForm.tsx`), linked from the Knowledge and Journal landings and `RolesTable`. It shows "{n} of 5 accepted changes" from `acceptedCount` in `/api/contribute/standing` and disables the form below `ROLE_APPLICATION_MIN_ACCEPTED` (5 approved submissions that aren't applications); the form takes a role, languages (none means all), a 20–2,000 character statement and up to five sample links, and shows any open or decided application with the moderator's note. `submission-policy` enforces the same rules, plus no open application for that role and no grant that already covers it. Plan, Tier and Points never count.
- **Location Requests:** "Not listed?" under the Region and Area selects in the Index editor (`LocationHierarchySelector`) opens `LocationRequestForm` for the selected country or region; the request's `fields` are `kind` (`region` or `area`), `name`, `typeLabel`, `countryDocumentId`, `regionDocumentId` (areas), `note` and `evidenceUrl`. The `new_library` carries `proposedRegionName`/`proposedAreaName` and `locationRequestDocumentId`, and the Moderator can edit the name and type label in `LocationRequestPanel`.
- **Notifications** (`server/services/notifications.ts`, templates in `server/utils/email-templates.ts`): queued after the transition commits, off the request path, and never block or undo it. The submitter is emailed when a submission is approved, rejected or sent back (respecting `notifPrefs.editsReviewed`, except Role Application decisions, which always send); a Role Application or Location Request reaching `pending` emails `MODERATORS_EMAIL` (default `moderators@libraries.global`). Links use `APP_PUBLIC_URL`. Without Mailgun or Mailtrap credentials (`server/utils/email-config.ts`) every email is logged and skipped.
- **Audit trail:** the document-service middleware `apps/strapi/src/documentMiddlewares/change-records.ts` (registered in `src/index.ts`) records every library write as Change Records (`api::library-change.library-change`: one row per changed field, grouped by `batchId`, with `action`, `contentLocale`, `versionStatus`, `source` (`submission`, `admin`, `api_token`, `import`, `system`), actor, reviewer and `submissionDocumentId`) and every Knowledge or Journal write as an Article Change (`api::article-change.article-change`: `created`, `edited`, `translated`, `published`, `unpublished` or `deleted`, with a `bodyHash` but no body diff). The actor comes from `utils/change-context.ts`: the moderation apply's context, else the admin user, the API token (`import` when its name starts with `import` or `ingest`) or the bridge user, else `system`. Inserts run inside the caller's transaction, so an approval whose record can't be written rolls back. `strapi.db.query` writes (derived fields) bypass it by design. `CHANGE_RECORDS_ENABLED=false` is the emergency kill switch and logs loudly at boot. Both collections are append-only, with no REST routes.
- **History:** public content-moderation routes `GET /libraries/:documentId/history` (published Change Batches; previous → next only with `values=1` and the bridge secret), `GET /libraries/:documentId/history/stats` (24 months of batches, top fields, actions, verification months) and `GET /articles/:kind/:documentId/history`. The library page's **Changes** section (`LibraryChangesSection`, `ChangeHistogram`, `LibraryChangeTimeline`) shows them, Pro values as in the Access model; Knowledge and Journal articles show `ArticleEditHistory`. Usernames appear only when the contributor's profile activity is public. A one-off boot backfill (`backfillLibraryHistory`) gives every approved `library_edit` and record `correction` from before Change Records one batch of field names; claims, facility answers, photos and free-text corrections are not backfilled.
- **UI:** the `/contribute` hub adapts to `useCapabilities()`; tabs Hub, Community, Index editor (`index`, `index/new`, `index/[slug]`, plus `correct/[slug]` and `claim`), Knowledge editor (`knowledge`, `knowledge/new`, `knowledge/[slug]`, `knowledge/journal/[slug]`, `knowledge/apply`), My submissions, Moderation (Moderators only) and Membership; `events` sits under no tab. The article editor lives in `components/contribute/article-editor/` (TipTap; `articleBlocks.ts` converts to and from the Strapi dynamic zone).
- **Structured corrections:** the "Suggest a correction" drawer and the hub's correction step load the record from `/api/contribute/library/[slug]` and open the Index editor's own fields for the chosen category (`components/contribute/CorrectionEditor.tsx`, rules in `correction.logic.ts`): hours, address, name, links, open status, accessibility, services and amenities. Collections and "Something else" stay free text and are applied by hand. The moderator's review panel shows the library's live values and option names from Strapi (`utils/record-review.ts`), never the contributor's.
- **Suggested additions:** new option names from approved corrections are tallied in `plugin::content-moderation.option-suggestion` (one per list and name, with requests and libraries); signed-in contributors vote from the hub (`option-vote`, one per user). The editorial board decides at `/contribute/moderation/suggestions` (or the moderation admin's Suggestions tab), monthly: accepting creates (or reuses) the option and links it to every library that asked; declined names stay declined.
- **Content safety:** `@repo/shared-data` `content-safety.ts` (the `obscenity` matcher plus link rules: adult domains and TLDs, shorteners, non-http schemes) runs in the forms and, authoritatively, in `submission-policy.checkContent` on create and finalize. Real place names are allowed (`SAFE_TERMS`, plus the target library's own name and address).
- **Still to come (P-C):** the `needs_info` thread and resubmission (C-M1, C-M2): the contributor sees the moderator's note but can't reply, or edit and resubmit; applying free-text `correction` changes (they still only award points).

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
- **Meilisearch local dev:** container `librariesglobal-meilisearch` on `http://localhost:7701` (port 7700 is occupied by an unrelated project's container — do not touch it). Fresh instance? Run `node apps/strapi/scripts/seed-meilisearch.mjs` to seed the `library` index from Strapi.
- **Node 22 required** (`nvm use`) — a v20 shell will start but violates `engines`
- **TypeScript types** for Strapi are generated into `packages/strapi-types` — regenerate after schema changes
- **Lint** runs on pre-commit via ESLint + SonarJS; fix all errors before committing (warnings are tolerated)
- **No `overflow-x-hidden` on page wrappers** — it breaks sticky headers and negative margin heroes
- **`-mt-14` hero pattern** requires the parent chain to have no `overflow: hidden` ancestors
- Always use `formatStrapiMediaUrl()` for Strapi media URLs — it handles relative `/uploads/` paths and absolute CDN paths
- The `entityRef` field (e.g. `GB-BL-001`) is the stable external identifier for a library — use it for cross-referencing and data imports

### Testing access

- `cd qa/tests/playwright && pnpm seed:access` seeds the local fixture users (`FIXTURES` in `helpers/access-fixtures.ts`): one per Contributor Role, with `moderator-global` as the Moderator (every queue and locale); a French Knowledge-queue Moderator (`moderator-knowledge-fr`); a French Journal editor (`journal-editor-fr`); an `applicant` with five accepted submissions, for the Role Application spec; one each for granted, earned and verified Pro; one Team; and two not yet onboarded. Roles are written as Role Grants, and each seed leaves every fixture with exactly its own grants. Run it from that directory only (it reads `qa/tests/playwright/.env`; keys are in `.env.example`), with the local UI and Strapi running. It's safe to re-run.
- **Local-only guard:** the seed refuses `NODE_ENV=production` and any non-local `BASE_URL`, `STRAPI_URL` or `BA_DATABASE_URL`. Role Grants, plan grants, verifications and profiles are written through a headless Strapi Document Service process, never REST.
- `npx playwright test --project=access` (same directory) runs the role, plan, export, onboarding, moderation (tab visibility, scope filtering, self-review, approve and publish, needs-info note), Role Application and Location Request E2E. The project only exists when asked for, so it stays out of CI and the default runs.
- Fixture credentials are in the git-ignored `qa/tests/playwright/TEST-USERS.local.md`. Never commit it or paste from it.

---

## Agent skills

### Issue tracker

Issues live as local markdown files under `.scratch/<feature>/`. See `docs/agents/issue-tracker.md`.

### Triage labels

Uses canonical five-state vocabulary (needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context — one `CONTEXT.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.
