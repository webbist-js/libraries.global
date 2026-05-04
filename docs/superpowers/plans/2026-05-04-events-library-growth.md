# Events Library Growth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the library-facing growth surface: (1) a Strapi admin analytics panel showing import stats per library, (2) a public `/contribute/events` form where library operators can submit their event feed credentials, and (3) an "Active Feed" badge displayed on library detail pages for libraries with a connected event provider.

**Architecture:** The analytics panel is a React component in the events Strapi plugin's admin extension. The credentials submission form is a Next.js page using the existing `content-moderation` submission pipeline. The "Active Feed" badge queries a new `hasActiveFeed` field on the library content type (populated by a Strapi lifecycle hook when events are imported).

**Tech Stack:** Strapi v5 admin extension (Strapi Design System), Next.js 15 App Router, Better Auth session, existing `content-moderation` submission plugin, design tokens

---

### Task 1: Strapi — event provider registry content type

**Files:**

- Create: `apps/strapi/src/api/event-provider/content-types/event-provider/schema.json`
- Create: `apps/strapi/src/api/event-provider/controllers/event-provider.ts`
- Create: `apps/strapi/src/api/event-provider/routes/event-provider.ts`
- Create: `apps/strapi/src/api/event-provider/services/event-provider.ts`

- [ ] **Step 1: Create schema**

```json
// apps/strapi/src/api/event-provider/content-types/event-provider/schema.json
{
  "kind": "collectionType",
  "collectionName": "event_providers",
  "info": {
    "singularName": "event-provider",
    "pluralName": "event-providers",
    "displayName": "Event Provider"
  },
  "options": { "draftAndPublish": true },
  "attributes": {
    "libraryEntityRef": { "type": "string", "required": true, "unique": true },
    "providerType": {
      "type": "enumeration",
      "enum": [
        "eventbrite",
        "meetup",
        "ticketmaster",
        "ical_feed",
        "json_api",
        "other"
      ],
      "required": true
    },
    "feedUrl": { "type": "string" },
    "apiKey": { "type": "password" },
    "notes": { "type": "text" },
    "status": {
      "type": "enumeration",
      "enum": ["pending", "active", "paused", "rejected"],
      "default": "pending"
    },
    "lastImportAt": { "type": "datetime" },
    "lastImportCount": { "type": "integer" },
    "submittedByEmail": { "type": "email" },
    "submittedByName": { "type": "string" }
  }
}
```

- [ ] **Step 2: Create service + controller (core factories)**

```ts
// apps/strapi/src/api/event-provider/services/event-provider.ts
import { factories } from "@strapi/strapi"
export default factories.createCoreService("api::event-provider.event-provider")
```

```ts
// apps/strapi/src/api/event-provider/controllers/event-provider.ts
import { factories } from "@strapi/strapi"
export default factories.createCoreController(
  "api::event-provider.event-provider"
)
```

- [ ] **Step 3: Create routes (admin-only, no public API)**

```ts
// apps/strapi/src/api/event-provider/routes/event-provider.ts
import { factories } from "@strapi/strapi"
export default factories.createCoreRouter(
  "api::event-provider.event-provider",
  {
    config: {
      find: { policies: ["global::isAuthenticated"] },
      findOne: { policies: ["global::isAuthenticated"] },
      create: { policies: ["global::isAuthenticated"] },
      update: { policies: ["global::isAuthenticated"] },
      delete: { policies: ["global::isAuthenticated"] },
    },
  }
)
```

- [ ] **Step 4: Restart Strapi**

```bash
# restart Strapi dev server — new content-type auto-detected
```

- [ ] **Step 5: Commit**

```bash
git add apps/strapi/src/api/event-provider/
git commit -m "feat(events): add event-provider content type for feed registry"
```

---

### Task 2: Strapi admin analytics panel

**Files:**

- Create: `apps/strapi/src/plugins/events/admin/src/pages/ProviderAnalytics.tsx`
- Modify: `apps/strapi/src/plugins/events/admin/src/App.tsx` (add route)
- Modify: `apps/strapi/src/plugins/events/admin/src/components/PluginIcon.tsx` (menu entry if needed)

- [ ] **Step 1: Check existing admin entry point**

Read `apps/strapi/src/plugins/events/admin/src/index.ts` to understand the existing admin extension structure.

- [ ] **Step 2: Create ProviderAnalytics page**

