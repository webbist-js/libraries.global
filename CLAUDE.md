# libraries.global — Project Context for Claude

## What We Are Building

**libraries.global** is a comprehensive global index of libraries — every significant public, national, academic, monastic, parliamentary, and cultural library in the world. The goal is a definitive, navigable reference: every institution findable by continent → country → region → area → library, with rich detail pages for each entry.

This is not a search engine or aggregator. It is an atlas. The aesthetic and UX echoes scholarly reference works — a **light, accessible "warm paper" design** (v2, Sept 2026): ink-on-paper typography, indigo accents, borders over shadows, honest empty states. The pre-2026 dark "cartographic night" theme is retired.

**Core product pillars:**

1. **Atlas** — hierarchical location-based browsing (continent → country → region → area → library)
2. **Map** — interactive MapLibre GL globe with drill-down, clustering, and pin detail panels
3. **Search** — MeiliSearch-powered full-text search across all libraries
4. **Wiki** — editorial knowledge base (library history, classification systems, etc.)
5. **Blog** — editorial content

**Planned pillars (not yet built):** 6. **Events** — library events calendar with provider integration (see Future Goals) 7. **Contribute** — user-submitted corrections and additions through a moderated layer 8. **User profiles** — saved libraries, visit logs, collection notes

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
    ├── strapi-types/   — Generated TypeScript types from Strapi schemas
    ├── events-crypto/  — AES-256-GCM shared encryption for provider credentials
    ├── design-system/  — shared theme css consumed by both apps
    └── shared-data/    — shared static data
```

**Package manager:** pnpm with workspaces.

---

## Tech Stack

### Frontend (`apps/ui`)

- **Next.js 15** — App Router, RSC-first, `server-only` guards on data fetching
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

| Route                                       | Component                                                  |
| ------------------------------------------- | ---------------------------------------------------------- |
| `/`                                         | HomePage                                                   |
| `/index`                                    | FindLibraryPage (faceted search/browse — "Find libraries") |
| `/[continent]`                              | ContinentDetailPage                                        |
| `/[continent]/[country]`                    | CountryDetailPage                                          |
| `/[continent]/[country]/[region]`           | RegionDetailPage                                           |
| `/[continent]/[country]/[region]/[library]` | LibraryDetailPage                                          |
| `/map`                                      | FullMapPage (MapLibre GL full-screen)                      |
| `/wiki/[section]/[slug]`                    | WikiArticlePage                                            |
| `/blog/[slug]`                              | BlogArticlePage                                            |
| `/auth/*`                                   | Auth flows (sign in, register, OAuth, reset password)      |

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

| Component               | Purpose                                                                          |
| ----------------------- | -------------------------------------------------------------------------------- |
| `Eyebrow`               | Section label with optional index number and extending bar rule                  |
| `SectionHeader`         | Section heading with italic serif suffix (`italic` prop)                         |
| `HeroTitle`             | Full-bleed serif hero title                                                      |
| `HeroEyebrow`           | Hero-scale eyebrow label                                                         |
| `HeroStat`              | Single stat cell — mono label + serif 40px value + optional note                 |
| `HeroStatsGrid`         | Glassmorphic grid wrapping `HeroStat` cells (blur, border, backdrop)             |
| `HeroInlineTabNav`      | Inline anchor-link tab nav with aurora-tinted first tab                          |
| `EditorialSection`      | Two-column image + rich-text editorial block from CMS                            |
| `CtaBannerSection`      | Full-width CTA banner with radial gradient and aurora CTA link                   |
| `LocationGridBrowser`   | Bordered grid of location cards — rank prefix, serif name, subtitle, hover arrow |
| `MapSectionHeader`      | Standard map section heading (Eyebrow + SectionHeader + descriptive p)           |
| `LocationContributeCTA` | Contribute / correction prompt banner                                            |
| `Breadcrumb`            | Location breadcrumb trail                                                        |
| `Card`                  | General-purpose content card                                                     |
| `Badge`                 | Status/type badge                                                                |
| `StatBlock`             | Stat display block                                                               |
| `MetaRow`               | Key-value metadata row                                                           |
| `EmptyState`            | Empty/not-found state                                                            |
| `Pager`                 | Pagination control                                                               |
| `WikiCards`             | Wiki article card layouts                                                        |

### Primary CTA pattern

Primary CTAs are indigo pills: `bg-(--t-accent-primary) hover:bg-(--t-accent-primary-hover) text-white rounded-full font-semibold`. Secondary actions are white pills with a `--t-border-hi` border. The old aurora-cyan CTA constants in `lib/styles.ts` are deprecated — do not use them in new code.

### Inline styles vs Tailwind

- **Use inline styles** (via `style={{}}`) for design-token values — colours, fonts, letter-spacing, specific pixel measurements
- **Use Tailwind** for layout, spacing scales, responsive breakpoints, and hover/group state that needs pseudo-classes
- This is intentional — it keeps token values inspectable and prevents Tailwind's purger from stripping dynamic values

### Header pattern

v2 pages use normal in-flow light heroes — the header renders solid from the start. The legacy `data-transparent-header` + `-mt-14` scroll-reveal pattern is retired for v2 pages (the CSS machinery still exists in globals.css for any stragglers). **Never add `overflow-x-hidden` or `overflow: hidden` to the page wrapper or `<main>`** — it breaks `position: sticky`.

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
- DS components: PascalCase noun (`HeroStat`, `LocationGridBrowser`)
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

Auth infrastructure is already built (Better Auth + Strapi users). The next layer:

- **My Libraries** — save/bookmark libraries (stored in Strapi as user-library relations)
- **Visit log** — record libraries visited with date and notes
- **Collection notes** — personal annotation layer on library entries
- Profile pages at `/profile/{username}` (public or private toggle)
- User avatar and bio stored in Strapi user profile

### 3. Content Submission & Moderated Contribution Layer

The core differentiator — community-verified accuracy:

- **Correction submissions** — any user can flag incorrect data (wrong hours, closed status, wrong address)
- **Addition submissions** — propose a new library entry
- **Moderation queue** — submissions land in a Strapi draft queue; editors review and publish
- Strapi content type: `Submission` (type: correction|addition, targetLibrary relation, fields JSON, status: pending|approved|rejected, submittedBy user relation)
- UI: `/contribute` route with submission forms; authenticated users only
- Notification system: email confirmation on submission, email on review decision
- Build on top of existing `LocationContributeCTA` component which already links to `/contribute`

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

- i18n is scaffolded (next-intl, Strapi i18n plugin)
- Primary locale: English
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

---

## Agent skills

### Issue tracker

Issues live as local markdown files under `.scratch/<feature>/`. See `docs/agents/issue-tracker.md`.

### Triage labels

Uses canonical five-state vocabulary (needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context — one `CONTEXT.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.
