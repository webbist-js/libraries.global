# Library Index Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `/index` route — a full-screen, filterable register of every library, with hero stats, sticky geo filter bar, accordion sidebar, 2-column card grid, and continent browse section.

**Architecture:** SSR shell page fetches first-page results + hero stats server-side (MeiliSearch + Strapi). A `"use client"` `LibraryIndexPage` component owns all filter state and syncs it to URL query params via `useSearchParams`/`router.replace`. Subsequent filter changes fetch MeiliSearch client-side. Mirrors the Events programme page's layout language exactly — same `.fblock` accordion sidebar, same panel card grid, same DotHeroCanvas hero.

**Tech Stack:** Next.js 15 App Router, MeiliSearch `library` index, `useSearchParams`/`router.push` for URL state, `T` design tokens, `FBlock` accordion sidebar pattern from `EventsSidebar`, `IndexPager` DS component, `HeroStatsGrid`/`HeroStat` DS components, `DotHeroCanvas`.

---

## File Structure

**Create:**

```
apps/ui/src/
  app/[locale]/index/
    page.tsx                          ← SSR shell: fetches first page + stats, renders LibraryIndexPage
  app/api/library-stats/
    route.ts                          ← GET: { totalLibraries, totalCountries, totalRegions, percentOpen }
  components/library-index/
    types.ts                          ← LibraryIndexFilterState type
    LibraryIndexCard.tsx              ← individual library card (image, overlays, content)
    LibraryIndexSidebar.tsx           ← FBlock accordion sidebar (type, status, featured)
    LibraryIndexGeoFilterBar.tsx      ← sticky geo selectors (continent/country/region/area) + active pills
    LibraryIndexGrid.tsx              ← client grid: fetches on filter change, renders cards + pager
    LibraryIndexHero.tsx              ← DotHeroCanvas hero with stats grid
    LibraryBrowseElsewhere.tsx        ← continent tabs with library counts
    LibraryIndexPage.tsx              ← "use client" orchestrator: filter state, URL sync
```

**Modify:**

```
apps/ui/src/lib/meilisearch.ts        ← extend LibrarySearchParams + searchLibraries()
apps/ui/src/components/global/GlobalHeader.tsx  ← add "Index" nav link
```

---

## Task 1: Extend MeiliSearch client

**Files:**

- Modify: `apps/ui/src/lib/meilisearch.ts`

- [ ] **Step 1: Read the file**

```bash
cat apps/ui/src/lib/meilisearch.ts
```

- [ ] **Step 2: Extend `LibrarySearchParams` with new fields**

In `meilisearch.ts`, replace the existing `LibrarySearchParams` interface:

```ts
export interface LibrarySearchParams {
  query?: string
  libraryTypes?: string[]
  operationalStatuses?: string[]
  continentSlugs?: string[]
  countrySlugs?: string[] // NEW
  regionSlugs?: string[] // NEW
  areaSlugs?: string[] // NEW
  featured?: boolean // NEW — filter featured = true
  sort?: "name:asc" | "name:desc" | "featured:desc,name:asc" // NEW
  page?: number
  hitsPerPage?: number
  withFacets?: boolean // NEW — request continent_slug facet distribution
}
```

- [ ] **Step 3: Update `searchLibraries()` to apply new filters**

Replace the `searchLibraries` function body (keep the function signature):

```ts
export async function searchLibraries(params: LibrarySearchParams = {}) {
  const {
    query = "",
    libraryTypes = [],
    operationalStatuses = [],
    continentSlugs = [],
    countrySlugs = [],
    regionSlugs = [],
    areaSlugs = [],
    featured,
    sort,
    page = 0,
    hitsPerPage = 24,
    withFacets = false,
  } = params

  const filterParts: string[] = []

  if (libraryTypes.length > 0) {
    filterParts.push(
      `libraryType IN [${libraryTypes.map((t) => JSON.stringify(t)).join(", ")}]`
    )
  }
  if (operationalStatuses.length > 0) {
    filterParts.push(
      `operationalStatus IN [${operationalStatuses.map((s) => JSON.stringify(s)).join(", ")}]`
    )
  }
  if (continentSlugs.length > 0) {
    filterParts.push(
      `continent_slug IN [${continentSlugs.map((s) => JSON.stringify(s)).join(", ")}]`
    )
  }
  if (countrySlugs.length > 0) {
    filterParts.push(
      `country_slug IN [${countrySlugs.map((s) => JSON.stringify(s)).join(", ")}]`
    )
  }
  if (regionSlugs.length > 0) {
    filterParts.push(
      `region_slug IN [${regionSlugs.map((s) => JSON.stringify(s)).join(", ")}]`
    )
  }
  if (areaSlugs.length > 0) {
    filterParts.push(
      `area_slug IN [${areaSlugs.map((s) => JSON.stringify(s)).join(", ")}]`
    )
  }
  if (featured === true) {
    filterParts.push(`featured = true`)
  }

  const sortArr: string[] = []
  if (sort === "name:asc") sortArr.push("name:asc")
  else if (sort === "name:desc") sortArr.push("name:desc")
  else if (sort === "featured:desc,name:asc") {
    sortArr.push("featured:desc", "name:asc")
  }

  const index = meiliClient.index("library")

  return index.search<LibrarySearchHit>(query, {
    filter: filterParts.length > 0 ? filterParts.join(" AND ") : undefined,
    sort: sortArr.length > 0 ? sortArr : undefined,
    page: page + 1,
    hitsPerPage,
    facets: withFacets ? ["continent_slug", "operationalStatus"] : undefined,
    attributesToRetrieve: [
      "id",
      "documentId",
      "name",
      "slug",
      "entityRef",
      "shortName",
      "summary",
      "libraryType",
      "operationalStatus",
      "city",
      "featured",
      "continent_slug",
      "continent_name",
      "country_slug",
      "country_name",
      "region_slug",
      "region_name",
      "heroImage",
    ],
  })
}
```

- [ ] **Step 4: Update MeiliSearch index filterable + sortable attributes**

MeiliSearch must have `country_slug`, `region_slug`, `featured`, `name` as filterable/sortable. Run this one-time setup against your local MeiliSearch instance:

```bash
curl -X PATCH 'http://localhost:7700/indexes/library/settings' \
  -H 'Content-Type: application/json' \
  -d '{
    "filterableAttributes": [
      "libraryType", "operationalStatus", "continent_slug",
      "country_slug", "region_slug", "area_slug", "featured"
    ],
    "sortableAttributes": ["name", "featured"],
    "faceting": { "maxValuesPerFacet": 20 }
  }'
```

Expected: `{"taskUid": N, "status": "enqueued"}`. Wait for the task to complete before testing search with these filters.

- [ ] **Step 5: Verify the extension builds**

```bash
cd apps/ui && pnpm tsc --noEmit 2>&1 | head -20
```

Expected: no new errors related to `meilisearch.ts`.

- [ ] **Step 6: Commit**

```bash
git add apps/ui/src/lib/meilisearch.ts
git commit -m "feat(ui): extend LibrarySearchParams with country/region/area/featured/sort/facets"
```

---

## Task 2: `/api/library-stats` route

**Files:**

- Create: `apps/ui/src/app/api/library-stats/route.ts`

- [ ] **Step 1: Create the route file**

