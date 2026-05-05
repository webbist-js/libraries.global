# Events Landing Page Rework — Design Spec

**Goal:** Rework the `/events` programme page to match the new design: larger hero, carousel featured section, grid card listing with image thumbnails, a much richer filter sidebar, paginated results, and an enhanced analytics section. Mirror the Library Index's layout language throughout.

**Architecture:** All filtering remains client-side via the existing `/api/public-proxy/api/events/global` route. Add pagination to the `/global` endpoint. New `/featured?count=N` endpoint for carousel. Sidebar gains more filter categories. Card grid replaces timeline rows.

**Tech Stack:** Next.js 15, Strapi Events plugin (content-api routes), existing `FilterState`, Tailwind + `T` tokens, existing `DotHeroCanvas variant="events"`.

---

## 0. Design System — Component Reuse Plan

### Existing DS components to reuse (no changes needed)

| Component                    | Where used                                                                              |
| ---------------------------- | --------------------------------------------------------------------------------------- |
| `HeroTitle`                  | Events hero heading                                                                     |
| `HeroEyebrow`                | Events hero eyebrow                                                                     |
| `HeroStatsGrid` + `HeroStat` | Hero 4-stat grid                                                                        |
| `StickySubNav`               | Not used (no section tabs for events); may be used for continent tabs in Browse section |
| `EventTypeChip`              | Event card type badge; sidebar category labels (derive from `EVENT_TYPE_META`)          |
| `PriceBadge`                 | Event card price display                                                                |
| `EmptyState`                 | Empty state when no events match filters                                                |
| `Badge`                      | Status chips on cards                                                                   |
| `Eyebrow`                    | Section headings throughout                                                             |
| `SectionHeader`              | Analytics and browse section headings                                                   |
| `PageShell`                  | Page wrapper                                                                            |

### New DS components (domain-agnostic, shared with Library Index)

These live in `components/ds/` and have no events- or library-specific knowledge:

| Component              | Responsibility                                                                                                   |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `IndexPager`           | Numeric pagination: `Prev \| 1 2 3 … N \| Next \| Go to [  ]`                                                    |
| `FilterSidebarSection` | `§ N · LABEL` wrapper: section number + mono uppercase label + expandable children                               |
| `CardImageBlock`       | Image area: gradient fallback, desaturation + brightness filter, vignette overlay, top-left slot, top-right slot |

### New events-specific components

| Component                | Notes                                                      |
| ------------------------ | ---------------------------------------------------------- |
| `EventCard`              | Composes `CardImageBlock` + `EventTypeChip` + `PriceBadge` |
| `EventCardGrid`          | Card grid + `IndexPager`                                   |
| `EventsGeoFilterBar`     | Continent/country/region selectors + active filter chips   |
| `EventsBrowseElsewhere`  | Continent tabs + country/area grid                         |
| `EventsDailyVolumeChart` | SVG polyline chart                                         |
| `FeaturedEventsCarousel` | Wraps `FeaturedEventCard` in scrollable carousel           |

---

## 1. Hero Redesign

Replace current modest hero with a larger editorial statement.

**Left column (60%):**

- Eyebrow (via `HeroEyebrow`): `THE PROGRAMME`
- Large display serif via `HeroTitle` (clamp 5rem–9rem, weight 400, tracking -0.02em, line-height 0.9):
  `Tonight,` _(roman)_ `and` _(break)_ `the next two` _(break)_ `thousand nights.` _(italic)_
- Descriptor (body, `T.ink.low`, 15px): Static constant string — `"Author talks, exhibitions, classes, storytime, archive tours. Ingested live from Eventbrite, TicketSource, library calendars and direct partners. Filterable by anywhere, when, format and language."` _(roadmap: move to a Strapi single-type `EventsPageConfig` for editorial control)_

**Right column (40%) — 4-stat grid via `HeroStatsGrid` + `HeroStat`:**

