# Events Everywhere Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface upcoming events in three additional locations: a homepage widget showing the next 5 events globally, an events section on library detail pages (already has `LibraryEvents` tab — this plan adds it to the overview section too), and an events mini-feed on country/region detail pages filtered by location.

**Architecture:** All three widgets are lightweight client components that fetch from the existing `/api/public-proxy/api/events/*` endpoints. No new Strapi endpoints needed for the homepage widget or library overview. Country/region feeds use a new `?country=` or `?region=` query parameter added to the `/global` endpoint.

**Tech Stack:** Next.js 15, existing events Strapi plugin, design tokens, `@iconify/react`, `EventTypeChip`, `PriceBadge` (existing components)

---

### Task 1: Strapi — add location filtering to global events endpoint

**Files:**

- Modify: `apps/strapi/src/plugins/events/server/controllers/events.ts`
- Modify: `apps/strapi/src/plugins/events/server/routes/content-api.ts`

- [ ] **Step 1: Add `countryCode` and `regionSlug` fields to event schema**

Open `apps/strapi/src/plugins/events/content-types/event/schema.json` and add two new string fields:

```json
"countryCode": { "type": "string" },
"regionSlug": { "type": "string" }
```

These are populated during the event import/sync job from the library's country/region metadata.

- [ ] **Step 2: Update `global()` controller to accept filters**

In `events.ts`, find the `global(ctx)` controller method. Add country/region filtering:

```ts
async global(ctx) {
  const { from, to, type, isFree, limit, countryCode, regionSlug } =
    ctx.query as {
      from?: string
      to?: string
      type?: string
      isFree?: string
      limit?: string
      countryCode?: string
      regionSlug?: string
    }

  const filters: Record<string, unknown> = { status: "published" }
  if (from) filters.startTime = { ...(filters.startTime as object ?? {}), $gte: from }
  if (to) filters.startTime = { ...(filters.startTime as object ?? {}), $lte: to }
  if (type) filters.eventType = type
  if (isFree === "true") filters.isFree = true
  if (isFree === "false") filters.isFree = false
  if (countryCode) filters.countryCode = countryCode
  if (regionSlug) filters.regionSlug = regionSlug

  const results = await strapi
    .documents("plugin::events.event")
    .findMany({
      filters: filters as never,
      sort: "startTime:asc",
      limit: limit ? parseInt(limit, 10) : 50,
      status: "published",
    })

  ctx.body = results
},
```

- [ ] **Step 3: Rebuild and restart Strapi**

```bash
cd apps/strapi
pnpm run build:plugins
# restart Strapi dev server
```

- [ ] **Step 4: Smoke test with country filter**

```bash
curl "http://127.0.0.1:1337/api/events/global?countryCode=GB&limit=5"
# Expected: array (may be empty if no events tagged with GB yet)
```

- [ ] **Step 5: Commit**

```bash
git add apps/strapi/src/plugins/events/
git commit -m "feat(events): add countryCode/regionSlug fields + location filters to global endpoint"
```

---

### Task 2: UpcomingEventsWidget — homepage component

**Files:**

- Create: `apps/ui/src/components/events/UpcomingEventsWidget.tsx`

- [ ] **Step 1: Create the widget**