```ts
// apps/ui/src/app/api/library-stats/route.ts
import { NextResponse } from "next/server"

import { meiliClient } from "@/lib/meilisearch"

export const revalidate = 1800 // 30 minutes

export async function GET() {
  const STRAPI = process.env.STRAPI_URL ?? "http://127.0.0.1:1337"
  const API_TOKEN = process.env.STRAPI_REST_READONLY_API_KEY

  const strapiHeaders = API_TOKEN
    ? { Authorization: `Bearer ${API_TOKEN}` }
    : {}

  try {
    const [indexStats, operationalFacets, countriesRes, regionsRes] =
      await Promise.all([
        meiliClient.index("library").getStats(),
        meiliClient.index("library").search("", {
          facets: ["operationalStatus"],
          hitsPerPage: 0,
        }),
        fetch(
          `${STRAPI}/api/countries?pagination[pageSize]=1&pagination[page]=1`,
          { headers: strapiHeaders, next: { revalidate: 1800 } }
        ).then((r) => (r.ok ? r.json() : null)),
        fetch(
          `${STRAPI}/api/regions?pagination[pageSize]=1&pagination[page]=1`,
          { headers: strapiHeaders, next: { revalidate: 1800 } }
        ).then((r) => (r.ok ? r.json() : null)),
      ])

    const totalLibraries = indexStats.numberOfDocuments

    const facetDist =
      (
        operationalFacets.facetDistribution as
          | Record<string, Record<string, number>>
          | undefined
      )?.operationalStatus ?? {}
    const openCount = facetDist["open"] ?? 0
    const percentOpen =
      totalLibraries > 0 ? Math.round((openCount / totalLibraries) * 100) : 0

    const totalCountries =
      (countriesRes as { meta?: { pagination?: { total?: number } } } | null)
        ?.meta?.pagination?.total ?? 0
    const totalRegions =
      (regionsRes as { meta?: { pagination?: { total?: number } } } | null)
        ?.meta?.pagination?.total ?? 0

    return NextResponse.json(
      { totalLibraries, totalCountries, totalRegions, percentOpen },
      {
        headers: {
          "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=3600",
        },
      }
    )
  } catch {
    return NextResponse.json(
      { totalLibraries: 0, totalCountries: 0, totalRegions: 0, percentOpen: 0 },
      { status: 200 }
    )
  }
}
```

- [ ] **Step 2: Test the route**

Start the dev server and run:

```bash
curl http://localhost:3000/api/library-stats | jq .
```

Expected (with MeiliSearch running and indexed):

```json
{
  "totalLibraries": 412958,
  "totalCountries": 248,
  "totalRegions": 11420,
  "percentOpen": 94
}
```

With empty index: `{ "totalLibraries": 0, "totalCountries": 0, "totalRegions": 0, "percentOpen": 0 }` — also fine.

- [ ] **Step 3: Commit**

```bash
git add apps/ui/src/app/api/library-stats/route.ts
git commit -m "feat(ui): add /api/library-stats endpoint with 30-min cache"
```

---

## Task 3: `types.ts` — shared filter state type

**Files:**

- Create: `apps/ui/src/components/library-index/types.ts`

- [ ] **Step 1: Create the types file**

```ts
// apps/ui/src/components/library-index/types.ts

export interface LibraryIndexStats {
  totalLibraries: number
  totalCountries: number
  totalRegions: number
  percentOpen: number
}

export interface LibraryIndexFilterState {
  query: string
  /** Raw Strapi libraryType enum values e.g. ["National", "Parliamentary"] */
  libraryTypes: string[]
  /** operationalStatus enum values e.g. ["open", "temporarily_closed"] */
  statuses: string[]
  continentSlug: string
  countrySlug: string
  regionSlug: string
  areaSlug: string
  featured: boolean
  sort: "featured:desc,name:asc" | "name:asc" | "name:desc"
  page: number
}

export const DEFAULT_FILTERS: LibraryIndexFilterState = {
  query: "",
  libraryTypes: [],
  statuses: [],
  continentSlug: "",
  countrySlug: "",
  regionSlug: "",
  areaSlug: "",
  featured: false,
  sort: "featured:desc,name:asc",
  page: 0,
}

/** Parse URLSearchParams into LibraryIndexFilterState */
export function filtersFromParams(
  params: URLSearchParams
): LibraryIndexFilterState {
  const typeParam = params.get("type")
  const statusParam = params.get("status")

  return {
    query: params.get("q") ?? "",
    libraryTypes: typeParam ? typeParam.split(",").filter(Boolean) : [],
    statuses: statusParam ? statusParam.split(",").filter(Boolean) : [],
    continentSlug: params.get("continent") ?? "",
    countrySlug: params.get("country") ?? "",
    regionSlug: params.get("region") ?? "",
    areaSlug: params.get("area") ?? "",
    featured: params.get("featured") === "1",
    sort:
      (params.get("sort") as LibraryIndexFilterState["sort"]) ??
      "featured:desc,name:asc",
    page: Number(params.get("page") ?? "0"),
  }
}

/** Serialise LibraryIndexFilterState to URLSearchParams */
export function filtersToParams(f: LibraryIndexFilterState): URLSearchParams {
  const p = new URLSearchParams()
  if (f.query) p.set("q", f.query)
  if (f.libraryTypes.length > 0) p.set("type", f.libraryTypes.join(","))
  if (f.statuses.length > 0) p.set("status", f.statuses.join(","))
  if (f.continentSlug) p.set("continent", f.continentSlug)
  if (f.countrySlug) p.set("country", f.countrySlug)
  if (f.regionSlug) p.set("region", f.regionSlug)
  if (f.areaSlug) p.set("area", f.areaSlug)
  if (f.featured) p.set("featured", "1")
  if (f.sort !== "featured:desc,name:asc") p.set("sort", f.sort)
  if (f.page > 0) p.set("page", String(f.page))
  return p
}

/** Check whether any non-default filter is active */
export function hasActiveFilters(f: LibraryIndexFilterState): boolean {
  return (
    f.query !== "" ||
    f.libraryTypes.length > 0 ||
    f.statuses.length > 0 ||
    f.continentSlug !== "" ||
    f.countrySlug !== "" ||
    f.regionSlug !== "" ||
    f.areaSlug !== "" ||
    f.featured
  )
}
```

- [ ] **Step 2: Type-check**

```bash
cd apps/ui && pnpm tsc --noEmit 2>&1 | grep "library-index"
```

Expected: no output (no errors).

- [ ] **Step 3: Commit**

```bash
git add apps/ui/src/components/library-index/types.ts
git commit -m "feat(ui): library-index filter state types + URL serialization helpers"
```

---

## Task 4: `LibraryIndexCard` component

**Files:**

- Create: `apps/ui/src/components/library-index/LibraryIndexCard.tsx`

The card mirrors the FeaturedEventCard's image overlay approach. It uses data already available in `LibrarySearchHit`.

- [ ] **Step 1: Create the card**

