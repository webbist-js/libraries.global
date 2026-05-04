# Events Detail Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add individual event detail pages at `/events/[documentId]` with full event info, JSON-LD structured data for Google, related events sidebar, and update all event cards to link internally.

**Architecture:** Server Component route page fetches event + related events + library name in parallel from Strapi. `EventDetailPage` is a pure RSC receiving typed props. JSON-LD is injected via a dedicated `EventJsonLd` RSC component using a `<script type="application/ld+json">` tag (safe, server-rendered structured data — no XSS risk since data is serialised with `JSON.stringify` on the server). All event card components gain an `href` prop pointing to the internal route.

**Tech Stack:** Next.js 15 App Router, Strapi v5 Document Service, TypeScript, Tailwind CSS v4, design tokens from `T`, `@iconify/react`

---

### Task 1: Strapi — single event + related events endpoints

**Files:**

- Modify: `apps/strapi/src/plugins/events/server/controllers/events.ts`
- Modify: `apps/strapi/src/plugins/events/server/routes/content-api.ts`

- [ ] **Step 1: Add `event()` and `relatedEvents()` controller methods**

Open `apps/strapi/src/plugins/events/server/controllers/events.ts` and add two methods before the closing `}` of the exported controller object:

```ts
async event(ctx) {
  const { documentId } = ctx.params as { documentId: string }
  const event = await strapi
    .documents("plugin::events.event")
    .findOne({ documentId, status: "published" })
  if (!event) return ctx.notFound()
  ctx.body = event
},

async relatedEvents(ctx) {
  const { documentId } = ctx.params as { documentId: string }
  const source = await strapi
    .documents("plugin::events.event")
    .findOne({ documentId, status: "published" })
  if (!source) return ctx.notFound()

  const now = new Date().toISOString()
  const results = await strapi
    .documents("plugin::events.event")
    .findMany({
      filters: {
        libraryEntityRef: source.libraryEntityRef ?? "",
        startTime: { $gte: now },
        documentId: { $ne: documentId },
      } as never,
      sort: "startTime:asc",
      limit: 4,
      status: "published",
    })
  ctx.body = results
},
```

- [ ] **Step 2: Register routes for both new endpoints**

Open `apps/strapi/src/plugins/events/server/routes/content-api.ts` and add before the closing `]`:

```ts
{
  method: "GET",
  path: "/event/:documentId",
  handler: "events.event",
  config: { auth: false },
},
{
  method: "GET",
  path: "/event/:documentId/related",
  handler: "events.relatedEvents",
  config: { auth: false },
},
```

- [ ] **Step 3: Rebuild and restart Strapi**

```bash
cd apps/strapi
pnpm run build:plugins
# then restart the Strapi dev server
```

- [ ] **Step 4: Smoke test both endpoints**

```bash
curl "http://127.0.0.1:1337/api/events/event/<some-documentId>"
# Expected: JSON object with event fields

curl "http://127.0.0.1:1337/api/events/event/<some-documentId>/related"
# Expected: JSON array (may be empty if no sibling events)
```

- [ ] **Step 5: Commit**

```bash
git add apps/strapi/src/plugins/events/server/controllers/events.ts \
        apps/strapi/src/plugins/events/server/routes/content-api.ts
git commit -m "feat(events): add single event + related events endpoints"
```

---

### Task 2: EventJsonLd component

**Files:**

- Create: `apps/ui/src/components/events/EventJsonLd.tsx`

- [ ] **Step 1: Create the component**

