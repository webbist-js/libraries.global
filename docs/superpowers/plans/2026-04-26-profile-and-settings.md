# Profile & Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a full-service profile section (`/profile/[username]`) and settings page (`/settings`) for authenticated users, with Strapi user-profile content type as the backing store.

**Architecture:** User profiles are stored as a `user-profile` Strapi collection type linked to Better Auth users via `baUserId`. Profile reads are public Strapi API calls; profile writes go through a Next.js API layer that validates the BA session and calls a Strapi bridge endpoint. Contribution/following/collections tabs are scaffolded as TODO stubs.

**Tech Stack:** Next.js 15 App Router (RSC + client components), Better Auth session API, Strapi v5, Nodemailer (already configured), design tokens from `T`, inline styles + Tailwind per project convention.

---

## File Map

### Strapi (new/modified)
| File | Action |
|------|--------|
| `apps/strapi/src/api/user-profile/content-types/user-profile/schema.json` | CREATE |
| `apps/strapi/src/api/user-profile/controllers/user-profile.ts` | CREATE |
| `apps/strapi/src/api/user-profile/routes/user-profile.ts` | CREATE |
| `apps/strapi/src/api/user-profile/services/user-profile.ts` | CREATE |
| `apps/strapi/src/api/auth-bridge/controllers/auth-bridge.ts` | MODIFY — auto-create profile on sync |
| `apps/strapi/src/api/auth-bridge/routes/auth-bridge.ts` | MODIFY — add upsert-profile route |

### Next.js types & lib
| File | Action |
|------|--------|
| `apps/ui/src/lib/types/profile.ts` | CREATE — UserProfile, Badge types |
| `apps/ui/src/lib/badges.ts` | CREATE — static badge catalog |
| `apps/ui/src/hooks/useProfile.ts` | CREATE — profile mutation hook |

### Next.js API routes
| File | Action |
|------|--------|
| `apps/ui/src/app/api/profile/me/route.ts` | CREATE — GET + PUT own profile |
| `apps/ui/src/app/api/profile/[username]/route.ts` | CREATE — GET public profile |
| `apps/ui/src/app/api/profile/me/notifications/route.ts` | CREATE — GET + PUT notification prefs |
| `apps/ui/src/app/api/profile/me/sessions/route.ts` | CREATE — GET sessions, DELETE session |

### Profile pages
| File | Action |
|------|--------|
| `apps/ui/src/app/[locale]/profile/page.tsx` | CREATE — redirect to own profile |
| `apps/ui/src/app/[locale]/profile/[username]/page.tsx` | CREATE — RSC |
| `apps/ui/src/app/[locale]/profile/[username]/_components/ProfileHero.tsx` | CREATE |
| `apps/ui/src/app/[locale]/profile/[username]/_components/ProfileTabNav.tsx` | CREATE — client tab switcher |
| `apps/ui/src/app/[locale]/profile/[username]/_components/tabs/OverviewTab.tsx` | CREATE |
| `apps/ui/src/app/[locale]/profile/[username]/_components/tabs/ContributionsTab.tsx` | CREATE — TODO stub |
| `apps/ui/src/app/[locale]/profile/[username]/_components/tabs/FollowingTab.tsx` | CREATE — TODO stub |
| `apps/ui/src/app/[locale]/profile/[username]/_components/tabs/CollectionsTab.tsx` | CREATE — TODO stub |
| `apps/ui/src/app/[locale]/profile/[username]/_components/tabs/BadgesTab.tsx` | CREATE |
| `apps/ui/src/app/[locale]/profile/[username]/_components/tabs/ActivityTab.tsx` | CREATE — TODO stub |

### Settings pages
| File | Action |
|------|--------|
| `apps/ui/src/app/[locale]/settings/page.tsx` | CREATE — RSC, auth guard |
| `apps/ui/src/app/[locale]/settings/_components/SettingsShell.tsx` | CREATE — sidebar + content layout |
| `apps/ui/src/app/[locale]/settings/_components/PublicProfileSection.tsx` | CREATE — client form |
| `apps/ui/src/app/[locale]/settings/_components/NotificationsSection.tsx` | CREATE — client toggles |
| `apps/ui/src/app/[locale]/settings/_components/SecuritySection.tsx` | CREATE — sessions list |
| `apps/ui/src/app/[locale]/settings/_components/ConnectionsSection.tsx` | CREATE — OAuth providers |
| `apps/ui/src/app/[locale]/settings/_components/DangerZoneSection.tsx` | CREATE — destructive actions |

### Modified
| File | Action |
|------|--------|
| `apps/ui/src/components/global/GlobalLoggedUserMenu.tsx` | MODIFY — add profile + settings links |

---

## Task 1: Strapi user-profile content type

**Files:**
- Create: `apps/strapi/src/api/user-profile/content-types/user-profile/schema.json`
- Create: `apps/strapi/src/api/user-profile/controllers/user-profile.ts`
- Create: `apps/strapi/src/api/user-profile/routes/user-profile.ts`
- Create: `apps/strapi/src/api/user-profile/services/user-profile.ts`

- [ ] **Create the schema**

```json
{
  "kind": "collectionType",
  "collectionName": "user_profiles",
  "info": {
    "singularName": "user-profile",
    "pluralName": "user-profiles",
    "displayName": "User Profile"
  },
  "options": { "draftAndPublish": false },
  "pluginOptions": {},
  "attributes": {
    "baUserId":      { "type": "string", "unique": true, "required": true },
    "username":      { "type": "string", "unique": true },
    "firstName":     { "type": "string" },
    "lastName":      { "type": "string" },
    "bio":           { "type": "text" },
    "affiliation":   { "type": "string" },
    "role":          { "type": "string" },
    "city":          { "type": "string" },
    "country":       { "type": "string" },
    "timezone":      { "type": "string" },
    "website":       { "type": "string" },
    "avatarUrl":     { "type": "string" },
    "profileVisibility": {
      "type": "enumeration",
      "enum": ["public", "private"],
      "default": "public"
    },
    "isVerifiedLibrarian": { "type": "boolean", "default": false },
    "contributorNumber":   { "type": "integer" },
    "notifPrefs": {
      "type": "json",
      "default": {
        "weeklyDigest": true,
        "editsReviewed": true,
        "newFollowers": false,
        "editorialMessages": true,
        "soundOn": false,
        "marketing": false
      }
    }
  }
}
```

- [ ] **Create the default controller**

`apps/strapi/src/api/user-profile/controllers/user-profile.ts`:
```ts
import { factories } from "@strapi/strapi"
export default factories.createCoreController("api::user-profile.user-profile")
```

- [ ] **Create the default service**

`apps/strapi/src/api/user-profile/services/user-profile.ts`:
```ts
import { factories } from "@strapi/strapi"
export default factories.createCoreService("api::user-profile.user-profile")
```

- [ ] **Create routes — public read by username, no auth write (write is via bridge)**

`apps/strapi/src/api/user-profile/routes/user-profile.ts`:
```ts
export default {
  routes: [
    {
      method: "GET",
      path: "/user-profiles/by-username/:username",
      handler: "user-profile.findByUsername",
      config: { auth: false, policies: [], middlewares: [] },
    },
  ],
}
```

- [ ] **Extend the controller with `findByUsername`**

Update `apps/strapi/src/api/user-profile/controllers/user-profile.ts`:
```ts
import { factories } from "@strapi/strapi"

const base = factories.createCoreController("api::user-profile.user-profile")

export default {
  ...base,
  async findByUsername(ctx: any) {
    const { username } = ctx.params as { username: string }
    const profile = await strapi
      .query("api::user-profile.user-profile")
      .findOne({ where: { username } })
    if (!profile) return ctx.notFound("Profile not found")
    // Strip internal fields
    const { baUserId, ...safe } = profile
    return ctx.send({ data: safe })
  },
}
```

- [ ] **Restart Strapi dev server and verify `GET /api/user-profiles/by-username/test` returns 404 (not 500)**

---

## Task 2: Bridge — auto-create profile + upsert-profile endpoint

**Files:**
- Modify: `apps/strapi/src/api/auth-bridge/controllers/auth-bridge.ts`
- Modify: `apps/strapi/src/api/auth-bridge/routes/auth-bridge.ts`

- [ ] **Add upsertProfile handler and update syncUser to create profile**

Replace `apps/strapi/src/api/auth-bridge/controllers/auth-bridge.ts`:
```ts
export default {
  async syncUser(ctx: any) {
    const serviceSecret = ctx.request.header["x-service-secret"]
    if (!process.env.STRAPI_BRIDGE_SECRET || serviceSecret !== process.env.STRAPI_BRIDGE_SECRET) {
      return ctx.unauthorized("Invalid or missing service secret")
    }

    const { email, name, provider, baUserId } = ctx.request.body as {
      email?: string; name?: string; provider?: string; baUserId?: string
    }
    if (!email || !provider) return ctx.badRequest("Missing required fields: email, provider")

    // Find or create Strapi users-permissions user
    let user = await strapi.query("plugin::users-permissions.user").findOne({ where: { email } })
    if (!user) {
      const authenticatedRole = await strapi
        .query("plugin::users-permissions.role")
        .findOne({ where: { type: "authenticated" } })
      if (!authenticatedRole) return ctx.internalServerError('"authenticated" role not found')
      user = await strapi.query("plugin::users-permissions.user").create({
        data: { email, username: email, provider, confirmed: true, blocked: false, role: authenticatedRole.id },
      })
    }

    // Auto-create user-profile if baUserId provided and profile doesn't exist
    if (baUserId) {
      const existing = await strapi
        .query("api::user-profile.user-profile")
        .findOne({ where: { baUserId } })
      if (!existing) {
        const nameParts = (name ?? "").trim().split(/\s+/)
        const firstName = nameParts[0] ?? ""
        const lastName = nameParts.slice(1).join(" ") || ""
        // Auto-generate username from email local part + random suffix
        const baseUsername = email.split("@")[0].replace(/[^a-z0-9_]/gi, "").toLowerCase()
        const suffix = Math.floor(Math.random() * 9000 + 1000)
        // Count existing profiles for contributor number
        const count = await strapi.query("api::user-profile.user-profile").count()
        await strapi.query("api::user-profile.user-profile").create({
          data: {
            baUserId,
            username: `${baseUsername}${suffix}`,
            firstName,
            lastName,
            contributorNumber: count + 1,
          },
        })
      }
    }

    const jwt = strapi.plugin("users-permissions").service("jwt").issue({ id: user.id })
    return ctx.send({ user: { id: user.id, email: user.email, username: user.username }, jwt })
  },

  async upsertProfile(ctx: any) {
    const serviceSecret = ctx.request.header["x-service-secret"]
    if (!process.env.STRAPI_BRIDGE_SECRET || serviceSecret !== process.env.STRAPI_BRIDGE_SECRET) {
      return ctx.unauthorized("Invalid or missing service secret")
    }

    const { baUserId, ...fields } = ctx.request.body as { baUserId: string; [k: string]: unknown }
    if (!baUserId) return ctx.badRequest("Missing baUserId")

    const allowedFields = [
      "username", "firstName", "lastName", "bio", "affiliation", "role",
      "city", "country", "timezone", "website", "avatarUrl",
      "profileVisibility", "notifPrefs",
    ]
    const data: Record<string, unknown> = {}
    for (const key of allowedFields) {
      if (key in fields) data[key] = fields[key]
    }

    const existing = await strapi
      .query("api::user-profile.user-profile")
      .findOne({ where: { baUserId } })

    if (!existing) {
      await strapi.query("api::user-profile.user-profile").create({ data: { baUserId, ...data } })
    } else {
      await strapi.query("api::user-profile.user-profile").update({ where: { baUserId }, data })
    }

    const updated = await strapi
      .query("api::user-profile.user-profile")
      .findOne({ where: { baUserId } })
    const { baUserId: _id, ...safe } = updated
    return ctx.send({ data: safe })
  },
}
```