```tsx
// apps/ui/src/components/events/UpcomingEventsWidget.tsx
"use client"

import { Icon } from "@iconify/react"
import { useEffect, useState } from "react"

import { EventTypeChip } from "@/components/events/EventTypeChip"
import { PriceBadge } from "@/components/events/PriceBadge"
import { T } from "@/lib/design-tokens"

interface WidgetEvent {
  documentId: string
  title: string
  startTime: string
  allDay: boolean
  eventType: string
  isFree: boolean
  priceMin?: number | null
  priceMax?: number | null
  libraryEntityRef?: string | null
}

function formatEventDate(iso: string, allDay: boolean): string {
  const d = new Date(iso)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(today.getDate() + 1)
  const eventDay = new Date(d)
  eventDay.setHours(0, 0, 0, 0)

  const label =
    eventDay.getTime() === today.getTime()
      ? "Today"
      : eventDay.getTime() === tomorrow.getTime()
        ? "Tomorrow"
        : d.toLocaleDateString("en-GB", {
            weekday: "short",
            day: "numeric",
            month: "short",
          })

  if (allDay) return label
  return `${label} · ${d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false })}`
}

export function UpcomingEventsWidget() {
  const [events, setEvents] = useState<WidgetEvent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const from = new Date().toISOString()
    const to = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    fetch(`/api/public-proxy/api/events/global?from=${from}&to=${to}&limit=5`)
      .then((r) => r.json())
      .then((data: WidgetEvent[]) => {
        setEvents(Array.isArray(data) ? data : [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return null
  if (events.length === 0) return null

  return (
    <div>
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            style={{
              fontFamily: T.font.mono,
              fontSize: "9px",
              letterSpacing: ".22em",
              textTransform: "uppercase",
              color: T.ink.faint,
            }}
          >
            Coming up
          </span>
          <h3
            style={{
              fontFamily: T.font.serif,
              fontSize: "1.3rem",
              fontWeight: 400,
              color: T.ink.base,
            }}
          >
            Events this week
          </h3>
        </div>
        <a
          href="/events"
          className="inline-flex items-center gap-1 transition-colors duration-150 hover:text-(--t-accent-aurora)"
          style={{
            fontFamily: T.font.mono,
            fontSize: "9px",
            letterSpacing: ".16em",
            textTransform: "uppercase",
            color: T.ink.ghost,
            textDecoration: "none",
          }}
        >
          View all
          <Icon icon="mdi:arrow-right" className="size-3" />
        </a>
      </div>

      {/* Event list */}
      <div className="flex flex-col gap-0">
        {events.map((event) => (
          <a
            key={event.documentId}
            href={`/events/${event.documentId}`}
            className="group flex items-center gap-4 border-b py-3.5 transition-colors duration-150 hover:border-(--t-border-hi)"
            style={{ borderColor: T.border.line, textDecoration: "none" }}
          >
            {/* Type bar */}
            <div
              className="h-8 w-0.5 shrink-0 rounded-full"
              style={{
                background:
                  event.eventType === "talk"
                    ? "#a390ff"
                    : event.eventType === "storytime" ||
                        event.eventType === "book_club"
                      ? "#ffb88a"
                      : event.eventType === "workshop" ||
                          event.eventType === "drop_in"
                        ? "#8ef0b3"
                        : event.eventType === "exhibition"
                          ? "#7fdfff"
                          : "rgba(255,255,255,0.12)",
              }}
            />

            {/* Content */}
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <div className="flex items-center gap-2">
                <EventTypeChip type={event.eventType} size="xs" />
                {event.libraryEntityRef && (
                  <span
                    style={{
                      fontFamily: T.font.mono,
                      fontSize: "9px",
                      letterSpacing: ".1em",
                      color: T.ink.ghost,
                      textTransform: "uppercase",
                    }}
                  >
                    {event.libraryEntityRef}
                  </span>
                )}
              </div>
              <p
                className="truncate leading-snug transition-colors duration-150 group-hover:text-(--t-accent-aurora)"
                style={{
                  fontFamily: T.font.serif,
                  fontSize: "1rem",
                  fontStyle: "italic",
                  color: T.ink.base,
                }}
              >
                {event.title}
              </p>
              <p
                style={{
                  fontFamily: T.font.mono,
                  fontSize: "9px",
                  letterSpacing: ".1em",
                  color: T.ink.ghost,
                }}
              >
                {formatEventDate(event.startTime, event.allDay)}
              </p>
            </div>

            {/* Price */}
            <div className="shrink-0">
              <PriceBadge
                isFree={event.isFree}
                priceMin={event.priceMin}
                priceMax={event.priceMax}
                size="xs"
              />
            </div>
          </a>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/ui/src/components/events/UpcomingEventsWidget.tsx
git commit -m "feat(events): add UpcomingEventsWidget for homepage"
```

---

### Task 3: Add events widget to homepage

**Files:**

- Modify: `apps/ui/src/components/home/LibraryHomePage.tsx`

- [ ] **Step 1: Read LibraryHomePage to find the right insertion point**

Open `apps/ui/src/components/home/LibraryHomePage.tsx` and identify a section after the hero/stats blocks but before the footer CTA, where a "Coming up" widget would fit contextually.

- [ ] **Step 2: Add the widget in a Container**

Import and add `UpcomingEventsWidget`:

```tsx
import { UpcomingEventsWidget } from "@/components/events/UpcomingEventsWidget"
import { Container } from "@/components/elementary/Container"

// Inside the JSX, add after the stats/feature section and before the final CTA:
;<div
  className="border-t py-10 sm:py-14"
  style={{ borderColor: T.border.line }}
>
  <Container>
    <UpcomingEventsWidget />
  </Container>
</div>
```

- [ ] **Step 3: Commit**

```bash
git add apps/ui/src/components/home/LibraryHomePage.tsx
git commit -m "feat(events): add UpcomingEventsWidget to homepage"
```

---

### Task 4: LocationEventsStrip — country/region mini-feed

**Files:**

- Create: `apps/ui/src/components/events/LocationEventsStrip.tsx`

- [ ] **Step 1: Create the component**

