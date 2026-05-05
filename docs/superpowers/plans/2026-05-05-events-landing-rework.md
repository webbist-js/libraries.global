# Events Landing Page Rework — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rework the `/events` programme page with a large editorial hero, featured carousel, 2-col card grid with pagination, richer filter sidebar, geo filter bar, daily volume chart, and browse-elsewhere section.

**Architecture:** Backend-first (extend Strapi events plugin handlers + new endpoints), then new DS components shared with Library Index, then events-specific components, finally wire everything in `EventsProgrammePage`.

**Tech Stack:** Next.js 15 App Router, Strapi v5 events plugin (SQLite/Knex), Tailwind + `T` tokens, existing DS (`HeroTitle`, `HeroStatsGrid`, `EventTypeChip`, `PriceBadge`).

---

## File Map

**Create:**

- `apps/ui/src/components/ds/FilterSidebarSection.tsx` — `§ N · LABEL` section wrapper
- `apps/ui/src/components/ds/CardImageBlock.tsx` — image area with gradient fallback, filters, overlay slots
- `apps/ui/src/components/ds/IndexPager.tsx` — numeric pagination component
- `apps/ui/src/lib/iso-continent.ts` — ISO-3166 country → continent lookup
- `apps/ui/src/components/events/EventCard.tsx` — card for the grid (uses CardImageBlock)
- `apps/ui/src/components/events/EventCardGrid.tsx` — grid + DateScrollPicker + IndexPager
- `apps/ui/src/components/events/FeaturedEventsCarousel.tsx` — scrollable carousel of FeaturedEventCard
- `apps/ui/src/components/events/EventsGeoFilterBar.tsx` — continent/country selectors + active chips
- `apps/ui/src/components/events/EventsDailyVolumeChart.tsx` — SVG polyline chart
- `apps/ui/src/components/events/EventsBrowseElsewhere.tsx` — continent tabs + country grid

**Modify:**

- `apps/strapi/src/plugins/events/server/controllers/events.ts` — extend `featured`, `global`, `stats`; add `dailyVolume`, `countryBreakdown`
- `apps/strapi/src/plugins/events/server/routes/content-api.ts` — register two new routes
- `apps/ui/src/components/events/types.ts` — new types, update `EventsProgrammeData`
- `apps/ui/src/components/events/EventsFilterBar.tsx` — extend `FilterState`
- `apps/ui/src/components/ds/index.ts` — export new DS components
- `apps/ui/src/components/events/EventsHero.tsx` — new layout with HeroTitle + HeroStatsGrid
- `apps/ui/src/components/events/EventsSidebar.tsx` — new filter sections with FilterSidebarSection
- `apps/ui/src/components/events/EventsProgrammePage.tsx` — wire all new sections
- `apps/ui/src/app/[locale]/events/page.tsx` — fetch array featured, country breakdown, daily volume

---

## Task 1: Backend — extend `featured` and `global` handlers

**Files:**

- Modify: `apps/strapi/src/plugins/events/server/controllers/events.ts`

- [ ] **Step 1: Update `featured` handler to accept `?count=N` and return array**

Replace the `featured` handler (lines 336–370) with:

```ts
async featured(ctx: any) {
  const { count = "1" } = ctx.query as Record<string, string>
  const pageSize = Math.min(Math.max(1, Number(count)), 12)
  const now = new Date()
  const results = await strapi.documents("plugin::events.event").findMany({
    filters: {
      startTime: { $gte: now.toISOString() },
      status: { $in: ["upcoming", "ongoing"] },
      pendingReview: false,
    },
    sort: ["importedAt:desc"],
    pagination: { pageSize },
    fields: [
      "title", "description", "summary", "url", "imageUrl",
      "startTime", "endTime", "allDay", "timezone", "eventType",
      "isFree", "priceMin", "priceMax", "registrationUrl", "status",
      "tags", "libraryEntityRef", "sourceProvider",
    ],
  })
  ctx.body = results as any[]
},
```

- [ ] **Step 2: Update `global` handler to return `{ events, total, page, pageSize }` and add `countryCode`/`regionSlug` to fields**

Replace the `global` handler (lines 98–146) with:

```ts
async global(ctx: any) {
  const {
    type,
    isFree,
    from,
    to,
    limit = "20",
    page = "1",
    countryCode,
    regionSlug,
  } = ctx.query as Record<string, string>
  const now = new Date().toISOString()
  const db = strapi.db.connection

  const filters: Record<string, unknown> = {
    startTime: { $gte: from ?? now },
    status: { $in: ["upcoming", "ongoing"] },
  }
  if (to) (filters.startTime as any).$lte = to
  if (type) filters.eventType = type
  if (isFree != null) filters.isFree = isFree === "true"
  if (countryCode) filters.countryCode = countryCode
  if (regionSlug) filters.regionSlug = regionSlug

  // Count with same filters using knex
  const countQuery = db("ev_events").count("* as total")
  countQuery.where("start_time", ">=", from ?? now)
  if (to) countQuery.where("start_time", "<=", to)
  if (type) countQuery.where("event_type", type)
  if (isFree != null) countQuery.where("is_free", isFree === "true")
  if (countryCode) countQuery.where("country_code", countryCode)
  if (regionSlug) countQuery.where("region_slug", regionSlug)
  const [countRow] = await countQuery
  const total = Number((countRow as any).total)

  const events = await strapi.documents("plugin::events.event").findMany({
    filters,
    sort: ["startTime:asc"],
    pagination: { page: Number(page), pageSize: Number(limit) },
    fields: [
      "title", "summary", "url", "imageUrl",
      "startTime", "endTime", "allDay", "timezone",
      "eventType", "isFree", "priceMin", "priceMax",
      "registrationUrl", "libraryEntityRef", "status",
      "countryCode", "regionSlug",
    ],
  })

  ctx.body = {
    events: events as any[],
    total,
    page: Number(page),
    pageSize: Number(limit),
  }
},
```

- [ ] **Step 3: Verify build**

```bash
cd apps/strapi && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors in `controllers/events.ts`.

- [ ] **Step 4: Commit**

```bash
git add apps/strapi/src/plugins/events/server/controllers/events.ts
git commit -m "feat(events): featured returns array; global returns paginated envelope"
```

---

## Task 2: Backend — add `totalThisMonth` to stats, add `dailyVolume` and `countryBreakdown` handlers

**Files:**

- Modify: `apps/strapi/src/plugins/events/server/controllers/events.ts`

- [ ] **Step 1: Add `totalThisMonth` to `stats` handler**

In the `stats` handler, after the `weekLater` line (line 174), add:

```ts
const monthLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
```

After the `[freeRow]` query, add:

```ts
const [monthRow] = await db("ev_events")
  .count("* as count")
  .where("start_time", ">=", now)
  .where("start_time", "<=", monthLater)
const totalThisMonth = Number((monthRow as any).count)
```

Update `ctx.body` to include `totalThisMonth`:

```ts
ctx.body = {
  totalEvents: total,
  totalThisWeek,
  totalThisMonth,
  percentFree: total > 0 ? Math.round((freeCount / total) * 100) : 0,
  peakSlot: peakLabel,
  peakCount: peak ? Number(peak.cnt) : 0,
}
```

Also update the catch block:

```ts
ctx.body = {
  totalEvents: 0,
  totalThisWeek: 0,
  totalThisMonth: 0,
  percentFree: 0,
  peakSlot: null,
  peakCount: 0,
}
```

- [ ] **Step 2: Add `dailyVolume` handler**

After the `categoryBreakdown` handler, add:

```ts
async dailyVolume(ctx: any) {
  try {
    const db = strapi.db.connection
    const now = new Date()
    const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

    const rows = await db("ev_events")
      .select(db.raw("DATE(start_time) as date"))
      .count("* as count")
      .where("start_time", ">=", now)
      .where("start_time", "<=", thirtyDays)
      .groupByRaw("DATE(start_time)")
      .orderBy("date", "asc")

    ctx.body = (rows as any[]).map((r) => ({
      date: r.date as string,
      count: Number(r.count),
    }))
  } catch {
    ctx.body = []
  }
},
```

- [ ] **Step 3: Add `countryBreakdown` handler**

After `dailyVolume`, add:

```ts
async countryBreakdown(ctx: any) {
  try {
    const db = strapi.db.connection
    const now = new Date()

    const rows = await db("ev_events")
      .select("country_code as countryCode")
      .count("* as count")
      .where("start_time", ">=", now)
      .whereNotNull("country_code")
      .groupBy("country_code")
      .orderBy("count", "desc")

    ctx.body = (rows as any[]).map((r) => ({
      countryCode: r.countryCode as string,
      count: Number(r.count),
    }))
  } catch {
    ctx.body = []
  }
},
```

- [ ] **Step 4: Register new routes in `content-api.ts`**

In `apps/strapi/src/plugins/events/server/routes/content-api.ts`, add before the closing `]`:

```ts
{
  method: "GET",
  path: "/daily-volume",
  handler: "events.dailyVolume",
  config: { auth: false, policies: [] },
},
{
  method: "GET",
  path: "/country-breakdown",
  handler: "events.countryBreakdown",
  config: { auth: false, policies: [] },
},
```

- [ ] **Step 5: Commit**

```bash
git add apps/strapi/src/plugins/events/server/controllers/events.ts \
        apps/strapi/src/plugins/events/server/routes/content-api.ts
git commit -m "feat(events): add totalThisMonth, dailyVolume, countryBreakdown endpoints"
```

---

## Task 3: Frontend types — update `FilterState` and `EventsProgrammeData`

**Files:**

- Modify: `apps/ui/src/components/events/EventsFilterBar.tsx`
- Modify: `apps/ui/src/components/events/types.ts`

- [ ] **Step 1: Update `FilterState` in `EventsFilterBar.tsx`**

Replace the `FilterState` interface (and remove the unused `EventsFilterBar` component — it will no longer be used once `EventsGeoFilterBar` + `EventsSidebar` take over, but keep it for now to avoid breaking imports; just update the type):

```ts
export type DateScope = "today" | "tomorrow" | "this-week" | "this-month"
export type PriceScope = "all" | "free" | "paid"
export type TimeOfDay = "morning" | "afternoon" | "evening" | "night"
export type AgeGroup = "family" | "teens" | "adults" | "all"