- [ ] **Add upsert-profile route**

Replace `apps/strapi/src/api/auth-bridge/routes/auth-bridge.ts`:
```ts
export default {
  routes: [
    {
      method: "POST",
      path: "/auth-bridge/sync-user",
      handler: "auth-bridge.syncUser",
      config: { auth: false, policies: [], middlewares: [] },
    },
    {
      method: "POST",
      path: "/auth-bridge/upsert-profile",
      handler: "auth-bridge.upsertProfile",
      config: { auth: false, policies: [], middlewares: [] },
    },
  ],
}
```

- [ ] **Update auth.ts to pass baUserId in syncUser call**

In `apps/ui/src/lib/auth.ts`, update `syncUserToStrapi`:
```ts
async function syncUserToStrapi(user: { id: string; email: string; name: string }): Promise<void> {
  const strapiUrl = process.env.STRAPI_URL ?? "http://127.0.0.1:1337"
  const secret = process.env.STRAPI_BRIDGE_SECRET
  if (!secret) { console.warn("[auth] STRAPI_BRIDGE_SECRET not set — skipping Strapi user sync"); return }
  try {
    const res = await fetch(`${strapiUrl}/api/auth-bridge/sync-user`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Service-Secret": secret },
      body: JSON.stringify({ email: user.email, name: user.name, provider: "local", baUserId: user.id }),
    })
    if (!res.ok) console.error("[auth] Strapi sync failed:", res.status, await res.text())
  } catch (err) { console.error("[auth] Failed to reach Strapi:", err) }
}
```

And update the `databaseHooks.user.create.after` call:
```ts
after: async (user) => {
  await syncUserToStrapi({ id: user.id, email: user.email, name: user.name })
},
```

- [ ] **Restart Strapi, register a new test user, verify a user-profile row is created**

---

## Task 3: Types, badge catalog, profile hook

**Files:**
- Create: `apps/ui/src/lib/types/profile.ts`
- Create: `apps/ui/src/lib/badges.ts`
- Create: `apps/ui/src/hooks/useProfile.ts`

- [ ] **Create UserProfile types**

`apps/ui/src/lib/types/profile.ts`:
```ts
export type UserProfile = {
  id: number
  username: string
  firstName: string
  lastName: string
  bio?: string | null
  affiliation?: string | null
  role?: string | null
  city?: string | null
  country?: string | null
  timezone?: string | null
  website?: string | null
  avatarUrl?: string | null
  profileVisibility: "public" | "private"
  isVerifiedLibrarian: boolean
  contributorNumber?: number | null
  notifPrefs: NotifPrefs
  createdAt: string
  updatedAt: string
}

export type NotifPrefs = {
  weeklyDigest: boolean
  editsReviewed: boolean
  newFollowers: boolean
  editorialMessages: boolean
  soundOn: boolean
  marketing: boolean
}

export type PublicProfile = Omit<UserProfile, "notifPrefs"> & {
  // contribution counts will be added when Submission content type exists
  // TODO: contributionCount, followingCount, followersCount, collectionsCount
}
```

- [ ] **Create badge catalog**

`apps/ui/src/lib/badges.ts`:
```ts
export type BadgeRarity = "COMMON" | "UNCOMMON" | "RARE" | "STATUS"

export type BadgeDefinition = {
  id: string
  name: string
  description: string
  rarity: BadgeRarity
  icon: string // lucide icon name
  // TODO: earned condition — requires contribution data
  // earnedWhen: (stats: ContributorStats) => boolean
}

export const BADGE_CATALOG: BadgeDefinition[] = [
  { id: "first-edit",        name: "First edit",        description: "Made your first contribution to the index.", rarity: "COMMON",   icon: "Pencil" },
  { id: "centurion",         name: "Centurion",         description: "Logged 100 approved edits across the index.", rarity: "UNCOMMON", icon: "Star" },
  { id: "cartographer",      name: "Cartographer",      description: "Mapped libraries on every continent.", rarity: "RARE",     icon: "Map" },
  { id: "polyglot",          name: "Polyglot",          description: "Translated content into three or more languages.", rarity: "UNCOMMON", icon: "Languages" },
  { id: "rare-books",        name: "Rare Books",        description: "Documented 25+ rare-books collections.", rarity: "UNCOMMON", icon: "BookOpen" },
  { id: "streak-100",        name: "Streak 100",        description: "Contributed for 100 consecutive days.", rarity: "RARE",     icon: "Zap" },
  { id: "verified-librarian",name: "Verified librarian",description: "Affiliation confirmed by an institution.", rarity: "STATUS",   icon: "BadgeCheck" },
  { id: "first-add",         name: "First add",         description: "Indexed a library not previously in the atlas.", rarity: "COMMON",   icon: "Plus" },
  { id: "marathoner",        name: "Marathoner",        description: "Maintain a 365-day streak.", rarity: "RARE",     icon: "Clock" },
  { id: "bibliophile-2000",  name: "Bibliophile 2,000", description: "Reach 2,000 lifetime contributions.", rarity: "UNCOMMON", icon: "Diamond" },
  { id: "editorial-board",   name: "Editorial board",   description: "Invited to the project's stewards by peer vote.", rarity: "STATUS",   icon: "Users" },
  { id: "globetrotter",      name: "Globetrotter",      description: "Contributed libraries in 75 different countries.", rarity: "RARE",     icon: "Globe" },
  { id: "mentor",            name: "Mentor",            description: "Onboarded 10 new contributors successfully.", rarity: "UNCOMMON", icon: "GraduationCap" },
  { id: "legendary-10000",   name: "Legendary 10,000",  description: "Reach 10,000 lifetime contributions.", rarity: "RARE",     icon: "Trophy" },
  { id: "patron",            name: "Patron",            description: "Supported the project for a year.", rarity: "STATUS",   icon: "Heart" },
  { id: "atlas-complete",    name: "Atlas complete",    description: "Contributed to every continent.", rarity: "RARE",     icon: "LayoutGrid" },
]
```

- [ ] **Create useProfile hook**

`apps/ui/src/hooks/useProfile.ts`:
```ts
"use client"

import { useState } from "react"
import { toast } from "sonner"

import type { NotifPrefs, UserProfile } from "@/lib/types/profile"

export function useProfile() {
  const [saving, setSaving] = useState(false)

  async function updateProfile(data: Partial<UserProfile>): Promise<boolean> {
    setSaving(true)
    try {
      const res = await fetch("/api/profile/me", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      const json = (await res.json()) as { error?: string }
      if (!res.ok) { toast.error(json.error ?? "Failed to save profile"); return false }
      toast.success("Profile saved")
      return true
    } catch {
      toast.error("Failed to save profile")
      return false
    } finally {
      setSaving(false)
    }
  }

  async function updateNotifications(prefs: Partial<NotifPrefs>): Promise<boolean> {
    setSaving(true)
    try {
      const res = await fetch("/api/profile/me/notifications", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(prefs),
      })
      const json = (await res.json()) as { error?: string }
      if (!res.ok) { toast.error(json.error ?? "Failed to save notifications"); return false }
      return true
    } catch {
      toast.error("Failed to save notifications")
      return false
    } finally {
      setSaving(false)
    }
  }

  return { saving, updateProfile, updateNotifications }
}
```

---

## Task 4: Next.js API routes

**Files:**
- Create: `apps/ui/src/app/api/profile/me/route.ts`
- Create: `apps/ui/src/app/api/profile/[username]/route.ts`
- Create: `apps/ui/src/app/api/profile/me/notifications/route.ts`
- Create: `apps/ui/src/app/api/profile/me/sessions/route.ts`

- [ ] **Create GET/PUT /api/profile/me**

`apps/ui/src/app/api/profile/me/route.ts`:
```ts
import { headers } from "next/headers"
import { NextResponse } from "next/server"

import { auth } from "@/lib/auth"

const STRAPI = process.env.STRAPI_URL ?? "http://127.0.0.1:1337"
const SECRET = process.env.STRAPI_BRIDGE_SECRET

async function getStrapiProfile(baUserId: string) {
  const res = await fetch(
    `${STRAPI}/api/user-profiles?filters[baUserId][$eq]=${encodeURIComponent(baUserId)}&publicationState=live`,
    { next: { revalidate: 0 } }
  )
  if (!res.ok) return null
  const json = (await res.json()) as { data?: Array<{ id: number; attributes?: Record<string, unknown> }> }
  const row = json.data?.[0]
  if (!row) return null
  return { id: row.id, ...(row.attributes ?? {}) }
}

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const profile = await getStrapiProfile(session.user.id)
  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 })
  return NextResponse.json({ data: profile })
}

export async function PUT(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = (await req.json()) as Record<string, unknown>
  const allowed = ["username","firstName","lastName","bio","affiliation","role","city","country","timezone","website","avatarUrl","profileVisibility"]
  const data: Record<string, unknown> = { baUserId: session.user.id }
  for (const key of allowed) {
    if (key in body) data[key] = body[key]
  }

  if (!SECRET) return NextResponse.json({ error: "Bridge not configured" }, { status: 500 })
  const res = await fetch(`${STRAPI}/api/auth-bridge/upsert-profile`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Service-Secret": SECRET },
    body: JSON.stringify(data),
  })
  const json = await res.json()
  if (!res.ok) return NextResponse.json({ error: "Failed to update profile" }, { status: 500 })
  return NextResponse.json(json)
}
```