```tsx
// apps/ui/src/components/events/LocationEventsStrip.tsx
"use client"

import { Icon } from "@iconify/react"
import { useEffect, useState } from "react"

import { EventTypeChip } from "@/components/events/EventTypeChip"
import { T } from "@/lib/design-tokens"

interface StripEvent {
  documentId: string
  title: string
  startTime: string
  allDay: boolean
  eventType: string
  isFree: boolean
  libraryEntityRef?: string | null
}

interface LocationEventsStripProps {
  countryCode?: string
  regionSlug?: string
  locationLabel: string
}

export function LocationEventsStrip({
  countryCode,
  regionSlug,
  locationLabel,
}: LocationEventsStripProps) {
  const [events, setEvents] = useState<StripEvent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const params = new URLSearchParams({
      from: new Date().toISOString(),
      to: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      limit: "6",
    })
    if (countryCode) params.set("countryCode", countryCode)
    if (regionSlug) params.set("regionSlug", regionSlug)

    fetch(`/api/public-proxy/api/events/global?${params}`)
      .then((r) => r.json())
      .then((data: StripEvent[]) => {
        setEvents(Array.isArray(data) ? data : [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [countryCode, regionSlug])

  if (loading || events.length === 0) return null

  return (
    <div>
      {/* Section header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            style={{
              fontFamily: T.font.mono,
              fontSize: "9px",
              letterSpacing: ".22em",
              textTransform: "uppercase",
              color: T.ink.faint,
            }}
          >
            Upcoming
          </span>
          <h3
            style={{
              fontFamily: T.font.serif,
              fontSize: "1.3rem",
              fontWeight: 400,
              color: T.ink.base,
            }}
          >
            Events in{" "}
            <em style={{ fontStyle: "italic", color: T.ink.dim }}>
              {locationLabel}.
            </em>
          </h3>
        </div>
        <a
          href="/events"
          className="inline-flex items-center gap-1 transition-colors duration-150 hover:text-(--t-accent-aurora)"
          style={{
            fontFamily: T.font.mono,
            fontSize: "9px",
            letterSpacing: ".16em",
            textTransform: "uppercase",
            color: T.ink.ghost,
            textDecoration: "none",
          }}
        >
          Programme
          <Icon icon="mdi:arrow-right" className="size-3" />
        </a>
      </div>

      {/* Horizontal scroll on mobile, grid on desktop */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {events.map((event) => (
          <a
            key={event.documentId}
            href={`/events/${event.documentId}`}
            className="group flex flex-col gap-2 rounded-xl border p-4 transition-colors duration-150 hover:border-(--t-border-hi)"
            style={{ borderColor: T.border.line, textDecoration: "none" }}
          >
            <div className="flex items-center gap-2">
              <EventTypeChip type={event.eventType} size="xs" />
              <span
                style={{
                  fontFamily: T.font.mono,
                  fontSize: "9px",
                  letterSpacing: ".1em",
                  color: T.ink.ghost,
                }}
              >
                {event.isFree ? "Free" : "Ticketed"}
              </span>
            </div>
            <p
              className="line-clamp-2 leading-snug transition-colors duration-150 group-hover:text-(--t-accent-aurora)"
              style={{
                fontFamily: T.font.serif,
                fontSize: "0.95rem",
                fontStyle: "italic",
                color: T.ink.base,
              }}
            >
              {event.title}
            </p>
            {event.libraryEntityRef && (
              <p
                style={{
                  fontFamily: T.font.mono,
                  fontSize: "9px",
                  letterSpacing: ".1em",
                  textTransform: "uppercase",
                  color: T.ink.ghost,
                }}
              >
                {event.libraryEntityRef}
              </p>
            )}
          </a>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/ui/src/components/events/LocationEventsStrip.tsx
git commit -m "feat(events): add LocationEventsStrip for country/region pages"
```

---

### Task 5: Wire LocationEventsStrip into country and region detail pages

**Files:**

- Modify: `apps/ui/src/components/country/CountryDetailPage.tsx`
- Modify: `apps/ui/src/components/region/RegionDetailPage.tsx`

- [ ] **Step 1: Add to CountryDetailPage**

Open `CountryDetailPage.tsx`. Find the last content section before `<LocationContributeCTA>`. Add the events strip with the country's `iso2` code:

```tsx
import { LocationEventsStrip } from "@/components/events/LocationEventsStrip"
import { Container } from "@/components/elementary/Container"

// Add before <LocationContributeCTA>:
;<div
  className="border-t py-10 sm:py-14"
  style={{ borderColor: T.border.line }}
>
  <Container>
    <LocationEventsStrip
      countryCode={country.iso2}
      locationLabel={country.name}
    />
  </Container>
</div>
```

- [ ] **Step 2: Add to RegionDetailPage**

Open `RegionDetailPage.tsx`. Add the events strip before `<LocationContributeCTA>`:

```tsx
import { LocationEventsStrip } from "@/components/events/LocationEventsStrip"

// Add before <LocationContributeCTA>:
;<div
  className="border-t py-10 sm:py-14"
  style={{ borderColor: T.border.line }}
>
  <Container>
    <LocationEventsStrip regionSlug={region.slug} locationLabel={region.name} />
  </Container>
</div>
```

- [ ] **Step 3: Commit**

```bash
git add apps/ui/src/components/country/CountryDetailPage.tsx \
        apps/ui/src/components/region/RegionDetailPage.tsx
git commit -m "feat(events): wire LocationEventsStrip into country + region pages"
```
