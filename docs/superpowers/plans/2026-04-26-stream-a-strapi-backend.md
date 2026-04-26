# Stream A: Strapi Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the Strapi backend with new user-profile fields, a topics plugin, content-moderation schema updates, and an admin findAll route for submissions.

**Architecture:** All changes are in `apps/strapi/`. The user-profile content type gains new fields for pronouns, affiliation details, verification status, social links, and interests (stored as JSON). A new `topics` plugin provides an approvable taxonomy. The content-moderation plugin gains a `topic_suggestion` submission type, a `verificationMethod` field, an `approveClaim` service method, and a `findAll` admin route. The auth-bridge `upsertProfile` endpoint is updated to accept all new fields.

**Tech Stack:** Strapi v5, TypeScript, `strapi.query()` for API content types, `strapi.documents()` for plugin content types, REST

---

## File Map

**Create:**

- `apps/strapi/src/plugins/topics/strapi-server.ts`
- `apps/strapi/src/plugins/topics/strapi-admin.ts`
- `apps/strapi/src/plugins/topics/server/content-types/index.ts`
- `apps/strapi/src/plugins/topics/server/content-types/topic/schema.json`
- `apps/strapi/src/plugins/topics/server/controllers/index.ts`
- `apps/strapi/src/plugins/topics/server/controllers/topic.ts`
- `apps/strapi/src/plugins/topics/server/services/index.ts`
- `apps/strapi/src/plugins/topics/server/services/topic.ts`
- `apps/strapi/src/plugins/topics/server/routes/index.ts`
- `apps/strapi/src/plugins/topics/admin/src/index.ts`
- `apps/strapi/src/plugins/topics/admin/src/pages/TopicsDashboard.tsx`

**Modify:**

- `apps/strapi/src/api/user-profile/content-types/user-profile/schema.json`
- `apps/strapi/src/api/auth-bridge/controllers/auth-bridge.ts`
- `apps/strapi/src/plugins/content-moderation/server/content-types/submission/schema.json`
- `apps/strapi/src/plugins/content-moderation/server/services/submission.ts`
- `apps/strapi/src/plugins/content-moderation/server/controllers/submission.ts`
- `apps/strapi/src/plugins/content-moderation/server/routes/index.ts`
- `apps/strapi/config/plugins.ts`

---

## Task 1: Extend user-profile schema

**Files:**

- Modify: `apps/strapi/src/api/user-profile/content-types/user-profile/schema.json`

- [ ] **Step 1: Replace schema.json with the extended version**

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
    "role": { "type": "string" },
    "claimedLibraryEntityRef": { "type": "string" },
    "claimedLibraryName": { "type": "string" },
    "claimedLibraryRole": { "type": "string" },
    "claimedLibraryDepartment": { "type": "string" },
    "affiliationVerificationStatus": {
      "type": "enumeration",
      "enum": ["unclaimed", "pending", "verified", "rejected"],
      "default": "unclaimed"
    },
    "affiliationVerificationMethod": {
      "type": "enumeration",
      "enum": ["email_domain", "vouching", "contact_us"]
    },
    "city": { "type": "string" },
    "country": { "type": "string" },
    "timezone": { "type": "string" },
    "website": { "type": "string" },
    "orcid": { "type": "string" },
    "mastodon": { "type": "string" },
    "linkedin": { "type": "string" },
    "avatarUrl": { "type": "string" },
    "avatarStrapiId": { "type": "string" },
    "profileVisibility": {
      "type": "enumeration",
      "enum": ["public", "limited", "private"],
      "default": "public"
    },
    "isVerifiedLibrarian": { "type": "boolean", "default": false },
    "contributorNumber": { "type": "integer" },
    "languages": {
      "type": "json",
      "default": []
    },
    "interests": {
      "type": "json",
      "default": []
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
    }
  }
}
```

- [ ] **Step 2: Restart Strapi and verify no startup errors**

```bash
cd apps/strapi && pnpm develop
```

Expected: Strapi starts, no schema errors. Visit `http://localhost:1337/admin` → Content-Type Builder → User Profile should show the new fields.