```tsx
// apps/ui/src/components/events/EventJsonLd.tsx
// Server Component — safe to inject structured data via script tag.
// JSON.stringify is called server-side; no user input reaches __html.

interface EventJsonLdProps {
  title: string
  description?: string | null
  startTime: string
  endTime?: string | null
  url: string
  imageUrl?: string | null
  isFree: boolean
  priceMin?: number | null
  priceMax?: number | null
  libraryName?: string | null
}

export function EventJsonLd({
  title,
  description,
  startTime,
  endTime,
  url,
  imageUrl,
  isFree,
  priceMin,
  priceMax,
  libraryName,
}: EventJsonLdProps) {
  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Event",
    name: title,
    startDate: startTime,
    endDate: endTime ?? undefined,
    url,
    description: description ?? undefined,
    image: imageUrl ?? undefined,
    organizer: libraryName
      ? { "@type": "Organization", name: libraryName }
      : undefined,
    offers: {
      "@type": "Offer",
      price: isFree ? 0 : (priceMin ?? undefined),
      priceCurrency: "GBP",
      availability: "https://schema.org/InStock",
      url,
      ...(priceMax ? { maxPrice: priceMax } : {}),
    },
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
  }

  // Remove undefined values so the JSON is clean
  const clean = JSON.parse(JSON.stringify(schema)) as Record<string, unknown>

  return (
    <script
      type="application/ld+json"
      // Safe: data is server-serialised, not user-supplied HTML
      dangerouslySetInnerHTML={{ __html: JSON.stringify(clean) }}
    />
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/ui/src/components/events/EventJsonLd.tsx
git commit -m "feat(events): add EventJsonLd structured data component"
```

---

### Task 3: EventDetailPage component

**Files:**

- Create: `apps/ui/src/components/events/EventDetailPage.tsx`
- Reference: `apps/ui/src/lib/design-tokens.ts` (T), `apps/ui/src/components/events/EventTypeChip.tsx`, `apps/ui/src/components/events/PriceBadge.tsx`, `apps/ui/src/components/events/EventJsonLd.tsx`, `apps/ui/src/components/elementary/Container.tsx`

- [ ] **Step 1: Create EventDetailPage**

