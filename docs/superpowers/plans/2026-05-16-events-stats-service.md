# Events Stats Service Extraction

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move Event response types to `packages/shared-data` so both the Strapi backend and the Next.js frontend reference a single definition, and extract the raw Knex queries from the events stats controller into a service so the controller becomes a thin adapter.

**Architecture:** The events page in Next.js (`app/[locale]/events/page.tsx`) calls 8 Strapi endpoints in parallel and assembles `EventsProgrammeData`. All the response types (`EventsStats`, `ProviderStat`, `CategoryStat`, etc.) are currently defined only in `components/events/types.ts` — the frontend. Moving them to `@repo/shared-data` makes the contract explicit on both sides. The `stats` controller (193 lines of mixed Knex queries + date arithmetic) is then extracted into `events/server/services/stats.ts` — the controller calls the service and returns its result unchanged.

**Tech Stack:** TypeScript, Strapi v5, Knex (via `strapi.db.connection`), `@repo/shared-data` package, pnpm workspaces.

---

## File Map

| Action | Path                                                          | Responsibility                               |
| ------ | ------------------------------------------------------------- | -------------------------------------------- |
| Modify | `packages/shared-data/index.ts`                               | Add all Event response types                 |
| Modify | `apps/ui/src/components/events/types.ts`                      | Re-export types from `@repo/shared-data`     |
| Modify | `apps/ui/src/app/[locale]/events/page.tsx`                    | Import types from `@repo/shared-data`        |
| Create | `apps/strapi/src/plugins/events/server/services/stats.ts`     | Knex stats queries extracted from controller |
| Modify | `apps/strapi/src/plugins/events/server/services/index.ts`     | Export stats service                         |
| Modify | `apps/strapi/src/plugins/events/server/controllers/events.ts` | Make `stats` controller thin                 |

---

### Task 1: Move Event types to `packages/shared-data`

**Files:**

- Modify: `packages/shared-data/index.ts`

- [ ] **Step 1: Append Event types to `packages/shared-data/index.ts`**

```typescript
// ── Events ────────────────────────────────────────────────────────────────────

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
  sourceProvider: string
  isFree: boolean
  priceMin?: number | null
  priceMax?: number | null
  libraryName?: string | null
  librarySlug?: string | null
  status: string
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

- [ ] **Step 2: Build the shared-data package**

```bash
cd packages/shared-data && pnpm build
```

Expected: Compiles without errors; `dist/index.d.ts` and `dist/index.js` are updated.

- [ ] **Step 3: Commit**

```bash
git add packages/shared-data/index.ts
git commit -m "feat(shared-data): add Event response types"
```

---

### Task 2: Update `components/events/types.ts` to re-export from shared-data

**Files:**

- Modify: `apps/ui/src/components/events/types.ts`

- [ ] **Step 1: Replace the type definitions in `types.ts` with re-exports**

Replace the entire content of `apps/ui/src/components/events/types.ts` with:

```typescript
// Re-exported from @repo/shared-data — edit types there, not here.
export type {
  EventsStats,
  ProviderStat,
  CategoryStat,
  LibraryStat,
  HeatmapCell,
  CountryStat,
  DailyVolumeStat,
  FeaturedEvent,
  GridEvent,
  GlobalEventsResponse,
  EventsProgrammeData,
} from "@repo/shared-data"
```

- [ ] **Step 2: Typecheck the UI**

```bash
cd apps/ui && pnpm typecheck
```

Expected: No type errors. All files that import from `@/components/events/types` continue to work because the names are re-exported unchanged.

- [ ] **Step 3: Commit**

```bash
git add apps/ui/src/components/events/types.ts
git commit -m "refactor(events): re-export Event types from @repo/shared-data"
```

---

### Task 3: Extract the stats Knex queries into a service

**Files:**

- Create: `apps/strapi/src/plugins/events/server/services/stats.ts`

- [ ] **Step 1: Create the stats service**

```typescript
// apps/strapi/src/plugins/events/server/services/stats.ts
import type { EventsStats } from "@repo/shared-data"
import type { Core } from "@strapi/strapi"

