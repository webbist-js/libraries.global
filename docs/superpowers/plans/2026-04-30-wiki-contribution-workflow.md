# Wiki Contribution Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a frontend wiki article editor with role-gated access, content-moderation submission flow, editorial-style diff review, and automatic publishing on approval.

**Architecture:** Wiki article pages gain an in-page edit mode toggle (client component) gated to `wiki_editor`/`editorial_board` roles. Edits are serialised into a `draftData` JSON blob and submitted via the existing content-moderation plugin. On approval, a new `applyWikiEdit` side-effect immediately publishes the wiki article. Reviewers see an editorial-style stacked diff panel in the Moderation Dashboard.

**Tech Stack:** Next.js 15, Better Auth session, Strapi v5 content-moderation plugin, `diff` npm package (word-level diffing), inline styles + `T` design tokens, existing `QuickWinCard`/`ICON_MAP`/`CTA_LABEL` pattern.

---

## File Map

| Status | Path                                                                                    | Responsibility                                                 |
| ------ | --------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Modify | `apps/strapi/src/plugins/content-moderation/server/services/submission.ts`              | Add `applyWikiEdit` side-effect after `topic_suggestion` block |
| Modify | `apps/strapi/src/api/user-profile/services/quick-wins.ts`                               | Add `ruleEditWiki` + `edit_wiki` type                          |
| Modify | `apps/ui/src/lib/types/profile.ts`                                                      | Add `edit_wiki` to `QuickWinType`                              |
| Modify | `apps/ui/src/app/[locale]/contribute/_components/QuickWinCard.tsx`                      | Add `edit_wiki` to `ICON_MAP` + `CTA_LABEL`                    |
| Create | `apps/ui/src/lib/wikiEditorUtils.ts`                                                    | Type defs + AST ↔ draft conversion helpers                     |
| Create | `apps/ui/src/app/api/contribute/wiki/[slug]/route.ts`                                   | GET draft, POST create submission, PATCH update draft          |
| Create | `apps/ui/src/app/api/contribute/wiki/new/route.ts`                                      | POST create new-article submission                             |
| Create | `apps/ui/src/app/api/contribute/wiki/[slug]/finalize/route.ts`                          | POST finalize draft → pending                                  |
| Create | `apps/ui/src/app/api/upload/route.ts`                                                   | POST proxy image upload to Strapi (role-gated)                 |
| Create | `apps/ui/src/components/wiki/editor/WikiRichTextEditor.tsx`                             | Textarea editor for `content.rich-text` blocks                 |
| Create | `apps/ui/src/components/wiki/editor/WikiImageBlockEditor.tsx`                           | Image upload + caption editor                                  |
| Create | `apps/ui/src/components/wiki/editor/WikiCodeBlockEditor.tsx`                            | Code/language/filename editor                                  |
| Create | `apps/ui/src/components/wiki/editor/WikiQuoteBlockEditor.tsx`                           | Quote/attribution/source editor                                |
| Create | `apps/ui/src/components/wiki/editor/WikiCalloutBlockEditor.tsx`                         | Type/title/body editor                                         |
| Create | `apps/ui/src/components/wiki/editor/WikiBlockCard.tsx`                                  | Dispatcher: renders correct editor per `__component`           |
| Create | `apps/ui/src/components/wiki/editor/WikiBlockEditor.tsx`                                | Full block list + auto-save orchestrator                       |
| Create | `apps/ui/src/components/wiki/editor/WikiEditorSidebar.tsx`                              | Status, submission controls, edit summary                      |
| Modify | `apps/ui/src/components/wiki/WikiArticlePage.tsx`                                       | `"use client"` conversion + edit mode state                    |
| Create | `apps/strapi/src/plugins/content-moderation/admin/src/components/WikiEditDiffPanel.tsx` | Editorial stacked diff panel                                   |
| Modify | `apps/strapi/src/plugins/content-moderation/admin/src/pages/ModerationDashboard.tsx`    | Wire `WikiEditDiffPanel` for `wiki_edit` submissions           |

---

### Task 1: Strapi — `applyWikiEdit` side-effect in submission service

**Files:**

- Modify: `apps/strapi/src/plugins/content-moderation/server/services/submission.ts`

This task adds the backend approval logic. When a `wiki_edit` submission is approved, the service reads `draftData.body` and `draftData.title` from the submission, then publishes the wiki article with those values.

- [ ] **Step 1: Read the current submission service**

```bash
# Read lines 282–380 to confirm the exact insertion point after topic_suggestion block
```

Open `apps/strapi/src/plugins/content-moderation/server/services/submission.ts` and note the line number where the `topic_suggestion` approval block ends (currently around line 293) and the points-award section begins (around line 296).

- [ ] **Step 2: Add `applyWikiEdit` after `topic_suggestion` block**

In `updateStatus`, after the `topic_suggestion` block (which ends with `}` around line 293) and before the points-award section, insert:

```typescript
// ── wiki_edit approval ─────────────────────────────────────────────
if (newStatus === "approved" && submission.submissionType === "wiki_edit") {
  await (this as any).applyWikiEdit(submission)
}
```

- [ ] **Step 3: Add the `applyWikiEdit` private method**

At the end of the exported service object (before the closing `})`), add:

```typescript
  async applyWikiEdit(submission: any): Promise<void> {
    try {
      const draftData = submission.draftData ?? {}
      const slug: string | undefined = draftData.targetSlug
      if (!slug) return

      const article = await strapi.db
        .query("api::wiki-article.wiki-article")
        .findOne({ where: { slug, locale: draftData.locale ?? "en" } })
      if (!article) return

      const updateData: Record<string, unknown> = {}
      if (draftData.title) updateData.title = draftData.title
      if (Array.isArray(draftData.body)) updateData.body = draftData.body

      await strapi
        .documents("api::wiki-article.wiki-article" as any)
        .update({
          documentId: article.documentId,
          locale: draftData.locale ?? "en",
          status: "published",
          data: updateData,
        })
    } catch (err) {
      strapi.log.error("[content-moderation] applyWikiEdit failed", err)
    }
  },
```

- [ ] **Step 4: Build Strapi to verify TypeScript compiles**

```bash
cd apps/strapi && pnpm build 2>&1 | tail -20
```

Expected: build completes with no TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add apps/strapi/src/plugins/content-moderation/server/services/submission.ts
git commit -m "feat(strapi): applyWikiEdit side-effect on wiki_edit approval"
```

---

### Task 2: Strapi — `ruleEditWiki` in quick-wins service

**Files:**

- Modify: `apps/strapi/src/api/user-profile/services/quick-wins.ts`

- [ ] **Step 1: Add `edit_wiki` to the `QuickWin` type union at the top of the file**

In the `type` field of the `QuickWin` type (lines 1–19), add `"edit_wiki"` to the union:

```typescript
type QuickWin = {
  winId: string
  type:
    | "add_library"
    | "add_nearby_library"
    | "verify_hours"
    | "add_hero_image"
    | "translate_wiki"
    | "edit_wiki"
  title: string
  description: string
  points: number
  estimatedMinutes: number
  rewardLabel: string
  actionUrl: string
  targetEntityRef?: string
  targetSlug?: string
  computedForCountry?: string
  computedForLanguage?: string
}
```

- [ ] **Step 2: Add `ruleEditWiki` to the `computeForUser` Promise.all**

In `computeForUser`, update the destructured Promise.all to include `editWikiWins`:

```typescript
const [libraryWins, nearbyWins, hoursWins, imageWins, wikiWins, editWikiWins] =
  await Promise.all([
    (this as any).ruleAddLibrary(profile),
    (this as any).ruleAddNearbyLibrary(profile),
    (this as any).ruleVerifyHours(profile),
    (this as any).ruleAddHeroImage(profile),
    (this as any).ruleTranslateWiki(profile),
    (this as any).ruleEditWiki(profile),
  ])

const all: QuickWin[] = [
  ...libraryWins,
  ...nearbyWins,
  ...hoursWins,
  ...imageWins,
  ...wikiWins,
  ...editWikiWins,
]
```

- [ ] **Step 3: Add the `ruleEditWiki` method**

After the closing brace of `ruleTranslateWiki` (around line 306), add:

```typescript
  async ruleEditWiki(profile: any): Promise<QuickWin[]> {
    try {
      // Find published wiki articles that haven't been edited recently
      const articles = await strapi.db
        .query("api::wiki-article.wiki-article")
        .findMany({
          where: {
            publishedAt: { $ne: null },
            locale: "en",
          },
          limit: 3,
          orderBy: { updatedAt: "asc" },
          select: ["id", "documentId", "title", "slug", "updatedAt"],
        })

      return articles.map((article: any) => ({
        winId: `edit_wiki-${article.slug}`,
        type: "edit_wiki" as const,
        title: `Improve a wiki article`,
        description: `"${article.title}" could use your expertise. Fix errors, add context, or improve clarity.`,
        points: 10,
        estimatedMinutes: 5,
        rewardLabel: "EDITOR",
        actionUrl: `/wiki/${article.slug}?edit=true`,
        targetSlug: article.slug,
      }))
    } catch {
      // wiki-article content type may not exist — skip silently
      return []
    }
  },