| Value                               | Label            | Source                                                                                                    |
| ----------------------------------- | ---------------- | --------------------------------------------------------------------------------------------------------- |
| `stats.totalThisWeek`               | Events this week | Existing `/stats`                                                                                         |
| `stats.totalThisMonth`              | This month       | New field on `/stats` (see §7a)                                                                           |
| `stats.topCountryName` (city label) | In [country]     | Derived from first entry of `/top-libraries` grouped by country, or top country from `/country-breakdown` |
| `stats.percentFree`%                | Free or donation | Existing `/stats`                                                                                         |

Stats fetched server-side at page load.

**`topCountryName` derivation:** Call `/country-breakdown` (new endpoint, §7a) at page load, take `countryCode` of first entry, resolve country name via `T.countryName(countryCode)` helper or a lookup from Strapi countries. Stat label becomes `In [country name]`.

---

## 2. Featured Events Carousel

Replace the single `FeaturedEventCard` with a horizontally scrollable carousel. Heading via `SectionHeader`: `Featured` _`this week.`_

- Shows 2 featured card slots visible at a time (desktop), 1 on mobile
- Carousel navigation: `< >` arrows + dot indicators + `1 OF 6 / CAROUSEL` counter (mono, `T.ink.low`)
- Each card uses the existing `FeaturedEventCard` component (image panel + details panel)
- Source: `/api/events/featured?count=6` — returns array of up to 6 events
- **Backend change:** Update `featured` handler to accept `?count=N` (default 1, max 12), return array always (§7a)
- Component: `FeaturedEventsCarousel` wraps `FeaturedEventCard[]`; CSS `scroll-snap` for mobile (no JS swipe in v1)

---

## 3. Geo Filter Bar (sticky)

New `EventsGeoFilterBar` component. Sticky row below the hero/stats, above the listing.

```
[ All continents ▾ ]  [ Country ▾ ]  [ Region ▾ ]   FREE  LIVE  NEW   [ Soonest ▾ ]
```

- **Continent dropdown:** Options derived from `/country-breakdown` response — group `countryCode` values by continent (client-side ISO-3166 mapping). No hardcoded continent list.
- **Country dropdown:** Populated when continent selected — filter `/country-breakdown` results for that continent's `countryCode` values; resolve country names via Strapi `/countries` or ISO lookup.
- **Region dropdown:** Populated when country selected — future (v2 unless `regionSlug` values available from `/country-breakdown` or a `/region-breakdown` endpoint).
- **FREE pill:** toggles `isFree=true` on `/global` filter
- **LIVE pill:** Out of scope v1 (see §10)
- **NEW pill:** sorts by `importedAt:desc`
- **Sort dropdown:** `Soonest` (default, `startTime:asc`), `Latest added` (`importedAt:desc`)

**Active filter chips row** (shown when any filter active):
Chips for each active filter with × to remove. Result count: `{total} events{countryLabel}{dateLabel}` — count and labels sourced from the `/global` paginated response (`total` field).

---

## 4. Layout: Sidebar + Grid

Desktop: `grid-cols-[280px,1fr]` gap-8. Mobile: sidebar collapsed behind "Filters" toggle button.

### 4a. Sidebar Filter Sections

Each section wrapped in `FilterSidebarSection` (new DS component, §0). Keep existing date/price/type, add:

**Search** (existing) — text input

**§ 01 · When** (existing date scope) — Today / Tomorrow / This week / This month

**§ 02 · Category** — checkboxes with live counts from `/category-breakdown`:

Labels and values derived from `EVENT_TYPE_META` (imported from `components/events/EventTypeChip.tsx`). Each checkbox key is an `eventType` enum value; label comes from `EVENT_TYPE_META[key].label`. Counts from `/category-breakdown` response keyed by `eventType`.

Counts update in real-time as other filters change (re-request `/category-breakdown` with current filter params, or compute client-side from current result set). Show `{count}` right-aligned mono.

**§ 03 · Time of day** — checkboxes:

- Morning (06:00–12:00)
- Afternoon (12:00–18:00)
- Evening (18:00–22:00)
- Night (22:00–06:00)
- All day / open access

Applied client-side by filtering `startTime` hour range.

**§ 04 · Age** — checkboxes:

- All ages
- Family (under 12s)
- Teens (13–18)
- Adults (18+)

Maps to `audience` JSON field on event schema. Applied client-side.