- [ ] **Create GET /api/profile/[username]**

`apps/ui/src/app/api/profile/[username]/route.ts`:
```ts
import { NextResponse } from "next/server"

const STRAPI = process.env.STRAPI_URL ?? "http://127.0.0.1:1337"

export async function GET(_req: Request, { params }: { params: Promise<{ username: string }> }) {
  const { username } = await params
  const res = await fetch(
    `${STRAPI}/api/user-profiles/by-username/${encodeURIComponent(username)}`,
    { next: { revalidate: 60 } }
  )
  if (res.status === 404) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (!res.ok) return NextResponse.json({ error: "Upstream error" }, { status: 502 })
  const json = await res.json()
  return NextResponse.json(json)
}
```

- [ ] **Create GET/PUT /api/profile/me/notifications**

`apps/ui/src/app/api/profile/me/notifications/route.ts`:
```ts
import { headers } from "next/headers"
import { NextResponse } from "next/server"

import { auth } from "@/lib/auth"

const STRAPI = process.env.STRAPI_URL ?? "http://127.0.0.1:1337"
const SECRET = process.env.STRAPI_BRIDGE_SECRET

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const res = await fetch(
    `${STRAPI}/api/user-profiles?filters[baUserId][$eq]=${encodeURIComponent(session.user.id)}`,
    { next: { revalidate: 0 } }
  )
  if (!res.ok) return NextResponse.json({ error: "Not found" }, { status: 404 })
  const json = (await res.json()) as { data?: Array<{ attributes?: { notifPrefs?: unknown } }> }
  const prefs = json.data?.[0]?.attributes?.notifPrefs ?? {}
  return NextResponse.json({ data: prefs })
}

export async function PUT(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = (await req.json()) as Record<string, unknown>
  if (!SECRET) return NextResponse.json({ error: "Bridge not configured" }, { status: 500 })

  const res = await fetch(`${STRAPI}/api/auth-bridge/upsert-profile`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Service-Secret": SECRET },
    body: JSON.stringify({ baUserId: session.user.id, notifPrefs: body }),
  })
  if (!res.ok) return NextResponse.json({ error: "Failed to save" }, { status: 500 })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Create GET/DELETE /api/profile/me/sessions**

`apps/ui/src/app/api/profile/me/sessions/route.ts`:
```ts
import { headers } from "next/headers"
import { NextResponse } from "next/server"

import { auth } from "@/lib/auth"

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  try {
    const sessions = await auth.api.listSessions({ headers: await headers() })
    return NextResponse.json({ data: sessions })
  } catch {
    return NextResponse.json({ error: "Failed to list sessions" }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { sessionToken } = (await req.json()) as { sessionToken?: string }

  if (sessionToken) {
    // Revoke specific session
    await auth.api.revokeSession({ headers: await headers(), body: { token: sessionToken } })
  } else {
    // Sign out all other sessions
    await auth.api.revokeOtherSessions({ headers: await headers() })
  }
  return NextResponse.json({ ok: true })
}
```

---

## Task 5: Profile page — RSC shell + redirect

**Files:**
- Create: `apps/ui/src/app/[locale]/profile/page.tsx`
- Create: `apps/ui/src/app/[locale]/profile/[username]/page.tsx`

- [ ] **Create own-profile redirect page**

`apps/ui/src/app/[locale]/profile/page.tsx`:
```tsx
import { headers } from "next/headers"
import { redirect } from "next/navigation"

import { getSessionSSR } from "@/lib/auth-server"

export default async function OwnProfilePage() {
  const session = await getSessionSSR(await headers())
  if (!session?.user) redirect("/auth/signin")

  // Fetch own profile to get username
  const strapiUrl = process.env.STRAPI_URL ?? "http://127.0.0.1:1337"
  try {
    const res = await fetch(
      `${strapiUrl}/api/user-profiles?filters[baUserId][$eq]=${encodeURIComponent(session.user.id)}`,
      { cache: "no-store" }
    )
    if (res.ok) {
      const json = (await res.json()) as { data?: Array<{ attributes?: { username?: string } }> }
      const username = json.data?.[0]?.attributes?.username
      if (username) redirect(`/profile/${username}`)
    }
  } catch {}

  // Fallback: redirect to settings to complete profile
  redirect("/settings")
}
```

- [ ] **Create public profile RSC page**

`apps/ui/src/app/[locale]/profile/[username]/page.tsx`:
```tsx
import { headers } from "next/headers"
import { notFound } from "next/navigation"

import { GlobalHeader } from "@/components/global/GlobalHeader"
import { getSessionSSR } from "@/lib/auth-server"
import type { UserProfile } from "@/lib/types/profile"
import { ProfileHero } from "./_components/ProfileHero"
import { ProfileTabNav } from "./_components/ProfileTabNav"

async function fetchProfile(username: string): Promise<UserProfile | null> {
  const strapiUrl = process.env.STRAPI_URL ?? "http://127.0.0.1:1337"
  const res = await fetch(
    `${strapiUrl}/api/user-profiles/by-username/${encodeURIComponent(username)}`,
    { next: { revalidate: 60 } }
  )
  if (!res.ok) return null
  const json = (await res.json()) as { data: UserProfile }
  return json.data
}

export default async function ProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ username: string }>
  searchParams: Promise<{ tab?: string }>
}) {
  const { username } = await params
  const { tab = "overview" } = await searchParams

  const [profile, session] = await Promise.all([
    fetchProfile(username),
    getSessionSSR(await headers()),
  ])

  if (!profile) notFound()

  // Determine if this is the viewer's own profile
  // We'd need to cross-reference baUserId — for now, compare via a second fetch if session exists
  const isOwnProfile = false // TODO: resolve when viewing own profile

  return (
    <div className="relative isolate flex min-h-screen w-full flex-col" style={{ background: "#050816" }}>
      {/* GlobalHeader requires navbar — fetch it or pass null */}
      <ProfileHero profile={profile} isOwnProfile={isOwnProfile} />
      <ProfileTabNav username={username} activeTab={tab} />
    </div>
  )
}
```

---

## Task 6: ProfileHero component

**Files:**
- Create: `apps/ui/src/app/[locale]/profile/[username]/_components/ProfileHero.tsx`

- [ ] **Implement ProfileHero**

`apps/ui/src/app/[locale]/profile/[username]/_components/ProfileHero.tsx`:
```tsx
import GlobalLink from "@/components/global/GlobalLink"
import { T } from "@/lib/design-tokens"
import type { UserProfile } from "@/lib/types/profile"

function getInitials(p: UserProfile): string {
  const first = p.firstName?.[0] ?? ""
  const last = p.lastName?.[0] ?? ""
  return (first + last).toUpperCase() || p.username.slice(0, 2).toUpperCase()
}

