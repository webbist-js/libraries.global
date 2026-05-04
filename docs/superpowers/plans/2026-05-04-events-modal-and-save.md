# Events Modal & Saved Events Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a slide-over event detail modal (opens when clicking any event card), and allow authenticated users to save/favourite events with a persistent saved-events feed.

**Architecture:** `EventModal` is a client component rendered at the root layout level via a context provider. Any event card can trigger it by calling `openEventModal(documentId)`. The modal fetches full event data client-side. Saved events are stored in Strapi as a `saved-event` content type linked to a user; the UI queries via the authenticated Strapi JWT from the Better Auth session.

**Tech Stack:** Next.js 15 App Router, React Context, Strapi v5 Document Service, Better Auth session, TypeScript, design tokens, `@iconify/react`, Framer Motion (slide-in animation)

---

### Task 1: Strapi — saved-events content type + endpoints

**Files:**

- Create: `apps/strapi/src/api/saved-event/content-types/saved-event/schema.json`
- Create: `apps/strapi/src/api/saved-event/controllers/saved-event.ts`
- Create: `apps/strapi/src/api/saved-event/routes/saved-event.ts`
- Create: `apps/strapi/src/api/saved-event/services/saved-event.ts`

- [ ] **Step 1: Create schema**

```json
// apps/strapi/src/api/saved-event/content-types/saved-event/schema.json
{
  "kind": "collectionType",
  "collectionName": "saved_events",
  "info": {
    "singularName": "saved-event",
    "pluralName": "saved-events",
    "displayName": "Saved Event"
  },
  "options": { "draftAndPublish": false },
  "attributes": {
    "eventDocumentId": { "type": "string", "required": true },
    "user": {
      "type": "relation",
      "relation": "manyToOne",
      "target": "plugin::users-permissions.user",
      "inversedBy": "savedEvents"
    }
  }
}
```

- [ ] **Step 2: Create service**

```ts
// apps/strapi/src/api/saved-event/services/saved-event.ts
import { factories } from "@strapi/strapi"
export default factories.createCoreService("api::saved-event.saved-event")
```

- [ ] **Step 3: Create controller**

```ts
// apps/strapi/src/api/saved-event/controllers/saved-event.ts
import { factories } from "@strapi/strapi"

export default factories.createCoreController(
  "api::saved-event.saved-event",
  ({ strapi }) => ({
    // GET /api/saved-events — list current user's saved events
    async find(ctx) {
      const userId = ctx.state.user?.id
      if (!userId) return ctx.unauthorized()

      const results = await strapi
        .documents("api::saved-event.saved-event")
        .findMany({
          filters: { user: userId } as never,
        })

      ctx.body = results
    },

    // POST /api/saved-events { eventDocumentId } — save an event
    async create(ctx) {
      const userId = ctx.state.user?.id
      if (!userId) return ctx.unauthorized()

      const { eventDocumentId } = ctx.request.body as {
        eventDocumentId: string
      }
      if (!eventDocumentId) return ctx.badRequest("eventDocumentId required")

      // Idempotent: return existing if already saved
      const existing = await strapi
        .documents("api::saved-event.saved-event")
        .findFirst({
          filters: { user: userId, eventDocumentId } as never,
        })
      if (existing) {
        ctx.body = existing
        return
      }

      const created = await strapi
        .documents("api::saved-event.saved-event")
        .create({
          data: { eventDocumentId, user: userId },
        })
      ctx.status = 201
      ctx.body = created
    },

    // DELETE /api/saved-events/:documentId — unsave
    async delete(ctx) {
      const userId = ctx.state.user?.id
      if (!userId) return ctx.unauthorized()

      const { id: documentId } = ctx.params as { id: string }

      const record = await strapi
        .documents("api::saved-event.saved-event")
        .findOne({ documentId })

      if (!record) return ctx.notFound()
      if ((record as { user?: { id: number } }).user?.id !== userId)
        return ctx.forbidden()

      await strapi
        .documents("api::saved-event.saved-event")
        .delete({ documentId })

      ctx.status = 204
    },
  })
)
```

