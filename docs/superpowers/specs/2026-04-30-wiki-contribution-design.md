# Wiki Contribution Workflow — Design Spec

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow users with the `wiki_editor` or `editorial_board` contributor role to create and edit wiki articles via the frontend, with changes flowing through the existing content-moderation review queue, a rendered editorial-style diff view for reviewers, automatic application on approval, and full integration with the rewards system.

**Architecture:** Content-moderation submissions (existing plugin, `wiki_edit` type) store proposed changes as structured `draftData`. Auto-save debounce mirrors the library edit workflow. On approval, a new Strapi service side-effect writes the changes to the wiki article's draft state. The Moderation Dashboard gains a `WikiEditDiffPanel` that renders content as the article would appear — not a code diff — with word-level highlights only where content changed.

**Tech Stack:** Next.js 15 App Router, Better Auth (session + role check), Strapi v5 content-moderation plugin, `diff` npm package (word-level diffing), inline styles + T design tokens, `@strapi/blocks-react-renderer` (existing, reused for diff rendering), Sonner toasts.

---

## Scope

### In scope (v1)

- Edit existing wiki articles: `/contribute/wiki/[slug]`
- Create new wiki articles: `/contribute/wiki/new`
- All 5 dynamic zone block types: `rich-text`, `image-block`, `code-block`, `quote-block`, `callout`
- Auto-save draft to `cm_submissions.draftData`
- Submit for review (finalize draft → `status: pending`)
- Wiki Editor tab in `ContributeBottomNav`
- `WikiEditDiffPanel` in Strapi Moderation Dashboard
- Approval side-effect: writes `draftData` to wiki article's Strapi draft
- Rewards: 15 pts awarded on `wiki_edit` approval

### Out of scope (v1)

- Adding new image blocks (v1 only supports editing `caption` and `fullWidth` on existing image blocks; the image itself is read-only. Binary upload and new image insertion are v2 enhancements.)
- Per-block inline reviewer comments (v1 shows comment thread at submission level only)
- Translation/locale editing (v1 edits `en` locale only)
- Markdown import/export
- Conflict resolution if the published article changed between draft creation and approval

---

## Role Gating

Wiki editor routes and API endpoints require `contributorRole === 'wiki_editor' OR 'editorial_board'`.

- Role is stored in `user-profile.contributorRole`
- Checked server-side in Next.js API routes via `profile/me` fetch
- Frontend gate: redirect to `/contribute` with `?locked=wiki_editor` if role insufficient
- Role assignment: manual, by editorial board in Strapi admin — no self-assignment

---

## Data Model

### `draftData` shape stored in `cm_submissions`

For **edits** (`submissionType: "wiki_edit"`):

```ts
interface WikiEditDraftData {
  // Article metadata (only fields the editor changed)
  title?: string
  summary?: string
  articleStatus?: "stable" | "beta" | "experimental" | "draft" | "deprecated"

  // Body: full proposed dynamic zone array
  body: WikiDraftBlock[]

  // Snapshot of published body at the time the editor opened the draft
  // Used as stable diff target even if the article is updated during review
  originalBody: WikiDraftBlock[]

  // Contributor description of what changed
  editSummary: string

  // Stable reference so the approval side-effect knows which document to update
  targetDocumentId: string
}
```

For **new articles** (`submissionType: "wiki_edit"`, `targetDocumentId: null`):

```ts
interface WikiNewDraftData {
  title: string
  summary?: string
  slug: string // proposed slug (editorial board may adjust before publish)
  sectionDocumentId?: string
  articleStatus: "stable" | "beta" | "experimental" | "draft" | "deprecated"
  body: WikiDraftBlock[]
  editSummary: string
  targetDocumentId: null // null signals "create new" to the approval side-effect
}
```

### `WikiDraftBlock` — the frontend editor format

Each block in `body` / `originalBody` uses this discriminated union, matching the Strapi component structure exactly so the approval side-effect can write `draftData.body` directly to Strapi without conversion:

```ts
type WikiDraftBlock =
  | {
      __component: "content.rich-text"
      id?: number
      body: StrapiBlocksNode[] // Strapi Blocks AST — stored as-is from original,
      // replaced by a basic paragraph array when editor saves plain text
    }
  | {
      __component: "content.code-block"
      id?: number
      code: string
      language: string
      filename?: string
    }
  | {
      __component: "content.quote-block"
      id?: number
      quote: string
      attribution?: string
      source?: string
    }
  | {
      __component: "content.callout"
      id?: number
      type: "info" | "warning" | "tip" | "note"
      title?: string
      body: string
    }
  | {
      __component: "content.image-block"
      id?: number
      // v1: image itself is read-only (retains original Strapi media reference via id)
      // Only caption and fullWidth are editable
      strapiImageId?: number // original Strapi media record id — passed through on approval
      imageUrl?: string // display-only: used to render the image in the editor
      caption?: string
      fullWidth?: boolean
    }
```

**`rich-text` editor note:** The `body` field is a Strapi Blocks AST (complex JSON). In the frontend editor, we display a `<textarea>` containing the plain text extracted from the AST. On save, we reconstruct a minimal Strapi Blocks array: one `paragraph` node per non-empty line. This covers 95% of wiki editing needs. The original formatting (bold, links, headings) is preserved if the editor did not modify the block — we only re-serialise blocks the editor touched.

**`image-block` editor note:** v1 does not allow replacing or adding images. Existing `image-block` entries in an article are shown with a read-only preview; the editor may only change `caption` and `fullWidth`. The `strapiImageId` (original Strapi media record integer id) is carried through in `draftData` unchanged so the approval side-effect can pass `{ image: { id: strapiImageId } }` directly to the Strapi documents API.

---

## Frontend Surfaces

### 1. Wiki Editor — `/contribute/wiki/[slug]` (edit) + `/contribute/wiki/new` (new)

**Layout:** Three-column — matches the existing `WikiArticlePage` grid (`280px | flex-1 | 240px`) but repurposed for editing:

```
[Left: Article nav (reused)]  [Center: Block editor]  [Right: Submission metadata]
```

**Center — Block editor (`WikiBlockEditor` client component):**

- Loads the current published article body on mount (pre-fills blocks)
- On load: checks for an existing `draft` submission via `GET /api/content-moderation/submissions/draft/wiki_edit?targetSlug={slug}` — if found, shows "Resume draft · saved {time}" banner and pre-fills from `draftData`
- Block list rendered top-to-bottom; each block is a `WikiBlockCard`
- Between blocks: a `+` button opens a small type-picker popover (4 options: rich-text, code-block, quote-block, callout — image-block excluded in v1)
- Each block has: up/down reorder arrows, a delete button, the block-type editor
- **Auto-save:** 1500ms debounce after any change — `PATCH /api/content-moderation/submissions/:id/draft` (or `POST /api/content-moderation/submissions` with `asDraft: true` for first save). Shows "DRAFT SAVED · HH:MM" mono label in top-right.

**Per-block editors (`WikiBlockCard`):**

| Block type            | Editor UI                                                                                                                                                                            |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `content.rich-text`   | Full-width `<textarea>` (auto-resize); placeholder "Write in plain text. Basic formatting preserved if block was untouched."                                                         |
| `content.code-block`  | Monospace `<textarea>` + language `<select>` (plaintext/js/ts/python/bash/json/css/html/other) + optional filename text input                                                        |
| `content.quote-block` | Quote `<textarea>` + attribution text input + source text input                                                                                                                      |
| `content.callout`     | Type selector chips (info/warning/tip/note) + optional title input + body `<textarea>`                                                                                               |
| `content.image-block` | Read-only image preview (existing image, cannot be replaced in v1) + caption text input + full-width toggle. Cannot be added as a new block in v1 (excluded from block type picker). |