export interface FilterState {
  dateScope: DateScope
  priceScope: PriceScope
  eventTypes: string[] // multi-select; empty = all types
  search: string
  timeOfDay: TimeOfDay[]
  ageGroup: AgeGroup[]
  libraryDirect: boolean
  countryCode: string
  regionSlug: string
  page: number
}
```

- [ ] **Step 2: Update `types.ts` with new interfaces**

Replace the full contents of `apps/ui/src/components/events/types.ts`:

```ts
export interface EventsStats {
  totalEvents: number
  totalThisWeek: number
  totalThisMonth: number
  percentFree: number
  peakSlot: string | null
  peakCount: number
}

export interface ProviderStat {
  provider: string
  count: number
}

export interface CategoryStat {
  type: string
  count: number
}

export interface LibraryStat {
  entityRef: string
  name: string
  count: number
}

export interface HeatmapCell {
  dow: number
  hour: number
  count: number
}

export interface CountryStat {
  countryCode: string
  count: number
}

export interface DailyVolumeStat {
  date: string
  count: number
}

export interface FeaturedEvent {
  documentId: string
  title: string
  description?: string | null
  url: string
  imageUrl?: string | null
  startTime: string
  endTime?: string | null
  allDay: boolean
  timezone: string
  eventType: string
  isFree: boolean
  priceMin?: number | null
  priceMax?: number | null
  registrationUrl?: string | null
  libraryEntityRef?: string | null
  libraryName?: string | null
  libraryCity?: string | null
  sourceProvider?: string | null
  tags?: string[] | null
}

export interface GridEvent {
  documentId: string
  title: string
  url: string
  imageUrl?: string | null
  startTime: string
  endTime?: string | null
  allDay: boolean
  timezone: string
  eventType: string
  isFree: boolean
  priceMin?: number | null
  priceMax?: number | null
  registrationUrl?: string | null
  libraryEntityRef?: string | null
  status: string
  countryCode?: string | null
  regionSlug?: string | null
}

export interface GlobalEventsResponse {
  events: GridEvent[]
  total: number
  page: number
  pageSize: number
}

export interface EventsProgrammeData {
  stats: EventsStats
  providers: ProviderStat[]
  categories: CategoryStat[]
  topLibraries: LibraryStat[]
  heatmap: HeatmapCell[]
  featured: FeaturedEvent[]
  countryBreakdown: CountryStat[]
  dailyVolume: DailyVolumeStat[]
}
```

- [ ] **Step 3: Verify types compile**

```bash
cd apps/ui && npx tsc --noEmit 2>&1 | grep "events/" | head -20
```

Expected: errors only about usages of old `eventType: string` — these will be fixed in later tasks.

- [ ] **Step 4: Commit**

```bash
git add apps/ui/src/components/events/EventsFilterBar.tsx \
        apps/ui/src/components/events/types.ts
git commit -m "feat(events): extend FilterState and EventsProgrammeData types"
```

---

## Task 4: DS — `FilterSidebarSection` component

**Files:**

- Create: `apps/ui/src/components/ds/FilterSidebarSection.tsx`
- Modify: `apps/ui/src/components/ds/index.ts`

- [ ] **Step 1: Create `FilterSidebarSection.tsx`**

```tsx
import type { ReactNode } from "react"

import { T } from "@/lib/design-tokens"

interface FilterSidebarSectionProps {
  readonly index: number
  readonly label: string
  readonly children: ReactNode
}

export function FilterSidebarSection({
  index,
  label,
  children,
}: FilterSidebarSectionProps) {
  const prefix = `§ ${String(index).padStart(2, "0")} ·`

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          marginBottom: "10px",
        }}
      >
        <span
          style={{
            fontFamily: T.font.mono,
            fontSize: "9px",
            letterSpacing: ".22em",
            textTransform: "uppercase",
            color: T.ink.ghost,
          }}
        >
          {prefix}
        </span>
        <span
          style={{
            fontFamily: T.font.mono,
            fontSize: "9px",
            letterSpacing: ".22em",
            textTransform: "uppercase",
            color: T.ink.low,
          }}
        >
          {label}
        </span>
      </div>
      {children}
    </div>
  )
}
```

- [ ] **Step 2: Export from `ds/index.ts`**

Add to `apps/ui/src/components/ds/index.ts`:

```ts
export { FilterSidebarSection } from "./FilterSidebarSection"
```

- [ ] **Step 3: Commit**

```bash
git add apps/ui/src/components/ds/FilterSidebarSection.tsx \
        apps/ui/src/components/ds/index.ts
git commit -m "feat(ds): add FilterSidebarSection component"
```

---

## Task 5: DS — `CardImageBlock` component

**Files:**

- Create: `apps/ui/src/components/ds/CardImageBlock.tsx`
- Modify: `apps/ui/src/components/ds/index.ts`

- [ ] **Step 1: Create `CardImageBlock.tsx`**

```tsx
import type { ReactNode } from "react"

interface CardImageBlockProps {
  readonly imageUrl?: string | null
  readonly alt?: string
  readonly aspectRatio?: string
  readonly maxHeight?: number
  readonly topLeft?: ReactNode
  readonly topRight?: ReactNode
}

export function CardImageBlock({
  imageUrl,
  alt = "",
  aspectRatio = "4/3",
  maxHeight = 180,
  topLeft,
  topRight,
}: CardImageBlockProps) {
  return (
    <div
      style={{
        position: "relative",
        aspectRatio,
        maxHeight: `${maxHeight}px`,
        overflow: "hidden",
        flexShrink: 0,
      }}
    >
      {imageUrl ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt={alt}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              filter: "saturate(0.7) brightness(0.85)",
            }}
          />
          <div
            aria-hidden
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(to bottom, rgba(5,8,22,0.6) 0%, rgba(5,8,22,0) 40%, rgba(5,8,22,0) 60%, rgba(5,8,22,0.75) 100%)",
              pointerEvents: "none",
            }}
          />
        </>
      ) : (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `
              radial-gradient(ellipse 90% 70% at 20% 30%, rgba(127,223,255,0.13), transparent 60%),
              radial-gradient(ellipse 70% 90% at 75% 75%, rgba(163,144,255,0.10), transparent 55%),
              radial-gradient(ellipse 50% 50% at 55% 20%, rgba(232,201,138,0.06), transparent 50%),
              linear-gradient(160deg, #08101f 0%, #060c1a 60%, #070b1e 100%)
            `,
          }}
        />
      )}

      {(topLeft ?? topRight) ? (
        <div
          style={{
            position: "absolute",
            inset: 0,
            padding: "10px 12px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
          }}
        >
          <div>{topLeft}</div>
          <div>{topRight}</div>
        </div>
      ) : null}
    </div>
  )
}
```

- [ ] **Step 2: Export from `ds/index.ts`**

```ts
export { CardImageBlock } from "./CardImageBlock"
```

- [ ] **Step 3: Commit**

```bash
git add apps/ui/src/components/ds/CardImageBlock.tsx \
        apps/ui/src/components/ds/index.ts
git commit -m "feat(ds): add CardImageBlock component"
```

---

## Task 6: DS — `IndexPager` component

**Files:**

- Create: `apps/ui/src/components/ds/IndexPager.tsx`
- Modify: `apps/ui/src/components/ds/index.ts`

- [ ] **Step 1: Create `IndexPager.tsx`**

```tsx
"use client"

import { T } from "@/lib/design-tokens"

interface IndexPagerProps {
  readonly page: number
  readonly totalPages: number
  readonly onPageChange: (page: number) => void
}

export function IndexPager({
  page,
  totalPages,
  onPageChange,
}: IndexPagerProps) {
  if (totalPages <= 1) return null

  // Build compact page list: always show first, last, and window around current
  const items: (number | "…")[] = []
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= page - 1 && i <= page + 1)) {
      items.push(i)
    } else if (items.at(-1) !== "…") {
      items.push("…")
    }
  }

  const pill = (active: boolean, disabled = false): React.CSSProperties => ({
    fontFamily: T.font.mono,
    fontSize: "11px",
    letterSpacing: ".06em",
    padding: "6px 10px",
    borderRadius: "8px",
    border: `1px solid ${active ? "rgba(127,223,255,0.3)" : T.border.line}`,
    background: active ? "rgba(127,223,255,0.1)" : "transparent",
    color: disabled ? T.ink.ghost : active ? T.accent.aurora : T.ink.dim,
    cursor: disabled ? "default" : "pointer",
    transition: "all 150ms",
  })

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "4px",
        flexWrap: "wrap",
        justifyContent: "center",
        padding: "24px 0",
      }}
    >
      <button
        type="button"
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        style={pill(false, page <= 1)}
      >
        ← Prev
      </button>

      {items.map((item, i) =>
        item === "…" ? (
          <span
            key={`ellipsis-${i}`}
            style={{
              color: T.ink.ghost,
              padding: "6px 4px",
              fontSize: "11px",
              fontFamily: T.font.mono,
            }}
          >
            …
          </span>
        ) : (
          <button
            key={item}
            type="button"
            onClick={() => onPageChange(item)}
            style={pill(item === page)}
          >
            {item}
          </button>
        )
      )}

      <button
        type="button"
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages}
        style={pill(false, page >= totalPages)}
      >
        Next →
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Export from `ds/index.ts`**

```ts
export { IndexPager } from "./IndexPager"
```

- [ ] **Step 3: Commit**

```bash
git add apps/ui/src/components/ds/IndexPager.tsx \
        apps/ui/src/components/ds/index.ts
git commit -m "feat(ds): add IndexPager component"
```

---

## Task 7: Utility — ISO country-to-continent lookup

**Files:**

- Create: `apps/ui/src/lib/iso-continent.ts`

- [ ] **Step 1: Create the lookup utility**