```tsx
// apps/ui/src/components/library-index/LibraryIndexCard.tsx
import GlobalLink from "@/components/global/GlobalLink"
import { T } from "@/lib/design-tokens"
import {
  buildLibraryPath,
  libraryHeroUrl,
  type LibrarySearchHit,
} from "@/lib/meilisearch"
import { auroraCtaSm } from "@/lib/styles"

// ── Type colour map ────────────────────────────────────────────────────────────
const TYPE_COLORS: Record<string, string> = {
  National: "#e8c98a",
  Public: "#7fdfff",
  Academic: "#a390ff",
  University: "#a390ff",
  Parliamentary: "#e8c98a",
  Special: "#ffb88a",
  Archive: "#ffb88a",
  Municipal: "#7fdfff",
  Monastic: "#8ef0b3",
  Cultural: "#ffb88a",
  Digital: "#7fdfff",
  Mobile: "#8ef0b3",
  Private: "#a390ff",
  State: "#7fdfff",
  Other: T.ink.faint,
}

// ── Status helpers ─────────────────────────────────────────────────────────────
const STATUS_LABELS: Record<string, string> = {
  open: "Open",
  temporarily_closed: "Temp. Closed",
  permanently_closed: "Permanently Closed",
  seasonal: "Seasonal",
  appointment_only: "By Appt.",
  planned: "Planned",
  unknown: "Unknown",
}

const STATUS_COLORS: Record<string, string> = {
  open: T.accent.ok,
  temporarily_closed: T.accent.warn,
  permanently_closed: T.accent.danger,
  seasonal: T.accent.ember,
  appointment_only: T.accent.aurora,
  planned: T.accent.violet,
  unknown: T.ink.faint,
}

// ── Component ──────────────────────────────────────────────────────────────────
interface LibraryIndexCardProps {
  readonly hit: LibrarySearchHit
}

export function LibraryIndexCard({ hit }: LibraryIndexCardProps) {
  const imageUrl = libraryHeroUrl(hit)
  const libraryPath = buildLibraryPath(hit)
  const typeColor = TYPE_COLORS[hit.libraryType ?? ""] ?? T.ink.faint
  const statusLabel = STATUS_LABELS[hit.operationalStatus ?? ""] ?? ""
  const statusColor = STATUS_COLORS[hit.operationalStatus ?? ""] ?? T.ink.faint

  // Breadcrumb: EUROPE · UK · GREATER LONDON (use available names)
  const breadcrumbParts = [
    hit.continent_name,
    hit.country_name,
    hit.region_name,
  ].filter(Boolean)

  return (
    <div
      className="lib-card"
      style={{
        background: T.bg.deep,
        border: `1px solid ${T.border.line}`,
        borderRadius: "16px",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        transition: "border-color 200ms ease",
      }}
    >
      {/* Image area */}
      <div
        className="lib-card-img"
        style={{ position: "relative", height: "160px", flexShrink: 0 }}
      >
        {imageUrl ? (
          <>
            <img
              src={imageUrl}
              alt={hit.name}
              className="absolute inset-0 h-full w-full object-cover"
              style={{ filter: "saturate(0.75) brightness(0.85)" }}
              loading="lazy"
            />
            <div
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(to bottom, rgba(5,8,22,0.65) 0%, rgba(5,8,22,0) 40%, rgba(5,8,22,0.7) 100%)",
              }}
            />
          </>
        ) : (
          <div
            className="absolute inset-0"
            style={{
              background: `
                radial-gradient(ellipse 90% 70% at 20% 30%, rgba(127,223,255,0.10), transparent 60%),
                radial-gradient(ellipse 70% 90% at 75% 75%, rgba(163,144,255,0.08), transparent 55%),
                radial-gradient(ellipse 50% 50% at 55% 20%, rgba(232,201,138,0.05), transparent 50%),
                linear-gradient(160deg, #08101f 0%, #060c1a 60%, #070b1e 100%)
              `,
            }}
          />
        )}

        {/* Top-left: featured badge OR entity-ref + type */}
        <div className="absolute top-0 left-0 flex items-center gap-2 p-3">
          {hit.featured ? (
            <span
              style={{
                fontFamily: T.font.mono,
                fontSize: "9px",
                letterSpacing: ".22em",
                textTransform: "uppercase",
                color: T.accent.gold,
                borderColor: "rgba(232,201,138,0.3)",
                background: "rgba(232,201,138,0.12)",
                border: "1px solid",
                borderRadius: "999px",
                padding: "2px 8px",
              }}
            >
              ✦ Featured
            </span>
          ) : (
            <>
              {hit.entityRef && (
                <span
                  style={{
                    fontFamily: T.font.mono,
                    fontSize: "9px",
                    letterSpacing: ".14em",
                    textTransform: "uppercase",
                    color: T.ink.faint,
                    background: "rgba(0,0,0,0.45)",
                    border: `1px solid ${T.border.line}`,
                    borderRadius: "6px",
                    padding: "2px 6px",
                  }}
                >
                  {hit.entityRef}
                </span>
              )}
              {hit.libraryType && (
                <span
                  style={{
                    fontFamily: T.font.mono,
                    fontSize: "9px",
                    letterSpacing: ".18em",
                    textTransform: "uppercase",
                    color: typeColor,
                    background: `${typeColor}18`,
                    border: `1px solid ${typeColor}28`,
                    borderRadius: "999px",
                    padding: "2px 7px",
                  }}
                >
                  {hit.libraryType}
                </span>
              )}
            </>
          )}
        </div>

        {/* Top-right: operational status */}
        {hit.operationalStatus && (
          <div className="absolute top-0 right-0 p-3">
            <span
              style={{
                fontFamily: T.font.mono,
                fontSize: "9px",
                letterSpacing: ".18em",
                textTransform: "uppercase",
                color: statusColor,
                background: `${statusColor}18`,
                border: `1px solid ${statusColor}28`,
                borderRadius: "999px",
                padding: "2px 7px",
              }}
            >
              {statusLabel}
            </span>
          </div>
        )}
      </div>

      {/* Content area */}
      <div
        style={{
          padding: "14px 18px 16px",
          display: "flex",
          flexDirection: "column",
          gap: "8px",
          flex: 1,
        }}
      >
        {/* Breadcrumb */}
        {breadcrumbParts.length > 0 && (
          <p
            style={{
              fontFamily: T.font.mono,
              fontSize: "9px",
              letterSpacing: ".18em",
              textTransform: "uppercase",
              color: T.ink.faint,
              margin: 0,
            }}
          >
            {breadcrumbParts.join(" · ")}
          </p>
        )}

        {/* Name */}
        <h3
          style={{
            fontFamily: T.font.serif,
            fontSize: "clamp(1.1rem, 1.4vw, 1.35rem)",
            fontWeight: 400,
            letterSpacing: "-0.02em",
            color: T.ink.base,
            margin: 0,
            lineHeight: 1.15,
          }}
        >
          {hit.name}
        </h3>

        {/* Summary */}
        {hit.summary && (
          <p
            style={{
              fontSize: "13px",
              lineHeight: 1.55,
              color: T.ink.low,
              margin: 0,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {hit.summary}
          </p>
        )}

        {/* Spacer + bottom row */}
        <div style={{ marginTop: "auto", paddingTop: "8px" }}>
          {libraryPath ? (
            <GlobalLink href={libraryPath} className={auroraCtaSm}>
              Explore →
            </GlobalLink>
          ) : null}
        </div>
      </div>

      <style>{`
        .lib-card:hover {
          border-color: rgba(127,223,255,0.18) !important;
        }
      `}</style>
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

```bash
cd apps/ui && pnpm tsc --noEmit 2>&1 | grep "LibraryIndexCard"
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add apps/ui/src/components/library-index/LibraryIndexCard.tsx
git commit -m "feat(ui): LibraryIndexCard with image overlay, type badge, status pill"
```

---

## Task 5: `LibraryIndexSidebar` component

**Files:**

- Create: `apps/ui/src/components/library-index/LibraryIndexSidebar.tsx`

Mirrors `EventsSidebar`'s `FBlock` accordion pattern exactly. Import nothing from EventsSidebar — redefine FBlock locally.

- [ ] **Step 1: Create the sidebar**

```tsx
// apps/ui/src/components/library-index/LibraryIndexSidebar.tsx
"use client"

import { Icon } from "@iconify/react"
import { useState } from "react"

import type { LibraryIndexFilterState } from "@/components/library-index/types"
import { T } from "@/lib/design-tokens"

// ── Type groups ────────────────────────────────────────────────────────────────
// Each group maps a UI label to one or more Strapi enum values.
const TYPE_GROUPS: { label: string; types: string[] }[] = [
  { label: "Public", types: ["Public"] },
  { label: "Academic / university", types: ["Academic", "University"] },
  { label: "National & legal deposit", types: ["National", "Parliamentary"] },
  { label: "Special / archives", types: ["Special", "Archive"] },
  { label: "Municipal", types: ["Municipal"] },
  { label: "Monastic", types: ["Monastic"] },
  { label: "Mobile / bookmobile", types: ["Mobile"] },
  { label: "Cultural", types: ["Cultural"] },
  { label: "Digital", types: ["Digital"] },
  { label: "Private", types: ["Private"] },
  { label: "Other", types: ["Other", "State"] },
]

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "open", label: "Open today" },
  { value: "temporarily_closed", label: "Temporarily closed" },
  { value: "appointment_only", label: "Appointment only" },
  { value: "permanently_closed", label: "Permanently closed" },
]