```tsx
// apps/ui/src/components/events/EventDetailPage.tsx
import { Icon } from "@iconify/react"

import { EventJsonLd } from "@/components/events/EventJsonLd"
import { EventTypeChip } from "@/components/events/EventTypeChip"
import { PriceBadge } from "@/components/events/PriceBadge"
import { Container } from "@/components/elementary/Container"
import { T } from "@/lib/design-tokens"

interface DetailEvent {
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
  tags?: string[] | null
  status: string
}

interface EventDetailPageProps {
  event: DetailEvent
  related: DetailEvent[]
  libraryName?: string | null
}

function formatDate(iso: string): { date: string; time: string } {
  const d = new Date(iso)
  return {
    date: d.toLocaleDateString("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }),
    time: d.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }),
  }
}

function RelatedEventCard({ event }: { event: DetailEvent }) {
  const { date, time } = formatDate(event.startTime)
  return (
    <a
      href={`/events/${event.documentId}`}
      className="group flex gap-3 rounded-xl border p-4 transition-colors duration-150 hover:border-(--t-border-hi)"
      style={{ borderColor: T.border.line, textDecoration: "none" }}
    >
      <div className="min-w-0 flex-1">
        <div className="mb-1.5 flex items-center gap-2">
          <EventTypeChip type={event.eventType} size="xs" />
        </div>
        <p
          className="line-clamp-2 leading-snug"
          style={{
            fontFamily: T.font.serif,
            fontSize: "0.95rem",
            fontStyle: "italic",
            color: T.ink.base,
          }}
        >
          {event.title}
        </p>
        <p
          className="mt-1"
          style={{
            fontFamily: T.font.mono,
            fontSize: "10px",
            letterSpacing: ".1em",
            color: T.ink.ghost,
          }}
        >
          {date} · {time}
        </p>
      </div>
      <Icon
        icon="mdi:arrow-top-right"
        className="mt-0.5 size-4 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
        style={{ color: T.accent.aurora }}
      />
    </a>
  )
}

export function EventDetailPage({
  event,
  related,
  libraryName,
}: EventDetailPageProps) {
  const { date, time } = formatDate(event.startTime)
  const endFormatted = event.endTime ? formatDate(event.endTime) : null
  const linkUrl = event.registrationUrl ?? event.url

  return (
    <>
      <EventJsonLd
        title={event.title}
        description={event.description}
        startTime={event.startTime}
        endTime={event.endTime}
        url={event.url}
        imageUrl={event.imageUrl}
        isFree={event.isFree}
        priceMin={event.priceMin}
        priceMax={event.priceMax}
        libraryName={libraryName}
      />

      {/* Hero image */}
      {event.imageUrl ? (
        <div className="relative h-64 w-full overflow-hidden sm:h-80 lg:h-96">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={event.imageUrl}
            alt={event.title}
            className="h-full w-full object-cover"
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(to bottom, transparent 40%, rgba(7,11,30,0.85) 100%)",
            }}
          />
        </div>
      ) : null}

      <Container className="py-10 sm:py-14">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-3">
          {/* Main column */}
          <div className="lg:col-span-2">
            {/* Breadcrumb */}
            <nav className="mb-6 flex items-center gap-1.5">
              <a
                href="/events"
                style={{
                  fontFamily: T.font.mono,
                  fontSize: "10px",
                  letterSpacing: ".14em",
                  textTransform: "uppercase",
                  color: T.ink.ghost,
                  textDecoration: "none",
                }}
              >
                Programme
              </a>
              <span style={{ color: T.ink.faint, fontSize: "10px" }}>/</span>
              <span
                style={{
                  fontFamily: T.font.mono,
                  fontSize: "10px",
                  letterSpacing: ".14em",
                  textTransform: "uppercase",
                  color: T.ink.faint,
                }}
              >
                Event
              </span>
            </nav>

            {/* Type chip + tags */}
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <EventTypeChip type={event.eventType} size="sm" />
              {event.tags?.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  style={{
                    fontFamily: T.font.mono,
                    fontSize: "9px",
                    letterSpacing: ".14em",
                    textTransform: "uppercase",
                    color: T.ink.faint,
                    border: `1px solid ${T.border.line}`,
                    borderRadius: "999px",
                    padding: "2px 8px",
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>

            {/* Title */}
            <h1
              style={{
                fontFamily: T.font.serif,
                fontSize: "clamp(1.8rem, 4vw, 2.8rem)",
                lineHeight: 1.1,
                letterSpacing: "-0.01em",
                fontWeight: 400,
                color: T.ink.base,
              }}
            >
              {event.title}
            </h1>

            {/* Meta row */}
            <div
              className="mt-6 flex flex-wrap items-center gap-5 border-t border-b py-4"
              style={{ borderColor: T.border.line }}
            >
              {/* Date */}
              <div className="flex items-center gap-2">
                <Icon
                  icon="mdi:calendar-outline"
                  className="size-4"
                  style={{ color: T.ink.ghost }}
                />
                <span
                  style={{
                    fontFamily: T.font.mono,
                    fontSize: "11px",
                    color: T.ink.dim,
                  }}
                >
                  {date}
                </span>
              </div>

              {/* Time */}
              {!event.allDay && (
                <div className="flex items-center gap-2">
                  <Icon
                    icon="mdi:clock-outline"
                    className="size-4"
                    style={{ color: T.ink.ghost }}
                  />
                  <span
                    style={{
                      fontFamily: T.font.mono,
                      fontSize: "11px",
                      color: T.ink.dim,
                    }}
                  >
                    {time}
                    {endFormatted ? ` – ${endFormatted.time}` : ""}
                  </span>
                </div>
              )}

              {/* Library */}
              {(libraryName ?? event.libraryEntityRef) && (
                <div className="flex items-center gap-2">
                  <Icon
                    icon="mdi:library-outline"
                    className="size-4"
                    style={{ color: T.ink.ghost }}
                  />
                  <span
                    style={{
                      fontFamily: T.font.mono,
                      fontSize: "11px",
                      color: T.ink.dim,
                    }}
                  >
                    {libraryName ?? event.libraryEntityRef}
                  </span>
                </div>
              )}

              <div className="flex-1" />
              <PriceBadge
                isFree={event.isFree}
                priceMin={event.priceMin}
                priceMax={event.priceMax}
              />
            </div>

            {/* Description */}
            {event.description ? (
              <div className="mt-8">
                <p
                  className="leading-relaxed whitespace-pre-line"
                  style={{ color: T.ink.dim, fontSize: "1rem" }}
                >
                  {event.description}
                </p>
              </div>
            ) : null}

            {/* CTAs */}
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a
                href={linkUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-medium transition-all duration-150 hover:bg-[rgba(127,223,255,0.18)]"
                style={{
                  background: "rgba(127,223,255,0.1)",
                  border: "1px solid rgba(127,223,255,0.3)",
                  color: T.accent.aurora,
                  textDecoration: "none",
                }}
              >
                <Icon icon="mdi:ticket-outline" className="size-4" />
                {event.isFree ? "Register free" : "Get tickets"}
              </a>
              <a
                href={`data:text/calendar;charset=utf8,BEGIN:VCALENDAR%0AVERSION:2.0%0ABEGIN:VEVENT%0ASUMMARY:${encodeURIComponent(event.title)}%0ADTSTART:${new Date(event.startTime).toISOString().replace(/[-:]/g, "").slice(0, 15)}Z%0AURL:${encodeURIComponent(event.url)}%0AEND:VEVENT%0AEND:VCALENDAR`}
                download="event.ics"
                className="inline-flex items-center gap-2 rounded-full border px-6 py-3 text-sm transition-colors duration-150 hover:border-(--t-border-hi) hover:text-(--t-ink-base)"
                style={{
                  borderColor: T.border.line,
                  color: T.ink.dim,
                  textDecoration: "none",
                }}
              >
                <Icon icon="mdi:calendar-plus-outline" className="size-4" />
                Add to calendar
              </a>
            </div>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            {related.length > 0 && (
              <div>
                <p
                  className="mb-4"
                  style={{
                    fontFamily: T.font.mono,
                    fontSize: "9px",
                    letterSpacing: ".2em",
                    textTransform: "uppercase",
                    color: T.ink.faint,
                  }}
                >
                  More at this library
                </p>
                <div className="flex flex-col gap-3">
                  {related.map((r) => (
                    <RelatedEventCard key={r.documentId} event={r} />
                  ))}
                </div>
                <a
                  href="/events"
                  className="mt-4 inline-flex items-center gap-1.5 text-[11px] transition-colors duration-150 hover:text-(--t-accent-aurora)"
                  style={{
                    fontFamily: T.font.mono,
                    letterSpacing: ".12em",
                    textTransform: "uppercase",
                    color: T.ink.ghost,
                    textDecoration: "none",
                  }}
                >
                  View all events
                  <Icon icon="mdi:arrow-right" className="size-3" />
                </a>
              </div>
            )}
          </div>
        </div>
      </Container>
    </>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/ui/src/components/events/EventDetailPage.tsx
git commit -m "feat(events): add EventDetailPage component"
```