```

- [ ] **Step 4: Build to verify**

```bash
cd apps/strapi && pnpm build 2>&1 | tail -20
```

Expected: no TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add apps/strapi/src/api/user-profile/services/quick-wins.ts
git commit -m "feat(strapi): add ruleEditWiki to quick-wins service"
```

---

### Task 3: Frontend types — add `edit_wiki` to `QuickWinType` + `QuickWinCard`

**Files:**

- Modify: `apps/ui/src/lib/types/profile.ts`
- Modify: `apps/ui/src/app/[locale]/contribute/_components/QuickWinCard.tsx`

- [ ] **Step 1: Update `QuickWinType` in `profile.ts`**

Find the `QuickWinType` export (lines 90–95) and add `"edit_wiki"`:

```typescript
export type QuickWinType =
  | "add_library"
  | "add_nearby_library"
  | "verify_hours"
  | "add_hero_image"
  | "translate_wiki"
  | "edit_wiki"
```

- [ ] **Step 2: Add `edit_wiki` to `ICON_MAP` in `QuickWinCard.tsx`**

In the `ICON_MAP` object (lines 8–14), add:

```typescript
const ICON_MAP: Record<QuickWinType, { icon: string; color: string }> = {
  add_library: { icon: "mdi:plus-box", color: T.accent.ember },
  add_nearby_library: { icon: "mdi:plus-box", color: T.accent.ember },
  verify_hours: { icon: "mdi:text-box-outline", color: T.accent.aurora },
  add_hero_image: { icon: "mdi:image-outline", color: T.accent.violet },
  translate_wiki: { icon: "mdi:translate", color: T.accent.ok },
  edit_wiki: { icon: "mdi:pencil-outline", color: T.accent.aurora },
}
```

- [ ] **Step 3: Add `edit_wiki` to `CTA_LABEL` in `QuickWinCard.tsx`**

In the `CTA_LABEL` object (lines 16–22), add:

```typescript
const CTA_LABEL: Record<QuickWinType, string> = {
  add_library: "BEGIN →",
  add_nearby_library: "BEGIN →",
  verify_hours: "VERIFY →",
  add_hero_image: "ATTACH →",
  translate_wiki: "OPEN →",
  edit_wiki: "EDIT →",
}
```

- [ ] **Step 4: Verify TypeScript**

```bash
cd apps/ui && pnpm tsc --noEmit 2>&1 | grep -E "error|QuickWin" | head -20
```

Expected: no errors mentioning `QuickWinType` or `QuickWinCard`.

- [ ] **Step 5: Commit**

```bash
git add apps/ui/src/lib/types/profile.ts apps/ui/src/app/[locale]/contribute/_components/QuickWinCard.tsx
git commit -m "feat(ui): add edit_wiki to QuickWinType and QuickWinCard"
```

---

### Task 4: Frontend utilities — `wikiEditorUtils.ts`

**Files:**

- Create: `apps/ui/src/lib/wikiEditorUtils.ts`

This file defines the `WikiDraftBlock` type union and the conversion helpers between Strapi's content-type schema and the flat draft format stored in `draftData`.

- [ ] **Step 1: Create `wikiEditorUtils.ts`**

```typescript
// apps/ui/src/lib/wikiEditorUtils.ts
// Types and helpers for the wiki editor draft data format.
// draftData is stored as JSON in the content-moderation submission.

// ── Strapi Blocks AST node (minimal subset) ────────────────────────────────

export type StrapiBlockNode =
  | { type: "paragraph"; children: { type: "text"; text: string }[] }
  | {
      type: "heading"
      level: 1 | 2 | 3 | 4 | 5 | 6
      children: { type: "text"; text: string }[]
    }
  | {
      type: "list"
      format: "ordered" | "unordered"
      children: {
        type: "list-item"
        children: { type: "text"; text: string }[]
      }[]
    }
  | { type: "quote"; children: { type: "text"; text: string }[] }
  | { type: "code"; children: { type: "text"; text: string }[] }
  | {
      type: "image"
      image: { url: string; alternativeText?: string }
      children: { type: "text"; text: string }[]
    }

// ── Draft block types ──────────────────────────────────────────────────────

export type WikiRichTextDraftBlock = {
  __component: "content.rich-text"
  /** Plain-text representation for editing; reconstructed to Strapi blocks on save */
  text: string
  /** Original Strapi blocks AST — preserved if block was not edited */
  _originalBlocks?: StrapiBlockNode[]
  /** Whether the user has modified this block */
  _dirty?: boolean
}

export type WikiImageDraftBlock = {
  __component: "content.image-block"
  /** Strapi media ID after upload */
  imageId?: number
  /** Preview URL (either existing Strapi URL or local object URL) */
  previewUrl?: string
  caption?: string
  fullWidth?: boolean
}

export type WikiCodeDraftBlock = {
  __component: "content.code-block"
  code: string
  language?: string
  filename?: string
}

export type WikiQuoteDraftBlock = {
  __component: "content.quote-block"
  quote: string
  attribution?: string
  source?: string
}

export type WikiCalloutDraftBlock = {
  __component: "content.callout"
  type: "info" | "warning" | "tip" | "note"
  title?: string
  body: string
}

export type WikiDraftBlock =
  | WikiRichTextDraftBlock
  | WikiImageDraftBlock
  | WikiCodeDraftBlock
  | WikiQuoteDraftBlock
  | WikiCalloutDraftBlock

export type WikiDraftData = {
  targetSlug: string
  locale: string
  title?: string
  body: WikiDraftBlock[]
  editSummary?: string
  isTranslation?: boolean
}

// ── Conversion helpers ─────────────────────────────────────────────────────

/**
 * Extracts plain text from a Strapi Blocks AST array for display in a textarea.
 */
export function extractTextFromBlocks(blocks: StrapiBlockNode[]): string {
  return blocks
    .map((node) => {
      if (!("children" in node)) return ""
      return node.children
        .map((child) => ("text" in child ? child.text : ""))
        .join("")
    })
    .join("\n\n")
}

/**
 * Converts plain text back to a minimal Strapi Blocks AST (paragraph per double-newline).
 */
export function textToStrapiBlocks(text: string): StrapiBlockNode[] {
  const paragraphs = text.split(/\n\n+/).filter(Boolean)
  if (paragraphs.length === 0) {
    return [{ type: "paragraph", children: [{ type: "text", text: "" }] }]
  }
  return paragraphs.map((p) => ({
    type: "paragraph" as const,
    children: [{ type: "text" as const, text: p }],
  }))
}

/**
 * Converts a Strapi wiki article body (dynamic zone array) to the WikiDraftBlock[] format.
 */
export function articleBodyToWikiDraft(
  body: Record<string, unknown>[]
): WikiDraftBlock[] {
  return body.map((block): WikiDraftBlock => {
    const component = block.__component as string

    if (component === "content.rich-text") {
      const blocks = (block.body ?? []) as StrapiBlockNode[]
      return {
        __component: "content.rich-text",
        text: extractTextFromBlocks(blocks),
        _originalBlocks: blocks,
        _dirty: false,
      }
    }

    if (component === "content.image-block") {
      const image = block.image as Record<string, unknown> | undefined
      return {
        __component: "content.image-block",
        imageId: image?.id as number | undefined,
        previewUrl: image?.url as string | undefined,
        caption: block.caption as string | undefined,
        fullWidth: block.fullWidth as boolean | undefined,
      }
    }

    if (component === "content.code-block") {
      return {
        __component: "content.code-block",
        code: (block.code as string) ?? "",
        language: block.language as string | undefined,
        filename: block.filename as string | undefined,
      }
    }

    if (component === "content.quote-block") {
      return {
        __component: "content.quote-block",
        quote: (block.quote as string) ?? "",
        attribution: block.attribution as string | undefined,
        source: block.source as string | undefined,
      }
    }

    if (component === "content.callout") {
      return {
        __component: "content.callout",
        type: (block.type as "info" | "warning" | "tip" | "note") ?? "info",
        title: block.title as string | undefined,
        body: (block.body as string) ?? "",
      }
    }

    // Fallback: treat unknown components as empty rich-text
    return { __component: "content.rich-text", text: "", _dirty: false }
  })
}

/**
 * Converts WikiDraftBlock[] back to the Strapi dynamic zone format for submission draftData.
 */
export function wikiDraftToApiPayload(
  blocks: WikiDraftBlock[]
): Record<string, unknown>[] {
  return blocks.map((block): Record<string, unknown> => {
    if (block.__component === "content.rich-text") {
      const strapiBlocks =
        block._dirty || !block._originalBlocks
          ? textToStrapiBlocks(block.text)
          : block._originalBlocks
      return { __component: "content.rich-text", body: strapiBlocks }
    }

    if (block.__component === "content.image-block") {
      return {
        __component: "content.image-block",
        image: block.imageId ?? null,
        caption: block.caption ?? null,
        fullWidth: block.fullWidth ?? false,
      }
    }

    if (block.__component === "content.code-block") {
      return {
        __component: "content.code-block",
        code: block.code,
        language: block.language ?? null,
        filename: block.filename ?? null,
      }
    }

    if (block.__component === "content.quote-block") {
      return {
        __component: "content.quote-block",
        quote: block.quote,
        attribution: block.attribution ?? null,
        source: block.source ?? null,
      }
    }

    if (block.__component === "content.callout") {
      return {
        __component: "content.callout",
        type: block.type,
        title: block.title ?? null,
        body: block.body,
      }
    }

    return {}
  })
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd apps/ui && pnpm tsc --noEmit 2>&1 | grep "wikiEditorUtils" | head -10
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/ui/src/lib/wikiEditorUtils.ts
git commit -m "feat(ui): add wikiEditorUtils types and conversion helpers"
```