// ── FBlock accordion ───────────────────────────────────────────────────────────
function FBlock({
  index,
  label,
  accordion = false,
  defaultOpen = true,
  onReset,
  children,
}: {
  index: string
  label: string
  accordion?: boolean
  defaultOpen?: boolean
  onReset?: () => void
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="fb">
      <div className="fb-hd" style={{ marginBottom: open ? "10px" : 0 }}>
        <button
          type="button"
          onClick={accordion ? () => setOpen((v) => !v) : undefined}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flex: 1,
            background: "none",
            border: "none",
            padding: 0,
            cursor: accordion ? "pointer" : "default",
            gap: "8px",
          }}
        >
          <span className="fb-t">
            <span style={{ color: T.accent.aurora }}>{index}</span>
            {" · "}
            {label}
          </span>
          {accordion && (
            <Icon
              icon={open ? "mdi:chevron-up" : "mdi:chevron-down"}
              style={{
                fontSize: "14px",
                color: T.ink.faint,
                flexShrink: 0,
              }}
            />
          )}
        </button>
        {onReset && open && (
          <button type="button" className="fb-a" onClick={onReset}>
            Reset
          </button>
        )}
      </div>
      {open && children}
    </div>
  )
}

// ── FCheckbox ──────────────────────────────────────────────────────────────────
function FCheckbox({
  checked,
  onChange,
  label,
  count,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  count?: number
}) {
  return (
    <label className="fopt">
      <span
        className={`fopt-cb ${checked ? "fopt-on" : ""}`}
        onClick={() => onChange(!checked)}
        role="checkbox"
        aria-checked={checked}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === " " || e.key === "Enter") onChange(!checked)
        }}
      >
        {checked && (
          <Icon
            icon="mdi:check"
            style={{ fontSize: "9px", color: T.accent.aurora }}
          />
        )}
      </span>
      <span className="fopt-label">{label}</span>
      {count != null && (
        <span className="fopt-note">{count.toLocaleString()}</span>
      )}
    </label>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────
interface LibraryIndexSidebarProps {
  readonly filters: LibraryIndexFilterState
  readonly onChange: (next: LibraryIndexFilterState) => void
}

export function LibraryIndexSidebar({
  filters,
  onChange,
}: LibraryIndexSidebarProps) {
  // ── Type group toggle ────────────────────────────────────────────────────────
  // A group is "checked" if ALL of its types are in filters.libraryTypes.
  function isGroupChecked(types: string[]): boolean {
    return types.every((t) => filters.libraryTypes.includes(t))
  }

  function toggleGroup(types: string[], checked: boolean) {
    let next = [...filters.libraryTypes]
    if (checked) {
      next = [...new Set([...next, ...types])]
    } else {
      next = next.filter((t) => !types.includes(t))
    }
    onChange({ ...filters, libraryTypes: next, page: 0 })
  }

  // ── Status toggle ────────────────────────────────────────────────────────────
  function toggleStatus(value: string, checked: boolean) {
    const next = checked
      ? [...new Set([...filters.statuses, value])]
      : filters.statuses.filter((s) => s !== value)
    onChange({ ...filters, statuses: next, page: 0 })
  }

  const resetAll = () =>
    onChange({
      ...filters,
      libraryTypes: [],
      statuses: [],
      featured: false,
      page: 0,
    })

  return (
    <div className="sb">
      {/* § 01 Library type */}
      <FBlock
        index="§ 01"
        label="Library type"
        accordion
        defaultOpen={false}
        onReset={
          filters.libraryTypes.length > 0
            ? () => onChange({ ...filters, libraryTypes: [], page: 0 })
            : undefined
        }
      >
        <div className="fopts">
          {TYPE_GROUPS.map((g) => (
            <FCheckbox
              key={g.label}
              checked={isGroupChecked(g.types)}
              onChange={(v) => toggleGroup(g.types, v)}
              label={g.label}
            />
          ))}
        </div>
      </FBlock>

      {/* § 02 Status & Access */}
      <FBlock
        index="§ 02"
        label="Status & access"
        accordion
        defaultOpen={false}
        onReset={
          filters.statuses.length > 0
            ? () => onChange({ ...filters, statuses: [], page: 0 })
            : undefined
        }
      >
        <div className="fopts">
          {STATUS_OPTIONS.map((s) => (
            <FCheckbox
              key={s.value}
              checked={filters.statuses.includes(s.value)}
              onChange={(v) => toggleStatus(s.value, v)}
              label={s.label}
            />
          ))}
        </div>
      </FBlock>

      {/* § 03 Featured only toggle */}
      <FBlock index="§ 03" label="Featured only" accordion defaultOpen={false}>
        <div className="fopts">
          <FCheckbox
            checked={filters.featured}
            onChange={(v) => onChange({ ...filters, featured: v, page: 0 })}
            label="Pillar institutions only"
          />
        </div>
      </FBlock>

      {/* Reset all */}
      <button type="button" className="sb-reset" onClick={resetAll}>
        Reset all filters
      </button>

      <style>{`
        .sb { display: flex; flex-direction: column; gap: 2px; }
        .fb {
          background: rgba(255,255,255,.025);
          border: 1px solid ${T.border.line};
          border-radius: 12px;
          padding: 12px 14px;
          margin-bottom: 6px;
        }
        .fb-hd {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
        }
        .fb-t {
          font-family: ${T.font.mono};
          font-size: 9.5px;
          letter-spacing: .22em;
          text-transform: uppercase;
          color: ${T.ink.low};
          flex: 1;
        }
        .fb-a {
          font-family: ${T.font.mono};
          font-size: 9px;
          letter-spacing: .14em;
          text-transform: uppercase;
          color: ${T.accent.aurora};
          background: none;
          border: none;
          cursor: pointer;
          padding: 0;
          opacity: 0.7;
          flex-shrink: 0;
        }
        .fb-a:hover { opacity: 1; }
        .fopts { display: flex; flex-direction: column; gap: 4px; }
        .fopt {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 3px 0;
          cursor: pointer;
        }
        .fopt-cb {
          width: 14px;
          height: 14px;
          border: 1px solid ${T.border.hi};
          border-radius: 3px;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: border-color 150ms, background 150ms;
        }
        .fopt-on {
          border-color: ${T.accent.aurora} !important;
          background: rgba(127,223,255,0.12) !important;
        }
        .fopt-label {
          font-size: 13px;
          color: ${T.ink.dim};
          flex: 1;
        }
        .fopt-note {
          font-family: ${T.font.mono};
          font-size: 10px;
          color: ${T.ink.faint};
        }
        .sb-reset {
          font-family: ${T.font.mono};
          font-size: 9px;
          letter-spacing: .18em;
          text-transform: uppercase;
          color: ${T.ink.faint};
          background: none;
          border: none;
          cursor: pointer;
          padding: 6px 2px;
          text-align: left;
          margin-top: 2px;
        }
        .sb-reset:hover { color: ${T.ink.dim}; }
      `}</style>
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

```bash
cd apps/ui && pnpm tsc --noEmit 2>&1 | grep "LibraryIndexSidebar"
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add apps/ui/src/components/library-index/LibraryIndexSidebar.tsx
git commit -m "feat(ui): LibraryIndexSidebar with FBlock accordions (type, status, featured)"
```

---

## Task 6: `LibraryIndexGeoFilterBar` component

**Files:**

- Create: `apps/ui/src/components/library-index/LibraryIndexGeoFilterBar.tsx`

Uses local `CONTINENTS` and `COUNTRIES` data for continent/country selects (no API). Loads regions from Strapi when a country is selected. Areas are skipped in v1.

- [ ] **Step 1: Create the geo filter bar**

```tsx
// apps/ui/src/components/library-index/LibraryIndexGeoFilterBar.tsx
"use client"

import { useEffect, useState } from "react"

import type { LibraryIndexFilterState } from "@/components/library-index/types"
import { T } from "@/lib/design-tokens"
import { CONTINENT_COUNTRIES, CONTINENTS } from "@/lib/data/continents"
import { COUNTRIES } from "@/lib/data/countries"

// ── Types ──────────────────────────────────────────────────────────────────────
interface RegionOption {
  slug: string
  name: string
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function countriesForContinent(continentSlug: string) {
  const codes = CONTINENT_COUNTRIES[continentSlug] ?? []
  return COUNTRIES.filter((c) => codes.includes(c.code)).sort((a, b) =>
    a.name.localeCompare(b.name)
  )
}

async function fetchRegions(countrySlug: string): Promise<RegionOption[]> {
  const STRAPI = process.env.NEXT_PUBLIC_STRAPI_URL ?? "http://127.0.0.1:1337"
  try {
    const res = await fetch(
      `${STRAPI}/api/regions?filters[country][slug][$eq]=${countrySlug}&fields[0]=name&fields[1]=slug&sort=name&pagination[pageSize]=200`,
      { cache: "no-store" }
    )
    if (!res.ok) return []
    const json = (await res.json()) as {
      data?: { name?: string; slug?: string }[]
    }
    return (json.data ?? [])
      .filter((r) => r.slug && r.name)
      .map((r) => ({ slug: r.slug!, name: r.name! }))
  } catch {
    return []
  }
}

// ── Select pill ────────────────────────────────────────────────────────────────
function GeoSelect({
  value,
  onChange,
  placeholder,
  options,
  disabled = false,
}: {
  value: string
  onChange: (v: string) => void
  placeholder: string
  options: { value: string; label: string }[]
  disabled?: boolean
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      style={{
        fontFamily: T.font.mono,
        fontSize: "11px",
        letterSpacing: ".10em",
        textTransform: "uppercase",
        color: value ? T.ink.base : T.ink.faint,
        background: value ? "rgba(127,223,255,0.06)" : "rgba(255,255,255,0.04)",
        border: `1px solid ${value ? "rgba(127,223,255,0.25)" : T.border.line}`,
        borderRadius: "999px",
        padding: "5px 12px",
        cursor: disabled ? "not-allowed" : "pointer",
        outline: "none",
        opacity: disabled ? 0.4 : 1,
        appearance: "none",
        paddingRight: "28px",
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%23${T.ink.faint.replace("#", "")}' /%3E%3C/svg%3E")`,
        backgroundRepeat: "no-repeat",
        backgroundPosition: "right 10px center",
      }}
    >
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}