---

### Task 4: Route page `/events/[documentId]`

**Files:**

- Create: `apps/ui/src/app/[locale]/events/[documentId]/page.tsx`

- [ ] **Step 1: Create the route page**

```tsx
// apps/ui/src/app/[locale]/events/[documentId]/page.tsx
import type { Metadata } from "next"
import type { Locale } from "next-intl"
import { notFound } from "next/navigation"
import { use } from "react"

import { EventDetailPage } from "@/components/events/EventDetailPage"
import GlobalHeader from "@/components/global/GlobalHeader"
import { T } from "@/lib/design-tokens"
import { fetchNavbar } from "@/lib/strapi-api/content/server"

export const revalidate = 300
export const dynamicParams = true

const STRAPI = process.env.STRAPI_URL ?? "http://127.0.0.1:1337"
const API_TOKEN = process.env.STRAPI_REST_READONLY_API_KEY

function eventsGet(path: string) {
  return fetch(`${STRAPI}/api/events${path}`, {
    headers: API_TOKEN ? { Authorization: `Bearer ${API_TOKEN}` } : {},
    next: { revalidate: 300 },
  }).then((r) => (r.ok ? r.json() : null))
}

async function fetchEventData(documentId: string) {
  const [event, related] = await Promise.all([
    eventsGet(`/event/${documentId}`),
    eventsGet(`/event/${documentId}/related`),
  ])
  return { event, related: Array.isArray(related) ? related : [] }
}

async function fetchLibraryName(
  entityRef: string | null | undefined
): Promise<string | null> {
  if (!entityRef) return null
  const res = await fetch(
    `${STRAPI}/api/libraries?filters[entityRef][$eq]=${entityRef}&fields=name&pagination[limit]=1`,
    {
      headers: API_TOKEN ? { Authorization: `Bearer ${API_TOKEN}` } : {},
      next: { revalidate: 3600 },
    }
  )
  if (!res.ok) return null
  const json = (await res.json()) as {
    data?: Array<{ name: string }>
  }
  return json.data?.[0]?.name ?? null
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ documentId: string }>
}): Promise<Metadata> {
  const { documentId } = await params
  const event = await eventsGet(`/event/${documentId}`)
  if (!event) return { title: "Event — Libraries of the World" }
  return {
    title: `${event.title} — Libraries of the World`,
    description: event.description ?? undefined,
    openGraph: event.imageUrl
      ? { images: [{ url: event.imageUrl }] }
      : undefined,
  }
}

export default function EventPage(props: {
  params: Promise<{ locale: string; documentId: string }>
}) {
  const { locale, documentId } = use(props.params)
  const navbar = use(fetchNavbar(locale as Locale))?.data
  const { event, related } = use(fetchEventData(documentId))

  if (!event) notFound()

  const libraryName = use(fetchLibraryName(event.libraryEntityRef))

  return (
    <div
      className="relative isolate flex min-h-screen w-full flex-col"
      style={{ background: T.bg.space, color: T.ink.base }}
    >
      <GlobalHeader locale={locale as Locale} navbar={navbar} />
      <main className="relative z-10 flex-1 pt-4">
        <EventDetailPage
          event={event}
          related={related}
          libraryName={libraryName}
        />
      </main>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/ui/src/app/[locale]/events/[documentId]/page.tsx
git commit -m "feat(events): add event detail route page with ISR"
```