---

### Task 5: Next.js API routes — wiki contribution endpoints

**Files:**

- Create: `apps/ui/src/app/api/contribute/wiki/[slug]/route.ts`
- Create: `apps/ui/src/app/api/contribute/wiki/[slug]/finalize/route.ts`
- Create: `apps/ui/src/app/api/upload/route.ts`

These routes proxy authenticated requests to the content-moderation plugin and Strapi upload.

- [ ] **Step 1: Read the avatar upload route for the pattern**

Read `apps/ui/src/app/api/profile/me/avatar/route.ts` to confirm the `STRAPI_REST_READONLY_API_KEY` usage pattern and session check.

- [ ] **Step 2: Read an existing submission route for pattern**

Read `apps/ui/src/app/api/submissions/route.ts` (or the nearest equivalent) to see how `strapiJWT` from the session is forwarded to Strapi.

- [ ] **Step 3: Create `apps/ui/src/app/api/contribute/wiki/[slug]/route.ts`**

```typescript
import { auth } from "@/lib/auth"
import { headers } from "next/headers"

const STRAPI = process.env.NEXT_PUBLIC_STRAPI_URL ?? "http://127.0.0.1:1337"
const WIKI_EDITOR_ROLES = ["wiki_editor", "editorial_board"]

async function getEditorSession() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return null
  const role = (session.user as Record<string, unknown>).contributorRole as
    | string
    | undefined
  if (!role || !WIKI_EDITOR_ROLES.includes(role)) return null
  return session
}

// GET /api/contribute/wiki/[slug] — fetch existing draft for this slug
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const session = await getEditorSession()
  if (!session) return Response.json({ error: "Forbidden" }, { status: 403 })

  const jwt = (session.user as Record<string, unknown>).strapiJWT as string
  const res = await fetch(
    `${STRAPI}/api/content-moderation/submissions/draft/wiki_edit?targetSlug=${encodeURIComponent(slug)}`,
    { headers: { Authorization: `Bearer ${jwt}` }, cache: "no-store" }
  )
  if (!res.ok) return Response.json({ draft: null })
  const data = await res.json()
  return Response.json(data)
}

// POST /api/contribute/wiki/[slug] — create new draft submission
export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const session = await getEditorSession()
  if (!session) return Response.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json()
  const jwt = (session.user as Record<string, unknown>).strapiJWT as string

  const res = await fetch(`${STRAPI}/api/content-moderation/submissions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${jwt}`,
    },
    body: JSON.stringify({
      submissionType: "wiki_edit",
      targetEntityType: "wiki_article",
      targetSlug: slug,
      draftData: body.draftData,
    }),
  })

  const data = await res.json()
  return Response.json(data, { status: res.status })
}

// PATCH /api/contribute/wiki/[slug] — update draft data on existing submission
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const session = await getEditorSession()
  if (!session) return Response.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json()
  const jwt = (session.user as Record<string, unknown>).strapiJWT as string

  const res = await fetch(
    `${STRAPI}/api/content-moderation/submissions/${body.submissionId}/draft`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${jwt}`,
      },
      body: JSON.stringify({ draftData: body.draftData }),
    }
  )

  const data = await res.json()
  return Response.json(data, { status: res.status })
}
```

- [ ] **Step 4: Create `apps/ui/src/app/api/contribute/wiki/[slug]/finalize/route.ts`**

```typescript
import { auth } from "@/lib/auth"
import { headers } from "next/headers"

const STRAPI = process.env.NEXT_PUBLIC_STRAPI_URL ?? "http://127.0.0.1:1337"
const WIKI_EDITOR_ROLES = ["wiki_editor", "editorial_board"]

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user)
    return Response.json({ error: "Unauthorized" }, { status: 401 })

  const role = (session.user as Record<string, unknown>).contributorRole as
    | string
    | undefined
  if (!role || !WIKI_EDITOR_ROLES.includes(role)) {
    return Response.json({ error: "Forbidden" }, { status: 403 })
  }

  const { submissionId } = await req.json()
  const jwt = (session.user as Record<string, unknown>).strapiJWT as string

  const res = await fetch(
    `${STRAPI}/api/content-moderation/submissions/${submissionId}/finalize`,
    {
      method: "PATCH",
      headers: { Authorization: `Bearer ${jwt}` },
    }
  )

  const data = await res.json()
  return Response.json(data, { status: res.status })
}
```

- [ ] **Step 5: Create `apps/ui/src/app/api/upload/route.ts`**

```typescript
import { auth } from "@/lib/auth"
import { headers } from "next/headers"

const STRAPI = process.env.NEXT_PUBLIC_STRAPI_URL ?? "http://127.0.0.1:1337"
const STRAPI_API_KEY = process.env.STRAPI_REST_READONLY_API_KEY ?? ""
const WIKI_EDITOR_ROLES = ["wiki_editor", "editorial_board"]

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user)
    return Response.json({ error: "Unauthorized" }, { status: 401 })

  const role = (session.user as Record<string, unknown>).contributorRole as
    | string
    | undefined
  if (!role || !WIKI_EDITOR_ROLES.includes(role)) {
    return Response.json({ error: "Forbidden" }, { status: 403 })
  }

  const formData = await req.formData()
  // Forward only the `files` field for security
  const file = formData.get("files")
  if (!file || !(file instanceof File)) {
    return Response.json({ error: "No file provided" }, { status: 400 })
  }

  // Validate file type
  if (!file.type.startsWith("image/")) {
    return Response.json(
      { error: "Only image files are allowed" },
      { status: 400 }
    )
  }

  // Validate file size (5 MB max)
  if (file.size > 5 * 1024 * 1024) {
    return Response.json(
      { error: "File too large (max 5 MB)" },
      { status: 400 }
    )
  }

  const upload = new FormData()
  upload.append("files", file)

  const res = await fetch(`${STRAPI}/api/upload`, {
    method: "POST",
    headers: { Authorization: `Bearer ${STRAPI_API_KEY}` },
    body: upload,
  })

  if (!res.ok) {
    return Response.json({ error: "Upload failed" }, { status: 502 })
  }

  const data = await res.json()
  // data is an array of uploaded files
  const uploaded = Array.isArray(data) ? data[0] : data
  return Response.json({ id: uploaded.id, url: uploaded.url })
}
```

- [ ] **Step 6: Verify TypeScript**

```bash
cd apps/ui && pnpm tsc --noEmit 2>&1 | grep -E "contribute/wiki|api/upload" | head -20
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add apps/ui/src/app/api/contribute/wiki apps/ui/src/app/api/upload
git commit -m "feat(ui): wiki contribution API routes and upload proxy"
```

---

### Task 6: Wiki block editor components (5 block types + dispatcher)

**Files:**

- Create: `apps/ui/src/components/wiki/editor/WikiRichTextEditor.tsx`
- Create: `apps/ui/src/components/wiki/editor/WikiImageBlockEditor.tsx`
- Create: `apps/ui/src/components/wiki/editor/WikiCodeBlockEditor.tsx`
- Create: `apps/ui/src/components/wiki/editor/WikiQuoteBlockEditor.tsx`
- Create: `apps/ui/src/components/wiki/editor/WikiCalloutBlockEditor.tsx`
- Create: `apps/ui/src/components/wiki/editor/WikiBlockCard.tsx`

All editors use inline styles + `T` tokens, no Tailwind.

- [ ] **Step 1: Create `WikiRichTextEditor.tsx`**

```typescript
"use client"

