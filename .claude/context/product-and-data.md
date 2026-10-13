## What We Are Building

**libraries.global** is a comprehensive global index of libraries — every significant public, national, academic, monastic, parliamentary, and cultural library in the world. The goal is a definitive, navigable reference: every institution findable by continent → country → region → area → library, with rich detail pages for each entry.

This is not a search engine or aggregator. It is an atlas. The aesthetic and UX echoes scholarly reference works — a **light, accessible "warm paper" design** (v2, Sept 2026): ink-on-paper typography, indigo accents, borders over shadows, honest empty states. The pre-2026 dark "cartographic night" theme is retired.

**Core product pillars:**

1. **Atlas** — hierarchical location-based browsing (continent → country → region → area → library)
2. **Map** — interactive MapLibre GL globe with drill-down, clustering, and pin detail panels
3. **Search** — MeiliSearch-powered full-text search across all libraries
4. **Knowledge** (`/knowledge`, formerly Docs/Wiki) — platform knowledge base: how-tos, contribution guides, data and API. Stored as Strapi `wiki-article`, filed under `wiki-section` (the taxonomy: `name`, `slug`, `description`, `order`, `icon` as an Iconify id; the tint comes from `order` via `tintForOrder`). An article's home section is its `section` relation; the editor's extra picks in `docsSections` list it under more sections. `/knowledge` shows four pages per section with "Show all" to the section's tab (`?section=slug`); helpers in `components/docs/docs.config.ts`
5. **Journal** (`/journal`) — editorial content. Stored as Strapi `blog-article`

6. **Contribute** (`/contribute`) — moderated corrections, new libraries, library claims and edits, event feed connections, Knowledge and Journal suggestions, role applications, reviewed by community Moderators at `/contribute/moderation`; the hub adapts to the user's capabilities (see .claude/context/feature-status.md §3)
7. **User profiles** (`/profile/[username]`) — tier, points, streaks, badges, activity and followed libraries, with Public / Limited / Private visibility and per-part privacy toggles
8. **Staff area** (`/staff`): a hidden section for a library's approved staff: publish record edits, decide community suggestions, post Notices, connect event feeds and, for Mobile libraries, keep the timetable and go live from the `/live` console; reachable from any page through the Staff Drawer (`Alt+S`). Teams (`/staff/team`) let a library service's organiser assign colleagues to its libraries

9. **Events** — library calendars with provider-feed integration; see `.claude/context/feature-status.md`.

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