// ── Sort select ────────────────────────────────────────────────────────────────
const SORT_OPTIONS: {
  value: LibraryIndexFilterState["sort"]
  label: string
}[] = [
  { value: "featured:desc,name:asc", label: "Featured first" },
  { value: "name:asc", label: "A–Z" },
  { value: "name:desc", label: "Z–A" },
]

// ── Main component ─────────────────────────────────────────────────────────────
interface LibraryIndexGeoFilterBarProps {
  readonly filters: LibraryIndexFilterState
  readonly onChange: (next: LibraryIndexFilterState) => void
  readonly resultCount?: number
}

export function LibraryIndexGeoFilterBar({
  filters,
  onChange,
  resultCount,
}: LibraryIndexGeoFilterBarProps) {
  const [regions, setRegions] = useState<RegionOption[]>([])
  const [regionsLoading, setRegionsLoading] = useState(false)

  // Load regions when country changes
  useEffect(() => {
    if (!filters.countrySlug) {
      setRegions([])
      return
    }
    setRegionsLoading(true)
    fetchRegions(filters.countrySlug).then((r) => {
      setRegions(r)
      setRegionsLoading(false)
    })
  }, [filters.countrySlug])

  const countryOptions = filters.continentSlug
    ? countriesForContinent(filters.continentSlug).map((c) => ({
        value: c.slug,
        label: c.name,
      }))
    : []

  const regionOptions = regions.map((r) => ({ value: r.slug, label: r.name }))

  const continentOptions = CONTINENTS.map((c) => ({
    value: c.slug,
    label: c.name,
  }))

  function setContinent(slug: string) {
    onChange({
      ...filters,
      continentSlug: slug,
      countrySlug: "",
      regionSlug: "",
      areaSlug: "",
      page: 0,
    })
  }

  function setCountry(slug: string) {
    onChange({
      ...filters,
      countrySlug: slug,
      regionSlug: "",
      areaSlug: "",
      page: 0,
    })
  }

  function setRegion(slug: string) {
    onChange({ ...filters, regionSlug: slug, areaSlug: "", page: 0 })
  }

  function resetGeo() {
    onChange({
      ...filters,
      continentSlug: "",
      countrySlug: "",
      regionSlug: "",
      areaSlug: "",
      page: 0,
    })
  }

  // Active geo label for result count string
  const geoLabel = [
    filters.regionSlug &&
      regions.find((r) => r.slug === filters.regionSlug)?.name,
    filters.countrySlug &&
      countryOptions.find((c) => c.value === filters.countrySlug)?.label,
    filters.continentSlug &&
      continentOptions.find((c) => c.value === filters.continentSlug)?.label,
  ]
    .filter(Boolean)
    .join(", ")

  const hasGeoFilter =
    filters.continentSlug || filters.countrySlug || filters.regionSlug

  return (
    <div
      className="geo-bar"
      style={{
        borderBottom: `1px solid ${T.border.line}`,
        background: T.bg.space,
        position: "sticky",
        top: "56px", // height of GlobalHeader
        zIndex: 15,
      }}
    >
      <div
        style={{
          maxWidth: "1400px",
          margin: "0 auto",
          padding: "10px 24px",
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: "8px",
        }}
      >
        {/* Geo selects */}
        <GeoSelect
          value={filters.continentSlug}
          onChange={setContinent}
          placeholder="All continents"
          options={continentOptions}
        />
        <GeoSelect
          value={filters.countrySlug}
          onChange={setCountry}
          placeholder="Country"
          options={countryOptions}
          disabled={!filters.continentSlug}
        />
        <GeoSelect
          value={filters.regionSlug}
          onChange={setRegion}
          placeholder={regionsLoading ? "Loading…" : "Region"}
          options={regionOptions}
          disabled={!filters.countrySlug || regionsLoading}
        />

        {/* Reset */}
        {hasGeoFilter && (
          <button
            type="button"
            onClick={resetGeo}
            style={{
              fontFamily: T.font.mono,
              fontSize: "10px",
              letterSpacing: ".16em",
              textTransform: "uppercase",
              color: T.ink.faint,
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "5px 8px",
            }}
          >
            Reset
          </button>
        )}

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Result count */}
        {resultCount != null && (
          <p
            style={{
              fontFamily: T.font.mono,
              fontSize: "10px",
              letterSpacing: ".12em",
              color: T.ink.faint,
              margin: 0,
              whiteSpace: "nowrap",
            }}
          >
            {resultCount.toLocaleString()} libraries
            {geoLabel ? ` in ${geoLabel}` : ""}
          </p>
        )}

        {/* Sort */}
        <GeoSelect
          value={filters.sort}
          onChange={(v) =>
            onChange({
              ...filters,
              sort: v as LibraryIndexFilterState["sort"],
              page: 0,
            })
          }
          placeholder="Sort"
          options={SORT_OPTIONS}
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

```bash
cd apps/ui && pnpm tsc --noEmit 2>&1 | grep "LibraryIndexGeoFilterBar"
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add apps/ui/src/components/library-index/LibraryIndexGeoFilterBar.tsx
git commit -m "feat(ui): LibraryIndexGeoFilterBar with continent/country/region selects"
```

---

## Task 7: `LibraryIndexGrid` component

**Files:**

- Create: `apps/ui/src/components/library-index/LibraryIndexGrid.tsx`

Client component. Fetches from MeiliSearch on filter change, renders 2-column card grid + `IndexPager`. Mirrors `EventCardGrid` pattern.

- [ ] **Step 1: Create the grid**

```tsx
// apps/ui/src/components/library-index/LibraryIndexGrid.tsx
"use client"

import { useEffect, useRef, useState } from "react"

import { IndexPager } from "@/components/ds"
import { LibraryIndexCard } from "@/components/library-index/LibraryIndexCard"
import type { LibraryIndexFilterState } from "@/components/library-index/types"
import { T } from "@/lib/design-tokens"
import { searchLibraries, type LibrarySearchHit } from "@/lib/meilisearch"

const PAGE_SIZE = 24

interface LibraryIndexGridProps {
  readonly filters: LibraryIndexFilterState
  readonly onFiltersChange: (next: LibraryIndexFilterState) => void
  readonly onResultCount?: (count: number) => void
  /** Initial hits from SSR to avoid flash on first load */
  readonly initialHits?: LibrarySearchHit[]
  readonly initialTotal?: number
}

export function LibraryIndexGrid({
  filters,
  onFiltersChange,
  onResultCount,
  initialHits,
  initialTotal = 0,
}: LibraryIndexGridProps) {
  const [hits, setHits] = useState<LibrarySearchHit[]>(initialHits ?? [])
  const [total, setTotal] = useState(initialTotal)
  const [loading, setLoading] = useState(!initialHits)
  const gridRef = useRef<HTMLDivElement>(null)
  const isFirst = useRef(true)

  useEffect(() => {
    // Skip the first render if we already have SSR data
    if (isFirst.current && initialHits) {
      isFirst.current = false
      return
    }
    isFirst.current = false

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)

    searchLibraries({
      query: filters.query,
      libraryTypes: filters.libraryTypes,
      operationalStatuses: filters.statuses,
      continentSlugs: filters.continentSlug ? [filters.continentSlug] : [],
      countrySlugs: filters.countrySlug ? [filters.countrySlug] : [],
      regionSlugs: filters.regionSlug ? [filters.regionSlug] : [],
      areaSlugs: filters.areaSlug ? [filters.areaSlug] : [],
      featured: filters.featured || undefined,
      sort: filters.sort,
      page: filters.page,
      hitsPerPage: PAGE_SIZE,
    })
      .then((result) => {
        setHits(result.hits)
        const t = result.estimatedTotalHits ?? result.totalHits ?? 0
        setTotal(t)
        onResultCount?.(t)
        setLoading(false)
      })
      .catch(() => {
        setHits([])
        setTotal(0)
        setLoading(false)
      })
  }, [filters]) // eslint-disable-line react-hooks/exhaustive-deps

  const totalPages = Math.ceil(total / PAGE_SIZE)

  const handlePageChange = (p: number) => {
    onFiltersChange({ ...filters, page: p - 1 }) // IndexPager is 1-based
    gridRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  return (
    <div ref={gridRef}>
      {/* Header row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "20px",
          minHeight: "28px",
        }}
      >
        <p
          style={{
            fontFamily: T.font.mono,
            fontSize: "10px",
            letterSpacing: ".12em",
            textTransform: "uppercase",
            color: T.ink.faint,
            margin: 0,
          }}
        >
          {loading
            ? "Loading…"
            : total > 0
              ? (() => {
                  const start = filters.page * PAGE_SIZE + 1
                  const end = Math.min((filters.page + 1) * PAGE_SIZE, total)
                  return `${start.toLocaleString()}–${end.toLocaleString()} of ${total.toLocaleString()}`
                })()
              : "No libraries found"}
        </p>
      </div>

      {/* Grid */}
      {loading ? (
        <div
          style={{
            textAlign: "center",
            padding: "80px 0",
            fontFamily: T.font.mono,
            fontSize: "10px",
            letterSpacing: ".14em",
            textTransform: "uppercase",
            color: T.ink.faint,
          }}
        >
          Searching…
        </div>
      ) : hits.length === 0 ? (
        <div
          style={{
            padding: "80px 0",
            textAlign: "center",
            fontFamily: T.font.serif,
            fontSize: "1.1rem",
            fontStyle: "italic",
            color: T.ink.faint,
            border: `1px solid ${T.border.line}`,
            borderRadius: "16px",
          }}
        >
          No libraries match your filters.
        </div>
      ) : (
        <div
          className="lib-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, 1fr)",
            gap: "16px",
          }}
        >
          {hits.map((hit) => (
            <LibraryIndexCard key={hit.documentId} hit={hit} />
          ))}
        </div>
      )}

      {/* Pagination */}
      <IndexPager
        page={filters.page + 1}
        totalPages={totalPages}
        onPageChange={handlePageChange}
      />

      <style>{`
        @media (max-width: 640px) {
          .lib-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

```bash
cd apps/ui && pnpm tsc --noEmit 2>&1 | grep "LibraryIndexGrid"
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add apps/ui/src/components/library-index/LibraryIndexGrid.tsx
git commit -m "feat(ui): LibraryIndexGrid with MeiliSearch client fetch + SSR hydration"
```

---

## Task 8: `LibraryIndexHero` component

**Files:**

- Create: `apps/ui/src/components/library-index/LibraryIndexHero.tsx`

Mirrors `EventsHero` exactly — DotHeroCanvas, HeroTitle with italic suffix, HeroLead descriptor, HeroStatsGrid 2×2 grid.

- [ ] **Step 1: Create the hero**

```tsx
// apps/ui/src/components/library-index/LibraryIndexHero.tsx
import {
  HeroEyebrow,
  HeroLead,
  HeroStat,
  HeroStatsGrid,
  HeroTitle,
  parseHeroText,
} from "@/components/ds"
import type { LibraryIndexStats } from "@/components/library-index/types"
import { DotHeroCanvas } from "@/components/ui/DotHeroCanvas"
import { T } from "@/lib/design-tokens"

function formatCount(n: number): string {
  if (n >= 1_000_000)
    return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}k`
  return n.toLocaleString()
}

interface LibraryIndexHeroProps {
  readonly stats: LibraryIndexStats
}

export function LibraryIndexHero({ stats }: LibraryIndexHeroProps) {
  return (
    <section
      className="-mt-14"
      data-transparent-header=""
      style={{ position: "relative", overflow: "hidden" }}
    >
      {/* Background canvas */}
      <DotHeroCanvas variant="aurora" />

      {/* Content */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          maxWidth: "1400px",
          margin: "0 auto",
          padding: "clamp(100px, 14vw, 160px) 24px clamp(60px, 8vw, 100px)",
          display: "grid",
          gridTemplateColumns: "1fr auto",
          gap: "clamp(32px, 5vw, 80px)",
          alignItems: "center",
        }}
      >
        {/* Left: eyebrow + title + descriptor */}
        <div style={{ maxWidth: "600px" }}>
          <HeroEyebrow>The Index · Every Library on Earth</HeroEyebrow>
          <HeroTitle
            {...parseHeroText("Every library, _indexed._")}
            style={{ marginTop: "20px" }}
          />
          <HeroLead className="mt-5">
            A complete, sortable, filterable register of the world&rsquo;s
            libraries — public, academic, national, special. Cross-referenced by
            continent, country, region and area.
          </HeroLead>
        </div>

        {/* Right: stats grid */}
        <div style={{ paddingBottom: "10px" }}>
          <HeroStatsGrid cols={2}>
            <HeroStat
              label="Libraries"
              value={formatCount(stats.totalLibraries)}
            />
            <HeroStat
              label="Countries"
              value={formatCount(stats.totalCountries)}
            />
            <HeroStat label="Regions" value={formatCount(stats.totalRegions)} />
            <HeroStat label="Open now" value={`${stats.percentOpen}%`} />
          </HeroStatsGrid>
        </div>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .lib-hero-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </section>
  )
}
```

- [ ] **Step 2: Verify `parseHeroText` handles underscores for italic**

`parseHeroText` is exported from `components/ds/HeroTitle.tsx`. It parses `_italic_` markers into `{ plain, italic }` props. Verify:

```bash
grep -n "parseHeroText\|italic" apps/ui/src/components/ds/HeroTitle.tsx | head -10
```

If `parseHeroText` doesn't exist or doesn't parse underscores, use the plain + italic props directly on `HeroTitle`:

```tsx
<HeroTitle
  plain="Every library,"
  italic="indexed."
  style={{ marginTop: "20px" }}