- [ ] **Step 3: Commit**

```bash
git add apps/strapi/src/api/user-profile/content-types/user-profile/schema.json
git commit -m "feat(strapi): extend user-profile schema with pronouns, affiliation, verification, social links"
```

---

## Task 2: Expand upsertProfile allowed fields

**Files:**

- Modify: `apps/strapi/src/api/auth-bridge/controllers/auth-bridge.ts`

- [ ] **Step 1: Update the allowedFields array and upsertProfile handler**

Replace the `upsertProfile` method in `auth-bridge.ts`. Find the `allowedFields` array (line 64) and replace through line 68:

```typescript
const allowedFields = [
  "username",
  "firstName",
  "lastName",
  "bio",
  "pronouns",
  "affiliation",
  "affiliationType",
  "role",
  "claimedLibraryEntityRef",
  "claimedLibraryName",
  "claimedLibraryRole",
  "claimedLibraryDepartment",
  "affiliationVerificationStatus",
  "affiliationVerificationMethod",
  "city",
  "country",
  "timezone",
  "website",
  "orcid",
  "mastodon",
  "linkedin",
  "avatarUrl",
  "avatarStrapiId",
  "profileVisibility",
  "notifPrefs",
  "languages",
  "interests",
]
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd apps/strapi && npx tsc --noEmit
```

Expected: No errors in auth-bridge.ts.

- [ ] **Step 3: Test the endpoint manually**

```bash
curl -s -X POST http://localhost:1337/api/auth-bridge/upsert-profile \
  -H "Content-Type: application/json" \
  -H "X-Service-Secret: $STRAPI_BRIDGE_SECRET" \
  -d '{"baUserId":"test-id-123","pronouns":"they_them","affiliationType":"librarian"}' | jq .
```

Expected: `{ data: { pronouns: "they_them", affiliationType: "librarian", ... } }`

- [ ] **Step 4: Commit**

```bash
git add apps/strapi/src/api/auth-bridge/controllers/auth-bridge.ts
git commit -m "feat(strapi): expand upsertProfile to accept all new profile fields"
```

---

## Task 3: Extend content-moderation submission schema

**Files:**

- Modify: `apps/strapi/src/plugins/content-moderation/server/content-types/submission/schema.json`

- [ ] **Step 1: Add topic_suggestion to enum and verificationMethod field**

Replace the entire schema.json:

```json
{
  "kind": "collectionType",
  "collectionName": "cm_submissions",
  "info": {
    "singularName": "submission",
    "pluralName": "submissions",
    "displayName": "Submission"
  },
  "options": { "draftAndPublish": false },
  "pluginOptions": {
    "content-manager": { "visible": true },
    "content-type-builder": { "visible": false }
  },
  "attributes": {
    "submissionType": {
      "type": "enumeration",
      "required": true,
      "enum": [
        "correction",
        "new_library",
        "library_claim",
        "wiki_edit",
        "blog_submission",
        "topic_suggestion"
      ]
    },
    "status": {
      "type": "enumeration",
      "required": true,
      "default": "pending",
      "enum": ["pending", "approved", "rejected", "needs_info"]
    },
    "targetEntityType": {
      "type": "enumeration",
      "enum": [
        "library",
        "country",
        "region",
        "area",
        "wiki_article",
        "blog_article",
        "user_profile"
      ]
    },
    "targetDocumentId": { "type": "string" },
    "targetSlug": { "type": "string" },
    "fields": { "type": "json" },
    "note": { "type": "text" },
    "reviewNote": { "type": "text" },
    "verificationMethod": {
      "type": "enumeration",
      "enum": ["email_domain", "vouching", "contact_us"]
    },
    "submittedByUserId": { "type": "string", "required": true },
    "submittedByEmail": { "type": "string", "required": true },
    "submittedByName": { "type": "string" },
    "reviewedByUserId": { "type": "string" },
    "reviewedAt": { "type": "datetime" }
  }
}
```

- [ ] **Step 2: Restart Strapi and verify no startup errors**

