# Events ICS Calendar Feeds Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add ICS calendar subscription feeds so users can subscribe to events in any calendar app (Google Calendar, Apple Calendar, Outlook). Three feeds: per-library, global programme, and (for authenticated users) personal saved events.

**Architecture:** Three Strapi endpoints return `text/calendar` RFC 5545 ICS content. The per-library and global feeds are public (allowlisted via public proxy). The saved-events feed is authenticated and proxied through a Next.js API route that injects the user's Strapi JWT. ICS is generated with a minimal inline helper — no third-party library needed for the simple VEVENT format required.

**Tech Stack:** Strapi v5 Document Service, Next.js API routes, RFC 5545 ICS format (hand-generated), `text/calendar` MIME type

---

### Task 1: ICS generator utility

**Files:**

- Create: `apps/strapi/src/plugins/events/server/utils/ics.ts`

- [ ] **Step 1: Create the ICS utility**

```ts
// apps/strapi/src/plugins/events/server/utils/ics.ts

interface IcsEvent {
  uid: string
  summary: string
  description?: string | null
  dtstart: string // ISO 8601
  dtend?: string | null
  allDay?: boolean
  url?: string | null
  location?: string | null
}

function toIcsDate(iso: string, allDay = false): string {
  const d = new Date(iso)
  if (allDay) {
    const y = d.getUTCFullYear()
    const m = String(d.getUTCMonth() + 1).padStart(2, "0")
    const day = String(d.getUTCDate()).padStart(2, "0")
    return `${y}${m}${day}`
  }
  return d.toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z"
}

function escapeIcs(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n")
}

function foldLine(line: string): string {
  // RFC 5545: fold lines longer than 75 octets
  if (line.length <= 75) return line
  const chunks: string[] = []
  let i = 0
  chunks.push(line.slice(0, 75))
  i = 75
  while (i < line.length) {
    chunks.push(" " + line.slice(i, i + 74))
    i += 74
  }
  return chunks.join("\r\n")
}

export function buildIcs(events: IcsEvent[], calName: string): string {
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//libraries.global//Events//EN",
    `X-WR-CALNAME:${escapeIcs(calName)}`,
    "X-WR-TIMEZONE:UTC",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ]

  for (const e of events) {
    const startProp = e.allDay ? "DTSTART;VALUE=DATE" : "DTSTART"
    const endProp = e.allDay ? "DTEND;VALUE=DATE" : "DTEND"

    lines.push("BEGIN:VEVENT")
    lines.push(foldLine(`UID:${e.uid}@libraries.global`))
    lines.push(foldLine(`SUMMARY:${escapeIcs(e.summary)}`))
    lines.push(foldLine(`${startProp}:${toIcsDate(e.dtstart, e.allDay)}`))

    if (e.dtend) {
      lines.push(foldLine(`${endProp}:${toIcsDate(e.dtend, e.allDay)}`))
    }
    if (e.description) {
      lines.push(foldLine(`DESCRIPTION:${escapeIcs(e.description)}`))
    }
    if (e.url) {
      lines.push(foldLine(`URL:${e.url}`))
    }
    if (e.location) {
      lines.push(foldLine(`LOCATION:${escapeIcs(e.location)}`))
    }

    lines.push("END:VEVENT")
  }

  lines.push("END:VCALENDAR")
  return lines.join("\r\n")
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/strapi/src/plugins/events/server/utils/ics.ts
git commit -m "feat(events): add ICS calendar generator utility"
```

---

### Task 2: Strapi ICS endpoints — global + per-library

**Files:**

- Modify: `apps/strapi/src/plugins/events/server/controllers/events.ts`
- Modify: `apps/strapi/src/plugins/events/server/routes/content-api.ts`

- [ ] **Step 1: Add `icsGlobal()` and `icsLibrary()` controller methods**

Open `events.ts` and add at the end of the controller object (before the closing `}`):

```ts
async icsGlobal(ctx) {
  const { buildIcs } = await import("../utils/ics")
  const now = new Date().toISOString()
  const future = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString()

  const events = await strapi
    .documents("plugin::events.event")
    .findMany({
      filters: { startTime: { $gte: now, $lte: future }, status: "published" } as never,
      sort: "startTime:asc",
      limit: 500,
      status: "published",
    })

  const ics = buildIcs(
    events.map((e) => ({
      uid: e.documentId,
      summary: e.title as string,
      description: (e.description as string | null) ?? null,
      dtstart: e.startTime as string,
      dtend: (e.endTime as string | null) ?? null,
      allDay: !!(e.allDay),
      url: (e.url as string | null) ?? null,
      location: (e.libraryEntityRef as string | null) ?? null,
    })),
    "Libraries of the World — Events"
  )

  ctx.set("Content-Type", "text/calendar; charset=utf-8")
  ctx.set("Content-Disposition", 'attachment; filename="libraries-events.ics"')
  ctx.body = ics
},

async icsLibrary(ctx) {
  const { buildIcs } = await import("../utils/ics")
  const { entityRef } = ctx.params as { entityRef: string }
  const now = new Date().toISOString()
  const future = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString()

  const events = await strapi
    .documents("plugin::events.event")
    .findMany({
      filters: {
        libraryEntityRef: entityRef,
        startTime: { $gte: now, $lte: future },
        status: "published",
      } as never,
      sort: "startTime:asc",
      limit: 200,
      status: "published",
    })

  const ics = buildIcs(
    events.map((e) => ({
      uid: e.documentId,
      summary: e.title as string,
      description: (e.description as string | null) ?? null,
      dtstart: e.startTime as string,
      dtend: (e.endTime as string | null) ?? null,
      allDay: !!(e.allDay),
      url: (e.url as string | null) ?? null,
      location: entityRef,
    })),
    `${entityRef} — Events`
  )

  ctx.set("Content-Type", "text/calendar; charset=utf-8")
  ctx.set("Content-Disposition", `attachment; filename="${entityRef}-events.ics"`)
  ctx.body = ics
},
```