export function ProfileHero({
  profile,
  isOwnProfile,
}: {
  profile: UserProfile
  isOwnProfile: boolean
}) {
  const initials = getInitials(profile)
  const displayName = [profile.firstName, profile.lastName].filter(Boolean).join(" ") || profile.username
  const [first, ...lastParts] = displayName.split(" ")
  const last = lastParts.join(" ")

  const joinedYear = new Date(profile.createdAt).toLocaleDateString("en-US", { month: "short", year: "numeric" }).toUpperCase()

  return (
    <div
      className="relative w-full"
      style={{ background: "#030511", borderBottom: `1px solid ${T.border.line}` }}
    >
      {/* Subtle radial glow */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(ellipse 60% 80% at 60% 30%, rgba(127,223,255,0.04), transparent 65%)" }}
      />

      <div className="relative z-10 mx-auto max-w-5xl px-6 py-10 md:px-10">
        {/* Breadcrumb */}
        <div
          style={{
            fontFamily: T.font.mono,
            fontSize: "9px",
            letterSpacing: ".18em",
            textTransform: "uppercase",
            color: T.ink.faint,
            display: "flex",
            gap: "10px",
            marginBottom: "16px",
          }}
        >
          <GlobalLink href="/" style={{ color: T.ink.faint, textDecoration: "none" }}>Atlas</GlobalLink>
          <span>·</span>
          <span>Contributors</span>
          <span>·</span>
          <span style={{ color: T.ink.dim }}>{displayName}</span>
        </div>

        {/* Location / verified chip */}
        {(profile.city || profile.country || profile.isVerifiedLibrarian) && (
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "4px 12px",
              borderRadius: "999px",
              border: `1px solid ${T.border.line}`,
              background: "rgba(255,255,255,0.03)",
              fontFamily: T.font.mono,
              fontSize: "9px",
              letterSpacing: ".14em",
              textTransform: "uppercase",
              color: T.ink.dim,
              marginBottom: "18px",
            }}
          >
            {profile.city && <span>{profile.city}</span>}
            {profile.country && <><span>·</span><span>{profile.country}</span></>}
            {profile.isVerifiedLibrarian && (
              <>
                <span>·</span>
                <span style={{ color: T.accent.aurora }}>Verified Librarian</span>
              </>
            )}
          </div>
        )}

        <div className="flex items-start gap-8">
          {/* Avatar */}
          <div className="shrink-0">
            <div
              style={{
                width: "96px",
                height: "96px",
                borderRadius: "50%",
                border: `2px solid rgba(127,223,255,0.25)`,
                background: "rgba(127,223,255,0.12)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: T.font.mono,
                fontSize: "28px",
                fontWeight: 600,
                color: T.accent.aurora,
                position: "relative",
                overflow: "hidden",
              }}
            >
              {profile.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profile.avatarUrl} alt={displayName} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                initials
              )}
            </div>
            {profile.isVerifiedLibrarian && (
              <div
                style={{
                  marginTop: "-18px",
                  marginLeft: "68px",
                  width: "22px",
                  height: "22px",
                  borderRadius: "50%",
                  background: T.accent.aurora,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  border: "2px solid #030511",
                  position: "relative",
                  zIndex: 1,
                }}
              >
                <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                  <path d="M2 6l3 3 5-5" stroke="#030511" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            )}
          </div>

          {/* Main content */}
          <div className="flex-1 min-w-0">
            {/* Name */}
            <h1
              style={{
                fontFamily: T.font.serif,
                fontSize: "clamp(2.4rem, 5vw, 3.8rem)",
                fontWeight: 700,
                lineHeight: 0.94,
                letterSpacing: "-0.03em",
                color: T.ink.base,
                margin: "0 0 10px",
              }}
            >
              {first}{" "}
              {last && (
                <em style={{ fontStyle: "italic", fontWeight: 400 }}>{last}.</em>
              )}
            </h1>

            {/* Meta row */}
            <div
              style={{
                fontFamily: T.font.mono,
                fontSize: "10px",
                letterSpacing: ".12em",
                textTransform: "uppercase",
                color: T.ink.faint,
                display: "flex",
                gap: "10px",
                marginBottom: "14px",
              }}
            >
              <span>@{profile.username}</span>
              {profile.contributorNumber && (
                <><span>·</span><span>Contributor #{String(profile.contributorNumber).padStart(6, "0")}</span></>
              )}
              <span>·</span>
              <span>Joined {joinedYear}</span>
            </div>

            {/* Bio */}
            {profile.bio && (
              <p
                style={{
                  fontSize: "14px",
                  lineHeight: "1.65",
                  color: T.ink.dim,
                  maxWidth: "52ch",
                  margin: "0 0 14px",
                  fontWeight: 300,
                }}
              >
                {profile.bio}
              </p>
            )}

            {/* Affiliation + website */}
            <div style={{ display: "flex", gap: "20px", alignItems: "center", flexWrap: "wrap" }}>
              {profile.affiliation && (
                <span
                  style={{
                    fontFamily: T.font.mono,
                    fontSize: "10px",
                    letterSpacing: ".08em",
                    color: T.ink.base,
                    fontWeight: 500,
                  }}
                >
                  {profile.affiliation}
                </span>
              )}
              {profile.role && (
                <span
                  style={{
                    fontFamily: T.font.mono,
                    fontSize: "10px",
                    letterSpacing: ".08em",
                    color: T.ink.faint,
                  }}
                >
                  {profile.role}
                </span>
              )}
              {profile.website && (
                <a
                  href={profile.website.startsWith("http") ? profile.website : `https://${profile.website}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    fontFamily: T.font.mono,
                    fontSize: "10px",
                    letterSpacing: ".06em",
                    color: T.accent.aurora,
                    textDecoration: "none",
                  }}
                >
                  {profile.website.replace(/^https?:\/\//, "")} ↗
                </a>
              )}
            </div>
          </div>

          {/* Action buttons (shown to other users) */}
          {!isOwnProfile && (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", flexShrink: 0 }}>
              {/* TODO: Follow button — requires Follow relation */}
              <button
                type="button"
                style={{
                  padding: "8px 18px",
                  borderRadius: "8px",
                  border: `1px solid rgba(127,223,255,0.35)`,
                  background: "rgba(127,223,255,0.08)",
                  color: T.accent.aurora,
                  fontFamily: T.font.sans,
                  fontSize: "13px",
                  fontWeight: 500,
                  cursor: "not-allowed",
                  opacity: 0.5,
                }}
                disabled
                title="Following — coming soon"
              >
                + Follow
              </button>
            </div>
          )}

          {/* Own profile — edit link */}
          {isOwnProfile && (
            <GlobalLink
              href="/settings"
              style={{
                padding: "8px 18px",
                borderRadius: "8px",
                border: `1px solid ${T.border.hi}`,
                background: "rgba(255,255,255,0.04)",
                color: T.ink.dim,
                fontFamily: T.font.mono,
                fontSize: "10px",
                letterSpacing: ".12em",
                textTransform: "uppercase",
                textDecoration: "none",
                flexShrink: 0,
              }}
            >
              Edit profile
            </GlobalLink>
          )}
        </div>
      </div>
    </div>
  )
}
```

---

## Task 7: ProfileTabNav + tab components

**Files:**
- Create: `apps/ui/src/app/[locale]/profile/[username]/_components/ProfileTabNav.tsx`
- Create: `apps/ui/src/app/[locale]/profile/[username]/_components/tabs/OverviewTab.tsx`
- Create: `apps/ui/src/app/[locale]/profile/[username]/_components/tabs/ContributionsTab.tsx`
- Create: `apps/ui/src/app/[locale]/profile/[username]/_components/tabs/FollowingTab.tsx`
- Create: `apps/ui/src/app/[locale]/profile/[username]/_components/tabs/CollectionsTab.tsx`
- Create: `apps/ui/src/app/[locale]/profile/[username]/_components/tabs/BadgesTab.tsx`
- Create: `apps/ui/src/app/[locale]/profile/[username]/_components/tabs/ActivityTab.tsx`

- [ ] **Create ProfileTabNav (client, uses searchParams to switch tabs)**

`apps/ui/src/app/[locale]/profile/[username]/_components/ProfileTabNav.tsx`:
```tsx
"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { T } from "@/lib/design-tokens"

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "contributions", label: "Contributions" },
  { id: "following", label: "Following" },
  { id: "collections", label: "Collections" },
  { id: "badges", label: "Badges" },
  { id: "activity", label: "Activity" },
] as const

export function ProfileTabNav({ username, activeTab }: { username: string; activeTab: string }) {
  const router = useRouter()

  return (
    <div
      style={{
        borderBottom: `1px solid ${T.border.line}`,
        background: "#050816",
      }}
    >
      <div className="mx-auto max-w-5xl px-6 md:px-10">
        <div style={{ display: "flex", gap: "0", overflowX: "auto" }}>
          {TABS.map((tab) => {
            const active = activeTab === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => router.push(`/profile/${username}?tab=${tab.id}`)}
                style={{
                  padding: "14px 18px",
                  fontFamily: T.font.mono,
                  fontSize: "10px",
                  letterSpacing: ".14em",
                  textTransform: "uppercase",
                  color: active ? T.ink.base : T.ink.faint,
                  background: "transparent",
                  border: "none",
                  borderBottom: active ? `2px solid ${T.accent.aurora}` : "2px solid transparent",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  transition: "color 150ms",
                }}
              >
                {tab.label}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Update profile page to render active tab content**

Update `apps/ui/src/app/[locale]/profile/[username]/page.tsx` — add tab rendering below `<ProfileTabNav>`:

```tsx
// Add these imports at top of page.tsx:
import { OverviewTab } from "./_components/tabs/OverviewTab"
import { ContributionsTab } from "./_components/tabs/ContributionsTab"
import { FollowingTab } from "./_components/tabs/FollowingTab"
import { CollectionsTab } from "./_components/tabs/CollectionsTab"
import { BadgesTab } from "./_components/tabs/BadgesTab"
import { ActivityTab } from "./_components/tabs/ActivityTab"

// Add after <ProfileTabNav> in JSX:
const TAB_CONTENT: Record<string, React.ReactNode> = {
  overview:      <OverviewTab profile={profile} />,
  contributions: <ContributionsTab />,
  following:     <FollowingTab />,
  collections:   <CollectionsTab />,
  badges:        <BadgesTab />,
  activity:      <ActivityTab />,
}
// render:
<main className="mx-auto w-full max-w-5xl px-6 py-8 md:px-10">
  {TAB_CONTENT[tab] ?? <OverviewTab profile={profile} />}
</main>
```

- [ ] **Create OverviewTab**

`apps/ui/src/app/[locale]/profile/[username]/_components/tabs/OverviewTab.tsx`:
```tsx
import { T } from "@/lib/design-tokens"
import type { UserProfile } from "@/lib/types/profile"

export function OverviewTab({ profile }: { profile: UserProfile }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
      {/* Quick stats row — placeholder zeros until contribution data exists */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: "1px",
          border: `1px solid ${T.border.line}`,
          borderRadius: "12px",
          overflow: "hidden",
        }}
      >
        {[
          // TODO: replace 0 values with real contribution/following counts
          { label: "Contributions", value: "—", note: "TODO" },
          { label: "Following", value: "—", note: "TODO" },
          { label: "Collections", value: "—", note: "TODO" },
          { label: "Reputation", value: "—", note: "TODO" },
        ].map((stat) => (
          <div
            key={stat.label}
            style={{
              padding: "20px 24px",
              background: "rgba(255,255,255,0.02)",
              display: "flex",
              flexDirection: "column",
              gap: "4px",
            }}
          >
            <span
              style={{
                fontFamily: T.font.serif,
                fontSize: "32px",
                fontWeight: 400,
                letterSpacing: "-0.03em",
                color: T.ink.base,
              }}
            >
              {stat.value}
            </span>
            <span
              style={{
                fontFamily: T.font.mono,
                fontSize: "9px",
                letterSpacing: ".16em",
                textTransform: "uppercase",
                color: T.ink.faint,
              }}
            >
              {stat.label}
            </span>
          </div>
        ))}
      </div>

      {/* Profile details */}
      {(profile.affiliation || profile.role || profile.city || profile.country || profile.timezone || profile.website) && (
        <div
          style={{
            border: `1px solid ${T.border.line}`,
            borderRadius: "12px",
            padding: "24px",
            background: "rgba(255,255,255,0.02)",
            display: "flex",
            flexDirection: "column",
            gap: "14px",
          }}
        >
          <p style={{ fontFamily: T.font.mono, fontSize: "9px", letterSpacing: ".18em", textTransform: "uppercase", color: T.ink.faint, margin: 0 }}>
            Profile details
          </p>
          {[
            { label: "Institution", value: profile.affiliation },
            { label: "Role", value: profile.role },
            { label: "Location", value: [profile.city, profile.country].filter(Boolean).join(", ") || null },
            { label: "Timezone", value: profile.timezone },
            { label: "Website", value: profile.website },
          ].filter((r) => r.value).map((row) => (
            <div key={row.label} style={{ display: "flex", gap: "24px" }}>
              <span style={{ fontFamily: T.font.mono, fontSize: "10px", letterSpacing: ".1em", textTransform: "uppercase", color: T.ink.faint, width: "100px", flexShrink: 0 }}>
                {row.label}
              </span>
              <span style={{ fontSize: "13px", color: T.ink.dim }}>{row.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Create TODO stub tabs**

`apps/ui/src/app/[locale]/profile/[username]/_components/tabs/ContributionsTab.tsx`:
```tsx
import { T } from "@/lib/design-tokens"

// TODO: Implement when Submission content type is built.
// Will show: stats row (Total/Approved/Pending/Reputation), type filters (ALL/ADDED/EDITED/TRANSLATED/FLAGGED/PHOTOGRAPHY),
// country filter chips, date-grouped contribution list with rep points per entry.
export function ContributionsTab() {
  return (
    <div
      style={{
        border: `1px solid ${T.border.line}`,
        borderRadius: "12px",
        padding: "48px",
        textAlign: "center",
        background: "rgba(255,255,255,0.02)",
      }}
    >
      <p style={{ fontFamily: T.font.mono, fontSize: "10px", letterSpacing: ".18em", textTransform: "uppercase", color: T.ink.faint, margin: "0 0 8px" }}>
        Contributions
      </p>
      <p style={{ fontSize: "14px", color: T.ink.faint, margin: 0 }}>
        Contribution history will appear here once the submission system is built.
      </p>
    </div>
  )
}
```

`apps/ui/src/app/[locale]/profile/[username]/_components/tabs/FollowingTab.tsx`:
```tsx
import { T } from "@/lib/design-tokens"

// TODO: Implement when Follow relation is added to user-profile.
// Will show: following stats (total/libraries/people/followers), sub-tabs (People/Libraries/Regions/Followers),
// search + filter chips, person cards with avatar/name/institution/stats/Follow button.
export function FollowingTab() {
  return (
    <div
      style={{
        border: `1px solid ${T.border.line}`,
        borderRadius: "12px",
        padding: "48px",
        textAlign: "center",
        background: "rgba(255,255,255,0.02)",
      }}
    >
      <p style={{ fontFamily: T.font.mono, fontSize: "10px", letterSpacing: ".18em", textTransform: "uppercase", color: T.ink.faint, margin: "0 0 8px" }}>
        Following
      </p>
      <p style={{ fontSize: "14px", color: T.ink.faint, margin: 0 }}>
        Following and followers will appear here once the social graph is built.
      </p>
    </div>
  )
}
```

`apps/ui/src/app/[locale]/profile/[username]/_components/tabs/CollectionsTab.tsx`:
```tsx
import { T } from "@/lib/design-tokens"

// TODO: Implement when Collection content type is built.
// Will show: curated reading lists, exhibitions, and cross-library indexes assembled by the user.
export function CollectionsTab() {
  return (
    <div
      style={{
        border: `1px solid ${T.border.line}`,
        borderRadius: "12px",
        padding: "48px",
        textAlign: "center",
        background: "rgba(255,255,255,0.02)",
      }}
    >
      <p style={{ fontFamily: T.font.mono, fontSize: "10px", letterSpacing: ".18em", textTransform: "uppercase", color: T.ink.faint, margin: "0 0 8px" }}>
        Collections — coming next
      </p>
      <p style={{ fontSize: "14px", color: T.ink.faint, margin: 0 }}>
        Curated reading lists, exhibitions, and cross-library indexes will appear here.
      </p>
    </div>
  )
}
```

`apps/ui/src/app/[locale]/profile/[username]/_components/tabs/ActivityTab.tsx`:
```tsx
import { T } from "@/lib/design-tokens"

// TODO: Implement when contribution/event data exists.
// Will show: 30-day stats (events/avg/streak/watching), 12-month bar chart, filter (ALL/Mine/Followed/Editorial/Mentions),
// date-grouped activity feed (edits, follows, badge earned, approvals, mentions).
export function ActivityTab() {
  return (
    <div
      style={{
        border: `1px solid ${T.border.line}`,
        borderRadius: "12px",
        padding: "48px",
        textAlign: "center",
        background: "rgba(255,255,255,0.02)",
      }}
    >
      <p style={{ fontFamily: T.font.mono, fontSize: "10px", letterSpacing: ".18em", textTransform: "uppercase", color: T.ink.faint, margin: "0 0 8px" }}>
        Activity
      </p>
      <p style={{ fontSize: "14px", color: T.ink.faint, margin: 0 }}>
        Activity feed will appear here once contribution events are tracked.
      </p>
    </div>
  )
}
```

- [ ] **Create BadgesTab**

`apps/ui/src/app/[locale]/profile/[username]/_components/tabs/BadgesTab.tsx`:
```tsx
import { T } from "@/lib/design-tokens"
import { BADGE_CATALOG, type BadgeDefinition, type BadgeRarity } from "@/lib/badges"

// TODO: Replace all badges showing as LOCKED once contribution data is available.
// earnedBadgeIds should come from user's contribution stats.
const EARNED_BADGE_IDS: string[] = [] // placeholder — all locked until contribution system exists

const RARITY_COLORS: Record<BadgeRarity, string> = {
  COMMON:   "rgba(255,255,255,0.55)",
  UNCOMMON: T.accent.aurora,
  RARE:     T.accent.violet,
  STATUS:   T.accent.gold,
}

function BadgeCard({ badge, earned }: { badge: BadgeDefinition; earned: boolean }) {
  return (
    <div
      style={{
        padding: "20px",
        borderRadius: "12px",
        border: `1px solid ${earned ? "rgba(127,223,255,0.18)" : T.border.line}`,
        background: earned ? "rgba(127,223,255,0.04)" : "rgba(255,255,255,0.02)",
        opacity: earned ? 1 : 0.5,
        display: "flex",
        flexDirection: "column",
        gap: "10px",
      }}
    >
      <div
        style={{
          width: "40px",
          height: "40px",
          borderRadius: "10px",
          background: earned ? "rgba(127,223,255,0.12)" : "rgba(255,255,255,0.04)",
          border: `1px solid ${earned ? "rgba(127,223,255,0.2)" : T.border.line}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: earned ? RARITY_COLORS[badge.rarity] : T.ink.faint,
          fontSize: "18px",
        }}
      >
        {/* Icon placeholder — lucide icons can't be rendered without importing each individually */}
        <span style={{ fontFamily: T.font.mono, fontSize: "10px" }}>{badge.icon.slice(0, 2).toUpperCase()}</span>
      </div>
      <div>
        <p style={{ margin: "0 0 4px", fontSize: "13px", fontWeight: 500, color: earned ? T.ink.base : T.ink.dim }}>
          {badge.name}
        </p>
        <p style={{ margin: "0 0 8px", fontSize: "12px", color: T.ink.faint, lineHeight: "1.5" }}>
          {badge.description}
        </p>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span
            style={{
              fontFamily: T.font.mono,
              fontSize: "8px",
              letterSpacing: ".18em",
              textTransform: "uppercase",
              color: RARITY_COLORS[badge.rarity],
            }}
          >
            {badge.rarity}
          </span>
          <span
            style={{
              fontFamily: T.font.mono,
              fontSize: "8px",
              letterSpacing: ".12em",
              textTransform: "uppercase",
              color: T.ink.faint,
            }}
          >
            {earned ? "EARNED" : "LOCKED"}
          </span>
        </div>
      </div>
    </div>
  )
}

export function BadgesTab() {
  const earned = BADGE_CATALOG.filter((b) => EARNED_BADGE_IDS.includes(b.id))
  const locked = BADGE_CATALOG.filter((b) => !EARNED_BADGE_IDS.includes(b.id))

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Stats row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: "1px",
          border: `1px solid ${T.border.line}`,
          borderRadius: "12px",
          overflow: "hidden",
        }}
      >
        {[
          { label: "Earned", value: `${earned.length}/${BADGE_CATALOG.length}`, note: `${Math.round((earned.length / BADGE_CATALOG.length) * 100)}% complete` },
          { label: "Rare badges", value: String(earned.filter((b) => b.rarity === "RARE").length), note: "Top 5% holders" },
          { label: "Latest", value: earned.length > 0 ? earned[earned.length - 1].name : "—", note: "" },
          { label: "Next milestone", value: "—", note: "TODO: from contrib data" },
        ].map((s) => (
          <div key={s.label} style={{ padding: "20px 24px", background: "rgba(255,255,255,0.02)" }}>
            <span style={{ fontFamily: T.font.serif, fontSize: "28px", fontWeight: 400, letterSpacing: "-0.03em", color: T.ink.base, display: "block" }}>{s.value}</span>
            <span style={{ fontFamily: T.font.mono, fontSize: "9px", letterSpacing: ".16em", textTransform: "uppercase", color: T.ink.faint }}>{s.label}</span>
          </div>
        ))}
      </div>

      {/* Badge grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "12px" }}>
        {[...earned, ...locked].map((badge) => (
          <BadgeCard key={badge.id} badge={badge} earned={EARNED_BADGE_IDS.includes(badge.id)} />
        ))}
      </div>
    </div>
  )
}
```

---

## Task 8: Settings page — shell + public profile section

**Files:**
- Create: `apps/ui/src/app/[locale]/settings/page.tsx`
- Create: `apps/ui/src/app/[locale]/settings/_components/SettingsShell.tsx`
- Create: `apps/ui/src/app/[locale]/settings/_components/PublicProfileSection.tsx`

- [ ] **Create settings RSC page with auth guard**

`apps/ui/src/app/[locale]/settings/page.tsx`:
```tsx
import { headers } from "next/headers"
import { redirect } from "next/navigation"

import { GlobalHeader } from "@/components/global/GlobalHeader"
import { getSessionSSR } from "@/lib/auth-server"
import type { UserProfile } from "@/lib/types/profile"
import { SettingsShell } from "./_components/SettingsShell"

async function fetchOwnProfile(baUserId: string): Promise<UserProfile | null> {
  const strapiUrl = process.env.STRAPI_URL ?? "http://127.0.0.1:1337"
  try {
    const res = await fetch(
      `${strapiUrl}/api/user-profiles?filters[baUserId][$eq]=${encodeURIComponent(baUserId)}`,
      { cache: "no-store" }
    )
    if (!res.ok) return null
    const json = (await res.json()) as { data?: Array<{ id: number; attributes?: Record<string, unknown> }> }
    const row = json.data?.[0]
    if (!row) return null
    return { id: row.id, ...(row.attributes as Omit<UserProfile, "id">) } as UserProfile
  } catch {
    return null
  }
}

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ section?: string }> }) {
  const [hdrs, { section = "profile" }] = await Promise.all([headers(), searchParams])
  const session = await getSessionSSR(hdrs)
  if (!session?.user) redirect("/auth/signin?callbackUrl=/settings")

  const profile = await fetchOwnProfile(session.user.id)

  return (
    <div className="relative isolate flex min-h-screen w-full flex-col" style={{ background: "#050816" }}>
      <SettingsShell
        activeSection={section}
        profile={profile}
        sessionUser={session.user}
      />
    </div>
  )
}
```

- [ ] **Create SettingsShell — sidebar + section routing**

`apps/ui/src/app/[locale]/settings/_components/SettingsShell.tsx`:
```tsx
"use client"

import { useRouter, useSearchParams } from "next/navigation"

import { T } from "@/lib/design-tokens"
import type { BetterAuthUser } from "@/lib/auth-server"
import type { UserProfile } from "@/lib/types/profile"
import { PublicProfileSection } from "./PublicProfileSection"
import { NotificationsSection } from "./NotificationsSection"
import { SecuritySection } from "./SecuritySection"
import { ConnectionsSection } from "./ConnectionsSection"
import { DangerZoneSection } from "./DangerZoneSection"

const SIDEBAR_ITEMS = [
  { id: "profile",       label: "Profile" },
  { id: "notifications", label: "Notifications" },
  { id: "security",      label: "Security" },
  { id: "connections",   label: "Connections" },
  { id: "danger",        label: "Danger zone", danger: true },
] as const

type SectionId = typeof SIDEBAR_ITEMS[number]["id"]

export function SettingsShell({
  activeSection,
  profile,
  sessionUser,
}: {
  activeSection: string
  profile: UserProfile | null
  sessionUser: BetterAuthUser
}) {
  const router = useRouter()
  const section = activeSection as SectionId

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-12 md:px-10">
      {/* Page header */}
      <div style={{ marginBottom: "40px" }}>
        <h1
          style={{
            fontFamily: T.font.serif,
            fontSize: "clamp(2rem, 4vw, 3rem)",
            fontWeight: 700,
            letterSpacing: "-0.03em",
            color: T.ink.base,
            margin: "0 0 8px",
          }}
        >
          Account <em style={{ fontStyle: "italic", fontWeight: 400 }}>settings.</em>
        </h1>
        <p style={{ fontSize: "14px", color: T.ink.faint, margin: 0 }}>
          Manage your profile, notifications, security, and data. Changes save automatically unless noted.
        </p>
      </div>

      <div className="flex gap-8">
        {/* Sidebar */}
        <nav
          style={{
            width: "200px",
            flexShrink: 0,
            display: "flex",
            flexDirection: "column",
            gap: "2px",
          }}
        >
          {SIDEBAR_ITEMS.map((item) => {
            const active = section === item.id
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => router.push(`/settings?section=${item.id}`)}
                style={{
                  padding: "8px 14px",
                  borderRadius: "8px",
                  border: "none",
                  background: active ? "rgba(255,255,255,0.06)" : "transparent",
                  color: "danger" in item && item.danger
                    ? active ? T.accent.danger : "rgba(255,100,100,0.55)"
                    : active ? T.ink.base : T.ink.dim,
                  fontFamily: T.font.sans,
                  fontSize: "13px",
                  textAlign: "left",
                  cursor: "pointer",
                  transition: "background 150ms, color 150ms",
                  width: "100%",
                }}
              >
                {item.label}
              </button>
            )
          })}
        </nav>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {section === "profile"       && <PublicProfileSection profile={profile} sessionUser={sessionUser} />}
          {section === "notifications" && <NotificationsSection profile={profile} />}
          {section === "security"      && <SecuritySection sessionUser={sessionUser} />}
          {section === "connections"   && <ConnectionsSection />}
          {section === "danger"        && <DangerZoneSection sessionUser={sessionUser} />}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Create PublicProfileSection — editable form**

`apps/ui/src/app/[locale]/settings/_components/PublicProfileSection.tsx`:
```tsx
"use client"

import { useState } from "react"

import { T } from "@/lib/design-tokens"
import type { BetterAuthUser } from "@/lib/auth-server"
import type { UserProfile } from "@/lib/types/profile"
import { useProfile } from "@/hooks/useProfile"

const inputStyle = {
  width: "100%",
  padding: "10px 14px",
  borderRadius: "8px",
  border: `1px solid ${T.border.hi}`,
  background: "rgba(255,255,255,0.04)",
  color: T.ink.base,
  fontSize: "13px",
  fontFamily: T.font.sans,
  outline: "none",
  boxSizing: "border-box" as const,
}

const labelStyle = {
  fontFamily: T.font.mono,
  fontSize: "9px",
  letterSpacing: ".16em",
  textTransform: "uppercase" as const,
  color: T.ink.faint,
  display: "block",
  marginBottom: "6px",
}

export function PublicProfileSection({
  profile,
  sessionUser,
}: {
  profile: UserProfile | null
  sessionUser: BetterAuthUser
}) {
  const { saving, updateProfile } = useProfile()

  const [form, setForm] = useState({
    firstName: profile?.firstName ?? sessionUser.name.split(" ")[0] ?? "",
    lastName:  profile?.lastName  ?? sessionUser.name.split(" ").slice(1).join(" ") ?? "",
    username:  profile?.username  ?? "",
    bio:       profile?.bio       ?? "",
    affiliation: profile?.affiliation ?? "",
    role:      profile?.role      ?? "",
    city:      profile?.city      ?? "",
    country:   profile?.country   ?? "",
    timezone:  profile?.timezone  ?? "",
    website:   profile?.website   ?? "",
  })

  const field = (key: keyof typeof form) => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value })),
  })

  const initials = ((form.firstName[0] ?? "") + (form.lastName[0] ?? "")).toUpperCase() || "?"

  return (
    <div
      style={{
        border: `1px solid ${T.border.line}`,
        borderRadius: "12px",
        overflow: "hidden",
      }}
    >
      {/* Section header */}
      <div style={{ padding: "20px 24px", borderBottom: `1px solid ${T.border.line}`, background: "rgba(255,255,255,0.02)" }}>
        <h2 style={{ margin: 0, fontSize: "16px", fontWeight: 600, color: T.ink.base }}>Public profile</h2>
        <p style={{ margin: "4px 0 0", fontSize: "13px", color: T.ink.faint }}>
          This is what other contributors see on your profile page. Your email is never shown publicly.
        </p>
      </div>

      <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "20px" }}>
        {/* Avatar row */}
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div
            style={{
              width: "56px",
              height: "56px",
              borderRadius: "50%",
              background: "rgba(127,223,255,0.15)",
              border: `1px solid rgba(127,223,255,0.25)`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: T.font.mono,
              fontSize: "18px",
              fontWeight: 600,
              color: T.accent.aurora,
              flexShrink: 0,
            }}
          >
            {profile?.avatarUrl
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={profile.avatarUrl} alt="avatar" style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }} />
              : initials}
          </div>
          <div>
            {/* TODO: implement avatar upload via Strapi media library */}
            <button
              type="button"
              style={{
                padding: "6px 14px",
                borderRadius: "6px",
                border: `1px solid ${T.border.hi}`,
                background: "rgba(255,255,255,0.05)",
                color: T.ink.dim,
                fontSize: "12px",
                fontFamily: T.font.sans,
                cursor: "not-allowed",
                opacity: 0.5,
              }}
              disabled
              title="Avatar upload coming soon"
            >
              Upload new photo
            </button>
            <p style={{ margin: "4px 0 0", fontSize: "11px", color: T.ink.faint, fontFamily: T.font.mono }}>
              JPG · GIF · PNG · MAX 5MB · 400px recommended
            </p>
          </div>
        </div>

        {/* Name row */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
          <div>
            <label style={labelStyle}>First name</label>
            <input style={inputStyle} type="text" {...field("firstName")}
              className="focus:border-[rgba(127,223,255,.4)]"
            />
          </div>
          <div>
            <label style={labelStyle}>Last name</label>
            <input style={inputStyle} type="text" {...field("lastName")}
              className="focus:border-[rgba(127,223,255,.4)]"
            />
          </div>
        </div>

        {/* Username */}
        <div>
          <label style={labelStyle}>Username <span style={{ color: T.ink.faint }}>· libraries.global/@username</span></label>
          <input style={inputStyle} type="text" {...field("username")}
            className="focus:border-[rgba(127,223,255,.4)]"
            placeholder="yourhandle"
          />
        </div>

        {/* Bio */}
        <div>
          <label style={{ ...labelStyle, display: "flex", justifyContent: "space-between" }}>
            <span>Bio</span>
            <span style={{ color: T.ink.faint }}>{form.bio.length}/400 · visible on your profile</span>
          </label>
          <textarea
            style={{ ...inputStyle, resize: "vertical", minHeight: "80px" }}
            maxLength={400}
            {...field("bio")}
            className="focus:border-[rgba(127,223,255,.4)]"
          />
        </div>

        {/* Affiliation + Role */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
          <div>
            <label style={labelStyle}>Affiliation</label>
            <input style={inputStyle} type="text" {...field("affiliation")}
              className="focus:border-[rgba(127,223,255,.4)]"
              placeholder="Bibliothèque nationale de France"
            />
          </div>
          <div>
            <label style={labelStyle}>Role</label>
            <input style={inputStyle} type="text" {...field("role")}
              className="focus:border-[rgba(127,223,255,.4)]"
              placeholder="Senior curator, Rare Books"
            />
          </div>
        </div>

        {/* City + Country */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
          <div>
            <label style={labelStyle}>City</label>
            <input style={inputStyle} type="text" {...field("city")}
              className="focus:border-[rgba(127,223,255,.4)]"
            />
          </div>
          <div>
            <label style={labelStyle}>Country</label>
            <input style={inputStyle} type="text" {...field("country")}
              className="focus:border-[rgba(127,223,255,.4)]"
            />
          </div>
        </div>

        {/* Timezone */}
        <div>
          <label style={labelStyle}>Timezone</label>
          <input style={inputStyle} type="text" {...field("timezone")}
            className="focus:border-[rgba(127,223,255,.4)]"
            placeholder="Europe/Paris · UTC+1"
          />
        </div>

        {/* Website */}
        <div>
          <label style={labelStyle}>Website</label>
          <input style={inputStyle} type="url" {...field("website")}
            className="focus:border-[rgba(127,223,255,.4)]"
            placeholder="https://yoursite.net"
          />
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", paddingTop: "8px", borderTop: `1px solid ${T.border.line}` }}>
          <button
            type="button"
            onClick={() => setForm({
              firstName: profile?.firstName ?? "",
              lastName:  profile?.lastName  ?? "",
              username:  profile?.username  ?? "",
              bio:       profile?.bio       ?? "",
              affiliation: profile?.affiliation ?? "",
              role:      profile?.role      ?? "",
              city:      profile?.city      ?? "",
              country:   profile?.country   ?? "",
              timezone:  profile?.timezone  ?? "",
              website:   profile?.website   ?? "",
            })}
            style={{
              padding: "9px 18px",
              borderRadius: "8px",
              border: `1px solid ${T.border.line}`,
              background: "transparent",
              color: T.ink.dim,
              fontSize: "13px",
              fontFamily: T.font.sans,
              cursor: "pointer",
            }}
          >
            Discard
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => updateProfile(form)}
            style={{
              padding: "9px 18px",
              borderRadius: "8px",
              border: "none",
              background: T.ink.base,
              color: "#030511",
              fontSize: "13px",
              fontFamily: T.font.sans,
              fontWeight: 600,
              cursor: saving ? "not-allowed" : "pointer",
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  )
}
```

---

## Task 9: Settings — Notifications + Security sections

**Files:**
- Create: `apps/ui/src/app/[locale]/settings/_components/NotificationsSection.tsx`
- Create: `apps/ui/src/app/[locale]/settings/_components/SecuritySection.tsx`

- [ ] **Create NotificationsSection**

`apps/ui/src/app/[locale]/settings/_components/NotificationsSection.tsx`:
```tsx
"use client"

import { useState } from "react"

import { T } from "@/lib/design-tokens"
import type { UserProfile } from "@/lib/types/profile"
import { useProfile } from "@/hooks/useProfile"

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      style={{
        width: "42px",
        height: "24px",
        borderRadius: "999px",
        border: "none",
        background: value ? T.accent.aurora : "rgba(255,255,255,0.12)",
        cursor: "pointer",
        position: "relative",
        flexShrink: 0,
        transition: "background 200ms",
      }}
    >
      <span
        style={{
          position: "absolute",
          top: "3px",
          left: value ? "21px" : "3px",
          width: "18px",
          height: "18px",
          borderRadius: "50%",
          background: "#fff",
          transition: "left 200ms",
        }}
      />
    </button>
  )
}

type NotifKey = "weeklyDigest" | "editsReviewed" | "newFollowers" | "editorialMessages" | "soundOn" | "marketing"

const EMAIL_NOTIFS: { key: NotifKey; label: string; desc: string }[] = [
  { key: "weeklyDigest",      label: "Weekly digest",          desc: "Every activity on followed libraries + your contributions." },
  { key: "editsReviewed",     label: "Edits reviewed",         desc: "When an editor approves, rejects, or comments on your submission." },
  { key: "newFollowers",      label: "New followers",          desc: "When another contributor follows you." },
  { key: "editorialMessages", label: "Editorial-board messages", desc: "Important announcements from the project stewards. Recommended." },
]
const PRODUCT_NOTIFS: { key: NotifKey; label: string; desc: string }[] = [
  { key: "soundOn",   label: "Sound on new notifications", desc: "A subtle chime when a new notification arrives." },
  { key: "marketing", label: "Marketing emails",           desc: "Occasional updates on new features and project milestones." },
]

export function NotificationsSection({ profile }: { profile: UserProfile | null }) {
  const { saving, updateNotifications } = useProfile()
  const defaults = profile?.notifPrefs ?? {
    weeklyDigest: true, editsReviewed: true, newFollowers: false,
    editorialMessages: true, soundOn: false, marketing: false,
  }
  const [prefs, setPrefs] = useState(defaults)

  const toggle = (key: NotifKey) => {
    const next = { ...prefs, [key]: !prefs[key] }
    setPrefs(next)
    updateNotifications(next)
  }

  const SectionCard = ({ title, desc, items }: { title: string; desc?: string; items: typeof EMAIL_NOTIFS }) => (
    <div
      style={{
        border: `1px solid ${T.border.line}`,
        borderRadius: "12px",
        overflow: "hidden",
        marginBottom: "16px",
      }}
    >
      <div style={{ padding: "16px 20px", borderBottom: `1px solid ${T.border.line}`, background: "rgba(255,255,255,0.02)" }}>
        <h3 style={{ margin: 0, fontSize: "14px", fontWeight: 600, color: T.ink.base }}>{title}</h3>
        {desc && <p style={{ margin: "2px 0 0", fontSize: "12px", color: T.ink.faint }}>{desc}</p>}
      </div>
      {items.map((item, i) => (
        <div
          key={item.key}
          style={{
            padding: "14px 20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "16px",
            borderBottom: i < items.length - 1 ? `1px solid ${T.border.line}` : "none",
          }}
        >
          <div>
            <p style={{ margin: 0, fontSize: "13px", color: T.ink.base }}>{item.label}</p>
            <p style={{ margin: "2px 0 0", fontSize: "12px", color: T.ink.faint }}>{item.desc}</p>
          </div>
          <Toggle value={prefs[item.key]} onChange={() => toggle(item.key)} />
        </div>
      ))}
    </div>
  )

  return (
    <div>
      <h2 style={{ margin: "0 0 6px", fontSize: "16px", fontWeight: 600, color: T.ink.base }}>Notifications</h2>
      <p style={{ margin: "0 0 24px", fontSize: "13px", color: T.ink.faint }}>
        Choose how you want to hear about activity on libraries, contributions, and the people you follow.
      </p>
      <SectionCard title="Email" items={EMAIL_NOTIFS} />
      <SectionCard title="In-product" items={PRODUCT_NOTIFS} />
      {saving && <p style={{ fontSize: "11px", color: T.ink.faint, fontFamily: T.font.mono }}>Saving…</p>}
    </div>
  )
}
```

- [ ] **Create SecuritySection**

`apps/ui/src/app/[locale]/settings/_components/SecuritySection.tsx`:
```tsx
"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"

import GlobalLink from "@/components/global/GlobalLink"
import { T } from "@/lib/design-tokens"
import type { BetterAuthUser } from "@/lib/auth-server"

type SessionEntry = {
  id: string
  token: string
  userAgent?: string | null
  ipAddress?: string | null
  createdAt: string
  current?: boolean
}

export function SecuritySection({ sessionUser }: { sessionUser: BetterAuthUser }) {
  const [sessions, setSessions] = useState<SessionEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [revoking, setRevoking] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/profile/me/sessions")
      .then((r) => r.json())
      .then((json: { data?: SessionEntry[] }) => setSessions(json.data ?? []))
      .catch(() => setSessions([]))
      .finally(() => setLoading(false))
  }, [])

  const revokeSession = async (token: string) => {
    setRevoking(token)
    const res = await fetch("/api/profile/me/sessions", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionToken: token }),
    })
    if (res.ok) {
      setSessions((s) => s.filter((x) => x.token !== token))
      toast.success("Session revoked")
    } else {
      toast.error("Failed to revoke session")
    }
    setRevoking(null)
  }

  const revokeAll = async () => {
    const res = await fetch("/api/profile/me/sessions", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    })
    if (res.ok) { setSessions([]); toast.success("All other sessions signed out") }
    else toast.error("Failed to sign out sessions")
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <div>
        <h2 style={{ margin: "0 0 6px", fontSize: "16px", fontWeight: 600, color: T.ink.base }}>Security</h2>
        <p style={{ margin: 0, fontSize: "13px", color: T.ink.faint }}>
          Protect access to your account and review where you&apos;re currently signed in.
        </p>
      </div>

      {/* 2FA — TODO: requires BA twoFactor plugin */}
      <div
        style={{
          border: `1px solid ${T.border.line}`,
          borderRadius: "12px",
          overflow: "hidden",
        }}
      >
        <div style={{ padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: `1px solid ${T.border.line}` }}>
          <div>
            <p style={{ margin: 0, fontSize: "13px", color: T.ink.base }}>Two-factor authentication</p>
            <p style={{ margin: "2px 0 0", fontSize: "12px", color: T.ink.faint }}>
              {/* TODO: enable when BA twoFactor plugin is installed */}
              Requires a code from your authenticator app on sign in.
            </p>
          </div>
          <span style={{ fontFamily: T.font.mono, fontSize: "9px", letterSpacing: ".14em", color: T.ink.faint, textTransform: "uppercase" }}>
            Coming soon
          </span>
        </div>
      </div>

      {/* Active sessions */}
      <div
        style={{
          border: `1px solid ${T.border.line}`,
          borderRadius: "12px",
          overflow: "hidden",
        }}
      >
        <div style={{ padding: "16px 20px", background: "rgba(255,255,255,0.02)", borderBottom: `1px solid ${T.border.line}` }}>
          <h3 style={{ margin: 0, fontSize: "14px", fontWeight: 600, color: T.ink.base }}>Active sessions</h3>
        </div>
        {loading ? (
          <div style={{ padding: "20px", textAlign: "center", color: T.ink.faint, fontSize: "13px" }}>Loading…</div>
        ) : sessions.length === 0 ? (
          <div style={{ padding: "20px", textAlign: "center", color: T.ink.faint, fontSize: "13px" }}>No sessions found</div>
        ) : (
          sessions.map((s, i) => (
            <div
              key={s.id}
              style={{
                padding: "12px 20px",
                display: "flex",
                alignItems: "center",
                gap: "12px",
                borderBottom: i < sessions.length - 1 ? `1px solid ${T.border.line}` : "none",
              }}
            >
              <div
                style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "8px",
                  background: "rgba(255,255,255,0.06)",
                  border: `1px solid ${T.border.line}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  fontFamily: T.font.mono,
                  fontSize: "10px",
                  color: T.ink.faint,
                }}
              >
                {s.userAgent?.includes("Mobile") ? "M" : "D"}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: "12px", color: T.ink.base, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {s.userAgent ?? "Unknown device"}
                </p>
                <p style={{ margin: "2px 0 0", fontSize: "11px", color: T.ink.faint, fontFamily: T.font.mono }}>
                  {s.ipAddress ?? "—"} · {new Date(s.createdAt).toLocaleDateString()}
                </p>
              </div>
              <button
                type="button"
                disabled={revoking === s.token}
                onClick={() => revokeSession(s.token)}
                style={{
                  padding: "5px 12px",
                  borderRadius: "6px",
                  border: `1px solid ${T.border.line}`,
                  background: "transparent",
                  color: T.ink.dim,
                  fontSize: "12px",
                  fontFamily: T.font.sans,
                  cursor: "pointer",
                  flexShrink: 0,
                  opacity: revoking === s.token ? 0.5 : 1,
                }}
              >
                Revoke
              </button>
            </div>
          ))
        )}
        <div style={{ padding: "14px 20px", borderTop: `1px solid ${T.border.line}`, display: "flex", gap: "10px" }}>
          <button
            type="button"
            onClick={revokeAll}
            style={{
              padding: "7px 14px",
              borderRadius: "6px",
              border: `1px solid ${T.border.line}`,
              background: "transparent",
              color: T.ink.dim,
              fontSize: "12px",
              fontFamily: T.font.sans,
              cursor: "pointer",
            }}
          >
            Sign out all other sessions
          </button>
          <GlobalLink
            href="/auth/change-password"
            style={{
              padding: "7px 14px",
              borderRadius: "6px",
              border: `1px solid ${T.border.line}`,
              background: "transparent",
              color: T.ink.dim,
              fontSize: "12px",
              fontFamily: T.font.sans,
              textDecoration: "none",
            }}
          >
            Change password
          </GlobalLink>
        </div>
      </div>
    </div>
  )
}
```

---

## Task 10: Settings — Connections + Danger Zone sections

**Files:**
- Create: `apps/ui/src/app/[locale]/settings/_components/ConnectionsSection.tsx`
- Create: `apps/ui/src/app/[locale]/settings/_components/DangerZoneSection.tsx`

- [ ] **Create ConnectionsSection**

`apps/ui/src/app/[locale]/settings/_components/ConnectionsSection.tsx`:
```tsx
"use client"