```bash
cd apps/strapi && pnpm develop
```

Expected: Strapi starts without errors.

- [ ] **Step 3: Commit**

```bash
git add apps/strapi/src/plugins/content-moderation/server/content-types/submission/schema.json
git commit -m "feat(strapi): add topic_suggestion and verificationMethod to submission schema"
```

---

## Task 4: Add findAll + approveClaim to content-moderation

**Files:**

- Modify: `apps/strapi/src/plugins/content-moderation/server/services/submission.ts`
- Modify: `apps/strapi/src/plugins/content-moderation/server/controllers/submission.ts`
- Modify: `apps/strapi/src/plugins/content-moderation/server/routes/index.ts`

- [ ] **Step 1: Update submission service with findAll and approveClaim**

Replace `apps/strapi/src/plugins/content-moderation/server/services/submission.ts`:

```typescript
export default ({ strapi }: { strapi: any }) => ({
  async create(data: {
    submissionType: string
    targetEntityType?: string
    targetDocumentId?: string
    targetSlug?: string
    fields?: Record<string, unknown>
    note?: string
    verificationMethod?: string
    submittedByUserId: string
    submittedByEmail: string
    submittedByName?: string
  }) {
    return strapi.documents("plugin::content-moderation.submission").create({
      data: { ...data, status: "pending" },
    })
  },

  async findAll(status?: string) {
    const filters: Record<string, unknown> = {}
    if (status) filters.status = status
    return strapi.documents("plugin::content-moderation.submission").findMany({
      filters,
      sort: { createdAt: "desc" },
      limit: 200,
    })
  },

  async findByUser(userId: string) {
    return strapi.documents("plugin::content-moderation.submission").findMany({
      filters: { submittedByUserId: userId },
      sort: { createdAt: "desc" },
      limit: 100,
    })
  },

  async updateStatus(
    documentId: string,
    status: "approved" | "rejected" | "needs_info",
    reviewedByUserId: string,
    reviewNote?: string
  ) {
    const submission = await strapi
      .documents("plugin::content-moderation.submission")
      .findOne({ documentId })

    const updated = await strapi
      .documents("plugin::content-moderation.submission")
      .update({
        documentId,
        data: { status, reviewedByUserId, reviewNote, reviewedAt: new Date() },
      })

    // Side-effect: if approving a library_claim, update the user profile
    if (
      status === "approved" &&
      submission?.submissionType === "library_claim"
    ) {
      const fields = (submission.fields ?? {}) as Record<string, unknown>
      await strapi.query("api::user-profile.user-profile").update({
        where: { baUserId: submission.submittedByUserId },
        data: {
          claimedLibraryEntityRef: fields.entityRef ?? null,
          claimedLibraryName: fields.name ?? null,
          claimedLibraryRole: fields.role ?? null,
          claimedLibraryDepartment: fields.department ?? null,
          affiliationVerificationStatus: "verified",
          affiliationVerificationMethod:
            submission.verificationMethod ?? "contact_us",
          isVerifiedLibrarian: true,
        },
      })
    }

    // Side-effect: if approving a topic_suggestion, approve the topic
    if (
      status === "approved" &&
      submission?.submissionType === "topic_suggestion"
    ) {
      const fields = (submission.fields ?? {}) as Record<string, unknown>
      if (fields.topicDocumentId) {
        await strapi.documents("plugin::topics.topic").update({
          documentId: fields.topicDocumentId as string,
          data: { status: "approved" },
        })
      }
    }

    // Side-effect: if rejecting a library_claim, mark profile as rejected
    if (
      status === "rejected" &&
      submission?.submissionType === "library_claim"
    ) {
      await strapi.query("api::user-profile.user-profile").update({
        where: { baUserId: submission.submittedByUserId },
        data: { affiliationVerificationStatus: "rejected" },
      })
    }

    return updated
  },
})
```

- [ ] **Step 2: Add findAll handler to submission controller**

Replace `apps/strapi/src/plugins/content-moderation/server/controllers/submission.ts`:

```typescript
export default ({ strapi }: { strapi: any }) => ({
  // GET /api/content-moderation/submissions?status=pending
  async findAll(ctx: any) {
    const { status } = ctx.query as { status?: string }
    const submissions = await strapi
      .plugin("content-moderation")
      .service("submission")
      .findAll(status)
    ctx.body = { data: submissions }
  },

  // POST /api/content-moderation/submissions
  async create(ctx: any) {
    const session = await strapi.betterAuth.api.getSession({
      headers: ctx.request.headers,
    })
    if (!session?.user) {
      return ctx.unauthorized("You must be signed in to submit.")
    }
    const { user } = session
    const {
      submissionType,
      targetEntityType,
      targetDocumentId,
      targetSlug,
      fields,
      note,
      verificationMethod,
    } = ctx.request.body as Record<string, unknown>

    if (!submissionType) {
      return ctx.badRequest("submissionType is required")
    }

    const submission = await strapi
      .plugin("content-moderation")
      .service("submission")
      .create({
        submissionType,
        targetEntityType,
        targetDocumentId,
        targetSlug,
        fields,
        note,
        verificationMethod,
        submittedByUserId: user.id,
        submittedByEmail: user.email,
        submittedByName: user.name,
      })

    ctx.body = { data: submission }
  },

  // GET /api/content-moderation/submissions/my
  async findMine(ctx: any) {
    const session = await strapi.betterAuth.api.getSession({
      headers: ctx.request.headers,
    })
    if (!session?.user) {
      return ctx.unauthorized("You must be signed in.")
    }
    const { user } = session

    const submissions = await strapi
      .plugin("content-moderation")
      .service("submission")
      .findByUser(user.id)

    ctx.body = { data: submissions }
  },

  // PATCH /api/content-moderation/submissions/:id/status
  async updateStatus(ctx: any) {
    const session = await strapi.betterAuth.api.getSession({
      headers: ctx.request.headers,
    })
    if (!session?.user) {
      return ctx.unauthorized("You must be signed in.")
    }
    const { user } = session
    const { id } = ctx.params
    const { status, reviewNote } = ctx.request.body as {
      status: string
      reviewNote?: string
    }

    const updated = await strapi
      .plugin("content-moderation")
      .service("submission")
      .updateStatus(id, status, user.id, reviewNote)

    ctx.body = { data: updated }
  },
})
```

- [ ] **Step 3: Add findAll route**

Replace `apps/strapi/src/plugins/content-moderation/server/routes/index.ts`:

```typescript
export default [
  {
    method: "GET",
    path: "/submissions",
    handler: "submission.findAll",
    config: {
      auth: { scope: [] },
      policies: [],
    },
  },
  {
    method: "POST",
    path: "/submissions",
    handler: "submission.create",
    config: {
      auth: { scope: [] },
      policies: [],
    },
  },
  {
    method: "GET",
    path: "/submissions/my",
    handler: "submission.findMine",
    config: {
      auth: { scope: [] },
      policies: [],
    },
  },
  {
    method: "PATCH",
    path: "/submissions/:id/status",
    handler: "submission.updateStatus",
    config: {
      auth: { scope: [] },
      policies: [],
    },
  },
]
```

- [ ] **Step 4: Test findAll endpoint**

```bash
curl -s "http://localhost:1337/api/content-moderation/submissions?status=pending" | jq .
```

Expected: `{ data: [] }` (or an array of submissions).

- [ ] **Step 5: Commit**

```bash
git add apps/strapi/src/plugins/content-moderation/server/services/submission.ts \
        apps/strapi/src/plugins/content-moderation/server/controllers/submission.ts \
        apps/strapi/src/plugins/content-moderation/server/routes/index.ts
git commit -m "feat(strapi): add findAll route and approveClaim side-effect to content-moderation"
```

---

## Task 5: Create topics plugin

**Files:**

- Create all: `apps/strapi/src/plugins/topics/`

- [ ] **Step 1: Create plugin content type schema**

Create `apps/strapi/src/plugins/topics/server/content-types/topic/schema.json`:

```json
{
  "kind": "collectionType",
  "collectionName": "topics_topics",
  "info": {
    "singularName": "topic",
    "pluralName": "topics",
    "displayName": "Topic"
  },
  "options": { "draftAndPublish": false },
  "pluginOptions": {
    "content-manager": { "visible": true },
    "content-type-builder": { "visible": false }
  },
  "attributes": {
    "name": { "type": "string", "required": true, "unique": true },
    "slug": { "type": "uid", "targetField": "name", "required": true },
    "status": {
      "type": "enumeration",
      "enum": ["approved", "pending", "rejected"],
      "default": "pending"
    },
    "suggestedByUserId": { "type": "string" },
    "suggestedByEmail": { "type": "string" }
  }
}
```

- [ ] **Step 2: Create content-types index**

Create `apps/strapi/src/plugins/topics/server/content-types/index.ts`:

```typescript
import topic from "./topic/schema.json"

export default { topic }
```

- [ ] **Step 3: Create topic service**

Create `apps/strapi/src/plugins/topics/server/services/topic.ts`:

```typescript
export default ({ strapi }: { strapi: any }) => ({
  async findApproved() {
    return strapi.documents("plugin::topics.topic").findMany({
      filters: { status: "approved" },
      sort: { name: "asc" },
      limit: 500,
    })
  },

  async findAll() {
    return strapi.documents("plugin::topics.topic").findMany({
      sort: [{ status: "asc" }, { name: "asc" }],
      limit: 500,
    })
  },

  async create(data: {
    name: string
    status?: "approved" | "pending" | "rejected"
    suggestedByUserId?: string
    suggestedByEmail?: string
  }) {
    return strapi.documents("plugin::topics.topic").create({ data })
  },

  async updateStatus(
    documentId: string,
    status: "approved" | "pending" | "rejected"
  ) {
    return strapi.documents("plugin::topics.topic").update({
      documentId,
      data: { status },
    })
  },
})
```

- [ ] **Step 4: Create services index**

Create `apps/strapi/src/plugins/topics/server/services/index.ts`:

```typescript
import topic from "./topic"

export default { topic }
```

- [ ] **Step 5: Create topic controller**

Create `apps/strapi/src/plugins/topics/server/controllers/topic.ts`:

```typescript
export default ({ strapi }: { strapi: any }) => ({
  // GET /api/topics/approved — public
  async findApproved(ctx: any) {
    const topics = await strapi.plugin("topics").service("topic").findApproved()
    ctx.body = { data: topics }
  },

  // GET /api/topics — admin only (no auth check here; rely on route config)
  async findAll(ctx: any) {
    const topics = await strapi.plugin("topics").service("topic").findAll()
    ctx.body = { data: topics }
  },

  // PATCH /api/topics/:id/status — admin
  async updateStatus(ctx: any) {
    const { id } = ctx.params
    const { status } = ctx.request.body as { status: string }
    const topic = await strapi
      .plugin("topics")
      .service("topic")
      .updateStatus(id, status)
    ctx.body = { data: topic }
  },
})
```

- [ ] **Step 6: Create controllers index**

Create `apps/strapi/src/plugins/topics/server/controllers/index.ts`:

```typescript
import topic from "./topic"

export default { topic }
```

- [ ] **Step 7: Create routes**

Create `apps/strapi/src/plugins/topics/server/routes/index.ts`:

```typescript
export default [
  {
    method: "GET",
    path: "/approved",
    handler: "topic.findApproved",
    config: { auth: false, policies: [] },
  },
  {
    method: "GET",
    path: "/",
    handler: "topic.findAll",
    config: { auth: { scope: [] }, policies: [] },
  },
  {
    method: "PATCH",
    path: "/:id/status",
    handler: "topic.updateStatus",
    config: { auth: { scope: [] }, policies: [] },
  },
]
```

- [ ] **Step 8: Create admin topics dashboard**

Create `apps/strapi/src/plugins/topics/admin/src/pages/TopicsDashboard.tsx`:

```tsx
import { useEffect, useState } from "react"

const STATUS_COLORS: Record<string, string> = {
  approved: "#8ef0b3",
  pending: "#ffcf7a",
  rejected: "#ff8a8a",
}

export function TopicsDashboard() {
  const [topics, setTopics] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState("pending")

  const load = () => {
    setLoading(true)
    fetch("/api/topics", { headers: { "Content-Type": "application/json" } })
      .then((r) => r.json())
      .then((json) => setTopics(json.data ?? []))
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  const filtered = topics.filter((t) => t.status === filter)

  const updateStatus = async (id: string, status: string) => {
    await fetch(`/api/topics/${id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    })
    load()
  }

  return (
    <div style={{ padding: "32px", fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ fontSize: "24px", fontWeight: 700, marginBottom: "24px" }}>
        Topics
      </h1>

      <div style={{ display: "flex", gap: "8px", marginBottom: "24px" }}>
        {["pending", "approved", "rejected"].map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            style={{
              padding: "6px 14px",
              borderRadius: "6px",
              border: `1px solid ${filter === s ? STATUS_COLORS[s] : "#ccc"}`,
              background:
                filter === s ? STATUS_COLORS[s] + "22" : "transparent",
              color: filter === s ? STATUS_COLORS[s] : "#666",
              cursor: "pointer",
              fontSize: "13px",
              fontWeight: 500,
            }}
          >
            {s}
          </button>
        ))}
      </div>

      {loading && <p>Loading…</p>}

      {!loading && filtered.length === 0 && (
        <p style={{ color: "#888" }}>No {filter} topics.</p>
      )}

      {filtered.map((topic) => (
        <div
          key={topic.documentId}
          style={{
            border: "1px solid #e2e8f0",
            borderRadius: "8px",
            padding: "16px 20px",
            marginBottom: "12px",
            background: "#fff",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <span style={{ fontWeight: 600, fontSize: "14px" }}>
              {topic.name}
            </span>
            {topic.suggestedByEmail && (
              <span
                style={{ fontSize: "12px", color: "#888", marginLeft: "12px" }}
              >
                suggested by {topic.suggestedByEmail}
              </span>
            )}
          </div>
          {topic.status === "pending" && (
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                onClick={() => updateStatus(topic.documentId, "approved")}
                style={{
                  padding: "6px 12px",
                  borderRadius: "6px",
                  background: "#8ef0b3",
                  border: "none",
                  fontWeight: 600,
                  cursor: "pointer",
                  fontSize: "12px",
                }}
              >
                Approve
              </button>
              <button
                onClick={() => updateStatus(topic.documentId, "rejected")}
                style={{
                  padding: "6px 12px",
                  borderRadius: "6px",
                  background: "#ff8a8a",
                  border: "none",
                  fontWeight: 600,
                  cursor: "pointer",
                  fontSize: "12px",
                }}
              >
                Reject
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 9: Create admin index**

Create `apps/strapi/src/plugins/topics/admin/src/index.ts`:

```typescript
import { TopicsDashboard } from "./pages/TopicsDashboard"

export const App = TopicsDashboard
```

- [ ] **Step 10: Create strapi-server.ts**

Create `apps/strapi/src/plugins/topics/strapi-server.ts`:

```typescript
import contentTypes from "./server/content-types"
import controllers from "./server/controllers"
import routes from "./server/routes"
import services from "./server/services"

export default {
  register({ strapi }: { strapi: any }) {},
  bootstrap({ strapi }: { strapi: any }) {},
  contentTypes,
  controllers,
  routes,
  services,
}
```

- [ ] **Step 11: Create strapi-admin.ts**

Create `apps/strapi/src/plugins/topics/strapi-admin.ts`:

```typescript
export default {
  register(app: any) {
    app.addMenuLink({
      to: `/plugins/topics`,
      icon: () => "🏷️",
      intlLabel: { id: "topics.plugin.name", defaultMessage: "Topics" },
      Component: async () => {
        const { App } = await import("./admin/src/index")
        return App
      },
    })
  },
  bootstrap() {},
}
```

- [ ] **Step 12: Register plugin in plugins.ts**

In `apps/strapi/config/plugins.ts`, add to the returned object (after the `"content-moderation"` entry):

```typescript
    "topics": {
      enabled: true,
      resolve: "./src/plugins/topics",
    },
```

- [ ] **Step 13: Start Strapi and verify topics plugin loads**

```bash
cd apps/strapi && pnpm develop
```

Expected: Strapi admin shows "Topics" in left menu. `GET http://localhost:1337/api/topics/approved` returns `{ data: [] }`.

```bash
curl -s http://localhost:1337/api/topics/approved | jq .
```

Expected: `{"data":[]}`

- [ ] **Step 14: Commit**

```bash
git add apps/strapi/src/plugins/topics/ apps/strapi/config/plugins.ts
git commit -m "feat(strapi): add topics plugin with approve/reject admin dashboard"
```

---

## Task 6: Seed initial topics

**Files:**

- Create: `apps/strapi/src/plugins/topics/server/bootstrap.ts`
- Modify: `apps/strapi/src/plugins/topics/strapi-server.ts`

- [ ] **Step 1: Create bootstrap with seed topics**

Create `apps/strapi/src/plugins/topics/server/bootstrap.ts`:

```typescript
const SEED_TOPICS = [
  "Rare Books",
  "Manuscripts",
  "Digital Libraries",
  "Open Access",
  "Archival Science",
  "Cataloguing",
  "Library History",
  "Conservation",
  "Information Science",
  "Academic Libraries",
  "Public Libraries",
  "National Libraries",
  "Special Collections",
  "Interlibrary Loan",
  "Reference Services",
  "Library Architecture",
  "Metadata",
  "Linked Data",
  "Library Law",
  "Accessibility",
  "Indigenous Knowledge",
  "Children's Libraries",
  "Mobile Libraries",
  "Prison Libraries",
  "Hospital Libraries",
]

export async function bootstrap({ strapi }: { strapi: any }) {
  for (const name of SEED_TOPICS) {
    const existing = await strapi.documents("plugin::topics.topic").findFirst({
      filters: { name },
    })
    if (!existing) {
      const slug = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
      await strapi.documents("plugin::topics.topic").create({
        data: { name, slug, status: "approved" },
      })
    }
  }
}
```

- [ ] **Step 2: Wire bootstrap into strapi-server.ts**

Replace `apps/strapi/src/plugins/topics/strapi-server.ts`:

```typescript
import contentTypes from "./server/content-types"
import controllers from "./server/controllers"
import routes from "./server/routes"
import services from "./server/services"
import { bootstrap as bootstrapTopics } from "./server/bootstrap"

export default {
  register({ strapi }: { strapi: any }) {},
  bootstrap: bootstrapTopics,
  contentTypes,
  controllers,
  routes,
  services,
}
```

- [ ] **Step 3: Restart and verify seed runs**

```bash
cd apps/strapi && pnpm develop
```

Then:

```bash
curl -s http://localhost:1337/api/topics/approved | jq '.data | length'
```

Expected: `25` (the number of seeded topics).

- [ ] **Step 4: Commit**

```bash
git add apps/strapi/src/plugins/topics/server/bootstrap.ts \
        apps/strapi/src/plugins/topics/strapi-server.ts
git commit -m "feat(strapi): seed 25 initial approved topics on bootstrap"
```

---

## Verification

After all tasks are complete:

```bash
# All new Strapi endpoints respond
curl -s http://localhost:1337/api/topics/approved | jq '.data | length'
# Expected: 25

curl -s "http://localhost:1337/api/content-moderation/submissions?status=pending" | jq .
# Expected: { data: [] }

curl -s -X POST http://localhost:1337/api/auth-bridge/upsert-profile \
  -H "Content-Type: application/json" \
  -H "X-Service-Secret: $STRAPI_BRIDGE_SECRET" \
  -d '{"baUserId":"verify-test","affiliationType":"librarian","pronouns":"she_her"}' | jq .
# Expected: data object with affiliationType and pronouns

# TypeScript compiles clean
cd apps/strapi && npx tsc --noEmit
```