Each `WikiBlockCard` is visually styled to match the rendered block appearance (same colour treatment as `ArticleBodyBlocks`), but with inputs in place of rendered content. The card has a subtle left border that matches the block type's accent colour.

**Right sidebar — `WikiEditorSidebar`:**

```
ARTICLE INFO
  Section:     [select]
  Status:      [select]

YOUR DRAFT
  Saved:       2 min ago
  Status:      DRAFT / OPEN FOR REVIEW
  Edit summary: [textarea, 240 char max]

LIVE VERSION
  Published:   3 days ago
  Status:      ● Stable
  [View live article ↗]
```

Mono labels, low-contrast, same card treatment as WikiArticlePage's right panel.

**Bottom bar — `WikiEditorBottomBar`:**

```
[DISCARD DRAFT]          [SAVE DRAFT]    [PREVIEW]    [SUBMIT FOR REVIEW →]
```

- **Discard:** confirms, deletes draft submission, navigates to article
- **Save draft:** manual save (same auto-save logic but immediate)
- **Preview:** opens a modal rendering `draftData.body` through `ArticleBodyBlocks` — shows the article as it would look
- **Submit for review:** calls `PATCH /api/content-moderation/submissions/:id/finalize` → sets `status: pending`. Navigates to `/contribute/submissions` with success toast.

**New article page (`/contribute/wiki/new`):**

Same layout, but with extra fields at the top: Title (text input), Slug (auto-generated from title, editable), Summary (textarea), Section (select). Body starts with one empty `rich-text` block.

---

### 2. Wiki Editor tab in `ContributeBottomNav`

Add `WIKI EDITOR` as the 4th tab (between `EDIT (DIFF)` and `MY SUBMISSIONS`). Tab link: `/contribute/wiki`. On `/contribute/wiki` there is a search/picker to find an article to edit, or a "New article" CTA (shown only to `wiki_editor`/`editorial_board`). Tab is always visible but clicking while lacking the role shows the locked state with a tooltip.

**`/contribute/wiki` landing page** (`WikiEditorHub`):

- Heading: "Edit the _project docs._" (serif, matching hub style)
- Search bar: finds wiki articles by title (MeiliSearch or simple Strapi title search)
- Result list: article title, section, status badge, last edited date, "Edit →" link
- "Write a new article" CTA button (role-gated, aurora style)
- If role is insufficient: the entire page shows a locked state with role requirement message

---

### 3. Next.js API routes (new)

| Route                         | Method | Purpose                                                      |
| ----------------------------- | ------ | ------------------------------------------------------------ |
| `/api/contribute/wiki/[slug]` | GET    | Load article + any existing draft for this slug; checks role |
| `/api/contribute/wiki/[slug]` | POST   | Create initial draft submission for this article             |
| `/api/contribute/wiki/new`    | POST   | Create initial draft for a new article                       |

All routes: session-required + `contributorRole` check. Proxy to Strapi content-moderation endpoints with `X-Service-Secret` + `X-Ba-User-*` headers (existing pattern).

---

## Moderation Dashboard — `WikiEditDiffPanel`

Added as a new panel inside the existing `ModerationDashboard.tsx` when `submission.submissionType === "wiki_edit"`.

### Layout

```
[  Article title  ·  Section  ·  Status  ·  Contributor  ]
[ N blocks modified  ·  N added  ·  N removed             ]

[ block card 1 — unchanged, collapsed                     ]
[ block card 2 — MODIFIED                                  ]
  [ before: rendered block content                         ]
  [ after:  rendered block content, changed words tinted   ]
[ block card 3 — ADDED (full aurora left border)          ]
[ block card 4 — REMOVED (full danger left border, dimmed)]

[ Show 3 unchanged blocks ▾                               ]

EDIT SUMMARY
  "{editSummary from contributor}"

[Add comment]   [Request changes]   [Approve]   [Approve & merge ↗]
```

### Block diff logic