```ts
// ISO 3166-1 alpha-2 → continent name
// Covers the most common library-event-bearing countries.
// Add entries as new countries appear in countryBreakdown data.
const COUNTRY_TO_CONTINENT: Record<string, string> = {
  // Africa
  DZ: "Africa",
  AO: "Africa",
  BJ: "Africa",
  BW: "Africa",
  BF: "Africa",
  CM: "Africa",
  CV: "Africa",
  CF: "Africa",
  TD: "Africa",
  KM: "Africa",
  CG: "Africa",
  CD: "Africa",
  CI: "Africa",
  DJ: "Africa",
  EG: "Africa",
  GQ: "Africa",
  ET: "Africa",
  GA: "Africa",
  GM: "Africa",
  GH: "Africa",
  GN: "Africa",
  GW: "Africa",
  KE: "Africa",
  LS: "Africa",
  LR: "Africa",
  LY: "Africa",
  MG: "Africa",
  MW: "Africa",
  ML: "Africa",
  MR: "Africa",
  MU: "Africa",
  MA: "Africa",
  MZ: "Africa",
  NA: "Africa",
  NE: "Africa",
  NG: "Africa",
  RW: "Africa",
  ST: "Africa",
  SN: "Africa",
  SL: "Africa",
  SO: "Africa",
  ZA: "Africa",
  SD: "Africa",
  TZ: "Africa",
  TG: "Africa",
  TN: "Africa",
  UG: "Africa",
  ZM: "Africa",
  ZW: "Africa",
  // Asia
  AF: "Asia",
  AM: "Asia",
  AZ: "Asia",
  BH: "Asia",
  BD: "Asia",
  BT: "Asia",
  BN: "Asia",
  KH: "Asia",
  CN: "Asia",
  CY: "Asia",
  GE: "Asia",
  IN: "Asia",
  ID: "Asia",
  IR: "Asia",
  IQ: "Asia",
  IL: "Asia",
  JP: "Asia",
  JO: "Asia",
  KZ: "Asia",
  KW: "Asia",
  KG: "Asia",
  LA: "Asia",
  LB: "Asia",
  MY: "Asia",
  MV: "Asia",
  MN: "Asia",
  MM: "Asia",
  NP: "Asia",
  KP: "Asia",
  OM: "Asia",
  PK: "Asia",
  PS: "Asia",
  PH: "Asia",
  QA: "Asia",
  SA: "Asia",
  SG: "Asia",
  KR: "Asia",
  LK: "Asia",
  SY: "Asia",
  TW: "Asia",
  TJ: "Asia",
  TH: "Asia",
  TL: "Asia",
  TR: "Asia",
  TM: "Asia",
  AE: "Asia",
  UZ: "Asia",
  VN: "Asia",
  YE: "Asia",
  // Europe
  AL: "Europe",
  AD: "Europe",
  AT: "Europe",
  BY: "Europe",
  BE: "Europe",
  BA: "Europe",
  BG: "Europe",
  HR: "Europe",
  CZ: "Europe",
  DK: "Europe",
  EE: "Europe",
  FI: "Europe",
  FR: "Europe",
  DE: "Europe",
  GR: "Europe",
  HU: "Europe",
  IS: "Europe",
  IE: "Europe",
  IT: "Europe",
  XK: "Europe",
  LV: "Europe",
  LI: "Europe",
  LT: "Europe",
  LU: "Europe",
  MT: "Europe",
  MD: "Europe",
  MC: "Europe",
  ME: "Europe",
  NL: "Europe",
  MK: "Europe",
  NO: "Europe",
  PL: "Europe",
  PT: "Europe",
  RO: "Europe",
  RU: "Europe",
  SM: "Europe",
  RS: "Europe",
  SK: "Europe",
  SI: "Europe",
  ES: "Europe",
  SE: "Europe",
  CH: "Europe",
  UA: "Europe",
  GB: "Europe",
  VA: "Europe",
  // North America
  AG: "North America",
  BS: "North America",
  BB: "North America",
  BZ: "North America",
  CA: "North America",
  CR: "North America",
  CU: "North America",
  DM: "North America",
  DO: "North America",
  SV: "North America",
  GD: "North America",
  GT: "North America",
  HT: "North America",
  HN: "North America",
  JM: "North America",
  MX: "North America",
  NI: "North America",
  PA: "North America",
  KN: "North America",
  LC: "North America",
  VC: "North America",
  TT: "North America",
  US: "North America",
  // Oceania
  AU: "Oceania",
  FJ: "Oceania",
  KI: "Oceania",
  MH: "Oceania",
  FM: "Oceania",
  NR: "Oceania",
  NZ: "Oceania",
  PW: "Oceania",
  PG: "Oceania",
  WS: "Oceania",
  SB: "Oceania",
  TO: "Oceania",
  TV: "Oceania",
  VU: "Oceania",
  // South America
  AR: "South America",
  BO: "South America",
  BR: "South America",
  CL: "South America",
  CO: "South America",
  EC: "South America",
  GY: "South America",
  PY: "South America",
  PE: "South America",
  SR: "South America",
  UY: "South America",
  VE: "South America",
}

export const CONTINENTS = [
  "Africa",
  "Asia",
  "Europe",
  "North America",
  "Oceania",
  "South America",
] as const

export type Continent = (typeof CONTINENTS)[number]

/** Returns the continent name for a given ISO 3166-1 alpha-2 country code, or null. */
export function getContinent(countryCode: string): Continent | null {
  return (COUNTRY_TO_CONTINENT[countryCode.toUpperCase()] as Continent) ?? null
}

/** Returns the display name for a country code using Intl.DisplayNames. */
export function getCountryName(countryCode: string): string {
  try {
    return (
      new Intl.DisplayNames(["en"], { type: "region" }).of(
        countryCode.toUpperCase()
      ) ?? countryCode
    )
  } catch {
    return countryCode
  }
}
```

- [ ] **Step 2: Verify types**

```bash
cd apps/ui && npx tsc --noEmit 2>&1 | grep "iso-continent" | head -10
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/ui/src/lib/iso-continent.ts
git commit -m "feat(ui): add ISO country-to-continent lookup utility"
```

---

## Task 8: Update `EventsHero` — new editorial layout

**Files:**

- Modify: `apps/ui/src/components/events/EventsHero.tsx`

- [ ] **Step 1: Replace `EventsHero` with new layout**

Replace the full file:

```tsx
import {
  HeroEyebrow,
  HeroStat,
  HeroStatsGrid,
  HeroTitle,
  parseHeroText,
} from "@/components/ds"
import { DotHeroCanvas } from "@/components/ui/DotHeroCanvas"
import { T } from "@/lib/design-tokens"
import type { EventsStats } from "@/components/events/types"

const DESCRIPTOR =
  "Author talks, exhibitions, classes, storytime, archive tours. Ingested live from Eventbrite, TicketSource, library calendars and direct partners. Filterable by anywhere, when, format and language."

function formatCount(n: number): string {
  if (n >= 1_000_000)
    return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}k`
  return String(n)
}

interface EventsHeroProps {
  readonly stats: EventsStats
  readonly topCountryName?: string | null
}

export function EventsHero({ stats, topCountryName }: EventsHeroProps) {
  return (
    <section
      className="-mt-14"
      data-transparent-header=""
      style={{
        position: "relative",
        overflow: "hidden",
        padding: "130px 0 60px",
      }}
    >
      <DotHeroCanvas variant="events" />

      {/* Vignette */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse 110% 90% at 50% 50%, transparent 25%, var(--t-bg-space) 80%)",
          pointerEvents: "none",
        }}
      />

      <div
        style={{
          maxWidth: "1296px",
          margin: "0 auto",
          padding: "0 24px",
          position: "relative",
          zIndex: 10,
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.3fr 0.9fr",
            gap: "56px",
            alignItems: "end",
          }}
          className="events-hero-inner"
        >
          {/* Left */}
          <div>
            <HeroEyebrow>The Programme</HeroEyebrow>

            <HeroTitle>
              {parseHeroText("Tonight, and the next two thousand *nights.*")}
            </HeroTitle>

            <p
              style={{
                fontSize: "15px",
                lineHeight: 1.68,
                color: T.ink.dim,
                fontWeight: 300,
                maxWidth: "52ch",
                margin: "20px 0 0",
              }}
            >
              {DESCRIPTOR}
            </p>
          </div>

          {/* Right: stats grid */}
          <div style={{ paddingBottom: "8px" }}>
            <HeroStatsGrid cols={2}>
              <HeroStat
                label="Events this week"
                value={formatCount(stats.totalThisWeek)}
              />
              <HeroStat
                label="This month"
                value={formatCount(stats.totalThisMonth)}
              />
              {topCountryName ? (
                <HeroStat
                  label={`In ${topCountryName}`}
                  value={formatCount(stats.totalEvents)}
                />
              ) : (
                <HeroStat
                  label="Total upcoming"
                  value={formatCount(stats.totalEvents)}
                />
              )}
              <HeroStat
                label="Free or donation"
                value={`${stats.percentFree}%`}
              />
            </HeroStatsGrid>
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .events-hero-inner { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </section>
  )
}
```

- [ ] **Step 2: Verify types**

```bash
cd apps/ui && npx tsc --noEmit 2>&1 | grep "EventsHero" | head -10
```

- [ ] **Step 3: Commit**

```bash
git add apps/ui/src/components/events/EventsHero.tsx
git commit -m "feat(events): rework EventsHero with editorial title and HeroStatsGrid"
```

---

## Task 9: `FeaturedEventsCarousel` component

**Files:**

- Create: `apps/ui/src/components/events/FeaturedEventsCarousel.tsx`

- [ ] **Step 1: Create `FeaturedEventsCarousel.tsx`**

```tsx
"use client"

import { useRef, useState } from "react"

import { FeaturedEventCard } from "@/components/events/FeaturedEventCard"
import { SectionHeader } from "@/components/ds"
import type { FeaturedEvent } from "@/components/events/types"
import { T } from "@/lib/design-tokens"

interface FeaturedEventsCarouselProps {
  readonly events: FeaturedEvent[]
}