/>
```

Check which prop signature `HeroTitle` accepts and use the correct one.

- [ ] **Step 3: Type-check**

```bash
cd apps/ui && pnpm tsc --noEmit 2>&1 | grep "LibraryIndexHero"
```

Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add apps/ui/src/components/library-index/LibraryIndexHero.tsx
git commit -m "feat(ui): LibraryIndexHero with DotHeroCanvas and stats grid"
```

---

## Task 9: `LibraryBrowseElsewhere` component

**Files:**

- Create: `apps/ui/src/components/library-index/LibraryBrowseElsewhere.tsx`

Shows continent tabs with total library counts from a MeiliSearch facet search. Clicking a continent applies the continent filter and scrolls to grid.

- [ ] **Step 1: Create the component**

```tsx
// apps/ui/src/components/library-index/LibraryBrowseElsewhere.tsx
"use client"

import { useEffect, useState } from "react"

import type { LibraryIndexFilterState } from "@/components/library-index/types"
import { T } from "@/lib/design-tokens"
import { CONTINENTS } from "@/lib/data/continents"
import { meiliClient } from "@/lib/meilisearch"

interface ContinentCount {
  slug: string
  name: string
  count: number
}

async function fetchContinentCounts(): Promise<ContinentCount[]> {
  try {
    const result = await meiliClient.index("library").search("", {
      facets: ["continent_slug"],
      hitsPerPage: 0,
    })
    const dist =
      (
        result.facetDistribution as
          | Record<string, Record<string, number>>
          | undefined
      )?.continent_slug ?? {}

    return CONTINENTS.map((c) => ({
      slug: c.slug,
      name: c.name,
      count: dist[c.slug] ?? 0,
    }))
  } catch {
    return CONTINENTS.map((c) => ({ slug: c.slug, name: c.name, count: 0 }))
  }
}

interface LibraryBrowseElsewhereProps {
  readonly filters: LibraryIndexFilterState
  readonly onFiltersChange: (next: LibraryIndexFilterState) => void
  readonly totalLibraries?: number
}

export function LibraryBrowseElsewhere({
  filters,
  onFiltersChange,
  totalLibraries = 0,
}: LibraryBrowseElsewhereProps) {
  const [counts, setCounts] = useState<ContinentCount[]>([])

  useEffect(() => {
    fetchContinentCounts().then(setCounts)
  }, [])

  function selectContinent(slug: string) {
    onFiltersChange({
      ...filters,
      continentSlug: slug === filters.continentSlug ? "" : slug,
      countrySlug: "",
      regionSlug: "",
      areaSlug: "",
      page: 0,
    })
    // Scroll to top of page to show grid
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  return (
    <div style={{ padding: "clamp(40px, 6vw, 80px) 0" }}>
      {/* Heading */}
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          marginBottom: "28px",
          flexWrap: "wrap",
          gap: "8px",
        }}
      >
        <h2
          style={{
            fontFamily: T.font.serif,
            fontSize: "clamp(1.5rem, 2.5vw, 2.2rem)",
            fontWeight: 400,
            letterSpacing: "-.025em",
            color: T.ink.base,
            margin: 0,
          }}
        >
          Browse libraries{" "}
          <em
            style={{ fontStyle: "italic", color: T.ink.dim, fontWeight: 300 }}
          >
            elsewhere.
          </em>
        </h2>
        <span
          style={{
            fontFamily: T.font.mono,
            fontSize: "10px",
            letterSpacing: ".18em",
            textTransform: "uppercase",
            color: T.ink.faint,
          }}
        >
          {totalLibraries.toLocaleString()} total
        </span>
      </div>

      {/* Continent list */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
          gap: "1px",
          border: `1px solid ${T.border.line}`,
          borderRadius: "12px",
          overflow: "hidden",
        }}
      >
        {counts.map((c) => {
          const active = filters.continentSlug === c.slug
          return (
            <button
              key={c.slug}
              type="button"
              onClick={() => selectContinent(c.slug)}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "4px",
                padding: "16px 18px",
                background: active
                  ? "rgba(127,223,255,0.07)"
                  : "rgba(255,255,255,0.02)",
                border: "none",
                borderRight: `1px solid ${T.border.line}`,
                borderBottom: `1px solid ${T.border.line}`,
                cursor: "pointer",
                textAlign: "left",
                transition: "background 150ms",
              }}
            >
              <span
                style={{
                  fontFamily: T.font.serif,
                  fontSize: "15px",
                  fontWeight: 400,
                  color: active ? T.accent.aurora : T.ink.base,
                  letterSpacing: "-.01em",
                }}
              >
                {c.name}
              </span>
              {c.count > 0 && (
                <span
                  style={{
                    fontFamily: T.font.mono,
                    fontSize: "10px",
                    color: T.ink.faint,
                    letterSpacing: ".10em",
                  }}
                >
                  {c.count.toLocaleString()}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

```bash
cd apps/ui && pnpm tsc --noEmit 2>&1 | grep "LibraryBrowseElsewhere"
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add apps/ui/src/components/library-index/LibraryBrowseElsewhere.tsx
git commit -m "feat(ui): LibraryBrowseElsewhere continent grid with MeiliSearch facet counts"
```

---

## Task 10: `LibraryIndexPage` client orchestrator

**Files:**

- Create: `apps/ui/src/components/library-index/LibraryIndexPage.tsx`

`"use client"` component. Owns all filter state. Reads initial state from URL on mount. Writes URL on change. Renders hero (server props) + geo bar + sidebar + grid + browse elsewhere in the Events programme page layout.

- [ ] **Step 1: Create the orchestrator**

```tsx
// apps/ui/src/components/library-index/LibraryIndexPage.tsx
"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useRef, useState } from "react"