import { T } from "@/lib/design-tokens"

// TODO: Fetch real connected accounts via BA listAccounts API when exposed.
// BA stores accounts in the `account` table linked by userId.
// Disconnect via BA revokeSession + unlinkAccount (if BA exposes it).
const PROVIDER_ICONS: Record<string, string> = {
  google: "G",
  github: "GH",
  magic_link: "✉",
}

const DEMO_ACCOUNTS = [
  // TODO: Replace with real BA account data from GET /api/auth/list-accounts or BA server API.
  { provider: "google", identifier: "your@gmail.com", connectedAt: "Connected to SSO link" },
]

export function ConnectionsSection() {
  return (
    <div>
      <h2 style={{ margin: "0 0 6px", fontSize: "16px", fontWeight: 600, color: T.ink.base }}>Connected accounts</h2>
      <p style={{ margin: "0 0 24px", fontSize: "13px", color: T.ink.faint }}>
        Use these providers to sign in faster and show verified affiliations on your profile.
      </p>

      <div
        style={{
          border: `1px solid ${T.border.line}`,
          borderRadius: "12px",
          overflow: "hidden",
        }}
      >
        {DEMO_ACCOUNTS.map((acct, i) => (
          <div
            key={acct.provider}
            style={{
              padding: "14px 20px",
              display: "flex",
              alignItems: "center",
              gap: "12px",
              borderBottom: i < DEMO_ACCOUNTS.length - 1 ? `1px solid ${T.border.line}` : "none",
            }}
          >
            <div
              style={{
                width: "32px",
                height: "32px",
                borderRadius: "8px",
                background: "rgba(255,255,255,0.06)",
                border: `1px solid ${T.border.line}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: T.font.mono,
                fontSize: "11px",
                fontWeight: 600,
                color: T.ink.dim,
                flexShrink: 0,
              }}
            >
              {PROVIDER_ICONS[acct.provider] ?? acct.provider[0].toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: "13px", color: T.ink.base, textTransform: "capitalize" }}>{acct.provider}</p>
              <p style={{ margin: "2px 0 0", fontSize: "11px", color: T.ink.faint, fontFamily: T.font.mono }}>{acct.identifier}</p>
            </div>
            {/* TODO: implement disconnect via BA unlinkAccount */}
            <button
              type="button"
              disabled
              style={{
                padding: "5px 12px",
                borderRadius: "6px",
                border: `1px solid ${T.border.line}`,
                background: "transparent",
                color: T.ink.faint,
                fontSize: "12px",
                fontFamily: T.font.sans,
                cursor: "not-allowed",
                opacity: 0.5,
              }}
            >
              Disconnect
            </button>
          </div>
        ))}
        <div
          style={{
            padding: "14px 20px",
            borderTop: `1px solid ${T.border.line}`,
            fontSize: "12px",
            color: T.ink.faint,
            fontFamily: T.font.mono,
            letterSpacing: ".06em",
          }}
        >
          {/* TODO: show real connected providers once BA listAccounts is wired */}
          Only providers you have authenticated with will appear here.
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Create DangerZoneSection**

`apps/ui/src/app/[locale]/settings/_components/DangerZoneSection.tsx`:
```tsx
"use client"

import { useState } from "react"
import { toast } from "sonner"

import { authClient } from "@/lib/auth-client"
import { T } from "@/lib/design-tokens"
import type { BetterAuthUser } from "@/lib/auth-server"

export function DangerZoneSection({ sessionUser }: { sessionUser: BetterAuthUser }) {
  const [confirming, setConfirming] = useState<string | null>(null)

  const signOut = async () => {
    await authClient.signOut()
    globalThis.location.href = "/"
  }

  return (
    <div>
      <h2 style={{ margin: "0 0 6px", fontSize: "16px", fontWeight: 600, color: T.accent.danger }}>Danger zone</h2>
      <p style={{ margin: "0 0 24px", fontSize: "13px", color: T.ink.faint }}>
        Irreversible actions. We&apos;ll always ask you to confirm before anything is removed.
      </p>

      <div
        style={{
          border: `1px solid rgba(255,100,100,0.2)`,
          borderRadius: "12px",
          overflow: "hidden",
        }}
      >
        {[
          {
            id: "export",
            label: "Export my data",
            desc: "Download a JSON archive of your profile, contributions, and activity history.",
            action: "Request export",
            // TODO: implement data export endpoint
            handler: () => toast.info("Data export — coming soon"),
            destructive: false,
          },
          {
            id: "deactivate",
            label: "Deactivate account",
            desc: "Hide your profile and pause notifications. Reversible.",
            action: "Deactivate",
            // TODO: implement deactivate — set profileVisibility to private + sign out
            handler: () => toast.info("Deactivation — coming soon"),
            destructive: true,
          },
          {
            id: "delete",
            label: "Delete account",
            desc: "Permanently remove your account and anonymise your contributions. This cannot be undone.",
            action: "Delete account",
            // TODO: implement full account deletion via BA + Strapi cascade
            handler: () => toast.info("Account deletion — coming soon. Please contact support."),
            destructive: true,
          },
        ].map((item, i, arr) => (
          <div
            key={item.id}
            style={{
              padding: "16px 20px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "16px",
              borderBottom: i < arr.length - 1 ? `1px solid rgba(255,100,100,0.12)` : "none",
            }}
          >
            <div>
              <p style={{ margin: 0, fontSize: "13px", color: item.destructive ? "rgba(255,140,140,0.9)" : T.ink.base }}>{item.label}</p>
              <p style={{ margin: "2px 0 0", fontSize: "12px", color: T.ink.faint }}>{item.desc}</p>
            </div>
            <button
              type="button"
              onClick={item.handler}
              style={{
                padding: "6px 14px",
                borderRadius: "6px",
                border: `1px solid ${item.destructive ? "rgba(255,100,100,0.3)" : T.border.line}`,
                background: item.destructive ? "rgba(255,100,100,0.06)" : "transparent",
                color: item.destructive ? "rgba(255,140,140,0.8)" : T.ink.dim,
                fontSize: "12px",
                fontFamily: T.font.sans,
                cursor: "pointer",
                flexShrink: 0,
                whiteSpace: "nowrap",
              }}
            >
              {item.action}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
```

---

## Task 11: Wire navigation — settings link in user menu

**Files:**
- Modify: `apps/ui/src/components/global/GlobalLoggedUserMenu.tsx`

- [ ] **Add Settings and Profile links to dropdown**

In `GlobalLoggedUserMenu.tsx`, update the dropdown content section to add a profile link. Find the identity header block and add before the Settings item:

```tsx
// After the identity header div, before the first DropdownMenuSeparator:
<DropdownMenuItem asChild className="cursor-pointer text-white/65 hover:text-white focus:text-white">
  <Link
    href="/profile"
    className="flex w-full items-center gap-2 px-3 py-2 text-[13px]"
  >
    <UserIcon className="size-3.5 opacity-60" />
    <span>View profile</span>
  </Link>
</DropdownMenuItem>
```

Also add `UserIcon` to the lucide import:
```tsx
import { LogOutIcon, UserIcon, UserRoundCogIcon } from "lucide-react"
```

---

## Self-Review Against Spec

| Spec requirement | Task covering it |
|-----------------|-----------------|
| Strapi user-profile content type | Task 1 |
| Auto-create profile on registration | Task 2 |
| Profile upsert bridge endpoint | Task 2 |
| Pass baUserId from auth.ts | Task 2 |
| UserProfile + Badge types | Task 3 |
| Badge catalog (16 badges) | Task 3 |
| Profile mutation hook | Task 3 |
| GET/PUT /api/profile/me | Task 4 |
| GET /api/profile/[username] | Task 4 |
| GET/PUT /api/profile/me/notifications | Task 4 |
| GET/DELETE /api/profile/me/sessions | Task 4 |
| Own-profile redirect | Task 5 |
| Profile RSC page | Task 5 |
| ProfileHero (avatar, name, bio, affiliation, website, verified badge) | Task 6 |
| Tab navigation | Task 7 |
| Overview tab | Task 7 |
| Contributions tab (TODO stub) | Task 7 |
| Following tab (TODO stub) | Task 7 |
| Collections tab (TODO stub) | Task 7 |
| Badges tab (static catalog) | Task 7 |
| Activity tab (TODO stub) | Task 7 |
| Settings RSC with auth guard | Task 8 |
| Settings shell (sidebar + routing) | Task 8 |
| Public profile form (all fields) | Task 8 |
| Notifications toggles | Task 9 |
| Security (sessions list + revoke + change-password) | Task 9 |
| Connected accounts | Task 10 |
| Danger zone | Task 10 |
| Profile + Settings links in user menu | Task 11 |