```tsx
// apps/strapi/src/plugins/events/admin/src/pages/ProviderAnalytics.tsx
import {
  Box,
  Button,
  Flex,
  Table,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
  Typography,
} from "@strapi/design-system"
import { useEffect, useState } from "react"

interface ProviderRow {
  libraryEntityRef: string
  providerType: string
  status: string
  lastImportAt: string | null
  lastImportCount: number | null
}

export function ProviderAnalytics() {
  const [rows, setRows] = useState<ProviderRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(
      "/api/event-providers?pagination[limit]=100&sort=libraryEntityRef:asc",
      {
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      }
    )
      .then((r) => r.json())
      .then((res: { data?: ProviderRow[] }) => {
        setRows(res.data ?? [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  function statusColor(
    status: string
  ): "success" | "warning" | "danger" | "neutral" {
    if (status === "active") return "success"
    if (status === "pending") return "warning"
    if (status === "paused") return "neutral"
    return "danger"
  }

  return (
    <Box padding={8} background="neutral100">
      <Flex justifyContent="space-between" alignItems="center" marginBottom={6}>
        <Typography variant="alpha">Event Provider Analytics</Typography>
        <Button variant="default" onClick={() => window.location.reload()}>
          Refresh
        </Button>
      </Flex>

      {loading ? (
        <Typography>Loading…</Typography>
      ) : (
        <Table colCount={5} rowCount={rows.length}>
          <Thead>
            <Tr>
              <Th>
                <Typography variant="sigma">Library Ref</Typography>
              </Th>
              <Th>
                <Typography variant="sigma">Provider</Typography>
              </Th>
              <Th>
                <Typography variant="sigma">Status</Typography>
              </Th>
              <Th>
                <Typography variant="sigma">Last Import</Typography>
              </Th>
              <Th>
                <Typography variant="sigma">Events Imported</Typography>
              </Th>
            </Tr>
          </Thead>
          <Tbody>
            {rows.map((row) => (
              <Tr key={row.libraryEntityRef}>
                <Td>
                  <Typography variant="omega" fontWeight="semiBold">
                    {row.libraryEntityRef}
                  </Typography>
                </Td>
                <Td>
                  <Typography variant="omega" textColor="neutral600">
                    {row.providerType}
                  </Typography>
                </Td>
                <Td>
                  <Typography
                    variant="pi"
                    textColor={`${statusColor(row.status)}600`}
                    fontWeight="semiBold"
                    textTransform="uppercase"
                  >
                    {row.status}
                  </Typography>
                </Td>
                <Td>
                  <Typography variant="omega" textColor="neutral600">
                    {row.lastImportAt
                      ? new Date(row.lastImportAt).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "—"}
                  </Typography>
                </Td>
                <Td>
                  <Typography variant="omega" textColor="neutral600">
                    {row.lastImportCount ?? "—"}
                  </Typography>
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      )}
    </Box>
  )
}
```

- [ ] **Step 3: Register the page in the plugin admin routes**

In `apps/strapi/src/plugins/events/admin/src/App.tsx`, add a route for the analytics page:

```tsx
// Find the <Routes> block and add:
import { ProviderAnalytics } from "./pages/ProviderAnalytics"

// Inside <Routes>:
;<Route path="analytics" element={<ProviderAnalytics />} />
```

In `apps/strapi/src/plugins/events/admin/src/index.ts`, add a sub-link to the menu:

```ts
// Inside the menu.links array for the events plugin, add:
{
  intlLabel: { id: "events.menu.analytics", defaultMessage: "Provider Analytics" },
  to: `${pluginId}/analytics`,
  Component: async () => ({ default: (await import("./App")).App }),
}
```

- [ ] **Step 4: Rebuild admin**

```bash
cd apps/strapi
pnpm run build:plugins
# restart Strapi to pick up admin changes
```

- [ ] **Step 5: Commit**

```bash
git add apps/strapi/src/plugins/events/admin/src/pages/ProviderAnalytics.tsx \
        apps/strapi/src/plugins/events/admin/src/App.tsx \
        apps/strapi/src/plugins/events/admin/src/index.ts
git commit -m "feat(events): add Provider Analytics admin panel"
```

---

### Task 3: Public credentials submission form

**Files:**

- Create: `apps/ui/src/app/[locale]/contribute/events/page.tsx`
- Create: `apps/ui/src/app/[locale]/contribute/events/_components/EventFeedForm.tsx`

- [ ] **Step 1: Create EventFeedForm**