- [ ] **Step 2: Add routes**

In `content-api.ts`, add:

```ts
{
  method: "GET",
  path: "/ics/global.ics",
  handler: "events.icsGlobal",
  config: { auth: false },
},
{
  method: "GET",
  path: "/ics/library/:entityRef.ics",
  handler: "events.icsLibrary",
  config: { auth: false },
},
```

- [ ] **Step 3: Allowlist ICS paths in UI proxy**

Open `apps/ui/src/lib/strapi-api/request-auth.ts` and confirm `"api/events"` is already in `ALLOWED_STRAPI_ENDPOINTS.GET` (it was added in a previous step). The wildcard prefix covers the `/ics/*` sub-paths.

- [ ] **Step 4: Rebuild and smoke test**

```bash
cd apps/strapi
pnpm run build:plugins
# restart Strapi

curl "http://127.0.0.1:1337/api/events/ics/global.ics" | head -20
# Expected: BEGIN:VCALENDAR ... PRODID:-//libraries.global//...
```

- [ ] **Step 5: Commit**

```bash
git add apps/strapi/src/plugins/events/server/controllers/events.ts \
        apps/strapi/src/plugins/events/server/routes/content-api.ts
git commit -m "feat(events): add ICS feed endpoints for global + per-library"
```

---

### Task 3: Authenticated saved-events ICS feed

**Files:**

- Create: `apps/ui/src/app/api/saved-events/ics/route.ts`

- [ ] **Step 1: Create Next.js API route**

```ts
// apps/ui/src/app/api/saved-events/ics/route.ts
import { headers } from "next/headers"
import { auth } from "@/lib/auth"

const STRAPI = process.env.STRAPI_URL ?? "http://127.0.0.1:1337"
const API_TOKEN = process.env.STRAPI_REST_READONLY_API_KEY

async function getStrapiJwt(): Promise<string | null> {
  const session = await auth.api.getSession({ headers: await headers() })
  return (session?.session as { strapiJWT?: string })?.strapiJWT ?? null
}

export async function GET() {
  const jwt = await getStrapiJwt()
  if (!jwt) return new Response("Unauthorized", { status: 401 })

  // Fetch user's saved event IDs
  const savedRes = await fetch(`${STRAPI}/api/saved-events`, {
    headers: { Authorization: `Bearer ${jwt}` },
  })
  if (!savedRes.ok) return new Response("Error", { status: 500 })

  const saved = (await savedRes.json()) as Array<{
    documentId: string
    eventDocumentId: string
  }>

  if (saved.length === 0) {
    const empty = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//libraries.global//Events//EN",
      "X-WR-CALNAME:My Saved Events — Libraries of the World",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "END:VCALENDAR",
    ].join("\r\n")

    return new Response(empty, {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": 'attachment; filename="my-saved-events.ics"',
      },
    })
  }

  // Fetch full event data for each saved event
  const eventResults = await Promise.all(
    saved.map(({ eventDocumentId }) =>
      fetch(`${STRAPI}/api/events/event/${eventDocumentId}`, {
        headers: API_TOKEN ? { Authorization: `Bearer ${API_TOKEN}` } : {},
      }).then((r) => (r.ok ? r.json() : null))
    )
  )

  const events = eventResults.filter(Boolean) as Array<{
    documentId: string
    title: string
    description?: string | null
    startTime: string
    endTime?: string | null
    allDay?: boolean
    url?: string | null
    libraryEntityRef?: string | null
  }>

  // Build ICS inline (avoid importing from Strapi plugin)
  function escapeIcs(s: string): string {
    return s
      .replace(/\\/g, "\\\\")
      .replace(/;/g, "\\;")
      .replace(/,/g, "\\,")
      .replace(/\n/g, "\\n")
  }

  function toIcsDate(iso: string, allDay = false): string {
    const d = new Date(iso)
    if (allDay) {
      return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}`
    }
    return d.toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z"
  }

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//libraries.global//Events//EN",
    "X-WR-CALNAME:My Saved Events — Libraries of the World",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ]

  for (const e of events) {
    const startProp = e.allDay ? "DTSTART;VALUE=DATE" : "DTSTART"
    const endProp = e.allDay ? "DTEND;VALUE=DATE" : "DTEND"
    lines.push("BEGIN:VEVENT")
    lines.push(`UID:${e.documentId}@libraries.global`)
    lines.push(`SUMMARY:${escapeIcs(e.title)}`)
    lines.push(`${startProp}:${toIcsDate(e.startTime, e.allDay)}`)
    if (e.endTime) lines.push(`${endProp}:${toIcsDate(e.endTime, e.allDay)}`)
    if (e.description) lines.push(`DESCRIPTION:${escapeIcs(e.description)}`)
    if (e.url) lines.push(`URL:${e.url}`)
    if (e.libraryEntityRef)
      lines.push(`LOCATION:${escapeIcs(e.libraryEntityRef)}`)
    lines.push("END:VEVENT")
  }

  lines.push("END:VCALENDAR")

  return new Response(lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="my-saved-events.ics"',
    },
  })
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/ui/src/app/api/saved-events/ics/route.ts
git commit -m "feat(events): add authenticated saved-events ICS feed API route"
```

---

### Task 4: Subscribe UI — add calendar subscription links

**Files:**

- Create: `apps/ui/src/components/events/CalendarSubscribeButton.tsx`
- Modify: `apps/ui/src/components/events/EventDetailPage.tsx`
- Modify: `apps/ui/src/components/library/LibraryEvents.tsx`

- [ ] **Step 1: Create CalendarSubscribeButton**

```tsx
// apps/ui/src/components/events/CalendarSubscribeButton.tsx
"use client"