- [ ] **Step 4: Create routes**

```ts
// apps/strapi/src/api/saved-event/routes/saved-event.ts
export default {
  routes: [
    {
      method: "GET",
      path: "/saved-events",
      handler: "saved-event.find",
      config: { middlewares: ["plugin::users-permissions.isAuthenticated"] },
    },
    {
      method: "POST",
      path: "/saved-events",
      handler: "saved-event.create",
      config: { middlewares: ["plugin::users-permissions.isAuthenticated"] },
    },
    {
      method: "DELETE",
      path: "/saved-events/:id",
      handler: "saved-event.delete",
      config: { middlewares: ["plugin::users-permissions.isAuthenticated"] },
    },
  ],
}
```

- [ ] **Step 5: Restart Strapi (schema rebuild is automatic on restart)**

```bash
# restart Strapi dev server — new content-type is auto-detected
```

- [ ] **Step 6: Smoke test**

```bash
# Replace <JWT> with a valid Strapi user JWT from Better Auth session
curl -H "Authorization: Bearer <JWT>" http://127.0.0.1:1337/api/saved-events
# Expected: []
```

- [ ] **Step 7: Commit**

```bash
git add apps/strapi/src/api/saved-event/
git commit -m "feat(events): add saved-event content type + CRUD endpoints"
```

---

### Task 2: EventModal context + provider

**Files:**

- Create: `apps/ui/src/components/events/EventModalContext.tsx`

- [ ] **Step 1: Create context**

```tsx
// apps/ui/src/components/events/EventModalContext.tsx
"use client"

import { createContext, useCallback, useContext, useState } from "react"

interface EventModalContextValue {
  openModal: (documentId: string) => void
  closeModal: () => void
  activeDocumentId: string | null
}

const EventModalContext = createContext<EventModalContextValue | null>(null)

export function EventModalProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [activeDocumentId, setActiveDocumentId] = useState<string | null>(null)

  const openModal = useCallback((id: string) => setActiveDocumentId(id), [])
  const closeModal = useCallback(() => setActiveDocumentId(null), [])

  return (
    <EventModalContext.Provider
      value={{ openModal, closeModal, activeDocumentId }}
    >
      {children}
    </EventModalContext.Provider>
  )
}

export function useEventModal(): EventModalContextValue {
  const ctx = useContext(EventModalContext)
  if (!ctx)
    throw new Error("useEventModal must be used inside EventModalProvider")
  return ctx
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/ui/src/components/events/EventModalContext.tsx
git commit -m "feat(events): add EventModal context provider"
```

---

### Task 3: EventModal slide-over component

**Files:**

- Create: `apps/ui/src/components/events/EventModal.tsx`

- [ ] **Step 1: Create EventModal**