export async function computeEventStats(
  strapi: Core.Strapi
): Promise<EventsStats> {
  try {
    const db = strapi.db.connection
    const now = new Date()
    const weekLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
    const monthLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

    const [totalRow] = await db("ev_events")
      .count("* as count")
      .where("start_time", ">=", now)
    const [weekRow] = await db("ev_events")
      .count("* as count")
      .where("start_time", ">=", now)
      .where("start_time", "<=", weekLater)
    const [freeRow] = await db("ev_events")
      .count("* as count")
      .where("start_time", ">=", now)
      .where("is_free", true)
    const [monthRow] = await db("ev_events")
      .count("* as count")
      .where("start_time", ">=", now)
      .where("start_time", "<=", monthLater)

    const peakRows = await db("ev_events")
      .select(
        db.raw("strftime('%w', start_time) as dow"),
        db.raw("strftime('%H', start_time) as hour"),
        db.raw("count(*) as cnt")
      )
      .where("start_time", ">=", now)
      .groupByRaw("dow, hour")
      .orderBy("cnt", "desc")
      .limit(1)

    const peak = peakRows[0] as
      | { dow: string; hour: string; cnt: string }
      | undefined
    const DOW_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
    const peakLabel = peak
      ? `${DOW_LABELS[Number(peak.dow)] ?? ""} ${String(peak.hour).padStart(2, "0")}:00`
      : null

    const total = Number((totalRow as { count: unknown }).count)
    const totalThisWeek = Number((weekRow as { count: unknown }).count)
    const freeCount = Number((freeRow as { count: unknown }).count)
    const totalThisMonth = Number((monthRow as { count: unknown }).count)

    return {
      totalEvents: total,
      totalThisWeek,
      totalThisMonth,
      percentFree: total > 0 ? Math.round((freeCount / total) * 100) : 0,
      peakSlot: peakLabel,
      peakCount: peak ? Number(peak.cnt) : 0,
    }
  } catch {
    return {
      totalEvents: 0,
      totalThisWeek: 0,
      totalThisMonth: 0,
      percentFree: 0,
      peakSlot: null,
      peakCount: 0,
    }
  }
}
```

- [ ] **Step 2: Export the stats service from `services/index.ts`**

Replace the content of `apps/strapi/src/plugins/events/server/services/index.ts`:

```typescript
import credentials from "./credentials"
import { computeEventStats } from "./stats"

export default { credentials, computeEventStats }
```

- [ ] **Step 3: Typecheck the Strapi app**

```bash
cd apps/strapi && pnpm typecheck
```

Expected: No type errors.

- [ ] **Step 4: Commit**

```bash
git add apps/strapi/src/plugins/events/server/services/stats.ts apps/strapi/src/plugins/events/server/services/index.ts
git commit -m "feat(events-plugin): extract stats Knex queries into stats service"
```

---

### Task 4: Make the `stats` controller thin

**Files:**

- Modify: `apps/strapi/src/plugins/events/server/controllers/events.ts`

- [ ] **Step 1: Replace the `stats` controller body (lines 193–257) with a service call**

Replace:

```typescript
async stats(ctx: any) {
  try {
    const db = strapi.db.connection
    const now = new Date()
    // ... (all the Knex queries and date arithmetic)
    ctx.body = { totalEvents: total, ... }
  } catch {
    ctx.body = { totalEvents: 0, ... }
  }
},
```

With:

```typescript
async stats(ctx: any) {
  ctx.body = await strapi.plugin("events").service("computeEventStats")(strapi)
},
```

Wait — Strapi v5 services are accessed differently. The stats service is exported as a plain function, not a Strapi service factory. Access it directly:

```typescript
async stats(ctx: any) {
  const { computeEventStats } = await import("../services/stats")
  ctx.body = await computeEventStats(strapi)
},
```

- [ ] **Step 2: Typecheck**

```bash
cd apps/strapi && pnpm typecheck
```

Expected: No type errors.

- [ ] **Step 3: Manual verification — start Strapi and hit the stats endpoint**

```bash
cd apps/strapi && pnpm dev
```

In a separate terminal:

```bash
curl -s "http://127.0.0.1:1337/api/events/stats" | jq .
```

Expected output shape:

```json
{
  "totalEvents": 0,
  "totalThisWeek": 0,
  "totalThisMonth": 0,
  "percentFree": 0,
  "peakSlot": null,
  "peakCount": 0
}
```

(Values will be 0 unless events are seeded — the shape is what matters.)

- [ ] **Step 4: Commit**

```bash
git add apps/strapi/src/plugins/events/server/controllers/events.ts
git commit -m "refactor(events-plugin): stats controller delegates to computeEventStats service"
```

---

## Self-Review

**Spec coverage:**

- ✅ `EventsProgrammeData` and all Event stat types moved to `@repo/shared-data`
- ✅ `components/events/types.ts` re-exports from shared-data — no callers need to change imports
- ✅ Knex queries extracted from `stats` controller into `services/stats.ts`
- ✅ `stats` controller is now a thin adapter
- ✅ `EventsStats` return type from `computeEventStats` matches the shared-data definition

**Placeholder scan:** None found.

**Type consistency:** `EventsStats` imported from `@repo/shared-data` in both `services/stats.ts` (return type) and re-exported from `components/events/types.ts` — same definition throughout.