import { Container } from "@/components/elementary/Container"
import { LibraryBrowseElsewhere } from "@/components/library-index/LibraryBrowseElsewhere"
import { LibraryIndexGeoFilterBar } from "@/components/library-index/LibraryIndexGeoFilterBar"
import { LibraryIndexGrid } from "@/components/library-index/LibraryIndexGrid"
import { LibraryIndexHero } from "@/components/library-index/LibraryIndexHero"
import { LibraryIndexSidebar } from "@/components/library-index/LibraryIndexSidebar"
import {
  DEFAULT_FILTERS,
  filtersFromParams,
  filtersToParams,
  type LibraryIndexFilterState,
  type LibraryIndexStats,
} from "@/components/library-index/types"
import { T } from "@/lib/design-tokens"
import type { LibrarySearchHit } from "@/lib/meilisearch"
import { Icon } from "@iconify/react"

interface LibraryIndexPageProps {
  readonly stats: LibraryIndexStats
  readonly initialHits: LibrarySearchHit[]
  readonly initialTotal: number
}

export function LibraryIndexPage({
  stats,
  initialHits,
  initialTotal,
}: LibraryIndexPageProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [filters, setFilters] = useState<LibraryIndexFilterState>(() =>
    filtersFromParams(searchParams)
  )
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [resultCount, setResultCount] = useState(initialTotal)
  const isMount = useRef(true)

  // Sync URL when filters change (skip on first mount to avoid double-render)
  useEffect(() => {
    if (isMount.current) {
      isMount.current = false
      return
    }
    const qs = filtersToParams(filters).toString()
    router.replace(qs ? `/index?${qs}` : "/index", { scroll: false })
  }, [filters]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleFiltersChange(next: LibraryIndexFilterState) {
    setFilters(next)
  }

  return (
    <main className="relative z-10 flex-1">
      {/* Hero */}
      <LibraryIndexHero stats={stats} />

      {/* Sticky geo filter bar */}
      <LibraryIndexGeoFilterBar
        filters={filters}
        onChange={handleFiltersChange}
        resultCount={resultCount}
      />

      {/* Main layout: sidebar + grid */}
      <Container className="py-8 sm:py-10">
        {/* Mobile filter toggle */}
        <div className="mb-4 flex items-center justify-between lg:hidden">
          <h2
            style={{
              fontFamily: T.font.serif,
              fontSize: "1.4rem",
              fontWeight: 400,
              color: T.ink.base,
            }}
          >
            The{" "}
            <em style={{ fontStyle: "italic", color: T.ink.dim }}>index.</em>
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

        {/* Mobile sidebar drawer */}
        {sidebarOpen && (
          <div className="mb-6 lg:hidden">
            <LibraryIndexSidebar
              filters={filters}
              onChange={handleFiltersChange}
            />
          </div>
        )}

        {/* Desktop layout */}
        <div
          className="lib-index-layout"
          style={{
            display: "grid",
            gridTemplateColumns: "280px 1fr",
            gap: "40px",
          }}
        >
          {/* Sidebar (desktop) */}
          <div
            className="sticky"
            style={{ top: "calc(56px + 54px + 16px)", alignSelf: "start" }}
          >
            <div
              className="overflow-y-auto"
              style={{ maxHeight: "calc(100vh - 8rem)", paddingRight: "4px" }}
            >
              <LibraryIndexSidebar
                filters={filters}
                onChange={handleFiltersChange}
              />
            </div>
          </div>

          {/* Grid */}
          <div>
            <LibraryIndexGrid
              filters={filters}
              onFiltersChange={handleFiltersChange}
              onResultCount={setResultCount}
              initialHits={initialHits}
              initialTotal={initialTotal}
            />
          </div>
        </div>
      </Container>

      {/* Browse elsewhere */}
      <div style={{ borderTop: `1px solid ${T.border.line}` }}>
        <Container>
          <LibraryBrowseElsewhere
            filters={filters}
            onFiltersChange={handleFiltersChange}
            totalLibraries={stats.totalLibraries}
          />
        </Container>
      </div>

      <style>{`
        @media (max-width: 1023px) {
          .lib-index-layout {
            grid-template-columns: 1fr !important;
          }
          .lib-index-layout > :first-child {
            display: none;
          }
        }
      `}</style>
    </main>
  )
}
```

- [ ] **Step 2: Type-check**

```bash
cd apps/ui && pnpm tsc --noEmit 2>&1 | grep "LibraryIndexPage"
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add apps/ui/src/components/library-index/LibraryIndexPage.tsx
git commit -m "feat(ui): LibraryIndexPage client orchestrator with URL-synced filter state"
```

---

## Task 11: SSR page + nav link

**Files:**

- Create: `apps/ui/src/app/[locale]/index/page.tsx`
- Modify: `apps/ui/src/components/global/GlobalHeader.tsx`

- [ ] **Step 1: Create the SSR page**

```tsx
// apps/ui/src/app/[locale]/index/page.tsx
import type { Metadata } from "next"
import type { Locale } from "next-intl"
import { Suspense, use } from "react"

import GlobalHeader from "@/components/global/GlobalHeader"
import { LibraryIndexPage } from "@/components/library-index/LibraryIndexPage"
import type { LibraryIndexStats } from "@/components/library-index/types"
import { T } from "@/lib/design-tokens"
import { searchLibraries } from "@/lib/meilisearch"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Index — Libraries of the World",
  description:
    "A complete, searchable, filterable register of every significant library on earth. Browse by continent, country, region, type and status.",
}