```tsx
// apps/ui/src/components/events/EventModal.tsx
"use client"

import { Icon } from "@iconify/react"
import { useEffect, useRef, useState } from "react"

import { EventTypeChip } from "@/components/events/EventTypeChip"
import { PriceBadge } from "@/components/events/PriceBadge"
import { useEventModal } from "@/components/events/EventModalContext"
import { T } from "@/lib/design-tokens"

interface ModalEvent {
  documentId: string
  title: string
  description?: string | null
  url: string
  imageUrl?: string | null
  startTime: string
  endTime?: string | null
  allDay: boolean
  eventType: string
  isFree: boolean
  priceMin?: number | null
  priceMax?: number | null
  registrationUrl?: string | null
  libraryEntityRef?: string | null
  tags?: string[] | null
}

function formatDateTime(iso: string, allDay: boolean): string {
  const d = new Date(iso)
  if (allDay)
    return d.toLocaleDateString("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    })
  return (
    d.toLocaleDateString("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }) +
    " · " +
    d.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
  )
}

export function EventModal() {
  const { activeDocumentId, closeModal } = useEventModal()
  const [event, setEvent] = useState<ModalEvent | null>(null)
  const [loading, setLoading] = useState(false)
  const overlayRef = useRef<HTMLDivElement>(null)

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeModal()
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [closeModal])

  // Lock scroll when open
  useEffect(() => {
    document.body.style.overflow = activeDocumentId ? "hidden" : ""
    return () => {
      document.body.style.overflow = ""
    }
  }, [activeDocumentId])

  // Fetch event when documentId changes
  useEffect(() => {
    if (!activeDocumentId) {
      setEvent(null)
      return
    }
    setLoading(true)
    fetch(`/api/public-proxy/api/events/event/${activeDocumentId}`)
      .then((r) => r.json())
      .then((data: ModalEvent) => {
        setEvent(data)
        setLoading(false)
      })
      .catch(() => {
        setEvent(null)
        setLoading(false)
      })
  }, [activeDocumentId])

  if (!activeDocumentId) return null

  const linkUrl = event?.registrationUrl ?? event?.url

  return (
    // Backdrop
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex justify-end"
      style={{ background: "rgba(3,5,17,0.7)", backdropFilter: "blur(4px)" }}
      onClick={(e) => {
        if (e.target === overlayRef.current) closeModal()
      }}
    >
      {/* Panel */}
      <div
        className="relative flex h-full w-full max-w-lg flex-col overflow-y-auto"
        style={{
          background: T.bg.deep,
          borderLeft: `1px solid ${T.border.hi}`,
        }}
      >
        {/* Close button */}
        <button
          type="button"
          onClick={closeModal}
          className="absolute top-4 right-4 z-10 flex size-8 items-center justify-center rounded-full border transition-colors duration-150 hover:border-(--t-border-hi)"
          style={{
            borderColor: T.border.line,
            color: T.ink.ghost,
            background: T.bg.deep,
          }}
        >
          <Icon icon="mdi:close" className="size-4" />
        </button>

        {/* Image */}
        {event?.imageUrl ? (
          <div className="relative h-48 w-full shrink-0 overflow-hidden">
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
                  "linear-gradient(to bottom, transparent 50%, rgba(7,11,30,0.9) 100%)",
              }}
            />
          </div>
        ) : (
          <div className="h-8 w-full shrink-0" />
        )}

        {/* Content */}
        <div className="flex flex-1 flex-col gap-5 p-6 pt-5">
          {loading ? (
            <div className="flex flex-1 items-center justify-center">
              <span
                style={{
                  fontFamily: T.font.mono,
                  fontSize: "10px",
                  letterSpacing: ".14em",
                  textTransform: "uppercase",
                  color: T.ink.faint,
                }}
              >
                Loading…
              </span>
            </div>
          ) : event ? (
            <>
              {/* Chips */}
              <div className="flex flex-wrap items-center gap-2">
                <EventTypeChip type={event.eventType} size="xs" />
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
              <h2
                style={{
                  fontFamily: T.font.serif,
                  fontSize: "clamp(1.3rem, 3vw, 1.8rem)",
                  lineHeight: 1.15,
                  fontWeight: 400,
                  color: T.ink.base,
                }}
              >
                {event.title}
              </h2>

              {/* Date/time */}
              <div className="flex items-center gap-2">
                <Icon
                  icon="mdi:calendar-outline"
                  className="size-4 shrink-0"
                  style={{ color: T.ink.ghost }}
                />
                <span
                  style={{
                    fontFamily: T.font.mono,
                    fontSize: "11px",
                    color: T.ink.dim,
                  }}
                >
                  {formatDateTime(event.startTime, event.allDay)}
                </span>
              </div>

              {/* Library */}
              {event.libraryEntityRef && (
                <div className="flex items-center gap-2">
                  <Icon
                    icon="mdi:library-outline"
                    className="size-4 shrink-0"
                    style={{ color: T.ink.ghost }}
                  />
                  <span
                    style={{
                      fontFamily: T.font.mono,
                      fontSize: "11px",
                      color: T.ink.dim,
                    }}
                  >
                    {event.libraryEntityRef}
                  </span>
                </div>
              )}

              <PriceBadge
                isFree={event.isFree}
                priceMin={event.priceMin}
                priceMax={event.priceMax}
              />

              {/* Description */}
              {event.description && (
                <p
                  className="text-sm leading-relaxed whitespace-pre-line"
                  style={{ color: T.ink.low }}
                >
                  {event.description}
                </p>
              )}

              {/* CTAs */}
              <div
                className="mt-auto flex flex-wrap items-center gap-3 border-t pt-5"
                style={{ borderColor: T.border.line }}
              >
                {linkUrl && (
                  <a
                    href={linkUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm transition-all duration-150 hover:bg-[rgba(127,223,255,0.18)]"
                    style={{
                      background: "rgba(127,223,255,0.1)",
                      border: "1px solid rgba(127,223,255,0.3)",
                      color: T.accent.aurora,
                      textDecoration: "none",
                    }}
                  >
                    <Icon icon="mdi:ticket-outline" className="size-4" />
                    {event.isFree ? "Register" : "Get tickets"}
                  </a>
                )}
                <a
                  href={`/events/${event.documentId}`}
                  className="inline-flex items-center gap-2 rounded-full border px-5 py-2.5 text-sm transition-colors duration-150 hover:border-(--t-border-hi) hover:text-(--t-ink-base)"
                  style={{
                    borderColor: T.border.line,
                    color: T.ink.dim,
                    textDecoration: "none",
                  }}
                >
                  Full details
                  <Icon icon="mdi:arrow-right" className="size-4" />
                </a>
              </div>
            </>
          ) : (
            <p
              style={{
                fontFamily: T.font.serif,
                fontSize: "1rem",
                color: T.ink.faint,
                fontStyle: "italic",
              }}
            >
              Event not found.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/ui/src/components/events/EventModal.tsx
git commit -m "feat(events): add EventModal slide-over component"
```

