# Library Index — Design Spec

**Goal:** A full-screen, searchable, filterable register of every library in the index at `/index` — the definitive "all libraries" browse experience, distinct from the Atlas (hierarchy-driven) and Map (spatial) views.

**Architecture:** Client-side MeiliSearch search with URL-persisted filter state. SSR first-page render for SEO and performance. Sidebar + 2-column card grid. Mirrors the Events programme page's layout language.

**Tech Stack:** Next.js 15 App Router, MeiliSearch `library` index, `useSearchParams`/`router.push` for URL state, Tailwind + `T` design tokens.

---

## 1. Route & Nav

- New route: `apps/ui/src/app/[locale]/index/page.tsx`
- Add **"Index"** to `NAV_LINKS` in `GlobalHeader.tsx` between "Atlas" and "Map": `{ label: "Index", href: "/index" }`
- Page is `force-dynamic`; first-page SSR via `searchLibraries()` called server-side, subsequent pages client-side

---

## 2. Hero Section

Full-bleed section with `DotHeroCanvas variant="aurora"` (reuse existing). Content:

**Left column:**

- Eyebrow (mono, uppercase): `THE INDEX · EVERY LIBRARY ON EARTH`
- Large serif title (clamp 4rem–7rem): `Every library,` then italic `indexed.`
- Descriptor paragraph: "A complete, sortable, filterable register of the world's libraries — public, academic, national, special. Cross-referenced by continent, country, region and area. Last reindexed [N] minutes ago."

**Right column — stat grid (4 cells):**
| Stat | Label |
|---|---|
| Total library count from MeiliSearch | Libraries |
| Country count (from Strapi `/countries?pagination[pageSize]=1` meta total) | Countries |
| Region count (from Strapi `/regions` meta total) | Regions |
| Percent with `operationalStatus = open` | Open now |

Stats are fetched server-side at page load (30-min revalidate). Use `HeroStatsGrid` DS component.

---

## 3. Geo Filter Bar (sticky, below hero)

Horizontal scrollable row, sticky below the global header. Three hierarchical selectors + reset + sort:

```
[ Europe ▾ ]  [ United Kingdom ▾ ]  [ Greater London ▾ ]  [ Camden ▾ ]   RESET   [ Most visited ▾ ]
```

- Each selector is a `<select>` or custom dropdown populated from MeiliSearch facets or Strapi
- Continent options: hardcoded from existing continent slugs
- Country options: dynamically loaded when continent selected (Strapi `/countries?filters[continent][slug][$eq]=europe`)
- Region options: loaded when country selected
- Area options: loaded when region selected
- Selecting any level clears deeper levels and re-runs search
- Sort options: `Most visited` (default, by `featured` then name), `A–Z`, `Newest`, `Most collections`

**Active filter pills row** (appears below geo bar when filters active):

```
[ ALL ]  [ PUBLIC · 21,249 ]  [ NATIONAL ]  [ ACADEMIC ]  [ SPECIAL ]  [ SCHOOL ]  [ OPEN NOW ]  [ FREE ENTRY ]  ...  [ CLEAR ALL ]
```

- Pills derived from sidebar state; clicking removes that filter
- Shows result count: `11,420 libraries in Greater London, United Kingdom`

---

## 4. Layout: Sidebar + Grid

Desktop: `grid-cols-[280px,1fr]` gap-8. Mobile: sidebar collapsed behind toggle.

### 4a. Sidebar Filter Sections

Each section has a mono uppercase section label + number prefix (§ 01, § 02, etc.).

**§ 01 · Library type** — checkboxes with facet counts from MeiliSearch:

- Public
- Academic / university
- National & legal deposit ← map to `National` + `Parliamentary`
- Special / archives ← map to `Special` + `Archive`
- School
- Municipal
- Monastic
- Mobile / bookmobile ← map to `Mobile`
- Cultural
- Digital
- Private
- Other

**§ 02 · Status & Access** — checkboxes:

- Open today (filter `operationalStatus = open`)
- Free entry (no existing field — skip for v1, add to roadmap)
- Reader pass required (no existing field — skip for v1)
- Temporarily closed (`operationalStatus = temporarily_closed`)
- Appointment only (`operationalStatus = appointment_only`)

**§ 03 · Collection size** — range slider (0 – 1,000,000+):

- Maps to MeiliSearch numeric range filter on a `collectionSize` attribute
- Note: `collectionStats` is a component array in Strapi — for v1, skip this filter; mark as roadmap

**§ 04 · Founded** — year range slider (oldest known year – present):

- Filter on `foundedYear` attribute in MeiliSearch
- Note: `foundedYear` is a string field in Strapi — needs numeric denormalization in MeiliSearch indexer; skip for v1

**§ 05 · Facilities** — checkboxes (amenity slugs, multi-select OR):

- Wi-Fi, Café, Children's room, Study rooms, Makerspace, Computers, Printing, Bookable seats
- Requires `amenity_slugs` array attribute in MeiliSearch (denormalized from `amenities` relation)
- Skip for v1 (not in MeiliSearch index yet); mark as roadmap

**§ 06 · Languages** — checkboxes:

- Requires `language_codes` array attribute; skip for v1

**Featured only** — toggle:

- Filter `featured = true`

**Reset all** — button at bottom of sidebar