async function fetchPageData(): Promise<{
  stats: LibraryIndexStats
  initialHits: Awaited<ReturnType<typeof searchLibraries>>["hits"]
  initialTotal: number
}> {
  const BASE = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"

  const [statsRes, firstPage] = await Promise.all([
    fetch(`${BASE}/api/library-stats`, {
      next: { revalidate: 1800 },
    })
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null),
    searchLibraries({
      sort: "featured:desc,name:asc",
      page: 0,
      hitsPerPage: 24,
    }).catch(() => null),
  ])

  const stats: LibraryIndexStats = statsRes ?? {
    totalLibraries: 0,
    totalCountries: 0,
    totalRegions: 0,
    percentOpen: 0,
  }

  return {
    stats,
    initialHits: firstPage?.hits ?? [],
    initialTotal: firstPage?.estimatedTotalHits ?? firstPage?.totalHits ?? 0,
  }
}

export default function LibraryIndexRoute(props: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = use(props.params)
  const { stats, initialHits, initialTotal } = use(fetchPageData())

  return (
    <div
      className="relative isolate flex min-h-screen w-full flex-col"
      style={{ background: T.bg.space, color: T.ink.base }}
    >
      <GlobalHeader locale={locale as Locale} />
      <Suspense>
        <LibraryIndexPage
          stats={stats}
          initialHits={initialHits}
          initialTotal={initialTotal}
        />
      </Suspense>
    </div>
  )
}
```

- [ ] **Step 2: Add "Index" nav link to GlobalHeader**

Read `apps/ui/src/components/global/GlobalHeader.tsx` then find `NAV_LINKS` and add Index between Atlas and Map:

```ts
const NAV_LINKS: { label: string; href: string }[] = [
  { label: "Atlas", href: "/" },
  { label: "Index", href: "/index" }, // ← add this line
  { label: "Map", href: "/map" },
  { label: "Wiki", href: "/wiki" },
  { label: "Journal", href: "/blog" },
  { label: "Events", href: "/events" },
]
```

- [ ] **Step 3: Type-check**

```bash
cd apps/ui && pnpm tsc --noEmit 2>&1 | head -20
```

Expected: no new errors.

- [ ] **Step 4: Start dev server and verify the page loads**

```bash
pnpm dev
```

Navigate to `http://localhost:3000/index`.

Expected:

- Hero renders with `DotHeroCanvas` background, "Every library, _indexed._" title, and 4 stat cells (may show 0 if MeiliSearch is empty)
- Sticky geo filter bar visible below header
- 2-column grid with library cards (or "No libraries found" if index is empty)
- Sidebar accordion sections visible on desktop (§ 01 Library type, § 02 Status & access, § 03 Featured)
- "Index" link appears in nav header between "Atlas" and "Map"
- URL updates when filters change (check browser address bar)

- [ ] **Step 5: Commit**

```bash
git add apps/ui/src/app/\[locale\]/index/page.tsx apps/ui/src/components/global/GlobalHeader.tsx
git commit -m "feat(ui): /index route SSR shell + Index nav link in GlobalHeader"
```

---

## Task 12: Lint + final cleanup

- [ ] **Step 1: Run ESLint on all new files**

```bash
pnpm --filter ui exec eslint src/components/library-index/ src/app/\[locale\]/index/ src/app/api/library-stats/ --max-warnings=0 2>&1
```

Fix any errors. Common issues:

- `react/no-array-index-key` — add a unique `key` prop using slug or value
- `react-hooks/set-state-in-effect` — add `// eslint-disable-next-line` comment on the `setLoading(true)` line in `LibraryIndexGrid`

- [ ] **Step 2: Type-check whole project**

```bash
cd apps/ui && pnpm tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "fix(ui): library-index ESLint and type-check cleanup"
```

---

## Self-Review Checklist

**Spec coverage:**

| Spec section                                                         | Task(s)                    |
| -------------------------------------------------------------------- | -------------------------- |
| § 1 Route & nav                                                      | Task 11                    |
| § 2 Hero section (DotHeroCanvas, stats)                              | Task 8                     |
| § 3 Geo filter bar (continent/country/region, result count, sort)    | Task 6                     |
| § 4a Sidebar (§ 01 type, § 02 status, featured, reset)               | Task 5                     |
| § 4b Library grid (2-col, 24/page, pagination)                       | Task 7                     |
| § 4c Library card (image, overlays, breadcrumb, name, summary, CTA)  | Task 4                     |
| § 5 Browse elsewhere (continent grid with counts)                    | Task 9                     |
| § 6 MeiliSearch extensions (countrySlugs, regionSlugs, sort, facets) | Task 1                     |
| § 7 /api/library-stats                                               | Task 2                     |
| § 8 File structure                                                   | All tasks                  |
| § 9 URL state shape                                                  | Task 3 (helpers) + Task 10 |
| § 10 Out of scope (collection size, founded, facilities, save)       | Not implemented — correct  |

**Out of scope items correctly excluded:**

- Collection size slider — not in any task ✓
- Founded year slider — not in any task ✓
- Facilities/language checkboxes — not in any task ✓
- Save/bookmark — not in any task ✓
- Areas grid in BrowseElsewhere — deferred (area_slug not in MeiliSearch) ✓

**Type consistency checks:**

- `LibraryIndexFilterState` defined in `types.ts` Task 3, imported by Tasks 5, 6, 7, 9, 10 — consistent ✓
- `LibraryIndexStats` defined in `types.ts` Task 3, used in Tasks 8 and 10 — consistent ✓
- `searchLibraries()` extended in Task 1, used in Tasks 7 and 11 — new params match ✓
- `IndexPager` takes `page` (1-based), `LibraryIndexGrid` passes `filters.page + 1` — correct ✓
- `MeiliSearch page` param: `searchLibraries` already adds +1 internally — `LibraryIndexGrid` passes `filters.page` (0-based) — correct ✓