import { Icon } from "@iconify/react"
import { useState } from "react"

import { T } from "@/lib/design-tokens"

interface CalendarSubscribeButtonProps {
  icsUrl: string
  label?: string
}

export function CalendarSubscribeButton({
  icsUrl,
  label = "Subscribe",
}: CalendarSubscribeButtonProps) {
  const [open, setOpen] = useState(false)

  // webcal:// links trigger native calendar apps; https:// links for manual import
  const webcalUrl = icsUrl.replace(/^https?:\/\//, "webcal://")

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs transition-colors duration-150 hover:border-(--t-border-hi) hover:text-(--t-ink-base)"
        style={{
          fontFamily: T.font.mono,
          letterSpacing: ".1em",
          textTransform: "uppercase",
          borderColor: T.border.line,
          color: T.ink.dim,
        }}
      >
        <Icon icon="mdi:calendar-sync-outline" className="size-4" />
        {label}
      </button>

      {open && (
        <div
          className="absolute top-full right-0 z-20 mt-1.5 w-52 rounded-xl border p-2"
          style={{ background: T.bg.deep, borderColor: T.border.hi }}
        >
          <a
            href={webcalUrl}
            className="flex items-center gap-2 rounded-lg px-3 py-2 transition-colors duration-150 hover:bg-[rgba(255,255,255,0.05)]"
            style={{ color: T.ink.dim, textDecoration: "none" }}
          >
            <Icon
              icon="mdi:calendar-check"
              className="size-4"
              style={{ color: T.accent.aurora }}
            />
            <span
              style={{
                fontFamily: T.font.mono,
                fontSize: "10px",
                letterSpacing: ".1em",
              }}
            >
              Subscribe (calendar app)
            </span>
          </a>
          <a
            href={icsUrl}
            download
            className="flex items-center gap-2 rounded-lg px-3 py-2 transition-colors duration-150 hover:bg-[rgba(255,255,255,0.05)]"
            style={{ color: T.ink.dim, textDecoration: "none" }}
          >
            <Icon
              icon="mdi:download-outline"
              className="size-4"
              style={{ color: T.ink.ghost }}
            />
            <span
              style={{
                fontFamily: T.font.mono,
                fontSize: "10px",
                letterSpacing: ".1em",
              }}
            >
              Download .ics file
            </span>
          </a>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Add subscribe button to EventDetailPage**

In `EventDetailPage.tsx`, import and add `CalendarSubscribeButton` next to the existing "Add to calendar" link. Replace the existing inline `data:text/calendar` link with:

```tsx
import { CalendarSubscribeButton } from "@/components/events/CalendarSubscribeButton"

// Replace the existing "Add to calendar" <a> with:
;<CalendarSubscribeButton
  icsUrl={`/api/public-proxy/api/events/ics/global.ics`}
  label="Add to calendar"
/>
```

- [ ] **Step 3: Add subscribe button to LibraryEvents**

In `LibraryEvents.tsx`, add a library-specific subscribe button in the section header area:

```tsx
import { CalendarSubscribeButton } from "@/components/events/CalendarSubscribeButton"

// In the LibraryEvents header row, add:
;<CalendarSubscribeButton
  icsUrl={`/api/public-proxy/api/events/ics/library/${entityRef}.ics`}
  label="Subscribe"
/>
```

- [ ] **Step 4: Commit**

```bash
git add apps/ui/src/components/events/CalendarSubscribeButton.tsx \
        apps/ui/src/components/events/EventDetailPage.tsx \
        apps/ui/src/components/library/LibraryEvents.tsx
git commit -m "feat(events): add CalendarSubscribeButton + wire ICS feeds to detail pages"
```