---

### Task 5: Wire event cards to internal detail pages

**Files:**

- Modify: `apps/ui/src/components/events/EventTimeline.tsx` — `TimelineRow` component
- Modify: `apps/ui/src/components/events/FeaturedEventCard.tsx`
- Modify: `apps/ui/src/components/library/LibraryEvents.tsx`

- [ ] **Step 1: Update TimelineRow to link title to detail page**

In `EventTimeline.tsx`, find the `<a>` element that wraps `{event.title}` (around line 195). Change its `href` from `{linkUrl}` to `/events/${event.documentId}` and open in same tab:

```tsx
<a
  href={`/events/${event.documentId}`}
  className="text-sm leading-snug transition-colors duration-150 group-hover:text-(--t-accent-aurora)"
  style={{
    fontFamily: T.font.serif,
    fontSize: "1.1rem",
    fontStyle: "italic",
    color: T.ink.base,
    textDecoration: "none",
  }}
>
  {event.title}
</a>
```

Keep the "Drop in" / "Reserve" CTA button linking to the external `linkUrl` with `target="_blank"`.

- [ ] **Step 2: Update FeaturedEventCard title link**

In `FeaturedEventCard.tsx`, the `<h2>` wrapping `{event.title}` is not currently a link. Wrap it in an anchor pointing to the internal detail page:

```tsx
<a
  href={`/events/${event.documentId}`}
  style={{ textDecoration: "none", color: "inherit" }}
>
  <h2
    style={{
      fontFamily: T.font.serif,
      fontSize: "clamp(1.5rem, 3vw, 2.2rem)",
      lineHeight: 1.1,
      letterSpacing: "-0.01em",
      color: T.ink.base,
      fontWeight: 400,
    }}
  >
    {event.title}
  </h2>
</a>
```

The `FeaturedEvent` type in `types.ts` needs a `documentId` field — add it:

```ts
// In apps/ui/src/components/events/types.ts, add to FeaturedEvent:
documentId: string
```

- [ ] **Step 3: Update LibraryEvents card links**

In `apps/ui/src/components/library/LibraryEvents.tsx`, find where event titles are rendered and wrap them in `<a href={"/events/" + event.documentId}>`.

- [ ] **Step 4: Commit**

```bash
git add apps/ui/src/components/events/EventTimeline.tsx \
        apps/ui/src/components/events/FeaturedEventCard.tsx \
        apps/ui/src/components/events/types.ts \
        apps/ui/src/components/library/LibraryEvents.tsx
git commit -m "feat(events): link event cards to internal detail pages"
```