```tsx
// apps/ui/src/app/[locale]/contribute/events/_components/EventFeedForm.tsx
"use client"

import { Icon } from "@iconify/react"
import { useState } from "react"

import { T } from "@/lib/design-tokens"

type ProviderType =
  | "eventbrite"
  | "meetup"
  | "ical_feed"
  | "json_api"
  | "ticketmaster"
  | "other"

const PROVIDER_OPTIONS: { value: ProviderType; label: string }[] = [
  { value: "eventbrite", label: "Eventbrite" },
  { value: "meetup", label: "Meetup" },
  { value: "ticketmaster", label: "Ticketmaster" },
  { value: "ical_feed", label: "iCal / .ics feed URL" },
  { value: "json_api", label: "Custom JSON API" },
  { value: "other", label: "Other" },
]

export function EventFeedForm() {
  const [form, setForm] = useState({
    libraryEntityRef: "",
    providerType: "" as ProviderType | "",
    feedUrl: "",
    notes: "",
    submittedByName: "",
    submittedByEmail: "",
  })
  const [status, setStatus] = useState<
    "idle" | "submitting" | "success" | "error"
  >("idle")

  function set(key: keyof typeof form) {
    return (
      e: React.ChangeEvent<
        HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      >
    ) => {
      setForm((prev) => ({ ...prev, [key]: e.target.value }))
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setStatus("submitting")

    const res = await fetch("/api/contribute/event-feed", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    })

    setStatus(res.ok ? "success" : "error")
  }

  const inputStyle: React.CSSProperties = {
    fontFamily: T.font.mono,
    fontSize: "13px",
    background: T.bg.deep,
    border: `1px solid ${T.border.line}`,
    borderRadius: "8px",
    color: T.ink.base,
    padding: "10px 14px",
    width: "100%",
    outline: "none",
  }

  const labelStyle: React.CSSProperties = {
    fontFamily: T.font.mono,
    fontSize: "9px",
    letterSpacing: ".18em",
    textTransform: "uppercase",
    color: T.ink.faint,
  }

  if (status === "success") {
    return (
      <div
        className="flex flex-col items-center gap-4 rounded-2xl border p-12 text-center"
        style={{ borderColor: T.border.line, background: T.bg.deep }}
      >
        <Icon
          icon="mdi:check-circle-outline"
          className="size-12"
          style={{ color: T.accent.ok }}
        />
        <p
          style={{
            fontFamily: T.font.serif,
            fontSize: "1.4rem",
            fontWeight: 400,
            color: T.ink.base,
          }}
        >
          Submission received.
        </p>
        <p
          style={{
            fontFamily: T.font.mono,
            fontSize: "11px",
            letterSpacing: ".12em",
            color: T.ink.faint,
          }}
        >
          We review all feed submissions within 48 hours. You will receive an
          email confirmation.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-6">
      {/* Library ref */}
      <div className="flex flex-col gap-2">
        <label style={labelStyle}>Library Entity Ref *</label>
        <input
          type="text"
          required
          placeholder="e.g. GB-BL-001"
          value={form.libraryEntityRef}
          onChange={set("libraryEntityRef")}
          style={inputStyle}
        />
        <p
          style={{
            fontFamily: T.font.mono,
            fontSize: "9px",
            letterSpacing: ".1em",
            color: T.ink.faint,
          }}
        >
          Find your library's entity ref on its libraries.global page.
        </p>
      </div>

      {/* Provider type */}
      <div className="flex flex-col gap-2">
        <label style={labelStyle}>Event Platform *</label>
        <select
          required
          value={form.providerType}
          onChange={set("providerType")}
          style={inputStyle}
        >
          <option value="">Select platform…</option>
          {PROVIDER_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {/* Feed URL */}
      <div className="flex flex-col gap-2">
        <label style={labelStyle}>Feed URL / Organiser URL</label>
        <input
          type="url"
          placeholder="https://..."
          value={form.feedUrl}
          onChange={set("feedUrl")}
          style={inputStyle}
        />
      </div>

      {/* Notes */}
      <div className="flex flex-col gap-2">
        <label style={labelStyle}>Additional notes</label>
        <textarea
          rows={3}
          placeholder="API keys, access requirements, scheduling preferences…"
          value={form.notes}
          onChange={set("notes")}
          style={{ ...inputStyle, resize: "vertical" }}
        />
      </div>

      {/* Contact */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <label style={labelStyle}>Your name *</label>
          <input
            type="text"
            required
            value={form.submittedByName}
            onChange={set("submittedByName")}
            style={inputStyle}
          />
        </div>
        <div className="flex flex-col gap-2">
          <label style={labelStyle}>Email address *</label>
          <input
            type="email"
            required
            value={form.submittedByEmail}
            onChange={set("submittedByEmail")}
            style={inputStyle}
          />
        </div>
      </div>

      {status === "error" && (
        <p
          style={{
            fontFamily: T.font.mono,
            fontSize: "11px",
            color: T.accent.danger,
          }}
        >
          Submission failed — please try again.
        </p>
      )}

      <button
        type="submit"
        disabled={status === "submitting"}
        className="inline-flex items-center gap-2 self-start rounded-full px-6 py-3 text-sm transition-all duration-150 hover:bg-[rgba(127,223,255,0.18)] disabled:opacity-60"
        style={{
          fontFamily: T.font.mono,
          background: "rgba(127,223,255,0.1)",
          border: "1px solid rgba(127,223,255,0.3)",
          color: T.accent.aurora,
          letterSpacing: ".1em",
          textTransform: "uppercase",
        }}
      >
        <Icon icon="mdi:send-outline" className="size-4" />
        {status === "submitting" ? "Submitting…" : "Submit feed"}
      </button>
    </form>
  )
}
```

