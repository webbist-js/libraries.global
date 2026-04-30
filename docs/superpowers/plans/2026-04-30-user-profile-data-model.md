# User Profile Data Model — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tighten the user-profile data model by replacing ad-hoc string fields with proper Strapi types (media field for avatar, repeatable components for languages, manyToMany relation for interests), rename `role` → `jobTitle` for clarity, fix missing `followedLibraries` populate in the "me" endpoint, and update every consumer in the Strapi controllers, Next.js API routes, TypeScript types, and frontend components.

**Architecture:** Changes flow in one direction — Strapi schema first, then the bridge controller that owns all write paths, then the Next.js API proxy routes, then the TypeScript types, then the frontend components. No new endpoints are introduced; the avatar upload route is adjusted to pass a file ID integer instead of a URL string, and `upsertProfile` switches from `strapi.db.query()` to the Document Service API (`strapi.documents()`) for the update path so repeatable components and relation sets are handled natively.

**Tech Stack:** Strapi v5 (Document Service API, `strapi.documents()`), Next.js 15 App Router, TypeScript, React

---

## File map

| Action | Path                                                                           |
| ------ | ------------------------------------------------------------------------------ |
| Create | `apps/strapi/src/components/profile/language-entry.json`                       |
| Modify | `apps/strapi/src/api/user-profile/content-types/user-profile/schema.json`      |
| Modify | `apps/strapi/src/api/auth-bridge/controllers/auth-bridge.ts`                   |
| Modify | `apps/strapi/src/api/user-profile/controllers/user-profile.ts`                 |
| Modify | `apps/ui/src/app/api/profile/me/route.ts`                                      |
| Modify | `apps/ui/src/app/api/profile/me/avatar/route.ts`                               |
| Modify | `apps/ui/src/lib/types/profile.ts`                                             |
| Modify | `apps/ui/src/app/[locale]/profile/[username]/_components/ProfileHero.tsx`      |
| Modify | `apps/ui/src/app/[locale]/profile/[username]/_components/tabs/OverviewTab.tsx` |
| Modify | `apps/ui/src/app/[locale]/settings/_components/PublicProfileSection.tsx`       |

---

### Task 1: Create the language-entry Strapi component

**Files:**

- Create: `apps/strapi/src/components/profile/language-entry.json`

- [ ] **Step 1: Create the component directory and JSON file**

```bash
mkdir -p apps/strapi/src/components/profile
```

Write `apps/strapi/src/components/profile/language-entry.json`:

```json
{
  "collectionName": "components_profile_language_entries",
  "info": {
    "displayName": "Language Entry",
    "icon": "earth"
  },
  "options": {},
  "attributes": {
    "code": {
      "type": "string",
      "required": true
    },
    "proficiency": {
      "type": "enumeration",
      "enum": ["native", "fluent", "conversational"],
      "required": true
    }
  }
}
```

- [ ] **Step 2: Verify the file exists and is valid JSON**

```bash
node -e "JSON.parse(require('fs').readFileSync('apps/strapi/src/components/profile/language-entry.json','utf8')); console.log('valid')"
```

Expected: `valid`

- [ ] **Step 3: Commit**

```bash
git add apps/strapi/src/components/profile/language-entry.json
git commit -m "feat(strapi): add profile/language-entry repeatable component"
```

---

### Task 2: Update the user-profile schema

**Files:**

- Modify: `apps/strapi/src/api/user-profile/content-types/user-profile/schema.json`

- [ ] **Step 1: Replace the schema**