import { T } from "@/lib/design-tokens"
import type { WikiRichTextDraftBlock } from "@/lib/wikiEditorUtils"

export function WikiRichTextEditor({
  block,
  onChange,
}: {
  readonly block: WikiRichTextDraftBlock
  readonly onChange: (updated: WikiRichTextDraftBlock) => void
}) {
  return (
    <textarea
      value={block.text}
      onChange={(e) =>
        onChange({ ...block, text: e.target.value, _dirty: true })
      }
      style={{
        width: "100%",
        minHeight: "120px",
        background: "rgba(255,255,255,.04)",
        border: `1px solid ${T.border.line}`,
        borderRadius: "6px",
        color: T.ink.base,
        fontFamily: T.font.sans,
        fontSize: "14px",
        lineHeight: 1.7,
        padding: "12px",
        resize: "vertical",
        outline: "none",
        boxSizing: "border-box",
      }}
      placeholder="Write paragraph text here…"
    />
  )
}
```

- [ ] **Step 2: Create `WikiImageBlockEditor.tsx`**

```typescript
"use client"

import { useRef, useState } from "react"
import { T } from "@/lib/design-tokens"
import type { WikiImageDraftBlock } from "@/lib/wikiEditorUtils"

export function WikiImageBlockEditor({
  block,
  onChange,
}: {
  readonly block: WikiImageDraftBlock
  readonly onChange: (updated: WikiImageDraftBlock) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleFile(file: File) {
    setUploading(true)
    setError(null)
    try {
      const fd = new FormData()
      fd.append("files", file)
      const res = await fetch("/api/upload", { method: "POST", body: fd })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error ?? "Upload failed")
      }
      const { id, url } = await res.json()
      onChange({ ...block, imageId: id, previewUrl: url })
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      {block.previewUrl ? (
        <div style={{ position: "relative" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={block.previewUrl}
            alt="block preview"
            style={{
              width: "100%",
              maxHeight: "240px",
              objectFit: "cover",
              borderRadius: "6px",
              border: `1px solid ${T.border.line}`,
            }}
          />
          <button
            onClick={() => onChange({ ...block, imageId: undefined, previewUrl: undefined })}
            style={{
              position: "absolute",
              top: "8px",
              right: "8px",
              background: "rgba(0,0,0,.6)",
              border: "none",
              borderRadius: "4px",
              color: T.ink.dim,
              fontFamily: T.font.mono,
              fontSize: "9px",
              letterSpacing: ".1em",
              textTransform: "uppercase",
              padding: "4px 8px",
              cursor: "pointer",
            }}
          >
            Remove
          </button>
        </div>
      ) : (
        <button
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          style={{
            width: "100%",
            height: "80px",
            background: "rgba(255,255,255,.03)",
            border: `1px dashed ${T.border.hi}`,
            borderRadius: "6px",
            color: T.ink.low,
            fontFamily: T.font.mono,
            fontSize: "10px",
            letterSpacing: ".12em",
            textTransform: "uppercase",
            cursor: uploading ? "wait" : "pointer",
          }}
        >
          {uploading ? "Uploading…" : "Click to upload image"}
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) handleFile(file)
        }}
      />

      {error && (
        <span style={{ fontFamily: T.font.mono, fontSize: "10px", color: T.accent.danger }}>
          {error}
        </span>
      )}

      <input
        type="text"
        value={block.caption ?? ""}
        onChange={(e) => onChange({ ...block, caption: e.target.value })}
        placeholder="Caption (optional)"
        style={{
          background: "rgba(255,255,255,.04)",
          border: `1px solid ${T.border.line}`,
          borderRadius: "6px",
          color: T.ink.base,
          fontFamily: T.font.sans,
          fontSize: "13px",
          padding: "8px 12px",
          outline: "none",
        }}
      />

      <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
        <input
          type="checkbox"
          checked={block.fullWidth ?? false}
          onChange={(e) => onChange({ ...block, fullWidth: e.target.checked })}
        />
        <span style={{ fontFamily: T.font.mono, fontSize: "10px", color: T.ink.low, letterSpacing: ".1em", textTransform: "uppercase" }}>
          Full width
        </span>
      </label>
    </div>
  )
}
```

- [ ] **Step 3: Create `WikiCodeBlockEditor.tsx`**

```typescript
"use client"

import { T } from "@/lib/design-tokens"
import type { WikiCodeDraftBlock } from "@/lib/wikiEditorUtils"

const LANGUAGES = ["", "typescript", "javascript", "python", "bash", "json", "html", "css", "sql", "rust", "go"]

export function WikiCodeBlockEditor({
  block,
  onChange,
}: {
  readonly block: WikiCodeDraftBlock
  readonly onChange: (updated: WikiCodeDraftBlock) => void
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      <div style={{ display: "flex", gap: "8px" }}>
        <select
          value={block.language ?? ""}
          onChange={(e) => onChange({ ...block, language: e.target.value || undefined })}
          style={{
            flex: "0 0 140px",
            background: "rgba(255,255,255,.04)",
            border: `1px solid ${T.border.line}`,
            borderRadius: "6px",
            color: T.ink.base,
            fontFamily: T.font.mono,
            fontSize: "11px",
            padding: "6px 10px",
            outline: "none",
          }}
        >
          {LANGUAGES.map((l) => (
            <option key={l} value={l}>{l || "Language"}</option>
          ))}
        </select>
        <input
          type="text"
          value={block.filename ?? ""}
          onChange={(e) => onChange({ ...block, filename: e.target.value || undefined })}
          placeholder="filename (optional)"
          style={{
            flex: 1,
            background: "rgba(255,255,255,.04)",
            border: `1px solid ${T.border.line}`,
            borderRadius: "6px",
            color: T.ink.base,
            fontFamily: T.font.mono,
            fontSize: "11px",
            padding: "6px 10px",
            outline: "none",
          }}
        />
      </div>
      <textarea
        value={block.code}
        onChange={(e) => onChange({ ...block, code: e.target.value })}
        style={{
          width: "100%",
          minHeight: "120px",
          background: "rgba(0,0,0,.3)",
          border: `1px solid ${T.border.line}`,
          borderRadius: "6px",
          color: T.ink.base,
          fontFamily: T.font.mono,
          fontSize: "12px",
          lineHeight: 1.6,
          padding: "12px",
          resize: "vertical",
          outline: "none",
          boxSizing: "border-box",
        }}
        placeholder="// code here"
        spellCheck={false}
      />
    </div>
  )
}
```

- [ ] **Step 4: Create `WikiQuoteBlockEditor.tsx`**

```typescript
"use client"

import { T } from "@/lib/design-tokens"
import type { WikiQuoteDraftBlock } from "@/lib/wikiEditorUtils"

export function WikiQuoteBlockEditor({
  block,
  onChange,
}: {
  readonly block: WikiQuoteDraftBlock
  readonly onChange: (updated: WikiQuoteDraftBlock) => void
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      <textarea
        value={block.quote}
        onChange={(e) => onChange({ ...block, quote: e.target.value })}
        style={{
          width: "100%",
          minHeight: "80px",
          background: "rgba(255,255,255,.04)",
          border: `1px solid ${T.border.line}`,
          borderRadius: "6px",
          color: T.ink.base,
          fontFamily: T.font.serif,
          fontSize: "14px",
          fontStyle: "italic",
          lineHeight: 1.65,
          padding: "12px",
          resize: "vertical",
          outline: "none",
          boxSizing: "border-box",
        }}
        placeholder="Quote text…"
      />
      <input
        type="text"
        value={block.attribution ?? ""}
        onChange={(e) => onChange({ ...block, attribution: e.target.value || undefined })}
        placeholder="Attribution (optional)"
        style={{
          background: "rgba(255,255,255,.04)",
          border: `1px solid ${T.border.line}`,
          borderRadius: "6px",
          color: T.ink.base,
          fontFamily: T.font.sans,
          fontSize: "13px",
          padding: "8px 12px",
          outline: "none",
        }}
      />
      <input
        type="text"
        value={block.source ?? ""}
        onChange={(e) => onChange({ ...block, source: e.target.value || undefined })}
        placeholder="Source URL or reference (optional)"
        style={{
          background: "rgba(255,255,255,.04)",
          border: `1px solid ${T.border.line}`,
          borderRadius: "6px",
          color: T.ink.base,
          fontFamily: T.font.sans,
          fontSize: "13px",
          padding: "8px 12px",
          outline: "none",
        }}
      />
    </div>
  )
}
```

- [ ] **Step 5: Create `WikiCalloutBlockEditor.tsx`**

```typescript
"use client"

import { T } from "@/lib/design-tokens"
import type { WikiCalloutDraftBlock } from "@/lib/wikiEditorUtils"

const CALLOUT_TYPES: { value: WikiCalloutDraftBlock["type"]; label: string; color: string }[] = [
  { value: "info", label: "INFO", color: T.accent.aurora },
  { value: "warning", label: "WARNING", color: T.accent.warn },
  { value: "tip", label: "TIP", color: T.accent.ok },
  { value: "note", label: "NOTE", color: T.accent.violet },
]

export function WikiCalloutBlockEditor({
  block,
  onChange,
}: {
  readonly block: WikiCalloutDraftBlock
  readonly onChange: (updated: WikiCalloutDraftBlock) => void
}) {
  const activeType = CALLOUT_TYPES.find((t) => t.value === block.type) ?? CALLOUT_TYPES[0]

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      <div style={{ display: "flex", gap: "6px" }}>
        {CALLOUT_TYPES.map((t) => (
          <button
            key={t.value}
            onClick={() => onChange({ ...block, type: t.value })}
            style={{
              fontFamily: T.font.mono,
              fontSize: "9px",
              letterSpacing: ".12em",
              textTransform: "uppercase",
              color: block.type === t.value ? t.color : T.ink.faint,
              background: block.type === t.value ? `${t.color}14` : "transparent",
              border: `1px solid ${block.type === t.value ? t.color + "40" : T.border.line}`,
              borderRadius: "4px",
              padding: "4px 10px",
              cursor: "pointer",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>
      <input
        type="text"
        value={block.title ?? ""}
        onChange={(e) => onChange({ ...block, title: e.target.value || undefined })}
        placeholder="Title (optional)"
        style={{
          background: "rgba(255,255,255,.04)",
          border: `1px solid ${T.border.line}`,
          borderRadius: "6px",
          color: T.ink.base,
          fontFamily: T.font.sans,
          fontSize: "13px",
          fontWeight: 600,
          padding: "8px 12px",
          outline: "none",
        }}
      />
      <textarea
        value={block.body}
        onChange={(e) => onChange({ ...block, body: e.target.value })}
        style={{
          width: "100%",
          minHeight: "80px",
          background: `${activeType.color}08`,
          border: `1px solid ${activeType.color}30`,
          borderRadius: "6px",
          color: T.ink.base,
          fontFamily: T.font.sans,
          fontSize: "13px",
          lineHeight: 1.65,
          padding: "12px",
          resize: "vertical",
          outline: "none",
          boxSizing: "border-box",
        }}
        placeholder="Callout body…"
      />
    </div>
  )
}
```

- [ ] **Step 6: Create `WikiBlockCard.tsx`**

```typescript
"use client"

import { Icon } from "@iconify/react"
import { T } from "@/lib/design-tokens"
import type { WikiDraftBlock } from "@/lib/wikiEditorUtils"
import { WikiRichTextEditor } from "./WikiRichTextEditor"
import { WikiImageBlockEditor } from "./WikiImageBlockEditor"
import { WikiCodeBlockEditor } from "./WikiCodeBlockEditor"
import { WikiQuoteBlockEditor } from "./WikiQuoteBlockEditor"
import { WikiCalloutBlockEditor } from "./WikiCalloutBlockEditor"

const COMPONENT_LABELS: Record<string, string> = {
  "content.rich-text": "Text",
  "content.image-block": "Image",
  "content.code-block": "Code",
  "content.quote-block": "Quote",
  "content.callout": "Callout",
}

export function WikiBlockCard({
  block,
  index,
  onChange,
  onMoveUp,
  onMoveDown,
  onDelete,
  isFirst,
  isLast,
}: {
  readonly block: WikiDraftBlock
  readonly index: number
  readonly onChange: (updated: WikiDraftBlock) => void
  readonly onMoveUp: () => void
  readonly onMoveDown: () => void
  readonly onDelete: () => void
  readonly isFirst: boolean
  readonly isLast: boolean
}) {
  const label = COMPONENT_LABELS[block.__component] ?? block.__component

  return (
    <div
      style={{
        border: `1px solid ${T.border.line}`,
        borderRadius: "8px",
        overflow: "hidden",
      }}
    >
      {/* Block header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 12px",
          background: "rgba(255,255,255,.03)",
          borderBottom: `1px solid ${T.border.line}`,
        }}
      >
        <span
          style={{
            fontFamily: T.font.mono,
            fontSize: "9px",
            letterSpacing: ".14em",
            textTransform: "uppercase",
            color: T.ink.low,
          }}
        >
          Block {index + 1} · {label}
        </span>
        <div style={{ display: "flex", gap: "4px" }}>
          <button
            onClick={onMoveUp}
            disabled={isFirst}
            style={{ background: "none", border: "none", cursor: isFirst ? "default" : "pointer", color: isFirst ? T.ink.faint : T.ink.low, padding: "2px" }}
            title="Move up"
          >
            <Icon icon="mdi:chevron-up" width={14} />
          </button>
          <button
            onClick={onMoveDown}
            disabled={isLast}
            style={{ background: "none", border: "none", cursor: isLast ? "default" : "pointer", color: isLast ? T.ink.faint : T.ink.low, padding: "2px" }}
            title="Move down"
          >
            <Icon icon="mdi:chevron-down" width={14} />
          </button>
          <button
            onClick={onDelete}
            style={{ background: "none", border: "none", cursor: "pointer", color: T.accent.danger, padding: "2px", marginLeft: "4px" }}
            title="Delete block"
          >
            <Icon icon="mdi:trash-can-outline" width={14} />
          </button>
        </div>
      </div>

      {/* Block editor */}
      <div style={{ padding: "12px" }}>
        {block.__component === "content.rich-text" && (
          <WikiRichTextEditor block={block} onChange={onChange as (b: typeof block) => void} />
        )}
        {block.__component === "content.image-block" && (
          <WikiImageBlockEditor block={block} onChange={onChange as (b: typeof block) => void} />
        )}
        {block.__component === "content.code-block" && (
          <WikiCodeBlockEditor block={block} onChange={onChange as (b: typeof block) => void} />
        )}
        {block.__component === "content.quote-block" && (
          <WikiQuoteBlockEditor block={block} onChange={onChange as (b: typeof block) => void} />
        )}
        {block.__component === "content.callout" && (
          <WikiCalloutBlockEditor block={block} onChange={onChange as (b: typeof block) => void} />
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 7: Verify TypeScript**

```bash
cd apps/ui && pnpm tsc --noEmit 2>&1 | grep "wiki/editor" | head -20
```

Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add apps/ui/src/components/wiki/editor/
git commit -m "feat(ui): add wiki block editor components (5 types + dispatcher)"
```

---

### Task 7: `WikiBlockEditor` — block list + auto-save orchestrator

**Files:**

- Create: `apps/ui/src/components/wiki/editor/WikiBlockEditor.tsx`

This is the main editing surface: renders all blocks using `WikiBlockCard`, manages the draft state, and handles auto-save with a 1500ms debounce.

- [ ] **Step 1: Create `WikiBlockEditor.tsx`**

```typescript
"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Icon } from "@iconify/react"
import { T } from "@/lib/design-tokens"
import {
  articleBodyToWikiDraft,
  wikiDraftToApiPayload,
  type WikiDraftBlock,
  type WikiDraftData,
} from "@/lib/wikiEditorUtils"
import { WikiBlockCard } from "./WikiBlockCard"

const BLOCK_TYPES: { component: WikiDraftBlock["__component"]; label: string }[] = [
  { component: "content.rich-text", label: "Text" },
  { component: "content.image-block", label: "Image" },
  { component: "content.code-block", label: "Code" },
  { component: "content.quote-block", label: "Quote" },
  { component: "content.callout", label: "Callout" },
]

function makeEmptyBlock(component: WikiDraftBlock["__component"]): WikiDraftBlock {
  switch (component) {
    case "content.rich-text": return { __component: "content.rich-text", text: "", _dirty: true }
    case "content.image-block": return { __component: "content.image-block" }
    case "content.code-block": return { __component: "content.code-block", code: "" }
    case "content.quote-block": return { __component: "content.quote-block", quote: "" }
    case "content.callout": return { __component: "content.callout", type: "info", body: "" }
  }
}

type SaveState = "idle" | "saving" | "saved" | "error"

export function WikiBlockEditor({
  slug,
  locale,
  title: initialTitle,
  body: initialBody,
  existingSubmissionId,
  onSubmissionIdChange,
  editSummary,
  onEditSummaryChange,
}: {
  readonly slug: string
  readonly locale: string
  readonly title: string
  readonly body: Record<string, unknown>[]
  readonly existingSubmissionId?: number
  readonly onSubmissionIdChange: (id: number) => void
  readonly editSummary: string
  readonly onEditSummaryChange: (v: string) => void
}) {
  const [blocks, setBlocks] = useState<WikiDraftBlock[]>(() =>
    articleBodyToWikiDraft(initialBody)
  )
  const [saveState, setSaveState] = useState<SaveState>("idle")
  const submissionIdRef = useRef<number | undefined>(existingSubmissionId)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Sync submissionId from parent (e.g. loaded from GET on mount)
  useEffect(() => {
    submissionIdRef.current = existingSubmissionId
  }, [existingSubmissionId])

  const save = useCallback(
    async (currentBlocks: WikiDraftBlock[], currentSummary: string) => {
      setSaveState("saving")
      try {
        const draftData: WikiDraftData = {
          targetSlug: slug,
          locale,
          body: wikiDraftToApiPayload(currentBlocks) as WikiDraftData["body"],
          editSummary: currentSummary,
        }

        if (!submissionIdRef.current) {
          // Create new draft submission
          const res = await fetch(`/api/contribute/wiki/${slug}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ draftData }),
          })
          if (!res.ok) throw new Error("Create failed")
          const data = await res.json()
          const id = data?.data?.id ?? data?.id
          if (id) {
            submissionIdRef.current = id
            onSubmissionIdChange(id)
          }
        } else {
          // Update existing draft
          const res = await fetch(`/api/contribute/wiki/${slug}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ submissionId: submissionIdRef.current, draftData }),
          })
          if (!res.ok) throw new Error("Update failed")
        }

        setSaveState("saved")
        setTimeout(() => setSaveState("idle"), 2000)
      } catch {
        setSaveState("error")
      }
    },
    [slug, locale, onSubmissionIdChange]
  )

  // Debounced auto-save on block or summary changes
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      save(blocks, editSummary)
    }, 1500)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [blocks, editSummary, save])

  function updateBlock(index: number, updated: WikiDraftBlock) {
    setBlocks((prev) => prev.map((b, i) => (i === index ? updated : b)))
  }

  function moveBlock(index: number, direction: "up" | "down") {
    setBlocks((prev) => {
      const next = [...prev]
      const swap = direction === "up" ? index - 1 : index + 1
      ;[next[index], next[swap]] = [next[swap], next[index]]
      return next
    })
  }

  function deleteBlock(index: number) {
    setBlocks((prev) => prev.filter((_, i) => i !== index))
  }

  function addBlock(component: WikiDraftBlock["__component"]) {
    setBlocks((prev) => [...prev, makeEmptyBlock(component)])
  }

  const saveLabel =
    saveState === "saving"
      ? "Saving…"
      : saveState === "saved"
        ? "Saved"
        : saveState === "error"
          ? "Save failed"
          : "Auto-save on"

  const saveColor =
    saveState === "error"
      ? T.accent.danger
      : saveState === "saved"
        ? T.accent.ok
        : T.ink.faint

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* Save indicator */}
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <span style={{ fontFamily: T.font.mono, fontSize: "9px", letterSpacing: ".12em", textTransform: "uppercase", color: saveColor }}>
          {saveLabel}
        </span>
      </div>

      {/* Block list */}
      {blocks.map((block, index) => (
        <WikiBlockCard
          key={index}
          block={block}
          index={index}
          onChange={(updated) => updateBlock(index, updated)}
          onMoveUp={() => moveBlock(index, "up")}
          onMoveDown={() => moveBlock(index, "down")}
          onDelete={() => deleteBlock(index)}
          isFirst={index === 0}
          isLast={index === blocks.length - 1}
        />
      ))}

      {/* Add block row */}
      <div
        style={{
          display: "flex",
          gap: "6px",
          flexWrap: "wrap",
          paddingTop: "4px",
          borderTop: `1px solid ${T.border.line}`,
        }}
      >
        <span
          style={{
            fontFamily: T.font.mono,
            fontSize: "9px",
            letterSpacing: ".12em",
            textTransform: "uppercase",
            color: T.ink.faint,
            display: "flex",
            alignItems: "center",
            marginRight: "4px",
          }}
        >
          Add block
        </span>
        {BLOCK_TYPES.map((bt) => (
          <button
            key={bt.component}
            onClick={() => addBlock(bt.component)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "4px",
              fontFamily: T.font.mono,
              fontSize: "9px",
              letterSpacing: ".12em",
              textTransform: "uppercase",
              color: T.ink.low,
              background: "rgba(255,255,255,.04)",
              border: `1px solid ${T.border.line}`,
              borderRadius: "4px",
              padding: "4px 10px",
              cursor: "pointer",
            }}
          >
            <Icon icon="mdi:plus" width={10} />
            {bt.label}
          </button>
        ))}
      </div>

      {/* Edit summary */}
      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        <label
          style={{
            fontFamily: T.font.mono,
            fontSize: "9px",
            letterSpacing: ".12em",
            textTransform: "uppercase",
            color: T.ink.low,
          }}
        >
          Edit summary
        </label>
        <input
          type="text"
          value={editSummary}
          onChange={(e) => onEditSummaryChange(e.target.value)}
          placeholder="Briefly describe your changes…"
          style={{
            background: "rgba(255,255,255,.04)",
            border: `1px solid ${T.border.line}`,
            borderRadius: "6px",
            color: T.ink.base,
            fontFamily: T.font.sans,
            fontSize: "13px",
            padding: "10px 12px",
            outline: "none",
          }}
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd apps/ui && pnpm tsc --noEmit 2>&1 | grep "WikiBlockEditor" | head -10
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/ui/src/components/wiki/editor/WikiBlockEditor.tsx
git commit -m "feat(ui): WikiBlockEditor with auto-save orchestration"
```

---

### Task 8: `WikiEditorSidebar` — submission controls panel

**Files:**

- Create: `apps/ui/src/components/wiki/editor/WikiEditorSidebar.tsx`

This sidebar shows submission status and the "Submit for review" button. It appears to the right of the article body when edit mode is active.

- [ ] **Step 1: Create `WikiEditorSidebar.tsx`**

```typescript
"use client"

import { useState } from "react"
import { T } from "@/lib/design-tokens"

type SubmitState = "idle" | "submitting" | "submitted" | "error"

export function WikiEditorSidebar({
  submissionId,
  onSubmit,
}: {
  readonly submissionId?: number
  readonly onSubmit: () => Promise<void>
}) {
  const [submitState, setSubmitState] = useState<SubmitState>("idle")

  async function handleSubmit() {
    if (!submissionId) return
    setSubmitState("submitting")
    try {
      await onSubmit()
      setSubmitState("submitted")
    } catch {
      setSubmitState("error")
    }
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "16px",
        padding: "20px",
        background: T.bg.deep,
        border: `1px solid ${T.border.line}`,
        borderRadius: "10px",
        position: "sticky",
        top: "80px",
      }}
    >
      <span
        style={{
          fontFamily: T.font.mono,
          fontSize: "9px",
          letterSpacing: ".14em",
          textTransform: "uppercase",
          color: T.ink.faint,
        }}
      >
        Edit session
      </span>

      {/* Status indicator */}
      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span
            style={{
              width: "6px",
              height: "6px",
              borderRadius: "50%",
              flexShrink: 0,
              background:
                submitState === "submitted"
                  ? T.accent.ok
                  : submitState === "error"
                    ? T.accent.danger
                    : submissionId
                      ? T.accent.aurora
                      : T.ink.faint,
            }}
          />
          <span
            style={{
              fontFamily: T.font.mono,
              fontSize: "10px",
              letterSpacing: ".1em",
              textTransform: "uppercase",
              color: T.ink.low,
            }}
          >
            {submitState === "submitted"
              ? "Submitted for review"
              : submitState === "error"
                ? "Submission failed"
                : submissionId
                  ? "Draft saved"
                  : "No changes yet"}
          </span>
        </div>

        {submissionId && submitState !== "submitted" && (
          <span
            style={{
              fontFamily: T.font.mono,
              fontSize: "9px",
              color: T.ink.faint,
            }}
          >
            Draft #{submissionId}
          </span>
        )}
      </div>

      {/* Divider */}
      <div style={{ height: "1px", background: T.border.line }} />

      {/* Info */}
      <p
        style={{
          fontFamily: T.font.sans,
          fontSize: "11px",
          color: T.ink.dim,
          lineHeight: 1.6,
          margin: 0,
        }}
      >
        Changes are auto-saved as a draft. When ready, submit for editorial review. Approved edits publish immediately.
      </p>

      {/* Submit button */}
      {submitState !== "submitted" && (
        <button
          onClick={handleSubmit}
          disabled={!submissionId || submitState === "submitting"}
          style={{
            fontFamily: T.font.mono,
            fontSize: "10px",
            letterSpacing: ".14em",
            textTransform: "uppercase",
            color:
              !submissionId || submitState === "submitting"
                ? T.ink.faint
                : T.accent.aurora,
            background:
              !submissionId || submitState === "submitting"
                ? "rgba(255,255,255,.04)"
                : "rgba(127,223,255,.08)",
            border: `1px solid ${!submissionId || submitState === "submitting" ? T.border.line : "rgba(127,223,255,.25)"}`,
            borderRadius: "6px",
            padding: "10px",
            cursor:
              !submissionId || submitState === "submitting"
                ? "not-allowed"
                : "pointer",
            width: "100%",
          }}
        >
          {submitState === "submitting" ? "Submitting…" : "Submit for review →"}
        </button>
      )}

      {submitState === "error" && (
        <span
          style={{
            fontFamily: T.font.mono,
            fontSize: "10px",
            color: T.accent.danger,
            textAlign: "center",
          }}
        >
          Try again or reload the page.
        </span>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd apps/ui && pnpm tsc --noEmit 2>&1 | grep "WikiEditorSidebar" | head -10
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/ui/src/components/wiki/editor/WikiEditorSidebar.tsx
git commit -m "feat(ui): WikiEditorSidebar submission controls"
```

---

### Task 9: Convert `WikiArticlePage` to client component with edit mode

**Files:**

- Modify: `apps/ui/src/components/wiki/WikiArticlePage.tsx`

This is the largest change. The article page becomes a client component that detects `?edit=true` in the URL, verifies the user has `wiki_editor` or `editorial_board` role, fetches any existing draft, and renders the `WikiBlockEditor` + `WikiEditorSidebar` in place of the read-only body + right sidebar.

- [ ] **Step 1: Read the full `WikiArticlePage.tsx` to understand current structure**

Read `apps/ui/src/components/wiki/WikiArticlePage.tsx` (all 886 lines). Note:

- Where `"use client"` needs to be added (top of file, replacing any `import type` if needed)
- Where the article toolbar is (the "Report issue" button)
- Where `<ArticleBodyBlocks>` is rendered (the main body)
- Where the right sidebar is rendered (240px column)
- The props the component receives (especially `article` shape with `body`, `title`, `slug`, `locale`)

- [ ] **Step 2: Add `"use client"` and edit mode state**

At the very top of the file, add `"use client"` as the first line.

Then, inside the component function body (after props destructuring, before return), add:

```typescript
const searchParams = useSearchParams()
const [editMode, setEditMode] = useState(false)
const [canEdit, setCanEdit] = useState(false)
const [submissionId, setSubmissionId] = useState<number | undefined>()
const [editSummary, setEditSummary] = useState("")

useEffect(() => {
  const shouldEdit = searchParams.get("edit") === "true"
  if (!shouldEdit) return

  fetch("/api/profile/me", { cache: "no-store" })
    .then((r) => (r.ok ? r.json() : null))
    .then((data) => {
      const role = data?.data?.contributorRole as string | undefined
      if (role === "wiki_editor" || role === "editorial_board") {
        setCanEdit(true)
        setEditMode(true)
        // Load existing draft if any
        fetch(`/api/contribute/wiki/${article.slug}`, { cache: "no-store" })
          .then((r) => (r.ok ? r.json() : null))
          .then((d) => {
            if (d?.data?.id) setSubmissionId(d.data.id)
          })
      }
    })
    .catch(() => {})
}, [searchParams, article.slug])
```

Add required imports at the top:

```typescript
import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { WikiBlockEditor } from "@/components/wiki/editor/WikiBlockEditor"
import { WikiEditorSidebar } from "@/components/wiki/editor/WikiEditorSidebar"
```

- [ ] **Step 3: Add "Edit" button to the article toolbar**

In the toolbar section where the "Report issue" button lives, add an edit toggle button conditionally (visible to all, but activating edit mode requires role check):

```tsx
{
  canEdit && (
    <button
      onClick={() => setEditMode((m) => !m)}
      style={{
        fontFamily: T.font.mono,
        fontSize: "9px",
        letterSpacing: ".14em",
        textTransform: "uppercase",
        color: editMode ? T.accent.aurora : T.ink.low,
        background: editMode ? "rgba(127,223,255,.08)" : "transparent",
        border: `1px solid ${editMode ? "rgba(127,223,255,.25)" : T.border.line}`,
        borderRadius: "4px",
        padding: "5px 12px",
        cursor: "pointer",
      }}
    >
      {editMode ? "Exit edit" : "Edit article"}
    </button>
  )
}
```

- [ ] **Step 4: Replace body + right sidebar rendering in edit mode**

Find the section where the 3-column grid is rendered. The right sidebar column (240px) needs to conditionally render `WikiEditorSidebar` in edit mode. The main content column needs to conditionally render `WikiBlockEditor` instead of `ArticleBodyBlocks`.

In the main body column, wrap the body rendering:

```tsx
{
  editMode ? (
    <WikiBlockEditor
      slug={article.slug}
      locale={article.locale ?? "en"}
      title={article.title}
      body={(article.body ?? []) as Record<string, unknown>[]}
      existingSubmissionId={submissionId}
      onSubmissionIdChange={setSubmissionId}
      editSummary={editSummary}
      onEditSummaryChange={setEditSummary}
    />
  ) : (
    <ArticleBodyBlocks body={article.body} />
  )
}
```

In the right sidebar column (240px), prepend:

```tsx
{
  editMode && (
    <WikiEditorSidebar
      submissionId={submissionId}
      onSubmit={async () => {
        if (!submissionId) throw new Error("No draft")
        const res = await fetch(
          `/api/contribute/wiki/${article.slug}/finalize`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ submissionId }),
          }
        )
        if (!res.ok) throw new Error("Finalize failed")
      }}
    />
  )
}
```

- [ ] **Step 5: Verify TypeScript**

```bash
cd apps/ui && pnpm tsc --noEmit 2>&1 | grep "WikiArticlePage" | head -20
```

Expected: no TypeScript errors.

- [ ] **Step 6: Commit**

```bash
git add apps/ui/src/components/wiki/WikiArticlePage.tsx
git commit -m "feat(ui): WikiArticlePage edit mode with role gating and auto-save"
```

---

### Task 10: Strapi admin — `WikiEditDiffPanel` + wire to `ModerationDashboard`

**Files:**

- Create: `apps/strapi/src/plugins/content-moderation/admin/src/components/WikiEditDiffPanel.tsx`
- Modify: `apps/strapi/src/plugins/content-moderation/admin/src/pages/ModerationDashboard.tsx`

The diff panel shows the original wiki article body alongside the proposed `draftData.body` using word-level diff highlighting. Install the `diff` npm package in the content-moderation plugin.

- [ ] **Step 1: Install `diff` package in the plugin**

```bash
cd apps/strapi/src/plugins/content-moderation && pnpm add diff
pnpm add -D @types/diff
```

- [ ] **Step 2: Read `ModerationDashboard.tsx` lines 1260–1280**

Look at how `LibraryClaimPanel` and `FieldsPanel` are conditionally rendered in the expanded detail area. Note the exact condition and variable names used for `sub.submissionType`.

- [ ] **Step 3: Create `WikiEditDiffPanel.tsx`**

```typescript
import { diffWords } from "diff"

// Minimal Strapi Design System imports (already available in admin context)
const T = {
  bg: { deep: "#070b1e", surface: "#060b19" },
  ink: { base: "#f4f7ff", dim: "rgba(244,247,255,.72)", low: "rgba(244,247,255,.48)", faint: "rgba(244,247,255,.30)" },
  border: { line: "rgba(255,255,255,.08)" },
  font: { mono: "'JetBrains Mono', monospace", serif: "'Fraunces', serif", sans: "'Roboto', sans-serif" },
  accent: { aurora: "#7fdfff", amber: "#ffb88a", ok: "#8ef0b3" },
}

type StrapiBlockNode = {
  type: string
  children?: { type: string; text?: string }[]
  level?: number
}

function blockToText(block: StrapiBlockNode): string {
  if (!block.children) return ""
  return block.children.map((c) => c.text ?? "").join("")
}

function getDraftBodyText(draftData: Record<string, unknown>): string {
  const body = draftData.body
  if (!Array.isArray(body)) return ""
  return body
    .map((block: Record<string, unknown>) => {
      if (block.__component === "content.rich-text") {
        const blocks = block.body as StrapiBlockNode[] | undefined
        return blocks ? blocks.map(blockToText).join("\n") : ""
      }
      if (block.__component === "content.code-block") return block.code as string ?? ""
      if (block.__component === "content.quote-block") return block.quote as string ?? ""
      if (block.__component === "content.callout") return block.body as string ?? ""
      return ""
    })
    .filter(Boolean)
    .join("\n\n")
}

function getOriginalBodyText(fields: Record<string, unknown>): string {
  const body = fields.body
  if (!Array.isArray(body)) return ""
  return body
    .map((block: StrapiBlockNode) => blockToText(block))
    .filter(Boolean)
    .join("\n\n")
}

function DiffText({ original, proposed }: { original: string; proposed: string }) {
  const changes = diffWords(original, proposed)
  return (
    <span style={{ fontFamily: T.font.sans, fontSize: "13px", lineHeight: 1.7, color: T.ink.base }}>
      {changes.map((part, i) => (
        <span
          key={i}
          style={{
            background: part.added
              ? "rgba(142,240,179,.18)"
              : part.removed
                ? "rgba(255,138,138,.18)"
                : "transparent",
            color: part.added
              ? T.accent.ok
              : part.removed
                ? "#ff8a8a"
                : T.ink.base,
            textDecoration: part.removed ? "line-through" : "none",
          }}
        >
          {part.value}
        </span>
      ))}
    </span>
  )
}

export function WikiEditDiffPanel({
  sub,
}: {
  readonly sub: {
    id: number
    submissionType: string
    draftData?: Record<string, unknown>
    fields?: Record<string, unknown>
    editSummary?: string
  }
}) {
  const draftData = sub.draftData ?? {}
  const fields = sub.fields ?? {}
  const proposedText = getDraftBodyText(draftData)
  const originalText = getOriginalBodyText(fields)
  const targetSlug = (draftData.targetSlug as string) ?? ""
  const locale = (draftData.locale as string) ?? "en"

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
        <span
          style={{
            fontFamily: T.font.mono,
            fontSize: "10px",
            letterSpacing: ".14em",
            textTransform: "uppercase",
            color: T.ink.faint,
          }}
        >
          Wiki edit · {targetSlug} · {locale.toUpperCase()}
        </span>
        {sub.editSummary && (
          <span
            style={{
              fontFamily: T.font.sans,
              fontSize: "12px",
              color: T.ink.dim,
              fontStyle: "italic",
            }}
          >
            "{sub.editSummary}"
          </span>
        )}
      </div>

      {/* Legend */}
      <div style={{ display: "flex", gap: "16px" }}>
        {[
          { color: "rgba(142,240,179,.18)", textColor: T.accent.ok, label: "Added" },
          { color: "rgba(255,138,138,.18)", textColor: "#ff8a8a", label: "Removed" },
        ].map((item) => (
          <div key={item.label} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span
              style={{
                display: "inline-block",
                width: "12px",
                height: "12px",
                borderRadius: "2px",
                background: item.color,
              }}
            />
            <span
              style={{
                fontFamily: T.font.mono,
                fontSize: "9px",
                letterSpacing: ".12em",
                textTransform: "uppercase",
                color: item.textColor,
              }}
            >
              {item.label}
            </span>
          </div>
        ))}
      </div>

      {/* Diff section */}
      {proposedText || originalText ? (
        <div
          style={{
            background: T.bg.deep,
            border: `1px solid ${T.border.line}`,
            borderRadius: "8px",
            padding: "20px",
          }}
        >
          <p style={{ margin: "0 0 4px", fontFamily: T.font.mono, fontSize: "9px", letterSpacing: ".12em", textTransform: "uppercase", color: T.ink.faint }}>
            Article body
          </p>
          <DiffText original={originalText} proposed={proposedText} />
        </div>
      ) : (
        <div
          style={{
            background: T.bg.deep,
            border: `1px solid ${T.border.line}`,
            borderRadius: "8px",
            padding: "20px",
          }}
        >
          <span style={{ fontFamily: T.font.sans, fontSize: "13px", color: T.ink.faint }}>
            No diff data available — draft body is empty or fields not stored.
          </span>
        </div>
      )}

      {/* Title change if any */}
      {draftData.title && fields.title && draftData.title !== fields.title && (
        <div
          style={{
            background: T.bg.deep,
            border: `1px solid ${T.border.line}`,
            borderRadius: "8px",
            padding: "20px",
          }}
        >
          <p style={{ margin: "0 0 8px", fontFamily: T.font.mono, fontSize: "9px", letterSpacing: ".12em", textTransform: "uppercase", color: T.ink.faint }}>
            Title change
          </p>
          <DiffText original={fields.title as string} proposed={draftData.title as string} />
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Wire `WikiEditDiffPanel` into `ModerationDashboard.tsx`**

Read lines 1260–1275 of `ModerationDashboard.tsx` to find the exact conditional. It will look something like:

```tsx
{
  sub.submissionType === "library_claim" ? (
    <LibraryClaimPanel sub={sub} />
  ) : (
    <FieldsPanel fields={sub.fields} />
  )
}
```

Replace that conditional with:

```tsx
{
  sub.submissionType === "library_claim" ? (
    <LibraryClaimPanel sub={sub} />
  ) : sub.submissionType === "wiki_edit" ? (
    <WikiEditDiffPanel sub={sub} />
  ) : (
    <FieldsPanel fields={sub.fields} />
  )
}
```

Also add the import at the top of `ModerationDashboard.tsx`:

```typescript
import { WikiEditDiffPanel } from "../components/WikiEditDiffPanel"
```

- [ ] **Step 5: Build the plugin to verify**

```bash
cd apps/strapi/src/plugins/content-moderation && pnpm build 2>&1 | tail -20
```

Expected: build completes without TypeScript errors.

- [ ] **Step 6: Commit**

```bash
git add apps/strapi/src/plugins/content-moderation/admin/src/components/WikiEditDiffPanel.tsx
git add apps/strapi/src/plugins/content-moderation/admin/src/pages/ModerationDashboard.tsx
git add apps/strapi/src/plugins/content-moderation/package.json
git commit -m "feat(strapi): WikiEditDiffPanel editorial diff for wiki_edit submissions"
```

---

### Task 11: Final integration check

**Files:** No new files.

- [ ] **Step 1: Build both apps**

```bash
cd apps/strapi && pnpm build 2>&1 | tail -20
cd apps/ui && pnpm build 2>&1 | tail -30
```

Expected: both complete without errors. Warnings about `img` element or unused variables are acceptable. TypeScript errors are not.

- [ ] **Step 2: Check TypeScript across the monorepo**

```bash
cd apps/ui && pnpm tsc --noEmit 2>&1 | grep "error TS" | head -20
cd apps/strapi && pnpm tsc --noEmit 2>&1 | grep "error TS" | head -20
```

Expected: no `error TS` lines.

- [ ] **Step 3: Manual smoke test checklist**

Start Strapi (`cd apps/strapi && pnpm develop`) and the UI (`cd apps/ui && pnpm dev`).

1. Log in as a user with `wiki_editor` contributor role.
2. Navigate to any wiki article — confirm no edit controls visible by default.
3. Append `?edit=true` to the URL — confirm edit toolbar appears with "Edit article" button.
4. Click "Edit article" — confirm `WikiBlockEditor` renders with the article's existing blocks.
5. Edit a text block — confirm auto-save triggers after 1.5s and "Saved" appears.
6. Click "Submit for review" — confirm the submission appears in the Strapi Moderation Dashboard with `submissionType: wiki_edit`.
7. In the Moderation Dashboard, expand the `wiki_edit` submission — confirm `WikiEditDiffPanel` renders with word-level diff.
8. Approve the submission — confirm the wiki article is updated and published in Strapi.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: final integration verification — wiki contribution workflow"
```

---

## Self-Review

**Spec coverage check:**

- Role gating (`wiki_editor`/`editorial_board`) — Task 5 (API routes) + Task 9 (page)
- Auto-save draft → content-moderation submission — Task 7 (`WikiBlockEditor`)
- Submit for review (finalize) — Task 8 (`WikiEditorSidebar`) + Task 5 (finalize route)
- `applyWikiEdit` publishes on approval — Task 1
- Editorial diff panel — Task 10
- Quick-wins `edit_wiki` — Tasks 2 + 3
- Image upload — Task 5 (`/api/upload` route) + Task 6 (`WikiImageBlockEditor`)
- All 5 block types editable — Task 6
- `"use client"` conversion of `WikiArticlePage` — Task 9

**No placeholders confirmed** — all tasks contain complete code.

**Type consistency confirmed:**

- `WikiDraftBlock` type union defined in Task 4, used identically in Tasks 6, 7, 8, 9
- `WikiDraftData.body` typed as `WikiDraftBlock[]` cast to `Record<string,unknown>[]` for API — explicit cast in Task 7
- `submissionId` is `number | undefined` throughout Tasks 7, 8, 9
- `applyWikiEdit` reads `draftData.targetSlug` (string) — matches `WikiDraftData.targetSlug` from Task 4