- [ ] **Step 2: Create the page**

```tsx
// apps/ui/src/app/[locale]/contribute/events/page.tsx
import type { Locale } from "next-intl"
import { use } from "react"

import { EventFeedForm } from "./_components/EventFeedForm"
import GlobalHeader from "@/components/global/GlobalHeader"
import { Container } from "@/components/elementary/Container"
import { T } from "@/lib/design-tokens"
import { fetchNavbar } from "@/lib/strapi-api/content/server"

export const metadata = {
  title: "Submit Event Feed — Libraries of the World",
  description: "Connect your library's event calendar to libraries.global.",
}

export default function ContributeEventsPage(props: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = use(props.params)
  const navbar = use(fetchNavbar(locale as Locale))?.data

  return (
    <div
      className="relative isolate flex min-h-screen w-full flex-col"
      style={{ background: T.bg.space, color: T.ink.base }}
    >
      <GlobalHeader locale={locale as Locale} navbar={navbar} />
      <main className="relative z-10 flex-1 pt-16">
        <Container className="max-w-2xl py-16">
          {/* Header */}
          <div className="mb-10">
            <p
              style={{
                fontFamily: T.font.mono,
                fontSize: "9px",
                letterSpacing: ".22em",
                textTransform: "uppercase",
                color: T.ink.faint,
                marginBottom: "12px",
              }}
            >
              Contribute · Events
            </p>
            <h1
              style={{
                fontFamily: T.font.serif,
                fontSize: "clamp(1.8rem, 4vw, 2.6rem)",
                lineHeight: 1.1,
                fontWeight: 400,
                color: T.ink.base,
              }}
            >
              List your library's{" "}
              <em style={{ fontStyle: "italic", color: T.ink.dim }}>events.</em>
            </h1>
            <p
              className="mt-4 leading-relaxed"
              style={{
                color: T.ink.low,
                fontSize: "0.95rem",
                maxWidth: "520px",
              }}
            >
              Connect your library's Eventbrite, Meetup, or calendar feed and
              your events will appear on libraries.global — reaching visitors
              searching for libraries worldwide.
            </p>
          </div>

          <EventFeedForm />
        </Container>
      </main>
    </div>
  )
}
```

- [ ] **Step 3: Create Next.js API route to save the submission**

```ts
// apps/ui/src/app/api/contribute/event-feed/route.ts
const STRAPI = process.env.STRAPI_URL ?? "http://127.0.0.1:1337"
const API_TOKEN = process.env.STRAPI_REST_API_KEY // write-capable token

export async function POST(req: Request) {
  const body = (await req.json()) as {
    libraryEntityRef: string
    providerType: string
    feedUrl?: string
    notes?: string
    submittedByName: string
    submittedByEmail: string
  }

  if (!body.libraryEntityRef || !body.providerType || !body.submittedByEmail) {
    return new Response("Missing required fields", { status: 400 })
  }

  const res = await fetch(`${STRAPI}/api/event-providers`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(API_TOKEN ? { Authorization: `Bearer ${API_TOKEN}` } : {}),
    },
    body: JSON.stringify({
      data: {
        ...body,
        status: "pending",
      },
    }),
  })

  if (!res.ok) return new Response("Strapi error", { status: 500 })
  return new Response(null, { status: 201 })
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/ui/src/app/[locale]/contribute/events/ \
        apps/ui/src/app/api/contribute/event-feed/
git commit -m "feat(events): add public event feed credentials submission form"
```

---

### Task 4: "Active Feed" badge on library detail pages

**Files:**

- Modify: `apps/strapi/src/api/library/content-types/library/schema.json` — add `hasActiveFeed` boolean
- Modify: `apps/ui/src/components/library/LibraryDetailPage.tsx` — show badge in hero
- Modify: `apps/ui/src/components/library/LibraryEvents.tsx` — show badge next to section title