**§ 05 · Price** (existing pills) — All / Free / Paid

**§ 06 · Library direct** — toggle: show only events from directly-integrated library feeds. Filter `sourceProvider IN [ical, custom_ical, aspen, solus, spydus]`. Applied client-side.

_(§ 07 Language, § 08 Library type — roadmap, no schema fields yet)_

**Reset all** button

### 4b. Event Card Grid

Replace `EventTimeline` / `TimelineRow` with a 2-column card grid via `EventCardGrid`.

Keep `DateScrollPicker` above the grid.

Card grid: `grid-cols-1 sm:grid-cols-2` gap-4. 20 results per page. Pagination via `IndexPager` (new DS component).

### 4c. Event Card (`EventCard` component)

Uses `CardImageBlock` (new DS component) for the image area.

**`CardImageBlock` image area** (aspect-ratio 4/3, max-height 180px):

- `imageUrl` if present, else 3-layer radial gradient placeholder
- Filter: `saturate(0.7) brightness(0.85)` on real images
- Vignette overlay on real images
- **`topLeft` slot:** `EventTypeChip` for event type (coloured square + label, mono, 9px)
- **`topRight` slot:** date block — serif day numeral (48px) + mono day-of-week (`format(startTime, "EEE")`)

**Content area** (padding 14px 16px):

- Breadcrumb: `{countryCode} · {regionSlug}` uppercased (mono, 8px) — from event's own `countryCode` + `regionSlug` fields
- Title (serif italic, 1.05rem, 2 lines max)
- Library entity ref via `libraryEntityRef` field (mono, 9px, `T.ink.ghost`)
- Meta row: `HH:MM – HH:MM` · duration (computed) · format (in-person/online from `eventType`)
- Bottom row: `PriceBadge` + `[ Reserve → ]` or `[ Drop in → ]` CTA (aurora pill, linked to `registrationUrl` or `url`) + save icon (v2, auth-gated)

**Hover state:** `translateY(-2px)`, border brightens to `T.border.hi`.

---

## 5. Analytics Section ("The shape of the programme")

New heading via `SectionHeader`: `The shape of the` _`programme.`_

Layout: 2-column grid below the listing.

### 5a. Where the doors are open (NEW)

Static breakdown list of top countries by event count. Data from new `/country-breakdown` endpoint (§7a) — `{ countryCode, count }[]` ordered by count desc. Render as ranked list with country name + horizontal count bar (reuse pattern from `ProviderBreakdownBar`). No interactive map in v1.

### 5b. What's on (existing `EventCategoryBreakdown`)

Horizontal bar chart. Style refresh: each bar shows label (from `EVENT_TYPE_META`) + count + percentage bar.

### 5c. When the doors open (existing `TimeOfDayHeatmap`)

Keep as-is.

### 5d. Where this comes from (existing `ProviderBreakdownBar`)

Style update: provider name + horizontal count bar + count number.

### 5e. Daily volume (NEW via `EventsDailyVolumeChart`)

Line/area chart: events per day for next 30 days. Data from new `/daily-volume` endpoint (§7a):

```
GET /api/events/daily-volume
→ [{ date: "2026-05-06", count: 341 }, ...]
```

Render as minimal SVG `<polyline>` — no charting library. Compute points from `(index / (days-1)) * width, height - (count / maxCount) * height`.

---

## 6. Browse the Programme Elsewhere (`EventsBrowseElsewhere`)

New section below analytics. Heading: `Browse the programme` _`elsewhere.`_

**Continent tabs:**
Populated from `/country-breakdown` response — derive distinct continents from `countryCode` values using ISO-3166 continent mapping. Tab labels: continent name + total event count (sum of counts for that continent). Format: `ALL | AFRICA | ASIA | EUROPE | ...`

**Country grid for selected continent:**
3-column grid of countries with event counts. Data from `/country-breakdown` filtered client-side by selected continent. Clicking a country sets `countryCode` filter in `FilterState`.

**Local breakdown (when region selected):**
Roadmap (v2) — requires `/region-breakdown` endpoint.

---

## 7. Backend Changes Required

### 7a. Events Plugin — Controller changes