Write the full content of `apps/strapi/src/api/user-profile/content-types/user-profile/schema.json`:

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
    "baUserId": { "type": "string", "unique": true, "required": true },
    "username": { "type": "string", "unique": true },
    "firstName": { "type": "string" },
    "lastName": { "type": "string" },
    "bio": { "type": "text" },
    "pronouns": {
      "type": "enumeration",
      "enum": ["he_him", "she_her", "they_them", "other", "prefer_not_to_say"]
    },
    "affiliation": { "type": "string" },
    "affiliationType": {
      "type": "enumeration",
      "enum": [
        "reader",
        "librarian",
        "researcher",
        "archivist",
        "educator",
        "other"
      ]
    },
    "jobTitle": { "type": "string" },
    "city": { "type": "string" },
    "country": { "type": "string" },
    "timezone": { "type": "string" },
    "website": { "type": "string" },
    "orcid": { "type": "string" },
    "mastodon": { "type": "string" },
    "linkedin": { "type": "string" },
    "avatar": {
      "type": "media",
      "multiple": false,
      "required": false,
      "allowedTypes": ["images"]
    },
    "profileVisibility": {
      "type": "enumeration",
      "enum": ["public", "limited", "private"],
      "default": "public"
    },
    "isVerifiedLibrarian": { "type": "boolean", "default": false },
    "contributorNumber": { "type": "integer" },
    "languages": {
      "type": "component",
      "component": "profile.language-entry",
      "repeatable": true
    },
    "interests": {
      "type": "relation",
      "relation": "manyToMany",
      "target": "plugin::topics.topic"
    },
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
    },
    "contributorRole": {
      "type": "enumeration",
      "enum": [
        "reader",
        "contributor",
        "verified_librarian",
        "wiki_editor",
        "editorial_board"
      ],
      "default": "reader"
    },
    "followedLibraries": {
      "type": "relation",
      "relation": "manyToMany",
      "target": "api::library.library"
    },
    "points": { "type": "integer", "default": 0 },
    "pointsThisMonth": { "type": "integer", "default": 0 },
    "tier": { "type": "string", "default": "Reader" },
    "streak": { "type": "integer", "default": 0 },
    "lastActivityDate": { "type": "string" }
  }
}
```

Key changes from the previous schema:

- `avatarUrl` and `avatarStrapiId` removed; replaced by `avatar` media field
- `languages` changed from `json` to `component` (`profile.language-entry`, repeatable)
- `interests` changed from `json` to `manyToMany` relation targeting `plugin::topics.topic`
- `role` renamed to `jobTitle`
- `contributorRole` default changed from `"contributor"` to `"reader"`

- [ ] **Step 2: Verify JSON is valid**

```bash
node -e "JSON.parse(require('fs').readFileSync('apps/strapi/src/api/user-profile/content-types/user-profile/schema.json','utf8')); console.log('valid')"
```

Expected: `valid`

- [ ] **Step 3: Commit**

```bash
git add apps/strapi/src/api/user-profile/content-types/user-profile/schema.json
git commit -m "feat(strapi): update user-profile schema — avatar media, languages component, interests relation, jobTitle rename"
```

---

### Task 3: Update the auth-bridge controller

**Files:**

- Modify: `apps/strapi/src/api/auth-bridge/controllers/auth-bridge.ts`

This is the most complex task. The `upsertProfile` function needs to:

1. Remove `avatarUrl`/`avatarStrapiId` from allowed fields; add `avatarFileId` (integer)
2. Rename `role` → `jobTitle` in the allowed list
3. Switch the **update** path from `strapi.db.query().update()` to `strapi.documents().update()` so repeatable components (`languages`) and relation sets (`interests`) are handled correctly
4. Translate `interests: string[]` → `{ set: [{ documentId }] }` before passing to Document Service
5. Translate `avatarFileId: number` → `avatar: fileId` for the media relation

`deleteProfile` needs:

- Remove `avatarUrl: null, avatarStrapiId: null` → replace with `avatar: null`
- Remove `role: null` → replace with `jobTitle: null`

- [ ] **Step 1: Replace the full controller file**

Write `apps/strapi/src/api/auth-bridge/controllers/auth-bridge.ts`:

```typescript
export default {
  async syncUser(ctx: any) {
    const serviceSecret = ctx.request.header["x-service-secret"]
    if (
      !process.env.STRAPI_BRIDGE_SECRET ||
      serviceSecret !== process.env.STRAPI_BRIDGE_SECRET
    ) {
      return ctx.unauthorized("Invalid or missing service secret")
    }

    const { email, name, provider, baUserId } = ctx.request.body as {
      email?: string
      name?: string
      provider?: string
      baUserId?: string
    }
    if (!email || !provider)
      return ctx.badRequest("Missing required fields: email, provider")

    // Find or create Strapi users-permissions user
    let user = await strapi
      .query("plugin::users-permissions.user")
      .findOne({ where: { email } })
    if (!user) {
      const authenticatedRole = await strapi
        .query("plugin::users-permissions.role")
        .findOne({ where: { type: "authenticated" } })
      if (!authenticatedRole)
        return ctx.internalServerError('"authenticated" role not found')
      user = await strapi.query("plugin::users-permissions.user").create({
        data: {
          email,
          username: email,
          provider,
          confirmed: true,
          blocked: false,
          role: authenticatedRole.id,
        },
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
        const baseUsername = email
          .split("@")[0]
          .replace(/[^a-z0-9_]/gi, "")
          .toLowerCase()
        const suffix = Math.floor(Math.random() * 9000 + 1000)
        // Count existing profiles for contributor number
        const count = await strapi
          .query("api::user-profile.user-profile")
          .count()
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

    const jwt = strapi
      .plugin("users-permissions")
      .service("jwt")
      .issue({ id: user.id })

    return ctx.send({
      user: { id: user.id, email: user.email, username: user.username },
      jwt,
    })
  },

  async upsertProfile(ctx: any) {
    const serviceSecret = ctx.request.header["x-service-secret"]
    if (
      !process.env.STRAPI_BRIDGE_SECRET ||
      serviceSecret !== process.env.STRAPI_BRIDGE_SECRET
    ) {
      return ctx.unauthorized("Invalid or missing service secret")
    }

    const { baUserId, ...fields } = ctx.request.body as {
      baUserId: string
      [k: string]: unknown
    }
    if (!baUserId) return ctx.badRequest("Missing baUserId")

    // Scalar fields the user is allowed to set directly.
    // Trust-level fields (isVerifiedLibrarian, contributorRole) are written
    // exclusively by the moderation service on claim approval.
    const scalarFields = [
      "username",
      "firstName",
      "lastName",
      "bio",
      "pronouns",
      "affiliation",
      "affiliationType",
      "jobTitle",
      "city",
      "country",
      "timezone",
      "website",
      "orcid",
      "mastodon",
      "linkedin",
      "profileVisibility",
      "notifPrefs",
    ]

    const data: Record<string, unknown> = {}
    for (const key of scalarFields) {
      if (key in fields) data[key] = fields[key] === "" ? null : fields[key]
    }

    // languages: passed as [{ code, proficiency }] — Document Service writes
    // repeatable components directly from the array.
    if ("languages" in fields) {
      data.languages = Array.isArray(fields.languages) ? fields.languages : []
    }

    // interests: passed as string[] of topic documentIds — translate to
    // Document Service relation set syntax.
    if ("interests" in fields) {
      const ids = Array.isArray(fields.interests)
        ? (fields.interests as string[])
        : []
      data.interests = { set: ids.map((documentId) => ({ documentId })) }
    }

    // avatarFileId: integer ID of an already-uploaded Strapi file.
    // Passed by the avatar upload route after a successful /api/upload call.
    if ("avatarFileId" in fields && fields.avatarFileId != null) {
      data.avatar = Number(fields.avatarFileId)
    }

    const existing = await strapi
      .query("api::user-profile.user-profile")
      .findOne({ where: { baUserId } })

    if (!existing) {
      // Create path: use db.query (no relational data at creation time)
      await strapi
        .query("api::user-profile.user-profile")
        .create({ data: { baUserId, ...data } })
    } else {
      // Update path: use Document Service so components + relations are handled
      // correctly by Strapi v5's built-in mechanisms.
      await strapi.documents("api::user-profile.user-profile").update({
        documentId: existing.documentId,
        data,
      })
    }

    const updated = await strapi
      .query("api::user-profile.user-profile")
      .findOne({
        where: { baUserId },
        populate: {
          avatar: true,
          languages: true,
          interests: true,
          followedLibraries: true,
        },
      })
    const { baUserId: _id, ...safe } = updated

    return ctx.send({ data: safe })
  },

  async followStatus(ctx: any) {
    const serviceSecret = ctx.request.header["x-service-secret"]
    if (
      !process.env.STRAPI_BRIDGE_SECRET ||
      serviceSecret !== process.env.STRAPI_BRIDGE_SECRET
    ) {
      return ctx.unauthorized("Invalid or missing service secret")
    }

    const { baUserId, libraryDocumentId } = ctx.query as {
      baUserId?: string
      libraryDocumentId?: string
    }
    if (!baUserId || !libraryDocumentId)
      return ctx.badRequest("Missing baUserId or libraryDocumentId")

    const profile = await strapi.db
      .query("api::user-profile.user-profile")
      .findOne({ where: { baUserId }, populate: { followedLibraries: true } })
    if (!profile) return ctx.send({ following: false })

    const following = (profile.followedLibraries ?? []).some(
      (lib: any) => lib.documentId === libraryDocumentId
    )

    return ctx.send({ following })
  },

  async deleteProfile(ctx: any) {
    const serviceSecret = ctx.request.header["x-service-secret"]
    if (
      !process.env.STRAPI_BRIDGE_SECRET ||
      serviceSecret !== process.env.STRAPI_BRIDGE_SECRET
    ) {
      return ctx.unauthorized("Invalid or missing service secret")
    }

    const { baUserId, email } = ctx.request.body as {
      baUserId?: string
      email?: string
    }
    if (!baUserId) return ctx.badRequest("Missing baUserId")

    const profile = await strapi
      .query("api::user-profile.user-profile")
      .findOne({ where: { baUserId } })

    if (profile) {
      const anonUsername = `deleted-${profile.contributorNumber ?? profile.id}`
      await strapi.query("api::user-profile.user-profile").update({
        where: { baUserId },
        data: {
          username: anonUsername,
          firstName: "Deleted",
          lastName: "User",
          bio: null,
          pronouns: null,
          affiliation: null,
          affiliationType: null,
          jobTitle: null,
          city: null,
          country: null,
          timezone: null,
          website: null,
          orcid: null,
          mastodon: null,
          linkedin: null,
          avatar: null,
          profileVisibility: "private",
          baUserId: `deleted-${baUserId}`,
        },
      })
    }

    const upUser = email
      ? await strapi
          .query("plugin::users-permissions.user")
          .findOne({ where: { email } })
      : null
    if (upUser) {
      await strapi
        .query("plugin::users-permissions.user")
        .delete({ where: { id: upUser.id } })
    }

    return ctx.send({ ok: true })
  },

  async createAffiliation(ctx: any) {
    const serviceSecret = ctx.request.header["x-service-secret"]
    if (
      !process.env.STRAPI_BRIDGE_SECRET ||
      serviceSecret !== process.env.STRAPI_BRIDGE_SECRET
    ) {
      return ctx.unauthorized("Invalid or missing service secret")
    }

    const { baUserId, entityRef, role, department, verificationMethod } = ctx
      .request.body as {
      baUserId?: string
      entityRef?: string
      role?: string
      department?: string
      verificationMethod?: string
    }
    if (!baUserId || !entityRef)
      return ctx.badRequest("Missing baUserId or entityRef")

    const library = await strapi.db
      .query("api::library.library")
      .findOne({ where: { entityRef } })

    const affiliationData: Record<string, unknown> = {
      baUserId,
      role: role ?? null,
      department: department ?? null,
      verificationMethod: verificationMethod ?? "contact_us",
    }
    if (library) {
      affiliationData.library = { connect: [{ id: library.id }] }
    }
    await strapi
      .documents("api::library-affiliation.library-affiliation")
      .create({ data: affiliationData as any })

    const profile = await strapi.db
      .query("api::user-profile.user-profile")
      .findOne({ where: { baUserId } })
    if (profile) {
      await strapi.db.query("api::user-profile.user-profile").update({
        where: { id: profile.id },
        data: {
          isVerifiedLibrarian: true,
          contributorRole: "verified_librarian",
        },
      })
    }

    return ctx.send({ ok: true })
  },

  async affiliationCount(ctx: any) {
    const serviceSecret = ctx.request.header["x-service-secret"]
    if (
      !process.env.STRAPI_BRIDGE_SECRET ||
      serviceSecret !== process.env.STRAPI_BRIDGE_SECRET
    ) {
      return ctx.unauthorized("Invalid or missing service secret")
    }

    const { entityRef } = ctx.query as { entityRef?: string }
    if (!entityRef) return ctx.badRequest("Missing entityRef")

    const affiliations = await strapi.db
      .query("api::library-affiliation.library-affiliation")
      .findMany({ where: {}, populate: { library: true } })

    const count = affiliations.filter(
      (a: any) => a.library?.entityRef === entityRef
    ).length

    return ctx.send({ count })
  },

  async claimStatus(ctx: any) {
    const serviceSecret = ctx.request.header["x-service-secret"]
    if (
      !process.env.STRAPI_BRIDGE_SECRET ||
      serviceSecret !== process.env.STRAPI_BRIDGE_SECRET
    ) {
      return ctx.unauthorized("Invalid or missing service secret")
    }

    const { baUserId, entityRef } = ctx.query as {
      baUserId?: string
      entityRef?: string
    }
    if (!baUserId || !entityRef)
      return ctx.badRequest("Missing baUserId or entityRef")

    const affiliations = await strapi.db
      .query("api::library-affiliation.library-affiliation")
      .findMany({ where: { baUserId }, populate: { library: true } })

    const match = affiliations.find(
      (a: any) => a.library?.entityRef === entityRef
    )

    const profile = await strapi.db
      .query("api::user-profile.user-profile")
      .findOne({ where: { baUserId } })

    return ctx.send({
      isVerifiedLibrarian: !!(profile?.isVerifiedLibrarian && match),
      claimedLibraryEntityRef: match ? entityRef : null,
    })
  },

  async getUserAffiliations(ctx: any) {
    const serviceSecret = ctx.request.header["x-service-secret"]
    if (
      !process.env.STRAPI_BRIDGE_SECRET ||
      serviceSecret !== process.env.STRAPI_BRIDGE_SECRET
    ) {
      return ctx.unauthorized("Invalid or missing service secret")
    }

    const { baUserId } = ctx.query as { baUserId?: string }
    if (!baUserId) return ctx.badRequest("Missing baUserId")

    const affiliations = await strapi.db
      .query("api::library-affiliation.library-affiliation")
      .findMany({ where: { baUserId }, populate: { library: true } })

    const entityRefs = affiliations
      .map((a: any) => a.library?.entityRef)
      .filter(Boolean) as string[]

    return ctx.send({ entityRefs })
  },

  async toggleFollow(ctx: any) {
    const serviceSecret = ctx.request.header["x-service-secret"]
    if (
      !process.env.STRAPI_BRIDGE_SECRET ||
      serviceSecret !== process.env.STRAPI_BRIDGE_SECRET
    ) {
      return ctx.unauthorized("Invalid or missing service secret")
    }

    const { baUserId, libraryDocumentId, action } = ctx.request.body as {
      baUserId?: string
      libraryDocumentId?: string
      action?: "follow" | "unfollow"
    }
    if (!baUserId || !libraryDocumentId || !action)
      return ctx.badRequest("Missing baUserId, libraryDocumentId, or action")

    const profile = await strapi.db
      .query("api::user-profile.user-profile")
      .findOne({ where: { baUserId } })
    if (!profile) return ctx.notFound("Profile not found")

    const library = await strapi.db
      .query("api::library.library")
      .findOne({ where: { documentId: libraryDocumentId } })
    if (!library) return ctx.notFound("Library not found")

    await strapi.db.query("api::user-profile.user-profile").update({
      where: { id: profile.id },
      data: {
        followedLibraries: {
          [action === "follow" ? "connect" : "disconnect"]: [
            { id: library.id },
          ],
        },
      },
    })

    return ctx.send({ following: action === "follow" })
  },
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd apps/strapi && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors (or only pre-existing unrelated errors)

- [ ] **Step 3: Commit**

```bash
git add apps/strapi/src/api/auth-bridge/controllers/auth-bridge.ts
git commit -m "feat(strapi): update auth-bridge upsertProfile — avatar media, languages component, interests relation, jobTitle"
```

---

### Task 4: Update user-profile controller populate

**Files:**

- Modify: `apps/strapi/src/api/user-profile/controllers/user-profile.ts`

The `findByUsername` handler currently only populates `followedLibraries`. It needs to also populate `avatar`, `languages`, and `interests` so the public profile page has full data.

- [ ] **Step 1: Update the controller**

Write `apps/strapi/src/api/user-profile/controllers/user-profile.ts`:

```typescript
import { factories } from "@strapi/strapi"

export default factories.createCoreController(
  "api::user-profile.user-profile",
  () => ({
    async findByUsername(ctx: any) {
      const { username } = ctx.params as { username: string }
      const profile = await strapi
        .query("api::user-profile.user-profile")
        .findOne({
          where: { username },
          populate: {
            avatar: true,
            languages: true,
            interests: true,
            followedLibraries: true,
          },
        })
      if (!profile) return ctx.notFound("Profile not found")

      if (profile.profileVisibility === "private") {
        return ctx.notFound("Profile not found")
      }

      const {
        baUserId: _baUserId,
        notifPrefs: _notifPrefs,
        contributorNumber: _contribNum,
        ...safe
      } = profile

      if (profile.profileVisibility === "limited") {
        const {
          website,
          orcid,
          mastodon,
          linkedin,
          city,
          country,
          timezone,
          ...limited
        } = safe

        return ctx.send({ data: limited })
      }

      return ctx.send({ data: safe })
    },
  })
)
```

- [ ] **Step 2: Commit**

```bash
git add apps/strapi/src/api/user-profile/controllers/user-profile.ts
git commit -m "feat(strapi): populate avatar, languages, interests in findByUsername"
```

---

### Task 5: Update Next.js /api/profile/me route

**Files:**

- Modify: `apps/ui/src/app/api/profile/me/route.ts`

Two changes:

1. **GET**: Add `populate` query params so `avatar`, `languages`, `interests`, and `followedLibraries` are returned (currently none of these are populated here)
2. **PUT**: Remove `avatarUrl`/`avatarStrapiId` from the allowed list; add `avatarFileId`; rename `role` → `jobTitle`

- [ ] **Step 1: Update the route file**

Write `apps/ui/src/app/api/profile/me/route.ts`:

```typescript
import { headers } from "next/headers"
import { NextResponse } from "next/server"

import { auth } from "@/lib/auth"

const STRAPI = process.env.STRAPI_URL ?? "http://127.0.0.1:1337"
const SECRET = process.env.STRAPI_BRIDGE_SECRET
const API_TOKEN = process.env.STRAPI_REST_READONLY_API_KEY

async function getStrapiProfile(baUserId: string) {
  try {
    const params = new URLSearchParams({
      "filters[baUserId][$eq]": baUserId,
      "populate[avatar]": "*",
      "populate[languages]": "*",
      "populate[interests][fields][0]": "name",
      "populate[interests][fields][1]": "slug",
      "populate[interests][fields][2]": "status",
      "populate[followedLibraries][fields][0]": "name",
      "populate[followedLibraries][fields][1]": "slug",
      "populate[followedLibraries][fields][2]": "libraryType",
    })
    const res = await fetch(
      `${STRAPI}/api/user-profiles?${params.toString()}`,
      {
        cache: "no-store",
        headers: API_TOKEN ? { Authorization: `Bearer ${API_TOKEN}` } : {},
      }
    )
    if (!res.ok) return null
    const json = (await res.json()) as { data?: Record<string, unknown>[] }

    return json.data?.[0] ?? null
  } catch {
    return null
  }
}

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const profile = await getStrapiProfile(session.user.id)
  if (!profile)
    return NextResponse.json({ error: "Profile not found" }, { status: 404 })

  return NextResponse.json({ data: profile })
}

export async function PUT(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const allowed = [
    "username",
    "firstName",
    "lastName",
    "bio",
    "pronouns",
    "affiliation",
    "affiliationType",
    "jobTitle",
    "city",
    "country",
    "timezone",
    "website",
    "orcid",
    "mastodon",
    "linkedin",
    "profileVisibility",
    "notifPrefs",
    "languages",
    "interests",
    "avatarFileId",
  ]
  const data: Record<string, unknown> = { baUserId: session.user.id }
  for (const key of allowed) {
    if (key in body) {
      data[key] = body[key] === "" ? null : body[key]
    }
  }

  if (!SECRET)
    return NextResponse.json(
      { error: "Bridge not configured" },
      { status: 500 }
    )
  const res = await fetch(`${STRAPI}/api/auth-bridge/upsert-profile`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Service-Secret": SECRET },
    body: JSON.stringify(data),
  })
  if (!res.ok)
    return NextResponse.json(
      { error: "Failed to update profile" },
      { status: 500 }
    )
  const json = await res.json()

  return NextResponse.json(json)
}

export async function DELETE() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  if (!SECRET)
    return NextResponse.json(
      { error: "Bridge not configured" },
      { status: 500 }
    )

  const anonymiseRes = await fetch(`${STRAPI}/api/auth-bridge/delete-profile`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Service-Secret": SECRET,
    },
    body: JSON.stringify({
      baUserId: session.user.id,
      email: session.user.email,
    }),
  })
  if (!anonymiseRes.ok) {
    return NextResponse.json(
      { error: "Failed to remove profile data" },
      { status: 500 }
    )
  }

  try {
    await auth.api.deleteUser({ headers: await headers() })
  } catch (err) {
    console.warn("[deleteUser] BA deletion error (non-fatal):", err)
  }

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/ui/src/app/api/profile/me/route.ts
git commit -m "feat(ui): profile/me — populate avatar/languages/interests/followedLibraries, jobTitle allowed field"
```

---

### Task 6: Update the avatar upload route

**Files:**

- Modify: `apps/ui/src/app/api/profile/me/avatar/route.ts`

Instead of passing `avatarUrl` + `avatarStrapiId` (strings) to `upsertProfile`, pass `avatarFileId` (integer). The bridge controller will connect the file to the `avatar` media relation.

- [ ] **Step 1: Update the route file**

Write `apps/ui/src/app/api/profile/me/avatar/route.ts`:

```typescript
import { headers } from "next/headers"
import { NextResponse } from "next/server"

import { auth } from "@/lib/auth"

const STRAPI = process.env.STRAPI_URL ?? "http://127.0.0.1:1337"
const SECRET = process.env.STRAPI_BRIDGE_SECRET

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  if (!SECRET)
    return NextResponse.json(
      { error: "Bridge not configured" },
      { status: 500 }
    )

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }
  const file = formData.get("file") as File | null
  if (!file)
    return NextResponse.json({ error: "No file provided" }, { status: 400 })

  if (file.size > 5 * 1024 * 1024)
    return NextResponse.json(
      { error: "File too large (max 5 MB)" },
      { status: 400 }
    )

  const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"]
  if (!allowed.includes(file.type))
    return NextResponse.json({ error: "Invalid file type" }, { status: 400 })

  // Upload file to Strapi media library
  const apiToken = process.env.STRAPI_REST_READONLY_API_KEY
  const strapiForm = new FormData()
  strapiForm.append("files", file, file.name)

  const uploadRes = await fetch(`${STRAPI}/api/upload`, {
    method: "POST",
    headers: apiToken ? { Authorization: `Bearer ${apiToken}` } : {},
    body: strapiForm,
  })
  if (!uploadRes.ok)
    return NextResponse.json({ error: "Upload failed" }, { status: 500 })

  const uploaded = (await uploadRes.json()) as { id: number; url: string }[]
  const first = uploaded[0]
  if (!first)
    return NextResponse.json(
      { error: "Upload returned no file" },
      { status: 500 }
    )

  const { id, url } = first
  const absoluteUrl = url.startsWith("http") ? url : `${STRAPI}${url}`

  // Connect the uploaded file to the user's profile avatar media field
  const profileRes = await fetch(`${STRAPI}/api/auth-bridge/upsert-profile`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Service-Secret": SECRET },
    body: JSON.stringify({
      baUserId: session.user.id,
      avatarFileId: id,
    }),
  })
  if (!profileRes.ok)
    return NextResponse.json(
      { error: "Profile update failed" },
      { status: 500 }
    )

  return NextResponse.json({ url: absoluteUrl })
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/ui/src/app/api/profile/me/avatar/route.ts
git commit -m "feat(ui): avatar upload — pass avatarFileId to bridge instead of URL strings"
```

---

### Task 7: Update frontend TypeScript types

**Files:**

- Modify: `apps/ui/src/lib/types/profile.ts`

Changes:

- Replace `avatarUrl` + `avatarStrapiId` with `avatar?: { id: number; url: string; formats?: Record<string, { url: string }> } | null`
- Replace `role?: string | null` with `jobTitle?: string | null`
- Replace `interests?: string[]` with `interests?: { documentId: string; name: string; slug: string }[]`

- [ ] **Step 1: Update the types file**

Write `apps/ui/src/lib/types/profile.ts`:

```typescript
export type FollowedLibrary = {
  id: number
  documentId: string
  name: string
  slug: string
  libraryType?: string | null
}

export type AvatarMedia = {
  id: number
  url: string
  formats?: Record<string, { url: string }>
}

export type InterestTopic = {
  documentId: string
  name: string
  slug: string
}

export type UserProfile = {
  id: number
  username: string
  firstName: string
  lastName: string
  bio?: string | null
  pronouns?:
    | "he_him"
    | "she_her"
    | "they_them"
    | "other"
    | "prefer_not_to_say"
    | null
  affiliation?: string | null
  affiliationType?:
    | "reader"
    | "librarian"
    | "researcher"
    | "archivist"
    | "educator"
    | "other"
    | null
  jobTitle?: string | null
  city?: string | null
  country?: string | null
  timezone?: string | null
  website?: string | null
  orcid?: string | null
  mastodon?: string | null
  linkedin?: string | null
  avatar?: AvatarMedia | null
  profileVisibility: "public" | "limited" | "private"
  isVerifiedLibrarian: boolean
  contributorNumber?: number | null
  languages?: LanguageEntry[]
  interests?: InterestTopic[]
  notifPrefs: NotifPrefs
  followedLibraries?: FollowedLibrary[]
  points?: number | null
  pointsThisMonth?: number | null
  tier?: string | null
  streak?: number | null
  createdAt: string
  updatedAt: string
}

export type LanguageEntry = {
  code: string
  proficiency: "native" | "fluent" | "conversational"
}

export type NotifPrefs = {
  weeklyDigest: boolean
  editsReviewed: boolean
  newFollowers: boolean
  editorialMessages: boolean
  soundOn: boolean
  marketing: boolean
}

export type PublicProfile = Omit<UserProfile, "notifPrefs">

export type Topic = {
  documentId: string
  name: string
  slug: string
  status: "approved" | "pending" | "rejected"
}
```

- [ ] **Step 2: Verify TypeScript picks up the changes**

```bash
cd apps/ui && npx tsc --noEmit 2>&1 | grep -E "error TS" | head -20
```

Expected: Any errors shown are the cascading type errors in the component files we are about to fix (Tasks 8–10), not new unrelated errors.

- [ ] **Step 3: Commit**

```bash
git add apps/ui/src/lib/types/profile.ts
git commit -m "feat(ui): update UserProfile types — avatar media, jobTitle, interests as topic objects"
```

---

### Task 8: Update ProfileHero component

**Files:**

- Modify: `apps/ui/src/app/[locale]/profile/[username]/_components/ProfileHero.tsx`

Two field references to update:

- `profile.avatarUrl` → `profile.avatar?.url`
- `profile.role` → `profile.jobTitle`

- [ ] **Step 1: Fix avatarUrl reference**

In `ProfileHero.tsx`, find:

```tsx
{profile.avatarUrl ? (
  <img
    src={profile.avatarUrl}
```

Replace with:

```tsx
{profile.avatar?.url ? (
  <img
    src={profile.avatar.url}
```

- [ ] **Step 2: Fix role reference**

In `ProfileHero.tsx`, find:

```tsx
{
  profile.role && (
    <span
      style={{
        fontFamily: T.font.mono,
        fontSize: "10px",
        letterSpacing: ".08em",
        color: T.ink.dim,
      }}
    >
      {profile.role}
    </span>
  )
}
```

Replace with:

```tsx
{
  profile.jobTitle && (
    <span
      style={{
        fontFamily: T.font.mono,
        fontSize: "10px",
        letterSpacing: ".08em",
        color: T.ink.dim,
      }}
    >
      {profile.jobTitle}
    </span>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/ui/src/app/[locale]/profile/[username]/_components/ProfileHero.tsx
git commit -m "feat(ui): ProfileHero — avatar.url, jobTitle"
```

---

### Task 9: Update OverviewTab component

**Files:**

- Modify: `apps/ui/src/app/[locale]/profile/[username]/_components/tabs/OverviewTab.tsx`

Two changes:

- `profile.role` → `profile.jobTitle` in the facts array
- `profile.interests?.slice(0, 3).join(" · ")` → `profile.interests?.map(i => i.name).slice(0, 3).join(" · ")`

- [ ] **Step 1: Fix role in facts array**

Find:

```tsx
profile.role ? { label: "Role", value: profile.role } : null,
```

Replace with:

```tsx
profile.jobTitle ? { label: "Role", value: profile.jobTitle } : null,
```

- [ ] **Step 2: Fix interests display**

Find:

```tsx
profile.interests?.length
  ? { label: "Interests", value: profile.interests.slice(0, 3).join(" · ") }
  : null,
```

Replace with:

```tsx
profile.interests?.length
  ? { label: "Interests", value: profile.interests.map((i) => i.name).slice(0, 3).join(" · ") }
  : null,
```

- [ ] **Step 3: Commit**

```bash
git add apps/ui/src/app/[locale]/profile/[username]/_components/tabs/OverviewTab.tsx
git commit -m "feat(ui): OverviewTab — jobTitle, interests names from topic objects"
```

---

### Task 10: Update PublicProfileSection (settings)

**Files:**

- Modify: `apps/ui/src/app/[locale]/settings/_components/PublicProfileSection.tsx`

Three changes:

1. `avatarUrl` form state initialised from `profile?.avatar?.url` instead of `profile?.avatarUrl`
2. `role` form field → `jobTitle` (both in form state, save payload, and discard reset)
3. `interests` form state initialised from `profile?.interests?.map(i => i.documentId)` instead of `profile?.interests` (which was already `string[]` before, but now it's `InterestTopic[]`)

- [ ] **Step 1: Fix form initial state — avatarUrl and role → jobTitle**

Find the `useState` call for `form`:

```tsx
const [form, setForm] = useState({
  firstName: profile?.firstName ?? sessionUser.name.split(" ")[0] ?? "",
  lastName:
    profile?.lastName ?? sessionUser.name.split(" ").slice(1).join(" ") ?? "",
  username: profile?.username ?? "",
  pronouns: profile?.pronouns ?? "",
  bio: profile?.bio ?? "",
  affiliation: profile?.affiliation ?? "",
  affiliationType: profile?.affiliationType ?? "",
  role: profile?.role ?? "",
  city: profile?.city ?? "",
  country: profile?.country ?? "",
  timezone: profile?.timezone ?? "",
  website: profile?.website ?? "",
  orcid: profile?.orcid ?? "",
  mastodon: profile?.mastodon ?? "",
  linkedin: profile?.linkedin ?? "",
  profileVisibility: (profile?.profileVisibility ?? "public") as
    | "public"
    | "limited"
    | "private",
  interests: profile?.interests ?? [],
  avatarUrl: profile?.avatarUrl ?? "",
})
```

Replace with:

```tsx
const [form, setForm] = useState({
  firstName: profile?.firstName ?? sessionUser.name.split(" ")[0] ?? "",
  lastName:
    profile?.lastName ?? sessionUser.name.split(" ").slice(1).join(" ") ?? "",
  username: profile?.username ?? "",
  pronouns: profile?.pronouns ?? "",
  bio: profile?.bio ?? "",
  affiliation: profile?.affiliation ?? "",
  affiliationType: profile?.affiliationType ?? "",
  jobTitle: profile?.jobTitle ?? "",
  city: profile?.city ?? "",
  country: profile?.country ?? "",
  timezone: profile?.timezone ?? "",
  website: profile?.website ?? "",
  orcid: profile?.orcid ?? "",
  mastodon: profile?.mastodon ?? "",
  linkedin: profile?.linkedin ?? "",
  profileVisibility: (profile?.profileVisibility ?? "public") as
    | "public"
    | "limited"
    | "private",
  interests: profile?.interests?.map((i) => i.documentId) ?? [],
  avatarUrl: profile?.avatar?.url ?? "",
})
```

- [ ] **Step 2: Fix handleSave payload**

Find:

```tsx
const payload: Partial<UserProfile> = {
  firstName: form.firstName,
  lastName: form.lastName,
  username: form.username,
  pronouns: form.pronouns as UserProfile["pronouns"],
  bio: form.bio,
  affiliation: form.affiliation,
  affiliationType: form.affiliationType as UserProfile["affiliationType"],
  role: form.role,
  city: form.city,
  country: form.country,
  timezone: form.timezone,
  website: form.website,
  orcid: form.orcid,
  mastodon: form.mastodon,
  linkedin: form.linkedin,
  profileVisibility: form.profileVisibility,
  interests: form.interests,
}
```

Replace with:

```tsx
const payload: Record<string, unknown> = {
  firstName: form.firstName,
  lastName: form.lastName,
  username: form.username,
  pronouns: form.pronouns,
  bio: form.bio,
  affiliation: form.affiliation,
  affiliationType: form.affiliationType,
  jobTitle: form.jobTitle,
  city: form.city,
  country: form.country,
  timezone: form.timezone,
  website: form.website,
  orcid: form.orcid,
  mastodon: form.mastodon,
  linkedin: form.linkedin,
  profileVisibility: form.profileVisibility,
  interests: form.interests,
}
```

- [ ] **Step 3: Fix handleDiscard reset**

Find:

```tsx
setForm({
  firstName: profile?.firstName ?? "",
  lastName: profile?.lastName ?? "",
  username: profile?.username ?? "",
  pronouns: profile?.pronouns ?? "",
  bio: profile?.bio ?? "",
  affiliation: profile?.affiliation ?? "",
  affiliationType: profile?.affiliationType ?? "",
  role: profile?.role ?? "",
  city: profile?.city ?? "",
  country: profile?.country ?? "",
  timezone: profile?.timezone ?? "",
  website: profile?.website ?? "",
  orcid: profile?.orcid ?? "",
  mastodon: profile?.mastodon ?? "",
  linkedin: profile?.linkedin ?? "",
  profileVisibility: profile?.profileVisibility ?? "public",
  interests: profile?.interests ?? [],
  avatarUrl: profile?.avatarUrl ?? "",
})
```

Replace with:

```tsx
setForm({
  firstName: profile?.firstName ?? "",
  lastName: profile?.lastName ?? "",
  username: profile?.username ?? "",
  pronouns: profile?.pronouns ?? "",
  bio: profile?.bio ?? "",
  affiliation: profile?.affiliation ?? "",
  affiliationType: profile?.affiliationType ?? "",
  jobTitle: profile?.jobTitle ?? "",
  city: profile?.city ?? "",
  country: profile?.country ?? "",
  timezone: profile?.timezone ?? "",
  website: profile?.website ?? "",
  orcid: profile?.orcid ?? "",
  mastodon: profile?.mastodon ?? "",
  linkedin: profile?.linkedin ?? "",
  profileVisibility: profile?.profileVisibility ?? "public",
  interests: profile?.interests?.map((i) => i.documentId) ?? [],
  avatarUrl: profile?.avatar?.url ?? "",
})
```

- [ ] **Step 4: Fix the Role label input**

Find:

```tsx
<div>
  <label style={labelStyle}>Role</label>
  <input
    style={inputStyle}
    type="text"
    {...field("role")}
    className="focus:border-[rgba(127,223,255,.4)]"
    placeholder="Senior curator"
  />
</div>
```

Replace with:

```tsx
<div>
  <label style={labelStyle}>Role</label>
  <input
    style={inputStyle}
    type="text"
    {...field("jobTitle")}
    className="focus:border-[rgba(127,223,255,.4)]"
    placeholder="Senior curator"
  />
</div>
```

- [ ] **Step 5: Verify TypeScript compiles with no new errors**

```bash
cd apps/ui && npx tsc --noEmit 2>&1 | grep -E "error TS" | head -20
```

Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add apps/ui/src/app/[locale]/settings/_components/PublicProfileSection.tsx
git commit -m "feat(ui): PublicProfileSection — avatar.url, jobTitle field, interests from documentIds"
```

---

### Task 11: Restart Strapi and smoke-test end-to-end

**Files:** none (runtime verification only)

Strapi must be restarted after schema changes. On restart it will run migrations to add the `avatar` media column, create the `components_profile_language_entries` join table, create the `user_profiles_interests_links` many-to-many table, and drop the old `avatar_url`/`avatar_strapi_id`/`role` columns.

- [ ] **Step 1: Restart Strapi**

```bash
# From the monorepo root
cd apps/strapi && pnpm develop
```

Watch the console for migration errors. Expected: Strapi starts successfully and logs "Strapi started successfully".

- [ ] **Step 2: Verify the profile GET endpoint returns new shape**

Replace `<BA_USER_ID>` with a real baUserId from your test account and `<API_TOKEN>` with `STRAPI_REST_READONLY_API_KEY`:

```bash
curl -s "http://127.0.0.1:1337/api/user-profiles?filters[baUserId][\$eq]=<BA_USER_ID>&populate[avatar]=*&populate[languages]=*&populate[interests][fields][0]=name&populate[followedLibraries][fields][0]=name" \
  -H "Authorization: Bearer <API_TOKEN>" | jq '.data[0] | {avatar, languages, interests, followedLibraries}'
```

Expected response shape:

```json
{
  "avatar": null,
  "languages": [],
  "interests": [],
  "followedLibraries": []
}
```

(All null/empty on a fresh profile — confirms the new fields exist and populate correctly.)

- [ ] **Step 3: Verify the UI settings page loads without errors**

Start the Next.js dev server and navigate to `/settings`. Open DevTools → Console. Expected: no TypeScript or runtime errors, the profile form renders, avatar upload button visible.

- [ ] **Step 4: Test avatar upload**

Upload a profile photo via the Settings page. Expected:

- Preview updates immediately
- DevTools Network: `POST /api/profile/me/avatar` → 200 with `{ url: "http://..." }`
- Refreshing the page shows the avatar persisted

- [ ] **Step 5: Test profile save with jobTitle**

In the Settings page, fill in the Role field (now backed by `jobTitle`). Click Save. Expected:

- `PUT /api/profile/me` → 200
- Navigating to `/profile/<username>` shows the role/title in the hero

- [ ] **Step 6: Test interests save**

Toggle a few interest chips in Settings and save. Expected:

- `PUT /api/profile/me` body contains `"interests": ["<documentId>", ...]`
- The profile page OverviewTab "Interests" fact row shows the topic names

- [ ] **Step 7: Final commit if any fixups were needed**

```bash
git add -p
git commit -m "fix(ui): post-migration smoke-test fixups"
```