- [ ] **Step 1: Add hasActiveFeed field to library schema**

Open `apps/strapi/src/api/library/content-types/library/schema.json`. Add:

```json
"hasActiveFeed": {
  "type": "boolean",
  "default": false
}
```

- [ ] **Step 2: Populate hasActiveFeed via event-provider lifecycle**

Create a lifecycle hook that sets `hasActiveFeed = true` on the library when an event-provider is set to `active`:

```ts
// apps/strapi/src/api/event-provider/content-types/event-provider/lifecycles.ts
export default {
  async afterUpdate(event: {
    result: { status: string; libraryEntityRef: string }
  }) {
    if (event.result.status !== "active") return

    const { libraryEntityRef } = event.result
    const libraries = await strapi.documents("api::library.library").findMany({
      filters: { entityRef: libraryEntityRef } as never,
      limit: 1,
    })

    if (libraries[0]) {
      await strapi.documents("api::library.library").update({
        documentId: libraries[0].documentId,
        data: { hasActiveFeed: true },
      })
    }
  },
}
```

- [ ] **Step 3: Add ActiveFeedBadge to LibraryEvents**

In `LibraryEvents.tsx`, add a badge next to the section title when the library has an active feed. Add a prop:

```tsx
// Add prop to LibraryEvents component:
interface LibraryEventsProps {
  entityRef: string
  hasActiveFeed?: boolean
}

// In the section header, after the title, add:
{
  hasActiveFeed && (
    <span
      className="inline-flex items-center gap-1.5"
      style={{
        fontFamily: T.font.mono,
        fontSize: "9px",
        letterSpacing: ".14em",
        textTransform: "uppercase",
        color: T.accent.ok,
        background: "rgba(142,240,179,0.08)",
        border: "1px solid rgba(142,240,179,0.2)",
        borderRadius: "999px",
        padding: "2px 8px",
      }}
    >
      <span
        className="size-1.5 rounded-full"
        style={{ background: T.accent.ok }}
      />
      Live feed
    </span>
  )
}
```

- [ ] **Step 4: Pass hasActiveFeed from LibraryDetailPage**

In `LibraryDetailPage.tsx`, pass `library.hasActiveFeed` to `<LibraryEvents>`:

```tsx
<LibraryEvents
  entityRef={library.entityRef}
  hasActiveFeed={library.hasActiveFeed}
/>
```

- [ ] **Step 5: Commit**

```bash
git add apps/strapi/src/api/library/content-types/library/schema.json \
        apps/strapi/src/api/event-provider/content-types/event-provider/lifecycles.ts \
        apps/ui/src/components/library/LibraryEvents.tsx \
        apps/ui/src/components/library/LibraryDetailPage.tsx
git commit -m "feat(events): add hasActiveFeed field + Live Feed badge on library pages"
```

---

### Task 5: Link the events contribution page from the contribute hub

**Files:**

- Modify: `apps/ui/src/app/[locale]/contribute/page.tsx` (or the contribute landing component)

- [ ] **Step 1: Read the contribute page to find the right insertion point**

Open `apps/ui/src/app/[locale]/contribute/page.tsx` and identify where contribution pathways are listed.

- [ ] **Step 2: Add an events pathway card**

Find the array or section listing contribution types and add:

```tsx
// In the contribute pathways grid/list, add a card:
<a
  href="/contribute/events"
  className="group flex flex-col gap-3 rounded-2xl border p-6 transition-colors duration-150 hover:border-(--t-border-hi)"
  style={{
    borderColor: T.border.line,
    background: T.bg.deep,
    textDecoration: "none",
  }}
>
  <div
    className="flex size-10 items-center justify-center rounded-xl"
    style={{
      background: "rgba(142,240,179,0.08)",
      border: "1px solid rgba(142,240,179,0.15)",
    }}
  >
    <Icon
      icon="mdi:calendar-sync-outline"
      className="size-5"
      style={{ color: T.accent.ok }}
    />
  </div>
  <p
    style={{
      fontFamily: T.font.serif,
      fontSize: "1.1rem",
      fontWeight: 400,
      color: T.ink.base,
    }}
  >
    List your events
  </p>
  <p
    style={{
      fontFamily: T.font.mono,
      fontSize: "10px",
      letterSpacing: ".1em",
      color: T.ink.faint,
      lineHeight: 1.6,
    }}
  >
    Connect your event platform and your library's programme will appear across
    libraries.global.
  </p>
</a>
```

- [ ] **Step 3: Commit**

```bash
git add apps/ui/src/app/[locale]/contribute/
git commit -m "feat(events): add events pathway card to contribute hub"
```