| Handler    | Change                                                                                                   |
| ---------- | -------------------------------------------------------------------------------------------------------- |
| `featured` | Accept `?count=N` (1–12, default 1), return array always                                                 |
| `global`   | Accept `minPrice`, `maxPrice` query params; change response shape to `{ events, total, page, pageSize }` |
| `stats`    | Add `totalThisMonth` to response: count events where `start_time BETWEEN now AND now+30days`             |

New handlers:
| Handler | Route | Response |
|---|---|---|
| `dailyVolume` | `GET /daily-volume` | `{ date, count }[]` for next 30 days |
| `countryBreakdown` | `GET /country-breakdown` | `{ countryCode, count }[]` ordered by count desc |

### 7b. Content-API routes additions

```ts
{ method: "GET", path: "/daily-volume", handler: "events.dailyVolume", config: { auth: false } },
{ method: "GET", path: "/country-breakdown", handler: "events.countryBreakdown", config: { auth: false } },
```

### 7c. Frontend permissions (add to read-only token)

- `dailyVolume`
- `countryBreakdown`

---

## 8. File Structure

```
apps/ui/src/
  components/ds/
    IndexPager.tsx             ← NEW DS: numeric pagination (shared with Library Index)
    FilterSidebarSection.tsx   ← NEW DS: § N · LABEL expandable section wrapper
    CardImageBlock.tsx         ← NEW DS: image area with gradient, filter, vignette, overlay slots

  components/events/
    EventCard.tsx                  ← NEW: grid card (uses CardImageBlock, EventTypeChip, PriceBadge)
    EventCardGrid.tsx              ← NEW: grid + IndexPager wrapper
    EventsGeoFilterBar.tsx         ← NEW: continent/country selectors + active filter chips
    EventsBrowseElsewhere.tsx      ← NEW: continent tabs + country grid (from /country-breakdown)
    EventsDailyVolumeChart.tsx     ← NEW: SVG polyline chart for daily volume
    FeaturedEventsCarousel.tsx     ← NEW: wraps FeaturedEventCard[], arrows + dots
    EventsProgrammePage.tsx        ← MODIFY: wire new sections, carousel, geo bar
    EventsSidebar.tsx              ← MODIFY: add FilterSidebarSection, category checkboxes, time-of-day, age, library-direct
    EventsFilterBar.tsx            ← MODIFY: extend FilterState type
    EventsHero.tsx                 ← MODIFY: HeroTitle + HeroStatsGrid with updated stats

apps/strapi/src/plugins/events/server/
  controllers/events.ts           ← MODIFY: featured array, global pagination, new endpoints
  routes/content-api.ts           ← MODIFY: add daily-volume, country-breakdown routes
```

Modify in page:

- `apps/ui/src/app/[locale]/events/page.tsx` — fetch additional data (daily volume, country breakdown, featured array)

---

## 9. FilterState Extension

```ts
export interface FilterState {
  dateScope: DateScope
  priceScope: PriceScope
  eventTypes: string[] // was: eventType: string — now multi-select array, values are eventType enum keys
  search: string
  // NEW:
  timeOfDay: ("morning" | "afternoon" | "evening" | "night")[]
  ageGroup: ("family" | "teens" | "adults" | "all")[]
  libraryDirect: boolean
  countryCode: string
  regionSlug: string
  page: number
}
```

Category checkboxes bind to `eventTypes: string[]`. `EVENT_TYPE_META` keys from `EventTypeChip.tsx` are the canonical set of valid values.

---

## 10. Out of Scope (v1)

- Language filter (no language field on event schema)
- Library type filter (requires cross-join with library records)
- Price range slider (no price range query param on backend yet)
- Interactive country map (ranked list only)
- Region-level breakdown in Browse section (no `/region-breakdown` endpoint)
- "Nearest" geo sort (requires user location permission)
- "LIVE" pill (`status=ongoing` requires real-time start/end comparison — backend work needed)
- Save/bookmark events (auth feature)
- Carousel touch/swipe on mobile (CSS scroll-snap sufficient)
- `topCountryName` stat — if `/country-breakdown` is unavailable at page load, stat cell is omitted