export function FeaturedEventsCarousel({
  events,
}: FeaturedEventsCarouselProps) {
  const [current, setCurrent] = useState(0)
  const trackRef = useRef<HTMLDivElement>(null)

  if (events.length === 0) return null

  const goTo = (index: number) => {
    const clamped = Math.max(0, Math.min(events.length - 1, index))
    setCurrent(clamped)
    trackRef.current?.children[clamped]?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "start",
    })
  }

  return (
    <section style={{ padding: "40px 0" }}>
      <div style={{ maxWidth: "1296px", margin: "0 auto", padding: "0 24px" }}>
        {/* Heading + controls */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "24px",
            flexWrap: "wrap",
            gap: "12px",
          }}
        >
          <SectionHeader italic="this week.">Featured</SectionHeader>

          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            {/* Counter */}
            <span
              style={{
                fontFamily: T.font.mono,
                fontSize: "10px",
                letterSpacing: ".18em",
                textTransform: "uppercase",
                color: T.ink.ghost,
              }}
            >
              {current + 1} of {events.length} · Carousel
            </span>

            {/* Arrows */}
            <div style={{ display: "flex", gap: "6px" }}>
              {(["prev", "next"] as const).map((dir) => (
                <button
                  key={dir}
                  type="button"
                  onClick={() =>
                    goTo(dir === "prev" ? current - 1 : current + 1)
                  }
                  disabled={
                    dir === "prev"
                      ? current === 0
                      : current === events.length - 1
                  }
                  style={{
                    width: "32px",
                    height: "32px",
                    borderRadius: "8px",
                    border: `1px solid ${T.border.line}`,
                    background: "transparent",
                    color:
                      (dir === "prev" && current === 0) ||
                      (dir === "next" && current === events.length - 1)
                        ? T.ink.ghost
                        : T.ink.dim,
                    cursor:
                      (dir === "prev" && current === 0) ||
                      (dir === "next" && current === events.length - 1)
                        ? "default"
                        : "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "14px",
                    transition: "all 150ms",
                  }}
                >
                  {dir === "prev" ? "‹" : "›"}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Track */}
        <div
          ref={trackRef}
          style={{
            display: "flex",
            gap: "24px",
            overflowX: "auto",
            scrollSnapType: "x mandatory",
            scrollbarWidth: "none",
            paddingBottom: "4px",
          }}
          className="carousel-track"
        >
          {events.map((event) => (
            <div
              key={event.documentId}
              style={{
                minWidth: "min(100%, 780px)",
                scrollSnapAlign: "start",
                flexShrink: 0,
              }}
            >
              <FeaturedEventCard event={event} />
            </div>
          ))}
        </div>

        {/* Dot indicators */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: "6px",
            marginTop: "16px",
          }}
        >
          {events.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => goTo(i)}
              aria-label={`Go to slide ${i + 1}`}
              style={{
                width: i === current ? "20px" : "6px",
                height: "6px",
                borderRadius: "3px",
                border: "none",
                background: i === current ? T.accent.aurora : T.border.hi,
                cursor: "pointer",
                transition: "all 200ms",
                padding: 0,
              }}
            />
          ))}
        </div>
      </div>

      <style>{`.carousel-track::-webkit-scrollbar { display: none; }`}</style>
    </section>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/ui/src/components/events/FeaturedEventsCarousel.tsx
git commit -m "feat(events): add FeaturedEventsCarousel component"
```

---

## Task 10: `EventCard` component

**Files:**

- Create: `apps/ui/src/components/events/EventCard.tsx`

- [ ] **Step 1: Create `EventCard.tsx`**

```tsx
import { Icon } from "@iconify/react"

import { CardImageBlock } from "@/components/ds"
import { EventTypeChip } from "@/components/events/EventTypeChip"
import { PriceBadge } from "@/components/events/PriceBadge"
import type { GridEvent } from "@/components/events/types"
import { T } from "@/lib/design-tokens"
import { getCountryName } from "@/lib/iso-continent"

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
}

function formatDuration(
  start: string,
  end: string | null | undefined
): string | null {
  if (!end) return null
  const ms = new Date(end).getTime() - new Date(start).getTime()
  const mins = Math.round(ms / 60_000)
  if (mins < 60) return `${mins}m`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m ? `${h}h ${m}m` : `${h}h`
}

interface EventCardProps {
  readonly event: GridEvent
}

export function EventCard({ event }: EventCardProps) {
  const start = new Date(event.startTime)
  const dayNum = start.getDate()
  const dayLabel = start
    .toLocaleDateString("en-GB", { weekday: "short" })
    .toUpperCase()
  const startTime = event.allDay ? "All day" : formatTime(event.startTime)
  const endTime = event.endTime ? formatTime(event.endTime) : null
  const duration = formatDuration(event.startTime, event.endTime)
  const link = event.registrationUrl ?? event.url

  // Breadcrumb from geo fields
  const countryLabel = event.countryCode
    ? getCountryName(event.countryCode)
    : null
  const breadcrumb = [countryLabel, event.regionSlug?.replace(/-/g, " ")]
    .filter(Boolean)
    .join(" · ")
    .toUpperCase()

  return (
    <a
      href={`/events/${event.documentId}`}
      style={{ textDecoration: "none", color: "inherit", display: "block" }}
      className="event-card group"
    >
      <div
        style={{
          background: T.bg.deep,
          border: `1px solid ${T.border.line}`,
          borderRadius: "16px",
          overflow: "hidden",
          transition: "transform 150ms, border-color 150ms",
        }}
        className="event-card-inner"
      >
        {/* Image */}
        <CardImageBlock
          imageUrl={event.imageUrl}
          alt={event.title}
          aspectRatio="4/3"
          maxHeight={180}
          topLeft={<EventTypeChip type={event.eventType} size="xs" />}
          topRight={
            <div style={{ textAlign: "right" }}>
              <div
                style={{
                  fontFamily: T.font.mono,
                  fontSize: "9px",
                  letterSpacing: ".14em",
                  color: T.ink.faint,
                  textTransform: "uppercase",
                }}
              >
                {dayLabel}
              </div>
              <div
                style={{
                  fontFamily: T.font.serif,
                  fontSize: "48px",
                  lineHeight: 0.9,
                  color: T.ink.base,
                  fontWeight: 400,
                  letterSpacing: "-0.02em",
                }}
              >
                {dayNum}
              </div>
            </div>
          }
        />

        {/* Content */}
        <div
          style={{
            padding: "14px 16px",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
          }}
        >
          {breadcrumb ? (
            <p
              style={{
                fontFamily: T.font.mono,
                fontSize: "8px",
                letterSpacing: ".18em",
                textTransform: "uppercase",
                color: T.ink.faint,
                margin: 0,
              }}
            >
              {breadcrumb}
            </p>
          ) : null}

          <h3
            style={{
              fontFamily: T.font.serif,
              fontSize: "1.05rem",
              fontStyle: "italic",
              fontWeight: 400,
              color: T.ink.base,
              margin: 0,
              lineHeight: 1.25,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {event.title}
          </h3>

          {event.libraryEntityRef ? (
            <p
              style={{
                fontFamily: T.font.mono,
                fontSize: "9px",
                color: T.ink.ghost,
                letterSpacing: ".1em",
                margin: 0,
              }}
            >
              {event.libraryEntityRef}
            </p>
          ) : null}

          <p
            style={{
              fontFamily: T.font.mono,
              fontSize: "10px",
              color: T.ink.low,
              letterSpacing: ".06em",
              margin: 0,
            }}
          >
            {startTime}
            {endTime ? ` – ${endTime}` : ""}
            {duration ? ` · ${duration}` : ""}
          </p>

          {/* Bottom row */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginTop: "4px",
            }}
          >
            <PriceBadge
              isFree={event.isFree}
              priceMin={event.priceMin}
              priceMax={event.priceMax}
              size="xs"
            />
            <a
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[10px] transition-all duration-150 hover:border-(--t-border-hi) hover:text-(--t-ink-base)"
              style={{
                fontFamily: T.font.mono,
                letterSpacing: ".1em",
                textTransform: "uppercase",
                borderColor: T.border.line,
                color: T.ink.low,
                textDecoration: "none",
              }}
            >
              {event.isFree ? "Drop in" : "Reserve"}
              <Icon icon="mdi:arrow-top-right" className="size-2.5" />
            </a>
          </div>
        </div>
      </div>

      <style>{`
        .event-card:hover .event-card-inner {
          transform: translateY(-2px);
          border-color: var(--t-border-hi);
        }
      `}</style>
    </a>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/ui/src/components/events/EventCard.tsx
git commit -m "feat(events): add EventCard grid card component"
```

---

## Task 11: `EventCardGrid` — replaces `EventTimeline`

**Files:**

- Create: `apps/ui/src/components/events/EventCardGrid.tsx`

- [ ] **Step 1: Create `EventCardGrid.tsx`**

```tsx
"use client"

import { useEffect, useRef, useState } from "react"

import { IndexPager } from "@/components/ds"
import { EventCard } from "@/components/events/EventCard"
import type { FilterState } from "@/components/events/EventsFilterBar"
import type { GlobalEventsResponse, GridEvent } from "@/components/events/types"
import { T } from "@/lib/design-tokens"

// ── DateScrollPicker (kept from EventTimeline) ─────────────────────────────────

const DAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"]

function buildDays(count: number): Date[] {
  const days: Date[] = []
  const base = new Date()
  base.setHours(0, 0, 0, 0)
  for (let i = 0; i < count; i++) {
    const d = new Date(base)
    d.setDate(base.getDate() + i)
    days.push(d)
  }
  return days
}

function DateScrollPicker({
  selected,
  onSelect,
  count = 7,
}: {
  selected: Date
  onSelect: (d: Date) => void
  count?: number
}) {
  const days = buildDays(count)
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  return (
    <div className="flex gap-1.5 overflow-x-auto pb-1">
      {days.map((d) => {
        const isToday = d.getTime() === today.getTime()
        const isSelected = d.getTime() === selected.getTime()
        return (
          <button
            key={d.toISOString()}
            type="button"
            onClick={() => onSelect(d)}
            className="flex shrink-0 flex-col items-center rounded-xl px-3 py-2.5 transition-all duration-150"
            style={{
              background: isSelected
                ? "rgba(127,223,255,0.12)"
                : isToday
                  ? "rgba(255,255,255,0.04)"
                  : "transparent",
              border: isSelected
                ? "1px solid rgba(127,223,255,0.3)"
                : `1px solid ${T.border.line}`,
              minWidth: "44px",
            }}
          >
            <span
              style={{
                fontFamily: T.font.mono,
                fontSize: "9px",
                letterSpacing: ".14em",
                textTransform: "uppercase",
                color: isSelected ? T.accent.aurora : T.ink.ghost,
              }}
            >
              {DAY_LABELS[d.getDay()]}
            </span>
            <span
              style={{
                fontFamily: T.font.serif,
                fontSize: "18px",
                lineHeight: 1.2,
                color: isSelected
                  ? T.accent.aurora
                  : isToday
                    ? T.ink.base
                    : T.ink.dim,
                fontWeight: 400,
                marginTop: "2px",
              }}
            >
              {d.getDate()}
            </span>
          </button>
        )
      })}
    </div>
  )
}

// ── EventCardGrid ──────────────────────────────────────────────────────────────

const PAGE_SIZE = 20

interface EventCardGridProps {
  readonly filters: FilterState
  readonly onFiltersChange: (next: FilterState) => void
}

export function EventCardGrid({
  filters,
  onFiltersChange,
}: EventCardGridProps) {
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  })
  const [response, setResponse] = useState<GlobalEventsResponse>({
    events: [],
    total: 0,
    page: 1,
    pageSize: PAGE_SIZE,
  })
  const [loading, setLoading] = useState(true)
  const gridRef = useRef<HTMLDivElement>(null)

  // Sync date scope shortcuts
  useEffect(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    if (filters.dateScope === "today") setSelectedDate(today)
    else if (filters.dateScope === "tomorrow") {
      const d = new Date(today)
      d.setDate(today.getDate() + 1)
      setSelectedDate(d)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.dateScope])

  useEffect(() => {
    setLoading(true)

    const from = new Date(selectedDate)
    from.setHours(0, 0, 0, 0)
    const to = new Date(selectedDate)
    to.setHours(23, 59, 59, 999)

    const params = new URLSearchParams({
      from: from.toISOString(),
      to: to.toISOString(),
      limit: String(PAGE_SIZE),
      page: String(filters.page),
    })
    if (filters.eventTypes.length === 1)
      params.set("type", filters.eventTypes[0]!)
    if (filters.priceScope === "free") params.set("isFree", "true")
    if (filters.priceScope === "paid") params.set("isFree", "false")
    if (filters.countryCode) params.set("countryCode", filters.countryCode)
    if (filters.regionSlug) params.set("regionSlug", filters.regionSlug)

    fetch(`/api/public-proxy/api/events/global?${params}`)
      .then((r) => r.json())
      .then((data: GlobalEventsResponse) => {
        setResponse(data)
        setLoading(false)
      })
      .catch(() => {
        setResponse({ events: [], total: 0, page: 1, pageSize: PAGE_SIZE })
        setLoading(false)
      })
  }, [selectedDate, filters])

  // Client-side filters (search, timeOfDay, ageGroup, libraryDirect)
  const filtered = applyClientFilters(response.events, filters)

  const totalPages = Math.ceil(response.total / PAGE_SIZE)

  const handlePageChange = (p: number) => {
    onFiltersChange({ ...filters, page: p })
    gridRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  return (
    <div ref={gridRef}>
      {/* Date picker */}
      <div style={{ marginBottom: "20px" }}>
        <DateScrollPicker
          selected={selectedDate}
          onSelect={(d) => {
            setSelectedDate(d)
            onFiltersChange({ ...filters, page: 1 })
          }}
          count={
            filters.dateScope === "this-month"
              ? 30
              : filters.dateScope === "this-week"
                ? 14
                : 7
          }
        />
      </div>

      {/* Result count */}
      {!loading && (
        <p
          style={{
            fontFamily: T.font.mono,
            fontSize: "10px",
            color: T.ink.ghost,
            marginBottom: "16px",
          }}
        >
          {filtered.length < response.total
            ? `${filtered.length} of ${response.total}`
            : response.total}{" "}
          events
        </p>
      )}

      {/* Grid */}
      {loading ? (
        <div
          style={{
            textAlign: "center",
            padding: "60px",
            fontFamily: T.font.mono,
            fontSize: "10px",
            letterSpacing: ".14em",
            textTransform: "uppercase",
            color: T.ink.faint,
          }}
        >
          Loading…
        </div>
      ) : filtered.length === 0 ? (
        <div
          style={{
            padding: "60px",
            textAlign: "center",
            fontFamily: T.font.serif,
            fontSize: "1.1rem",
            fontStyle: "italic",
            color: T.ink.faint,
            border: `1px solid ${T.border.line}`,
            borderRadius: "16px",
          }}
        >
          No events match your filters.
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
            gap: "16px",
          }}
          className="sm:grid-cols-2"
        >
          {filtered.map((event) => (
            <EventCard key={event.documentId} event={event} />
          ))}
        </div>
      )}

      {/* Pagination */}
      <IndexPager
        page={filters.page}
        totalPages={totalPages}
        onPageChange={handlePageChange}
      />
    </div>
  )
}