Blocks are matched by index position (not by id, since new blocks have no id). For each pair `(originalBody[i], draftData.body[i])`:

- **Same `__component`, no content change:** collapsed card, "UNCHANGED" chip
- **Same `__component`, content changed:** expanded card; word-level diff using `diff` package (`diffWords(extractText(original), extractText(proposed))`). Changed words highlighted: removed words in `rgba(255,138,138,.25)` with faint strikethrough, added words in `rgba(142,240,179,.25)`. Both the original and proposed rendered content are shown stacked (original above, proposed below) within a single card — not side-by-side columns. This is the "middle ground" — it reads like editorial content, not a code patch.
- **Block added** (index only in draftData): aurora left border (`T.accent.aurora`), "ADDED" chip, full proposed content shown
- **Block removed** (index only in originalBody): danger left border (`T.accent.danger`), "REMOVED" chip, original content shown dimmed

**`extractText(block)`** — utility that pulls plain text from a block for diffing:

- `rich-text`: recursively extracts text nodes from Strapi Blocks AST
- `code-block`: `block.code`
- `quote-block`: `${block.quote} ${block.attribution ?? ""}`
- `callout`: `${block.title ?? ""} ${block.body}`
- `image-block`: `${block.imageUrl} ${block.caption ?? ""}`

For `rich-text` blocks, the diff is shown on the **rendered** content (using `@strapi/blocks-react-renderer` for `originalBody` and a simple paragraph renderer for edited text) — the highlight overlay is applied on top of the rendered output via a `<mark>` wrapper injected around changed spans.

### Reviewer actions

Four buttons in the bottom bar (matching existing `ModerationDashboard` action pattern):

- **Add comment:** opens a textarea in a flyout, submits a `reviewNote` without changing status
- **Request changes:** sets `status: needs_info` + `reviewNote`
- **Approve:** sets `status: approved` (triggers approval side-effect — see below)
- **Approve & merge:** sets `status: approved` then immediately opens the wiki article in Strapi Content Manager in a new tab for final publishing

---

## Strapi Backend Changes

### 1. Content-moderation service — approval side-effect for `wiki_edit`

In `apps/strapi/src/plugins/content-moderation/server/services/submission.ts`, add to `updateStatus()` after the status is saved:

```ts
if (status === "approved" && submission.submissionType === "wiki_edit") {
  await applyWikiEdit(strapi, submission)
}
```

New private function `applyWikiEdit(strapi, submission)`:

```ts
async function applyWikiEdit(strapi, submission) {
  const { draftData } = submission
  if (!draftData) return

  const isNew = draftData.targetDocumentId === null

  if (isNew) {
    // Create new wiki article as a Strapi draft
    await strapi.documents("api::wiki-article.wiki-article").create({
      data: {
        title: draftData.title,
        slug: draftData.slug,
        summary: draftData.summary ?? "",
        body: draftData.body,
        articleStatus: draftData.articleStatus ?? "draft",
        // section set by documentId if provided
        ...(draftData.sectionDocumentId
          ? {
              section: {
                connect: [{ documentId: draftData.sectionDocumentId }],
              },
            }
          : {}),
      },
      status: "draft", // leave as draft; editorial board publishes from admin
    })
  } else {
    // Update existing wiki article's draft
    await strapi.documents("api::wiki-article.wiki-article").update({
      documentId: draftData.targetDocumentId,
      data: {
        ...(draftData.title !== undefined ? { title: draftData.title } : {}),
        ...(draftData.summary !== undefined
          ? { summary: draftData.summary }
          : {}),
        ...(draftData.articleStatus !== undefined
          ? { articleStatus: draftData.articleStatus }
          : {}),
        ...(draftData.body !== undefined ? { body: draftData.body } : {}),
      },
      status: "draft",
    })
  }
}
```

### 2. Rewards — award points on `wiki_edit` approval

In `updateStatus()`, after the `applyWikiEdit` call:

```ts
if (status === "approved") {
  const POINTS_BY_TYPE: Record<string, number> = {
    new_library: 50,
    library_edit: 15,
    wiki_edit: 15,
    // ...existing entries
  }
  const pts = POINTS_BY_TYPE[submission.submissionType] ?? 5
  try {
    await strapi
      .service("plugin::rewards.points")
      .award(submission.submittedByUserId, pts, submission.submissionType)
  } catch {
    /* rewards optional */
  }

  // Invalidate quick wins cache
  try {
    await strapi
      .service("api::user-profile.quick-wins")
      .computeAndSave(submission.submittedByUserId)
  } catch {
    /* non-blocking */
  }
}
```

### 3. Quick-wins — `ruleEditWiki` for wiki_editor role users

In `apps/strapi/src/api/user-profile/services/quick-wins.ts`, add a new rule:

```ts
async ruleEditWiki(profile: any): Promise<QuickWin[]> {
  // Only surface this rule for wiki editors
  if (
    profile.contributorRole !== "wiki_editor" &&
    profile.contributorRole !== "editorial_board"
  ) {
    return []
  }

  // Find wiki articles that are in "beta" or "experimental" status (likely need editing)
  const articles = await strapi.db
    .query("api::wiki-article.wiki-article")
    .findMany({
      where: {
        publishedAt: { $ne: null },
        locale: "en",
        articleStatus: { $in: ["beta", "experimental"] },
      },
      limit: 3,
      select: ["id", "documentId", "title", "slug", "articleStatus"],
    })

  return articles.map((article: any) => ({
    winId: `edit_wiki-${article.slug}`,
    type: "edit_wiki" as const,
    title: `Improve a wiki article`,
    description: `"${article.title}" is marked ${article.articleStatus}. Your edits help the community.`,
    points: 15,
    estimatedMinutes: 10,
    rewardLabel: "SCRIBE",
    actionUrl: `/contribute/wiki/${article.slug}`,
    targetSlug: article.slug,
  }))
},
```

Add `"edit_wiki"` to the `QuickWinType` union and `ICON_MAP`/`CTA_LABEL` in `QuickWinCard.tsx`.

Also add `ruleEditWiki` to the `Promise.all` in `computeForUser`.

### 4. ModerationDashboard — `WikiEditDiffPanel` component

New file: `apps/strapi/src/plugins/content-moderation/admin/src/components/WikiEditDiffPanel.tsx`

Uses `diff` npm package (add to `apps/strapi/src/plugins/content-moderation/package.json`).

The panel is rendered inside `ModerationDashboard.tsx` when `submission.submissionType === "wiki_edit"` (replacing the generic JSON `fields` display that currently shows for this type).

---

## File Structure

### New Next.js files

```
apps/ui/src/app/[locale]/contribute/wiki/
  page.tsx                                     — WikiEditorHub (article picker + new CTA)
  new/
    page.tsx                                   — New article page (RSC auth + role gate)
    _components/
      NewArticleEditor.tsx                     — client, extends WikiBlockEditor for new articles
  [slug]/
    page.tsx                                   — Edit article page (RSC, loads article + draft)
    _components/
      WikiEditorShell.tsx                      — client orchestrator
      WikiBlockEditor.tsx                      — block list manager (add/remove/reorder)
      WikiBlockCard.tsx                        — single block editor (dispatches to sub-editors)
      blocks/
        RichTextBlockEditor.tsx
        CodeBlockEditor.tsx
        QuoteBlockEditor.tsx
        CalloutBlockEditor.tsx
        ImageBlockEditor.tsx
      WikiEditorSidebar.tsx                    — right sidebar (article meta + draft status)
      WikiEditorBottomBar.tsx                  — save/preview/submit actions
      WikiPreviewModal.tsx                     — renders draftData.body via ArticleBodyBlocks

apps/ui/src/app/api/contribute/wiki/
  [slug]/route.ts                              — GET article + draft, POST create draft
  new/route.ts                                 — POST create new article draft
```