---

### Task 4: Mount EventModalProvider + EventModal in layout

**Files:**

- Modify: `apps/ui/src/app/[locale]/layout.tsx`

- [ ] **Step 1: Add provider and modal to root layout**

Open `apps/ui/src/app/[locale]/layout.tsx`. Import and wrap children with `EventModalProvider`, and mount `EventModal` as a sibling inside the provider:

```tsx
// Add imports near the top:
import { EventModal } from "@/components/events/EventModal"
import { EventModalProvider } from "@/components/events/EventModalContext"

// Inside the JSX returned, wrap the children:
;<EventModalProvider>
  {children}
  <EventModal />
</EventModalProvider>
```

- [ ] **Step 2: Verify no SSR errors**

```bash
cd apps/ui
pnpm build
# Expected: build succeeds, no "server-only" or hydration errors
```

- [ ] **Step 3: Commit**

```bash
git add apps/ui/src/app/[locale]/layout.tsx
git commit -m "feat(events): mount EventModalProvider + EventModal in root layout"
```

---

### Task 5: SaveEventButton component

**Files:**

- Create: `apps/ui/src/components/events/SaveEventButton.tsx`

- [ ] **Step 1: Create component**

```tsx
// apps/ui/src/components/events/SaveEventButton.tsx
"use client"

import { Icon } from "@iconify/react"
import { useEffect, useState } from "react"

import { T } from "@/lib/design-tokens"

interface SaveEventButtonProps {
  documentId: string
  size?: "sm" | "md"
}

export function SaveEventButton({
  documentId,
  size = "sm",
}: SaveEventButtonProps) {
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savedDocId, setSavedDocId] = useState<string | null>(null)

  // Check if already saved on mount
  useEffect(() => {
    fetch("/api/saved-events", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : []))
      .then((list: Array<{ documentId: string; eventDocumentId: string }>) => {
        const match = list.find((s) => s.eventDocumentId === documentId)
        if (match) {
          setSaved(true)
          setSavedDocId(match.documentId)
        }
      })
      .catch(() => {})
  }, [documentId])

  async function toggle() {
    setSaving(true)
    if (saved && savedDocId) {
      await fetch(`/api/saved-events/${savedDocId}`, {
        method: "DELETE",
        credentials: "include",
      })
      setSaved(false)
      setSavedDocId(null)
    } else {
      const res = await fetch("/api/saved-events", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventDocumentId: documentId }),
      })
      if (res.ok) {
        const data = (await res.json()) as { documentId: string }
        setSaved(true)
        setSavedDocId(data.documentId)
      }
    }
    setSaving(false)
  }

  const iconSize = size === "sm" ? "size-3.5" : "size-4"

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={saving}
      title={saved ? "Remove from saved" : "Save event"}
      className={`inline-flex items-center gap-1.5 rounded-full border transition-all duration-150 ${size === "sm" ? "px-2.5 py-1 text-[10px]" : "px-3.5 py-2 text-xs"}`}
      style={{
        fontFamily: T.font.mono,
        letterSpacing: ".1em",
        textTransform: "uppercase",
        borderColor: saved ? "rgba(127,223,255,0.3)" : T.border.line,
        color: saved ? T.accent.aurora : T.ink.ghost,
        background: saved ? "rgba(127,223,255,0.07)" : "transparent",
      }}
    >
      <Icon
        icon={saved ? "mdi:bookmark" : "mdi:bookmark-outline"}
        className={iconSize}
      />
      {saved ? "Saved" : "Save"}
    </button>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/ui/src/components/events/SaveEventButton.tsx
git commit -m "feat(events): add SaveEventButton component"
```