// ── Client-side filter helpers ─────────────────────────────────────────────────

function getHourSlot(
  iso: string
): "morning" | "afternoon" | "evening" | "night" {
  const h = new Date(iso).getHours()
  if (h >= 6 && h < 12) return "morning"
  if (h >= 12 && h < 18) return "afternoon"
  if (h >= 18 && h < 22) return "evening"
  return "night"
}

const DIRECT_PROVIDERS = new Set([
  "ical",
  "custom_ical",
  "aspen",
  "solus",
  "spydus",
])

function applyClientFilters(
  events: GridEvent[],
  filters: FilterState
): GridEvent[] {
  let result = events

  if (filters.search.trim()) {
    const q = filters.search.trim().toLowerCase()
    result = result.filter(
      (e) =>
        e.title.toLowerCase().includes(q) ||
        (e.libraryEntityRef ?? "").toLowerCase().includes(q)
    )
  }

  if (filters.eventTypes.length > 0) {
    result = result.filter((e) => filters.eventTypes.includes(e.eventType))
  }

  if (
    filters.timeOfDay.length > 0 &&
    !filters.timeOfDay.includes("morning" as never)
  ) {
    // Only filter if not all slots selected
    result = result.filter(
      (e) => !e.allDay && filters.timeOfDay.includes(getHourSlot(e.startTime))
    )
  }

  if (filters.libraryDirect) {
    result = result.filter(
      (e) =>
        e.libraryEntityRef &&
        DIRECT_PROVIDERS.has((e as any).sourceProvider ?? "")
    )
  }

  return result
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/ui/src/components/events/EventCardGrid.tsx
git commit -m "feat(events): add EventCardGrid replacing EventTimeline"
```

---

## Task 12: `EventsGeoFilterBar` component

**Files:**

- Create: `apps/ui/src/components/events/EventsGeoFilterBar.tsx`

- [ ] **Step 1: Create `EventsGeoFilterBar.tsx`**

```tsx
"use client"

import { useMemo, useState } from "react"

import type { FilterState } from "@/components/events/EventsFilterBar"
import type { CountryStat } from "@/components/events/types"
import { T } from "@/lib/design-tokens"
import { CONTINENTS, getContinent, getCountryName } from "@/lib/iso-continent"

interface EventsGeoFilterBarProps {
  readonly filters: FilterState
  readonly onChange: (next: FilterState) => void
  readonly countryBreakdown: CountryStat[]
}

const SELECT_STYLE: React.CSSProperties = {
  fontFamily: T.font.mono,
  fontSize: "11px",
  letterSpacing: ".08em",
  background: T.bg.deep,
  border: `1px solid ${T.border.line}`,
  borderRadius: "8px",
  color: T.ink.dim,
  padding: "6px 10px",
  cursor: "pointer",
  outline: "none",
  appearance: "none" as const,
  paddingRight: "24px",
}

function Pill({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        fontFamily: T.font.mono,
        fontSize: "10px",
        letterSpacing: ".12em",
        textTransform: "uppercase",
        padding: "6px 12px",
        borderRadius: "20px",
        border: `1px solid ${active ? "rgba(127,223,255,0.3)" : T.border.line}`,
        background: active ? "rgba(127,223,255,0.1)" : "transparent",
        color: active ? T.accent.aurora : T.ink.low,
        cursor: "pointer",
        transition: "all 150ms",
      }}
    >
      {children}
    </button>
  )
}