### New Strapi files

```
apps/strapi/src/plugins/content-moderation/admin/src/components/
  WikiEditDiffPanel.tsx                        — diff panel for ModerationDashboard
  WikiDiffBlock.tsx                            — single block diff card
  diffUtils.ts                                 — extractText(), diffBlocks() helpers
```

### Modified files

```
apps/strapi/src/plugins/content-moderation/server/services/submission.ts
  — add applyWikiEdit side-effect in updateStatus()
  — add points award + quick-wins invalidation

apps/strapi/src/plugins/content-moderation/admin/src/pages/ModerationDashboard.tsx
  — render WikiEditDiffPanel for wiki_edit submissions

apps/strapi/src/plugins/content-moderation/package.json
  — add "diff": "^5.2.0"

apps/strapi/src/api/user-profile/services/quick-wins.ts
  — add ruleEditWiki rule
  — add "edit_wiki" to QuickWin type union
  — add rule to computeForUser Promise.all

apps/ui/src/app/[locale]/contribute/_components/ContributeBottomNav.tsx
  — add WIKI EDITOR tab (4th position)

apps/ui/src/components/library/QuickWinCard.tsx
  — add edit_wiki to ICON_MAP and CTA_LABEL

apps/ui/src/lib/types/profile.ts
  — add "edit_wiki" to QuickWinType union
```

---

## Security Summary

| Surface                                               | Check                                                                             |
| ----------------------------------------------------- | --------------------------------------------------------------------------------- |
| `/contribute/wiki/*` pages                            | RSC: session required + `contributorRole` in `['wiki_editor', 'editorial_board']` |
| `/api/contribute/wiki/*` routes                       | Server-side: same session + role check via `/api/profile/me`                      |
| `POST /api/content-moderation/submissions`            | Existing `resolveUser` in Strapi controller                                       |
| `PATCH /api/content-moderation/submissions/:id/draft` | Existing ownership check (`submittedByUserId === user.id`)                        |
| Approval side-effect                                  | Runs inside Strapi service, no external auth surface                              |
| Strapi wiki article update                            | Service-to-service (no external exposure)                                         |

---

## UX Details

### Auto-save indicator

Top-right of editor: `DRAFT SAVED · 14:32` (mono, `T.ink.faint`). Pulses briefly on save. If offline/error: `SAVE FAILED · RETRY` in `T.accent.warn`.

### Edit summary requirement

The "Submit for review" button is disabled until `editSummary.trim().length >= 10`. Tooltip: "Add a short description of your changes before submitting."

### Empty state for new wiki editors

When a `wiki_editor` visits `/contribute/wiki` for the first time (no prior submissions), show a welcome card: "You have Wiki Editor access. Choose an article to improve, or write a new one."

### Locked state for non-wiki-editors

`/contribute/wiki` renders a locked card with: "PATH-03 · WIKI EDITOR" chip, lock icon, "This path requires Wiki Editor access. Ask an editorial board member to grant it." No redirect — the page is still reachable, just clearly gated.

---

## Approval Flow Summary

1. Editor opens `/contribute/wiki/[slug]`
2. Article body pre-loaded; editor makes changes
3. Auto-save creates/updates `cm_submissions` record with `status: draft`, `draftData: { body, originalBody, editSummary, targetDocumentId }`
4. Editor clicks "Submit for review" → `PATCH /finalize` → `status: pending`
5. Submission appears in Moderation Dashboard queue
6. Editorial board member opens submission → `WikiEditDiffPanel` renders rendered diff
7. Board member clicks "Approve" → `status: approved`
8. `applyWikiEdit()` runs: writes `draftData.body` to wiki article as Strapi draft
9. 15 pts awarded to contributor
10. Quick-wins cache invalidated for contributor
11. Board member opens Strapi Content Manager → publishes the draft
12. Submission shows as `approved` in contributor's My Submissions dashboard