---

### Task 6: Next.js API route proxy for saved-events

**Files:**

- Create: `apps/ui/src/app/api/saved-events/route.ts`
- Create: `apps/ui/src/app/api/saved-events/[id]/route.ts`

- [ ] **Step 1: Create GET + POST route**

```ts
// apps/ui/src/app/api/saved-events/route.ts
import { headers } from "next/headers"
import { auth } from "@/lib/auth"

const STRAPI = process.env.STRAPI_URL ?? "http://127.0.0.1:1337"

async function getStrapiJwt(): Promise<string | null> {
  const session = await auth.api.getSession({ headers: await headers() })
  return (session?.session as { strapiJWT?: string })?.strapiJWT ?? null
}

export async function GET() {
  const jwt = await getStrapiJwt()
  if (!jwt) return new Response(JSON.stringify([]), { status: 200 })

  const res = await fetch(`${STRAPI}/api/saved-events`, {
    headers: { Authorization: `Bearer ${jwt}` },
  })
  const data = await res.json()
  return Response.json(data)
}

export async function POST(req: Request) {
  const jwt = await getStrapiJwt()
  if (!jwt) return new Response("Unauthorized", { status: 401 })

  const body = (await req.json()) as { eventDocumentId: string }
  const res = await fetch(`${STRAPI}/api/saved-events`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${jwt}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  return Response.json(data, { status: res.status })
}
```

- [ ] **Step 2: Create DELETE route**

```ts
// apps/ui/src/app/api/saved-events/[id]/route.ts
import { headers } from "next/headers"
import { auth } from "@/lib/auth"

const STRAPI = process.env.STRAPI_URL ?? "http://127.0.0.1:1337"

async function getStrapiJwt(): Promise<string | null> {
  const session = await auth.api.getSession({ headers: await headers() })
  return (session?.session as { strapiJWT?: string })?.strapiJWT ?? null
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const jwt = await getStrapiJwt()
  if (!jwt) return new Response("Unauthorized", { status: 401 })

  const { id } = await params
  await fetch(`${STRAPI}/api/saved-events/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${jwt}` },
  })
  return new Response(null, { status: 204 })
}
```

- [ ] **Step 3: Add SaveEventButton to EventModal and EventDetailPage**

In `EventModal.tsx`, add `<SaveEventButton documentId={event.documentId} />` next to the CTAs row.

In `EventDetailPage.tsx`, add `<SaveEventButton documentId={event.documentId} size="md" />` in the meta row.

- [ ] **Step 4: Commit**

```bash
git add apps/ui/src/app/api/saved-events/ \
        apps/ui/src/components/events/EventModal.tsx \
        apps/ui/src/components/events/EventDetailPage.tsx
git commit -m "feat(events): add saved-events API routes + wire SaveEventButton"
```