export function EventsGeoFilterBar({
  filters,
  onChange,
  countryBreakdown,
}: EventsGeoFilterBarProps) {
  const [selectedContinent, setSelectedContinent] = useState("")

  // Build country options for the selected continent
  const continentCountries = useMemo(() => {
    const codes = countryBreakdown.map((c) => c.countryCode)
    if (!selectedContinent) return codes
    return codes.filter((c) => getContinent(c) === selectedContinent)
  }, [countryBreakdown, selectedContinent])

  const activeFilters: string[] = []
  if (filters.countryCode)
    activeFilters.push(getCountryName(filters.countryCode))
  if (filters.priceScope === "free") activeFilters.push("Free")
  if (filters.page > 1) activeFilters.push(`Page ${filters.page}`)

  return (
    <div
      className="sticky top-14 z-20"
      style={{
        background: "var(--t-header-bg)",
        borderBottom: `1px solid ${T.border.line}`,
        backdropFilter: "blur(12px)",
      }}
    >
      <div
        style={{
          maxWidth: "1296px",
          margin: "0 auto",
          padding: "10px 24px",
          display: "flex",
          alignItems: "center",
          gap: "8px",
          overflowX: "auto",
          flexWrap: "wrap",
        }}
      >
        {/* Continent */}
        <div style={{ position: "relative" }}>
          <select
            value={selectedContinent}
            onChange={(e) => {
              setSelectedContinent(e.target.value)
              onChange({ ...filters, countryCode: "", page: 1 })
            }}
            style={SELECT_STYLE}
          >
            <option value="">All continents</option>
            {CONTINENTS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <span
            style={{
              position: "absolute",
              right: "8px",
              top: "50%",
              transform: "translateY(-50%)",
              pointerEvents: "none",
              color: T.ink.ghost,
              fontSize: "10px",
            }}
          >
            ▾
          </span>
        </div>

        {/* Country */}
        <div style={{ position: "relative" }}>
          <select
            value={filters.countryCode}
            onChange={(e) =>
              onChange({ ...filters, countryCode: e.target.value, page: 1 })
            }
            style={SELECT_STYLE}
          >
            <option value="">Country</option>
            {continentCountries.map((code) => (
              <option key={code} value={code}>
                {getCountryName(code)}
              </option>
            ))}
          </select>
          <span
            style={{
              position: "absolute",
              right: "8px",
              top: "50%",
              transform: "translateY(-50%)",
              pointerEvents: "none",
              color: T.ink.ghost,
              fontSize: "10px",
            }}
          >
            ▾
          </span>
        </div>

        <div
          style={{
            width: "1px",
            height: "20px",
            background: T.border.line,
            flexShrink: 0,
          }}
        />

        <Pill
          active={filters.priceScope === "free"}
          onClick={() =>
            onChange({
              ...filters,
              priceScope: filters.priceScope === "free" ? "all" : "free",
              page: 1,
            })
          }
        >
          Free
        </Pill>

        <Pill active={false} onClick={() => onChange({ ...filters, page: 1 })}>
          New
        </Pill>
      </div>

      {/* Active filter chips */}
      {activeFilters.length > 0 && (
        <div
          style={{
            maxWidth: "1296px",
            margin: "0 auto",
            padding: "6px 24px 10px",
            display: "flex",
            gap: "6px",
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          {activeFilters.map((label) => (
            <span
              key={label}
              style={{
                fontFamily: T.font.mono,
                fontSize: "9px",
                letterSpacing: ".12em",
                textTransform: "uppercase",
                padding: "3px 8px",
                borderRadius: "12px",
                border: `1px solid ${T.border.line}`,
                color: T.ink.low,
                background: "rgba(255,255,255,0.03)",
              }}
            >
              {label}
            </span>
          ))}
          <button
            type="button"
            onClick={() =>
              onChange({
                ...filters,
                countryCode: "",
                regionSlug: "",
                priceScope: "all",
                page: 1,
              })
            }
            style={{
              fontFamily: T.font.mono,
              fontSize: "9px",
              letterSpacing: ".12em",
              textTransform: "uppercase",
              color: T.accent.danger,
              background: "transparent",
              border: "none",
              cursor: "pointer",
              padding: "3px 4px",
            }}
          >
            Clear ×
          </button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/ui/src/components/events/EventsGeoFilterBar.tsx
git commit -m "feat(events): add EventsGeoFilterBar component"
```

---

## Task 13: Update `EventsSidebar` with new filter sections

**Files:**

- Modify: `apps/ui/src/components/events/EventsSidebar.tsx`

- [ ] **Step 1: Replace `EventsSidebar.tsx` with expanded version**

```tsx
"use client"

import { Icon } from "@iconify/react"

import { FilterSidebarSection } from "@/components/ds"
import type {
  AgeGroup,
  DateScope,
  FilterState,
  PriceScope,
  TimeOfDay,
} from "@/components/events/EventsFilterBar"
import { EVENT_TYPE_META } from "@/components/events/EventTypeChip"
import { T } from "@/lib/design-tokens"
import { cn } from "@/lib/styles"

// ── Constants ──────────────────────────────────────────────────────────────────

const DATE_SCOPES: { value: DateScope; label: string; icon: string }[] = [
  { value: "today", label: "Today", icon: "mdi:calendar-today" },
  { value: "tomorrow", label: "Tomorrow", icon: "mdi:calendar-arrow-right" },
  { value: "this-week", label: "This week", icon: "mdi:calendar-week" },
  { value: "this-month", label: "This month", icon: "mdi:calendar-month" },
]

const PRICE_SCOPES: { value: PriceScope; label: string }[] = [
  { value: "all", label: "All" },
  { value: "free", label: "Free" },
  { value: "paid", label: "Paid" },
]

const TIME_SLOTS: { value: TimeOfDay; label: string; range: string }[] = [
  { value: "morning", label: "Morning", range: "06:00–12:00" },
  { value: "afternoon", label: "Afternoon", range: "12:00–18:00" },
  { value: "evening", label: "Evening", range: "18:00–22:00" },
  { value: "night", label: "Night", range: "22:00–06:00" },
]

const AGE_GROUPS: { value: AgeGroup; label: string; note: string }[] = [
  { value: "all", label: "All ages", note: "" },
  { value: "family", label: "Family", note: "Under 12s" },
  { value: "teens", label: "Teens", note: "13–18" },
  { value: "adults", label: "Adults", note: "18+" },
]

// Event types from canonical EVENT_TYPE_META (excludes "other")
const EVENT_TYPE_OPTIONS = Object.entries(EVENT_TYPE_META)
  .filter(([key]) => key !== "other")
  .map(([key, meta]) => ({ value: key, label: meta.label, color: meta.color }))

// ── Sub-components ─────────────────────────────────────────────────────────────

function DateScopeButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean
  icon: string
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-all duration-150"
      )}
      style={{
        fontFamily: T.font.mono,
        fontSize: "11px",
        letterSpacing: ".08em",
        background: active ? "rgba(127,223,255,0.1)" : "transparent",
        border: active
          ? "1px solid rgba(127,223,255,0.25)"
          : "1px solid transparent",
        color: active ? T.accent.aurora : T.ink.dim,
      }}
    >
      <Icon
        icon={icon}
        className="size-3.5 shrink-0"
        style={{ color: active ? T.accent.aurora : T.ink.ghost }}
      />
      {label}
    </button>
  )
}

function PricePill({
  active,
  label,
  onClick,
}: {
  active: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full border px-3 py-1 text-[10px] tracking-[.1em] uppercase transition-all duration-150"
      style={{
        fontFamily: T.font.mono,
        background: active ? "rgba(127,223,255,0.1)" : "transparent",
        borderColor: active ? "rgba(127,223,255,0.3)" : T.border.line,
        color: active ? T.accent.aurora : T.ink.low,
      }}
    >
      {label}
    </button>
  )
}

function CheckRow({
  checked,
  label,
  note,
  color,
  count,
  onChange,
}: {
  checked: boolean
  label: string
  note?: string
  color?: string
  count?: number
  onChange: (v: boolean) => void
}) {
  return (
    <label
      style={{
        display: "flex",
        alignItems: "center",
        gap: "8px",
        cursor: "pointer",
        padding: "4px 0",
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{ accentColor: T.accent.aurora, cursor: "pointer" }}
      />
      {color && (
        <span
          style={{
            width: "8px",
            height: "8px",
            borderRadius: "2px",
            background: color,
            flexShrink: 0,
          }}
        />
      )}
      <span
        style={{
          fontFamily: T.font.mono,
          fontSize: "11px",
          color: T.ink.dim,
          flex: 1,
        }}
      >
        {label}
        {note ? (
          <span style={{ color: T.ink.ghost, marginLeft: "4px" }}>{note}</span>
        ) : null}
      </span>
      {count !== undefined && (
        <span
          style={{
            fontFamily: T.font.mono,
            fontSize: "10px",
            color: T.ink.ghost,
          }}
        >
          {count}
        </span>
      )}
    </label>
  )
}

// ── Toggle helpers ─────────────────────────────────────────────────────────────

function toggleArr<T>(arr: T[], val: T): T[] {
  return arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val]
}

// ── Main component ─────────────────────────────────────────────────────────────

interface EventsSidebarProps {
  readonly filters: FilterState
  readonly onChange: (next: FilterState) => void
}

export function EventsSidebar({ filters, onChange }: EventsSidebarProps) {
  return (
    <aside className="flex flex-col gap-6" style={{ fontFamily: T.font.mono }}>
      {/* Search */}
      <div
        className="flex items-center gap-2 rounded-xl border px-3 py-2.5"
        style={{ borderColor: T.border.line, background: T.bg.deep }}
      >
        <Icon
          icon="mdi:magnify"
          className="size-4 shrink-0"
          style={{ color: T.ink.ghost }}
        />
        <input
          type="text"
          placeholder="Search events…"
          value={filters.search}
          onChange={(e) =>
            onChange({ ...filters, search: e.target.value, page: 1 })
          }
          className="min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-(--t-ink-ghost)"
          style={{ color: T.ink.dim, fontFamily: T.font.mono }}
        />
        {filters.search ? (
          <button
            type="button"
            onClick={() => onChange({ ...filters, search: "", page: 1 })}
            style={{ color: T.ink.ghost }}
          >
            <Icon icon="mdi:close" className="size-3.5" />
          </button>
        ) : null}
      </div>

      {/* § 01 · When */}
      <FilterSidebarSection index={1} label="When">
        <div className="flex flex-col gap-0.5">
          {DATE_SCOPES.map((s) => (
            <DateScopeButton
              key={s.value}
              active={filters.dateScope === s.value}
              icon={s.icon}
              label={s.label}
              onClick={() =>
                onChange({ ...filters, dateScope: s.value, page: 1 })
              }
            />
          ))}
        </div>
      </FilterSidebarSection>

      <div style={{ borderTop: `1px solid ${T.border.line}` }} />

      {/* § 02 · Category */}
      <FilterSidebarSection index={2} label="Category">
        <div className="flex flex-col">
          {EVENT_TYPE_OPTIONS.map((t) => (
            <CheckRow
              key={t.value}
              checked={filters.eventTypes.includes(t.value)}
              label={t.label}
              color={t.color}
              onChange={(checked) =>
                onChange({
                  ...filters,
                  eventTypes: checked
                    ? [...filters.eventTypes, t.value]
                    : filters.eventTypes.filter((v) => v !== t.value),
                  page: 1,
                })
              }
            />
          ))}
        </div>
      </FilterSidebarSection>

      <div style={{ borderTop: `1px solid ${T.border.line}` }} />

      {/* § 03 · Time of day */}
      <FilterSidebarSection index={3} label="Time of day">
        <div className="flex flex-col">
          {TIME_SLOTS.map((slot) => (
            <CheckRow
              key={slot.value}
              checked={filters.timeOfDay.includes(slot.value)}
              label={slot.label}
              note={slot.range}
              onChange={(checked) =>
                onChange({
                  ...filters,
                  timeOfDay: toggleArr(filters.timeOfDay, slot.value),
                  page: 1,
                })
              }
            />
          ))}
        </div>
      </FilterSidebarSection>

      <div style={{ borderTop: `1px solid ${T.border.line}` }} />

      {/* § 04 · Age */}
      <FilterSidebarSection index={4} label="Age">
        <div className="flex flex-col">
          {AGE_GROUPS.map((ag) => (
            <CheckRow
              key={ag.value}
              checked={filters.ageGroup.includes(ag.value)}
              label={ag.label}
              note={ag.note}
              onChange={() =>
                onChange({
                  ...filters,
                  ageGroup: toggleArr(filters.ageGroup, ag.value),
                  page: 1,
                })
              }
            />
          ))}
        </div>
      </FilterSidebarSection>

      <div style={{ borderTop: `1px solid ${T.border.line}` }} />

      {/* § 05 · Price */}
      <FilterSidebarSection index={5} label="Price">
        <div className="flex flex-wrap gap-1.5">
          {PRICE_SCOPES.map((s) => (
            <PricePill
              key={s.value}
              active={filters.priceScope === s.value}
              label={s.label}
              onClick={() =>
                onChange({ ...filters, priceScope: s.value, page: 1 })
              }
            />
          ))}
        </div>
      </FilterSidebarSection>

      <div style={{ borderTop: `1px solid ${T.border.line}` }} />

      {/* § 06 · Library direct */}
      <FilterSidebarSection index={6} label="Source">
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            cursor: "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={filters.libraryDirect}
            onChange={(e) =>
              onChange({ ...filters, libraryDirect: e.target.checked, page: 1 })
            }
            style={{ accentColor: T.accent.aurora, cursor: "pointer" }}
          />
          <span
            style={{
              fontFamily: T.font.mono,
              fontSize: "11px",
              color: T.ink.dim,
            }}
          >
            Library direct only
          </span>
        </label>
        <p
          style={{
            fontFamily: T.font.mono,
            fontSize: "9px",
            color: T.ink.ghost,
            marginTop: "4px",
            lineHeight: 1.5,
          }}
        >
          Excludes Eventbrite / TicketSource
        </p>
      </FilterSidebarSection>

      {/* Reset */}
      <button
        type="button"
        onClick={() =>
          onChange({
            dateScope: "today",
            priceScope: "all",
            eventTypes: [],
            search: "",
            timeOfDay: [],
            ageGroup: [],
            libraryDirect: false,
            countryCode: "",
            regionSlug: "",
            page: 1,
          })
        }
        style={{
          fontFamily: T.font.mono,
          fontSize: "10px",
          letterSpacing: ".1em",
          textTransform: "uppercase",
          color: T.ink.ghost,
          background: "transparent",
          border: `1px solid ${T.border.line}`,
          borderRadius: "8px",
          padding: "8px",
          cursor: "pointer",
          transition: "color 150ms",
        }}
      >
        Reset all filters
      </button>
    </aside>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/ui/src/components/events/EventsSidebar.tsx
git commit -m "feat(events): expand EventsSidebar with new filter sections"
```

---

## Task 14: `EventsDailyVolumeChart` and `EventsBrowseElsewhere`

**Files:**

- Create: `apps/ui/src/components/events/EventsDailyVolumeChart.tsx`
- Create: `apps/ui/src/components/events/EventsBrowseElsewhere.tsx`

- [ ] **Step 1: Create `EventsDailyVolumeChart.tsx`**

```tsx
import { SectionHeader } from "@/components/ds"
import type { DailyVolumeStat } from "@/components/events/types"
import { T } from "@/lib/design-tokens"

interface EventsDailyVolumeChartProps {
  readonly data: DailyVolumeStat[]
}

export function EventsDailyVolumeChart({ data }: EventsDailyVolumeChartProps) {
  if (data.length < 2) return null

  const maxCount = Math.max(...data.map((d) => d.count), 1)
  const W = 600
  const H = 80
  const PADDING = 4

  const points = data.map((d, i) => {
    const x = (i / (data.length - 1)) * W
    const y = H - PADDING - (d.count / maxCount) * (H - PADDING * 2)
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })

  // Build area path (polyline + close to bottom)
  const areaPath =
    `M 0,${H} ` +
    data
      .map((d, i) => {
        const x = (i / (data.length - 1)) * W
        const y = H - PADDING - (d.count / maxCount) * (H - PADDING * 2)
        return `L ${x.toFixed(1)},${y.toFixed(1)}`
      })
      .join(" ") +
    ` L ${W},${H} Z`

  const firstDate = new Date(data[0]!.date)
  const lastDate = new Date(data.at(-1)!.date)
  const dateRange = `${firstDate.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} – ${lastDate.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          marginBottom: "16px",
        }}
      >
        <SectionHeader italic="per day.">Volume</SectionHeader>
        <span
          style={{
            fontFamily: T.font.mono,
            fontSize: "10px",
            color: T.ink.ghost,
            letterSpacing: ".1em",
          }}
        >
          {dateRange}
        </span>
      </div>

      <div
        style={{
          border: `1px solid ${T.border.line}`,
          borderRadius: "12px",
          overflow: "hidden",
          background: T.bg.deep,
          padding: "16px",
        }}
      >
        <svg
          viewBox={`0 0 ${W} ${H}`}
          style={{ width: "100%", height: "auto", display: "block" }}
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="vol-fill" x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="0%"
                stopColor={T.accent.aurora}
                stopOpacity="0.15"
              />
              <stop
                offset="100%"
                stopColor={T.accent.aurora}
                stopOpacity="0.01"
              />
            </linearGradient>
          </defs>
          <path d={areaPath} fill="url(#vol-fill)" />
          <polyline
            points={points.join(" ")}
            fill="none"
            stroke={T.accent.aurora}
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create `EventsBrowseElsewhere.tsx`**

```tsx
"use client"

import { useMemo, useState } from "react"

import { SectionHeader } from "@/components/ds"
import type { FilterState } from "@/components/events/EventsFilterBar"
import type { CountryStat } from "@/components/events/types"
import { T } from "@/lib/design-tokens"
import { CONTINENTS, getContinent, getCountryName } from "@/lib/iso-continent"
import type { Continent } from "@/lib/iso-continent"

interface EventsBrowseElsewhereProps {
  readonly countryBreakdown: CountryStat[]
  readonly filters: FilterState
  readonly onFiltersChange: (next: FilterState) => void
}

export function EventsBrowseElsewhere({
  countryBreakdown,
  filters,
  onFiltersChange,
}: EventsBrowseElsewhereProps) {
  const [activeContinent, setActiveContinent] = useState<Continent | "All">(
    "All"
  )

  // Compute continent totals
  const continentTotals = useMemo(() => {
    const totals: Record<string, number> = {}
    for (const c of countryBreakdown) {
      const cont = getContinent(c.countryCode)
      if (cont) totals[cont] = (totals[cont] ?? 0) + c.count
    }
    return totals
  }, [countryBreakdown])

  // Countries for current continent tab
  const visibleCountries = useMemo(() => {
    if (activeContinent === "All") return countryBreakdown.slice(0, 24)
    return countryBreakdown.filter(
      (c) => getContinent(c.countryCode) === activeContinent
    )
  }, [countryBreakdown, activeContinent])

  if (countryBreakdown.length === 0) return null

  const tabStyle = (active: boolean): React.CSSProperties => ({
    fontFamily: T.font.mono,
    fontSize: "10px",
    letterSpacing: ".12em",
    textTransform: "uppercase",
    padding: "8px 14px",
    border: "none",
    background: active ? "rgba(127,223,255,0.1)" : "transparent",
    color: active ? T.accent.aurora : T.ink.low,
    cursor: "pointer",
    borderBottom: active
      ? `2px solid ${T.accent.aurora}`
      : "2px solid transparent",
    transition: "all 150ms",
    whiteSpace: "nowrap",
  })

  return (
    <section style={{ padding: "60px 0 80px" }}>
      <div style={{ maxWidth: "1296px", margin: "0 auto", padding: "0 24px" }}>
        <SectionHeader italic="elsewhere." style={{ marginBottom: "32px" }}>
          Browse the programme
        </SectionHeader>

        {/* Continent tabs */}
        <div
          style={{
            display: "flex",
            overflowX: "auto",
            borderBottom: `1px solid ${T.border.line}`,
            marginBottom: "24px",
            scrollbarWidth: "none",
          }}
        >
          <button
            type="button"
            style={tabStyle(activeContinent === "All")}
            onClick={() => setActiveContinent("All")}
          >
            All
          </button>
          {CONTINENTS.filter((c) => continentTotals[c]).map((c) => (
            <button
              key={c}
              type="button"
              style={tabStyle(activeContinent === c)}
              onClick={() => setActiveContinent(c)}
            >
              {c}{" "}
              <span style={{ opacity: 0.5 }}>
                ({continentTotals[c]?.toLocaleString() ?? 0})
              </span>
            </button>
          ))}
        </div>

        {/* Country grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
            gap: "8px",
          }}
        >
          {visibleCountries.map((c) => (
            <button
              key={c.countryCode}
              type="button"
              onClick={() =>
                onFiltersChange({
                  ...filters,
                  countryCode: c.countryCode,
                  page: 1,
                })
              }
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "10px 14px",
                border: `1px solid ${
                  filters.countryCode === c.countryCode
                    ? "rgba(127,223,255,0.3)"
                    : T.border.line
                }`,
                borderRadius: "10px",
                background:
                  filters.countryCode === c.countryCode
                    ? "rgba(127,223,255,0.06)"
                    : T.bg.deep,
                cursor: "pointer",
                textAlign: "left",
                transition: "all 150ms",
              }}
            >
              <span
                style={{
                  fontFamily: T.font.mono,
                  fontSize: "11px",
                  color:
                    filters.countryCode === c.countryCode
                      ? T.accent.aurora
                      : T.ink.dim,
                  letterSpacing: ".04em",
                }}
              >
                {getCountryName(c.countryCode)}
              </span>
              <span
                style={{
                  fontFamily: T.font.mono,
                  fontSize: "10px",
                  color: T.ink.ghost,
                }}
              >
                {c.count.toLocaleString()}
              </span>
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/ui/src/components/events/EventsDailyVolumeChart.tsx \
        apps/ui/src/components/events/EventsBrowseElsewhere.tsx
git commit -m "feat(events): add EventsDailyVolumeChart and EventsBrowseElsewhere"
```

---

## Task 15: Wire everything in `EventsProgrammePage` and `events/page.tsx`

**Files:**

- Modify: `apps/ui/src/components/events/EventsProgrammePage.tsx`
- Modify: `apps/ui/src/app/[locale]/events/page.tsx`

- [ ] **Step 1: Update `events/page.tsx` to fetch new data**

Replace `fetchProgrammeData`:

```ts
async function fetchProgrammeData(): Promise<EventsProgrammeData> {
  const [
    stats,
    providers,
    categories,
    topLibraries,
    heatmap,
    featured,
    countryBreakdown,
    dailyVolume,
  ] = await Promise.all([
    eventsGet("/stats"),
    eventsGet("/provider-breakdown"),
    eventsGet("/category-breakdown"),
    eventsGet("/top-libraries?limit=10"),
    eventsGet("/heatmap"),
    eventsGet("/featured?count=6"),
    eventsGet("/country-breakdown"),
    eventsGet("/daily-volume"),
  ])

  return {
    stats: stats ?? {
      totalEvents: 0,
      totalThisWeek: 0,
      totalThisMonth: 0,
      percentFree: 0,
      peakSlot: null,
      peakCount: 0,
    },
    providers: Array.isArray(providers) ? providers : [],
    categories: Array.isArray(categories) ? categories : [],
    topLibraries: Array.isArray(topLibraries) ? topLibraries : [],
    heatmap: Array.isArray(heatmap) ? heatmap : [],
    featured: Array.isArray(featured) ? featured : [],
    countryBreakdown: Array.isArray(countryBreakdown) ? countryBreakdown : [],
    dailyVolume: Array.isArray(dailyVolume) ? dailyVolume : [],
  }
}
```

Also remove the `EventsStatsBar` import since it's replaced by the new hero stats grid. The page component signature stays the same.

- [ ] **Step 2: Replace `EventsProgrammePage.tsx`**

```tsx
"use client"

import { Icon } from "@iconify/react"
import { useState } from "react"

import { Container } from "@/components/elementary/Container"
import { AggregationExplainer } from "@/components/events/AggregationExplainer"
import { EventCategoryBreakdown } from "@/components/events/EventCategoryBreakdown"
import { EventCardGrid } from "@/components/events/EventCardGrid"
import { EventsBrowseElsewhere } from "@/components/events/EventsBrowseElsewhere"
import { EventsDailyVolumeChart } from "@/components/events/EventsDailyVolumeChart"
import { EventsGeoFilterBar } from "@/components/events/EventsGeoFilterBar"
import { EventsHero } from "@/components/events/EventsHero"
import { EventsSidebar } from "@/components/events/EventsSidebar"
import { FeaturedEventsCarousel } from "@/components/events/FeaturedEventsCarousel"
import { MostBookedLibraries } from "@/components/events/MostBookedLibraries"
import { ProviderBreakdownBar } from "@/components/events/ProviderBreakdownBar"
import { TimeOfDayHeatmap } from "@/components/events/TimeOfDayHeatmap"
import { SectionHeader } from "@/components/ds"
import type { FilterState } from "@/components/events/EventsFilterBar"
import type { EventsProgrammeData } from "@/components/events/types"
import { T } from "@/lib/design-tokens"
import { getCountryName } from "@/lib/iso-continent"

const DEFAULT_FILTERS: FilterState = {
  dateScope: "today",
  priceScope: "all",
  eventTypes: [],
  search: "",
  timeOfDay: [],
  ageGroup: [],
  libraryDirect: false,
  countryCode: "",
  regionSlug: "",
  page: 1,
}

function SectionDivider() {
  return (
    <div className="my-2" style={{ borderTop: `1px solid ${T.border.line}` }} />
  )
}

interface EventsProgrammePageProps {
  readonly data: EventsProgrammeData
}

export function EventsProgrammePage({ data }: EventsProgrammePageProps) {
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Derive topCountryName from country breakdown
  const topCountryName = data.countryBreakdown[0]
    ? getCountryName(data.countryBreakdown[0].countryCode)
    : null

  return (
    <main className="relative z-10 flex-1">
      {/* Hero */}
      <EventsHero stats={data.stats} topCountryName={topCountryName} />

      {/* Featured carousel */}
      {data.featured.length > 0 && (
        <FeaturedEventsCarousel events={data.featured} />
      )}

      <SectionDivider />

      {/* Geo filter bar */}
      <EventsGeoFilterBar
        filters={filters}
        onChange={setFilters}
        countryBreakdown={data.countryBreakdown}
      />

      {/* Timeline section — sidebar + main on desktop */}
      <Container className="py-8 sm:py-10">
        {/* Mobile: filter toggle button */}
        <div className="mb-4 flex items-center justify-between lg:hidden">
          <h2
            style={{
              fontFamily: T.font.serif,
              fontSize: "1.4rem",
              fontWeight: 400,
              color: T.ink.base,
            }}
          >
            Today&rsquo;s{" "}
            <em style={{ fontStyle: "italic", color: T.ink.dim }}>
              programme.
            </em>
          </h2>
          <button
            type="button"
            onClick={() => setSidebarOpen((v) => !v)}
            className="flex items-center gap-1.5 rounded-full border px-3 py-1.5 transition-colors"
            style={{
              fontFamily: T.font.mono,
              fontSize: "10px",
              letterSpacing: ".1em",
              textTransform: "uppercase",
              borderColor: sidebarOpen
                ? "rgba(127,223,255,0.3)"
                : T.border.line,
              background: sidebarOpen
                ? "rgba(127,223,255,0.08)"
                : "transparent",
              color: sidebarOpen ? T.accent.aurora : T.ink.dim,
            }}
          >
            <Icon icon="mdi:tune" className="size-3.5" />
            Filters
          </button>
        </div>

        {sidebarOpen && (
          <div
            className="mb-6 rounded-2xl border p-5 lg:hidden"
            style={{ borderColor: T.border.line, background: T.bg.deep }}
          >
            <EventsSidebar filters={filters} onChange={setFilters} />
          </div>
        )}

        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[280px,1fr]">
          <div className="hidden lg:block">
            <div
              className="sticky rounded-2xl border p-5"
              style={{
                top: "calc(3.5rem + 16px)",
                borderColor: T.border.line,
                background: T.bg.deep,
              }}
            >
              <EventsSidebar filters={filters} onChange={setFilters} />
            </div>
          </div>

          <div>
            <EventCardGrid filters={filters} onFiltersChange={setFilters} />
          </div>
        </div>
      </Container>

      <SectionDivider />

      {/* Analytics: The shape of the programme */}
      <Container className="py-8 sm:py-10">
        <SectionHeader italic="programme." style={{ marginBottom: "32px" }}>
          The shape of the
        </SectionHeader>

        <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
          {/* Daily volume chart */}
          {data.dailyVolume.length > 1 && (
            <EventsDailyVolumeChart data={data.dailyVolume} />
          )}

          {/* Category breakdown */}
          <EventCategoryBreakdown categories={data.categories} />

          {/* Heatmap */}
          <TimeOfDayHeatmap cells={data.heatmap} />

          {/* Provider breakdown */}
          <ProviderBreakdownBar providers={data.providers} />
        </div>
      </Container>

      <SectionDivider />

      {/* Most active libraries */}
      <Container className="py-8 sm:py-10">
        <MostBookedLibraries libraries={data.topLibraries} />
      </Container>

      <SectionDivider />

      {/* Browse elsewhere */}
      <EventsBrowseElsewhere
        countryBreakdown={data.countryBreakdown}
        filters={filters}
        onFiltersChange={setFilters}
      />

      <SectionDivider />

      {/* Aggregation explainer */}
      <Container className="py-8 pb-16 sm:py-10 sm:pb-20">
        <AggregationExplainer />
      </Container>
    </main>
  )
}
```

- [ ] **Step 3: Verify the build compiles**

```bash
cd apps/ui && npx tsc --noEmit 2>&1 | head -40
```

Expected: zero errors. Fix any type mismatches (most likely `SectionHeader` italic prop — check its signature).

- [ ] **Step 4: Run dev server and check the page loads**

```bash
cd apps/ui && pnpm dev
```

Open `http://localhost:3000/events`. Verify: hero shows stats grid, featured carousel appears, geo bar is sticky, sidebar has new sections, card grid loads with EventCard layout, pagination renders.

- [ ] **Step 5: Commit**

```bash
git add apps/ui/src/components/events/EventsProgrammePage.tsx \
        apps/ui/src/app/[locale]/events/page.tsx
git commit -m "feat(events): wire all new sections in EventsProgrammePage"
```

---

## Self-Review

**Spec coverage check:**

| Spec section                                     | Covered             |
| ------------------------------------------------ | ------------------- |
| §1 Hero — HeroTitle + HeroStatsGrid              | Task 8              |
| §1 Hero — `totalThisMonth` stat                  | Task 2              |
| §1 Hero — `topCountryName` from countryBreakdown | Task 15             |
| §2 Featured carousel                             | Tasks 9, 15         |
| §2 Backend `featured?count=N`                    | Task 1              |
| §3 Geo filter bar                                | Task 12             |
| §3 Active filter chips                           | Task 12             |
| §3 Backend `/global` pagination envelope         | Task 1              |
| §4a Sidebar — new sections                       | Task 13             |
| §4a Sidebar — EventTypeChip labels               | Task 13             |
| §4b Card grid 2-col                              | Task 11             |
| §4c EventCard with CardImageBlock                | Tasks 5, 10         |
| §5a Country breakdown list                       | Task 14             |
| §5b CategoryBreakdown                            | Task 15 (unchanged) |
| §5c TimeOfDayHeatmap                             | Task 15 (unchanged) |
| §5d ProviderBreakdownBar                         | Task 15 (unchanged) |
| §5e Daily volume chart                           | Tasks 2, 14         |
| §6 Browse elsewhere                              | Task 14             |
| §7a Backend changes                              | Tasks 1, 2          |
| §7b New routes                                   | Task 2              |
| §9 FilterState extension                         | Task 3              |
| DS: IndexPager                                   | Task 6              |
| DS: FilterSidebarSection                         | Task 4              |
| DS: CardImageBlock                               | Task 5              |
| ISO continent utility                            | Task 7              |

**All spec sections are covered.**
