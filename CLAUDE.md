# libraries.global — Project Context for Claude

## What We Are Building

**libraries.global** is a comprehensive global index of libraries — every significant public, national, academic, monastic, parliamentary, and cultural library in the world. The goal is a definitive, navigable reference: every institution findable by continent → country → region → area → library, with rich detail pages for each entry.

This is not a search engine or aggregator. It is an atlas. The aesthetic and UX deliberately echoes cartographic archives and scholarly reference works — dark, typographically rich, with geographic wayfinding at its core.

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
│   ├── ui/          — Next.js 15 frontend (App Router)
│   └── strapi/      — Strapi v5 CMS (headless backend + admin)
└── packages/
    └── strapi-types/ — Generated TypeScript types from Strapi schemas
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

| Route                                       | Component                                             |
| ------------------------------------------- | ----------------------------------------------------- |
| `/`                                         | HomePage                                              |
| `/[continent]`                              | ContinentDetailPage                                   |
| `/[continent]/[country]`                    | CountryDetailPage                                     |
| `/[continent]/[country]/[region]`           | RegionDetailPage                                      |
| `/[continent]/[country]/[region]/[library]` | LibraryDetailPage                                     |
| `/map`                                      | FullMapPage (MapLibre GL full-screen)                 |
| `/wiki/[section]/[slug]`                    | WikiArticlePage                                       |
| `/blog/[slug]`                              | BlogArticlePage                                       |
| `/auth/*`                                   | Auth flows (sign in, register, OAuth, reset password) |

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

### Color tokens (`T`)

```ts
T.bg.void // #030511 — page root
T.bg.space // #050816 — standard page background
T.bg.deep // #070b1e — card/panel interior
T.bg.surface // #060b19 — elevated card

T.ink.base // #f4f7ff — primary text
T.ink.dim // rgba(...,.72) — secondary text
T.ink.low // rgba(...,.48) — tertiary / labels
T.ink.faint // rgba(...,.30) — placeholder / disabled
T.ink.ghost // rgba(...,.14) — hairlines / ghost states

T.border.line // rgba(255,255,255,.08) — standard border
T.border.hi // rgba(255,255,255,.16) — prominent border

T.accent.aurora // #7fdfff — primary CTA, aurora tint
T.accent.violet // #a390ff — secondary accent
T.accent.ember // #ffb88a — warm accent
T.accent.gold // #e8c98a — pillar/featured marker
T.accent.ok // #8ef0b3 — success/open states
T.accent.warn // #ffcf7a — warning states
T.accent.danger // #ff8a8a — error/closed states
```

### Typography (`T.font`)

| Token          | Font           | Use                                                |
| -------------- | -------------- | -------------------------------------------------- |
| `T.font.serif` | Fraunces       | Hero titles, large numerals, editorial headings    |
| `T.font.mono`  | JetBrains Mono | Labels, metadata, chips, coordinates, stats labels |
| `T.font.sans`  | Roboto         | Body copy, UI chrome                               |

**Rule:** Large data values (counts, years, coordinates) always use `T.font.serif`. Labels and categories always use `T.font.mono` with `letterSpacing: ".12em–.22em"` and `textTransform: "uppercase"`.

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

### Aurora CTA pattern

CTA buttons use the aurora colour. Prefer the named constants from `lib/styles.ts`:

```ts
import { auroraCtaSm, auroraCtaMd, auroraCtaLg } from "@/lib/styles"
// sm = px-5 py-2.5  (editorial inline)
// md = px-7 py-3    (banner CTAs)
// lg = px-8 py-3.5  (hero / journey CTAs)
```

Never hardcode the `border-[rgba(127,223,255,.35)] bg-[rgba(127,223,255,.1)] text-[#7fdfff]` string directly.

### Inline styles vs Tailwind

- **Use inline styles** (via `style={{}}`) for design-token values — colours, fonts, letter-spacing, specific pixel measurements
- **Use Tailwind** for layout, spacing scales, responsive breakpoints, and hover/group state that needs pseudo-classes
- This is intentional — it keeps token values inspectable and prevents Tailwind's purger from stripping dynamic values

### Transparent sticky header pattern

Pages with a full-bleed hero use a scroll-driven animation to transition the header from transparent to opaque:

- Add `data-transparent-header=""` to the hero `<section>`
- Add `-mt-14` to the hero section (pulls content behind the 56px sticky header)
- **Never add `overflow-x-hidden` or `overflow: hidden` to the page wrapper or `<main>`** — it breaks `position: sticky` and the negative margin trick

### Page shell pattern

All location detail pages follow this structure:

```tsx
<div className="relative isolate flex min-h-screen w-full flex-col bg-[#050816] text-white">
  <GlobalHeader locale={locale} navbar={navbar} />
  <main className="relative z-10 flex-1">
    <section id="overview" data-transparent-header="" className="... -mt-14 ...">
      {/* Hero */}
    </section>
    {/* Content sections */}
    <LocationContributeCTA ... />
  </main>
</div>
```

### Map panel pattern (LibraryPinPanel)

Selected-pin panels are dark glassmorphic cards (`#070d1e` bg, `rgba(255,255,255,.09)` border) with:

- Hero image with gradient overlay
- Aurora CTA for "Explore" link
- Mono chip labels (type, status)
- Gold chip for featured/Pillar libraries (`T.accent.gold`)

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
- **TypeScript types** for Strapi are generated into `packages/strapi-types` — regenerate after schema changes
- **Lint** runs on pre-commit via ESLint + SonarJS; fix all errors before committing (warnings are tolerated)
- **No `overflow-x-hidden` on page wrappers** — it breaks sticky headers and negative margin heroes
- **`-mt-14` hero pattern** requires the parent chain to have no `overflow: hidden` ancestors
- Always use `formatStrapiMediaUrl()` for Strapi media URLs — it handles relative `/uploads/` paths and absolute CDN paths
- The `entityRef` field (e.g. `GB-BL-001`) is the stable external identifier for a library — use it for cross-referencing and data imports