### 4b. Library Index Grid

- 2 columns on desktop (`grid-cols-2`), 1 on mobile
- 24 results per page
- Pagination: `Prev | 1 2 3 4 … Next` row below grid

### 4c. Library Index Card

Dark card (`bg: T.bg.deep`, border `T.border.line`, rounded-2xl) with:

**Image area** (aspect-ratio 16/9 or fixed 260px height):

- `heroImage` if available, else gradient placeholder (same 3-layer radial used in FeaturedEventCard)
- Desaturated 0.75 + brightness 0.85 filter on real images
- Gradient vignette overlay
- **Top-left overlay:** entity-ref chip (mono, `GB-BL-001`) + type badge (coloured square + label)
- **Top-right overlay:** operational status pill (`OPEN · 09:00–19:30` or `CLOSED` etc.)

**Content area** (padding 16px 20px):

- Breadcrumb (mono, 9px, uppercase): `EUROPE · UK · GREATER LONDON · CAMDEN`
- Library name (serif, clamp 1.3rem–1.6rem, `-0.02em` tracking)
- Summary text (2 lines, `T.ink.low`, 13px)
- Stats row (mono, small): primary collection stat (volumes) · founded year · N services/amenities
- Tag chips: amenity/service slugs (first 2–3 visible) + `+N` overflow chip
- Bottom row: `[ Explore → ]` aurora CTA + `[ ♥ Save ]` button (right-aligned, auth-gated)

**Featured libraries** get a `✦ FEATURED` gold badge in top-left instead of entity-ref.

---

## 5. Browse Libraries Elsewhere

Section below the grid (after pagination). Heading: `Browse libraries` _`elsewhere.`_

**Continent tabs** (scrollable, same StickySubNav style but non-sticky here):
`All (412,958) | Africa (10,135) | Antarctica (31) | Asia (109,874) | Europe (79,328) | North America (83,719) | Oceania (11,465) | South America (76,154)`

Tab click filters the continent in sidebar, re-runs search, and scrolls to grid.

**Areas in [selected region]** grid (3 columns):
When a region/country is selected, show borough/area breakdown with library counts:

```
Camden        307    Westminster  299    Islington   192    Hackney  196
Tower Hamlets 285    Southwark    280    Lambeth      270    ...
```

`+ 32 more boroughs →` expander link. Clicking an area applies area filter.

---

## 6. MeiliSearch Extensions Required

The following changes to `lib/meilisearch.ts` are needed:

```ts
// Extend LibrarySearchParams
interface LibrarySearchParams {
  query?: string
  libraryTypes?: string[] // existing
  operationalStatuses?: string[] // existing
  continentSlugs?: string[] // existing
  countrySlugs?: string[] // NEW
  regionSlugs?: string[] // NEW
  areaSlugs?: string[] // NEW
  featured?: boolean // NEW
  sort?: "name:asc" | "name:desc" | "featured:desc" // NEW
  page?: number
  hitsPerPage?: number
}
```

MeiliSearch `library` index must have `country_slug`, `region_slug` as **filterable attributes** (update index settings in the MeiliSearch sync job or via admin). `featured` already in hit type, add as filterable.

---

## 7. New API Route: `/api/library-stats`

Server-side endpoint returning counts for the hero stats:

```ts
GET /api/library-stats
→ {
    totalLibraries: number,   // from MeiliSearch index stats
    totalCountries: number,   // from Strapi /countries meta
    totalRegions: number,     // from Strapi /regions meta
    percentOpen: number,      // from MeiliSearch facet on operationalStatus
  }
```

Cached at 30 minutes. Used only by the hero section SSR.

---

## 8. File Structure

```
apps/ui/src/
  app/[locale]/index/
    page.tsx                       ← SSR shell, fetches first page + stats
  components/library-index/
    LibraryIndexPage.tsx           ← "use client", owns filter state + URL sync
    LibraryIndexHero.tsx           ← hero (SSR, receives stats as props)
    LibraryIndexGeoFilterBar.tsx   ← sticky geo selector + active pills
    LibraryIndexSidebar.tsx        ← filter sidebar
    LibraryIndexGrid.tsx           ← card grid + pagination
    LibraryIndexCard.tsx           ← individual library card
    LibraryBrowseElsewhere.tsx     ← continent tabs + area grid
  app/api/library-stats/
    route.ts                       ← stats endpoint
```

Modify:

- `lib/meilisearch.ts` — extend `LibrarySearchParams`, update `searchLibraries()`
- `components/global/GlobalHeader.tsx` — add Index to nav

---

## 9. URL State Shape

All filter state is persisted in query params for shareability:

```
/index?q=british+library&type=National,Special&status=open&continent=europe&country=gb&page=2
```

State is read on mount from `useSearchParams()`, written via `router.replace()` on change.

---

## 10. Out of Scope (v1)

- Collection size slider (requires MeiliSearch numeric attribute not yet indexed)
- Founded year slider (requires numeric conversion of string `foundedYear`)
- Facilities / language checkboxes (requires MeiliSearch array attributes not yet indexed)
- Free entry / reader-pass filters (no field in schema)
- Save/bookmark functionality (auth feature — separate spec)
- Map view toggle (exists on Map page already)
- "Most visited" sort (no visit count data available)
