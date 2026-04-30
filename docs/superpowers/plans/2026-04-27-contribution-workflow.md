# Contribution Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a full Wikipedia-style contribution system — hub landing page, add-library wizard, edit-library diff workflow, my-submissions tracker — wired to the existing content-moderation Strapi plugin and user roles.

**Architecture:** All contributions are `cm_submissions` records in the `content-moderation` plugin. The Next.js `/contribute/*` routes provide the authoring UI. The Strapi admin `Moderation` plugin (already built) is the editorial review screen. User roles live on `user-profile.contributorRole`.

**Tech Stack:** Next.js 15 App Router, Better Auth (session), Strapi v5 content-moderation plugin, TanStack Query, @iconify/react, sonner toasts, inline-styles + T design tokens.

---

## Current state (read before implementing)

### What exists in Strapi

- `content-moderation` plugin (`apps/strapi/src/plugins/content-moderation/`):
  - Schema: `plugin::content-moderation.submission` with fields: `submissionType` (enum), `status` (pending/approved/rejected/needs_info), `targetEntityType`, `targetDocumentId`, `targetSlug`, `fields` (JSON), `note`, `reviewNote`, `submittedByUserId`, `submittedByEmail`, `submittedByName`, `reviewedByUserId`, `reviewedAt`
  - Routes: `GET /api/content-moderation/submissions`, `POST /api/content-moderation/submissions`, `GET /api/content-moderation/submissions/my`, `PATCH /api/content-moderation/submissions/:id/status`
  - Service: create, findAll, findByUser, updateStatus (with side-effects for library_claim and topic_suggestion approval)
  - Admin: `ModerationDashboard` — functional queue with status filters, approve/reject/needs_info actions
  - Registered in `config/plugins.ts` as `content-moderation: { enabled: true, resolve: "./src/plugins/content-moderation" }`

- `user-profile` schema fields relevant here: `isVerifiedLibrarian`, `affiliationVerificationStatus`, `claimedLibraryEntityRef`, `contributorNumber`

- `useSubmissions` hook (`apps/ui/src/hooks/useSubmissions.ts`): `useMySubmissions()`, `useCreateSubmission()`

- `LibraryClaimButton` already exists and submits `library_claim` type to content-moderation

### What plugins.ts registers

Both `content-moderation` and `topics` plugins are correctly registered. **Plugin menu buttons don't show because the Strapi admin bundle hasn't been rebuilt.** Fix: `cd apps/strapi && pnpm build` then restart. This is a one-time admin build step.

### Key API note

Strapi base URL for client calls: `process.env.NEXT_PUBLIC_STRAPI_URL ?? "http://localhost:1337"`. Content-moderation plugin routes are under `/api/content-moderation/...`.

---

## Schema extensions needed (Stream A — do first)

### 1. Extend submission schema

Add to `apps/strapi/src/plugins/content-moderation/server/content-types/submission/schema.json`:

- `draftData` (json) — auto-saved form state for multi-step wizard
- `stepCompleted` (integer) — last completed step in add-library wizard (0-7)
- `editSummary` (string) — human-readable description of changes
- `evidenceType` (enumeration: `institutional_url`, `on_site_photo`, `press_release`, `personal_communication`, `my_institutional_affiliation`, `other`)
- `evidenceUrl` (string) — URL of evidence source
- `reviewerAssignedTo` (string) — BA user ID of assigned reviewer
- Update `submissionType` enum: add `library_edit` (edit to existing record, distinct from `correction`)

### 2. Extend user-profile schema

Add to `apps/strapi/src/api/user-profile/content-types/user-profile/schema.json`:

- `contributorRole` (enumeration: `reader`, `contributor`, `verified_librarian`, `wiki_editor`, `editorial_board`, default `contributor`)

### 3. Update auth-bridge upsert-profile

After schema change, add `contributorRole` to `allowedFields` array in `apps/strapi/src/api/auth-bridge/controllers/auth-bridge.ts`.

### 4. Extend content-moderation service

Add `saveDraft(documentId, draftData, stepCompleted)` method: upserts a pending submission's `draftData` and `stepCompleted`. Also add `findDraft(userId, submissionType)` — returns the latest pending submission of that type for the user (for resuming drafts).

### 5. Extend content-moderation routes

Add:

- `PATCH /api/content-moderation/submissions/:id/draft` → `submission.saveDraft`
- `GET /api/content-moderation/submissions/draft/:type` → `submission.findDraft`

### 6. Extend content-moderation controller

Add `saveDraft` and `findDraft` handlers mirroring existing auth pattern (check session via `strapi.betterAuth.api.getSession`).

### 7. Update useSubmissions hook

Add `useSaveDraft()` mutation and `useResumeDraft(type)` query to `apps/ui/src/hooks/useSubmissions.ts`.

### 8. Fix Strapi admin build

Run `pnpm build` from `apps/strapi/` to rebuild the admin bundle so the plugin menu entries appear.

---

## Stream B — Contribution Hub + shared navigation

### Files to create/modify

- Create: `apps/ui/src/app/[locale]/contribute/page.tsx` (RSC — fetches session + stats)
- Create: `apps/ui/src/app/[locale]/contribute/_components/ContributeHeroSection.tsx`
- Create: `apps/ui/src/app/[locale]/contribute/_components/ContributePathCards.tsx`
- Create: `apps/ui/src/app/[locale]/contribute/_components/ContributeGuidelinesSection.tsx`
- Create: `apps/ui/src/app/[locale]/contribute/_components/ContributeRolesTable.tsx`
- Create: `apps/ui/src/app/[locale]/contribute/_components/ContributeBottomNav.tsx` (client, active tab aware)
- Create: `apps/ui/src/app/[locale]/contribute/layout.tsx` (renders GlobalHeader + ContributeBottomNav)

### Design spec (from screenshot)

**Hero section:**

- Eyebrow: `§ The Contribution Plan · V.4 · April 2026` (mono, faint)
- H1: "Help us index the world's" in serif 700, then italic serif "reading rooms." on second line
- Body copy under headline (3 lines, 50ch max)
- Stats row: 4 cells with borders — Libraries Indexed (147,392), Pending Review (218), Open Contributors (9,840), Acceptance Rate (96.2%)
- Stats use `T.font.serif` for values, `T.font.mono` for labels

**Path cards section:**

- Heading: "Choose a path." with italic "path"
- Right: "PATHS GATED BY YOUR ROLE · VERIFIED LIBRARIAN" (mono faint)
- 4 path cards in 2×2 grid:
  - PATH-01 ANY ROLE | "Add a new library." — "Index a library that isn't on the atlas yet" | "~12 MIN · 7 STEPS" | aurora CTA "begin →"
  - PATH-02 ANY ROLE | "Edit an existing library." — "Refine a record that already exists" | "~6 MIN · DIFF REVIEW" | aurora CTA "find one →"
  - PATH-03 WIKI EDITOR | "Edit the project docs." — "Contributor guides, API references" | "~VARIES · MERGE REQUEST" | aurora CTA "open editor →"
  - PATH-04 EDITORIAL BOARD | "Triage the review queue." — "For editorial staff. 218 pending records await approval" | "REQUIRES 1/N+1" | label "locked" (faint, not a link unless user has role)
- Cards have: path number chip, role badge chip (ANY ROLE / WIKI EDITOR / EDITORIAL BOARD), italic serif title, description, time/step metadata, CTA

**Guidelines + Roles section** (two columns):

- Left: "What we ask of every contribution" — 4 bullet points with circle icons
- Right: "Roles & what each can do" — role table: Reader (Browse), Contributor (Add + Edit), Verified Librarian (fast-track review), Wiki Editor (Project docs), Editorial Board (Approve + Publish)

**Bottom navigation:**

- Fixed bottom bar, dark background `#030511`, top border line
- Tabs: HUB | ADD LIBRARY | EDIT (DIFF) | WIKI EDITOR | MY SUBMISSIONS
- Active tab shown with aurora underline or filled state
- Only show MY SUBMISSIONS if logged in
- This nav persists across all /contribute/\* routes via layout.tsx

### Role gating

- Path-03 (Wiki Editor): disabled/locked if `contributorRole` not `wiki_editor` or `editorial_board`
- Path-04 (Review Queue): disabled/locked if `contributorRole` not `editorial_board`
- Both Add Library and Edit Library require sign-in (show modal if not authed)

---

## Stream C — Add Library Wizard

### Files to create

- Create: `apps/ui/src/app/[locale]/contribute/add/page.tsx` (auth gate — redirect to signin if not authed)
- Create: `apps/ui/src/app/[locale]/contribute/add/_components/AddLibraryWizard.tsx` (client — main orchestrator)
- Create: `apps/ui/src/app/[locale]/contribute/add/_components/WizardStepNav.tsx` (left sidebar nav + completeness score)
- Create: `apps/ui/src/app/[locale]/contribute/add/_components/WizardCompletionSidebar.tsx` (right sidebar — checklist + editorial tip)
- Create: `apps/ui/src/app/[locale]/contribute/add/_components/steps/Step1Basics.tsx`
- Create: `apps/ui/src/app/[locale]/contribute/add/_components/steps/Step2Location.tsx`
- Create: `apps/ui/src/app/[locale]/contribute/add/_components/steps/Step3Visit.tsx`
- Create: `apps/ui/src/app/[locale]/contribute/add/_components/steps/Step4Collections.tsx`
- Create: `apps/ui/src/app/[locale]/contribute/add/_components/steps/Step5Building.tsx`
- Create: `apps/ui/src/app/[locale]/contribute/add/_components/steps/Step6Imagery.tsx`
- Create: `apps/ui/src/app/[locale]/contribute/add/_components/steps/Step7Sources.tsx`

### Layout (3-column)

```
[Left sidebar: step nav]  [Center: active step form]  [Right sidebar: completeness + tips]
     180px                       flex-1                        240px
```

On mobile: stack (step nav on top, then form, right sidebar hidden or modal).

### Left sidebar — WizardStepNav

Steps list with number + title + field summary:

1. Basics — Name · Type · Status
2. Location — Address · Coordinates
3. Visit — Hours · Admission
4. Collections — Stats · Classification
5. Building — Dates · Architect
6. Imagery — Photos · License
7. Sources & review — Evidence · Submit

Active step: aurora left border + brighter text.
Completed step: checkmark icon.

### Right sidebar — WizardCompletionSidebar

- "COMPLETENESS" label + score (e.g. "42 / 100") in large serif
- Progress bar (aurora fill)
- Checklist items (show which fields are filled):
  - Name & type
  - Coordinates
  - Operating status
  - At least one image
  - Catalogue or website URL
  - Collection statistics
  - Source citation
- "Editorial tip" box (conditionally shown for verified librarians)
- "Heads up" box (conflict of interest warning)

### Step content

**Step 1: Basics**
Fields: `name` (text, required), `shortName` (text), `libraryType` (select from enum), `operatorType` (select from enum), `operationalStatus` (select from enum)

**Step 2: Location**
Fields: `country` (select — load from Strapi countries), `region` (text — or select if country chosen), `city` (text), `streetAddress` (text), `postalCode` (text), `location` (lat/lng — two number inputs, with "Use map" placeholder)

**Step 3: Visit**
Fields: `operationalStatus` chip selector (Open / Temporarily closed / Permanently closed / Seasonal / Appointment only / Planned / Unknown), `openingTimes` (7-day schedule — Mon-Sun rows with time range inputs), `admissionInfo` (textarea, 600 char max), `visitNotes` (block editor or textarea), `bookingUrl` (text), `planAVisitUrl` (text), `membershipUrl` (text), `virtualTourUrl` (text), `donationUrl` (text), `transitInfo` (textarea)

**Step 4: Collections**
Fields: `catalogueUrl` (text), `website` (text), `iiifEndpoint` (text), `classificationSystem` (text), `collectionStats` (repeatable: value + category + description — add/remove rows), `foundedYear` (text), `openedYear` (text), `closedYear` (text)

**Step 5: Building**
Fields: `architect` (text), `architecturalStyle` (text), `builtYear` (text), `renovatedYear` (text), `building` description (textarea)

**Step 6: Imagery**
Fields: image upload (up to 5 images), `licenseType` per image (CC-BY 4.0 / CC-BY-SA / Public domain / Own work), alt text per image. Show current file count.

**Step 7: Sources & review**
Evidence type chips (multi-select): Institutional URL / On-site evidence (photo) / Press release / Personal communication / My institutional affiliation / Other. Evidence URL text input. Final notes textarea. Read-only summary of all filled fields. Submit button.

### Auto-save behavior

- Debounced 1500ms after any field change: call `POST /api/content-moderation/submissions` with `submissionType: "new_library"` and `draftData: formState` if no existing draft, OR `PATCH /api/content-moderation/submissions/:id/draft` if draft already exists.
- On page load: call `GET /api/content-moderation/submissions/draft/new_library` — if found, pre-fill form and show "Resuming draft · saved {time}".
- "DRAFT SAVED · HH:MM EST" indicator in top right (mono, faint).

### Submit

Final step "Submit for review" sets `status: pending` (transitions from draft). Redirect to `/contribute/submissions` with success toast.

---

## Stream D — Edit Library (Diff) Workflow

### Files to create

- Create: `apps/ui/src/app/[locale]/contribute/edit/page.tsx` (search/picker — find a library to edit)
- Create: `apps/ui/src/app/[locale]/contribute/edit/[slug]/page.tsx` (RSC — loads library data, session)
- Create: `apps/ui/src/app/[locale]/contribute/edit/[slug]/_components/EditLibraryDiff.tsx` (client — diff view)
- Create: `apps/ui/src/app/[locale]/contribute/edit/[slug]/_components/DiffFieldRow.tsx` (single field comparison row)
- Create: `apps/ui/src/app/[locale]/contribute/edit/[slug]/_components/EditSourcesSection.tsx`

### Page: /contribute/edit

- Search bar using MeiliSearch (same pattern as existing search)
- Shows library results as cards
- Click → navigate to `/contribute/edit/[slug]`

### Page: /contribute/edit/[slug]

Server component fetches:

1. Library data from Strapi
2. Session from Better Auth
3. Any existing draft submission for this library (`GET /api/content-moderation/submissions/draft/library_edit?targetSlug={slug}`)

Passes to `EditLibraryDiff` client component.

### EditLibraryDiff design (from screenshot)

**Header:**

- Breadcrumb: CONTRIBUTE / EDIT A LIBRARY / {LIBRARY NAME}
- Top right: "DRAFT SAVED · {count} EDITS" (mono, faint)
- H1: "Refine an existing record." with italic "existing record"
- Subtext: "Side-by-side: current published values on the left, your proposed changes on the right. Editorial reviews only what's actually changed."

**Status bar (2 columns):**

- Left: "CURRENTLY PUBLISHED · ENTITYREF {ref} · {score} · {date}"
- Right: "YOUR PROPOSED EDITS · {N} Fields changed"

**Diff rows — per changed field:**
Each row is a card with 2 columns:

- Left column: label chip (field name) + CHANGED badge + current published value (read-only, dimmed)
- Right column: editable input/textarea showing proposed value
- When user types in right column, it becomes "changed"
- Changed rows get a highlight treatment

**Field list to support editing:**

- `catalogueUrl` (text input)
- `openingTimes` (per-day schedule editing — Mon-Sun rows)
- `description` (block editor or textarea)
- `images` (photo gallery edit — add new images)
- `architect` (text input)
- `foundedYear` (text input)
- `location` (lat/lng)
- Plus 30+ unchanged fields shown collapsed: "Show {N} unchanged fields +"

**Sources section:**

- Heading: "What's your evidence?"
- Subtext: "Editorial accepts edits faster when they're backed by a verifiable source."
- Evidence type chips (multi-select): Institutional URL / On-site evidence (photo) / Press release / Personal communication / My institutional affiliation / Other
- Evidence URL input

**Footer:**

- "N CHANGED · N UNCHANGED · ESTIMATED REVIEW TIME: ~4H (VERIFIED)" (mono, faint)
- 3 buttons: Save draft | Discard changes | Submit for review →

### Auto-save

Same debounce pattern as Add Library but uses `submissionType: "library_edit"` and `targetDocumentId: library.documentId` / `targetSlug: library.slug`.

---

## Stream E — My Submissions Dashboard

### Files to create

- Create: `apps/ui/src/app/[locale]/contribute/submissions/page.tsx` (RSC auth gate)
- Create: `apps/ui/src/app/[locale]/contribute/submissions/_components/SubmissionsShell.tsx` (client)
- Create: `apps/ui/src/app/[locale]/contribute/submissions/_components/SubmissionCard.tsx`
- Create: `apps/ui/src/app/[locale]/contribute/submissions/_components/SubmissionPipeline.tsx`

### Design (from screenshot)

**Hero:**

- Eyebrow: CONTRIBUTE / MY SUBMISSIONS
- H1: "Your contributions, in flight." with italic "contributions"
- Subtext: "Drafts, things under review, requests for changes, and recently published."
- Top right: "AUTO-REFRESH · 60S" (mono, faint)

**Filter tabs (horizontal scrollable):**
ALL (count) | DRAFTS | UNDER REVIEW | CHANGES REQUESTED | APPROVED | PUBLISHED
Active tab: aurora bottom border.

**Submission cards:**
Each card shows:

- Type chip (ADD / EDIT) + entity type + country + city
- Submitted timestamp
- Title: "{Library Name} — {description of changes}"
- Subtext: "{N} fields changed · {N} photos added · evidence type"
- Pipeline progress bar: 5 nodes: SUBMITTED → UNDER REVIEW → (CHANGES REQUESTED) → APPROVED → PUBLISHED
  - Filled nodes = completed, current node = aurora highlight, future = dim
- Right side: reviewer handle, est. response time, queue position
- Status badge (top right): UNDER REVIEW / CHANGES REQUESTED / APPROVED / DRAFT / PUBLISHED

**Editorial board comment** (expanded inline, shown when `status === "needs_info"`):

- Avatar initials circle, reviewer name + EDITORIAL BOARD badge
- Comment text
- Action links: "Respond" / "View diff"

**Card states:**

- DRAFT: "AUTOSAVED · {time} · NEEDS SOURCE · {N} STEPS TO SUBMIT" — "Edit draft →"
- UNDER REVIEW: reviewer assigned, queue position shown
- CHANGES REQUESTED: gold badge, comment expanded
- APPROVED: green badge, "PUBLISHING IN ~3 MIN · +18 REPUTATION"
- PUBLISHED: "LIVE ON ATLAS · first 7D · {N} VIEWS · +18 REPUTATION EARNED"

### Data fetching

Client component calls `useMySubmissions()` (already exists in `useSubmissions.ts`). The hook fetches `GET /api/content-moderation/submissions/my`.

### Filter logic

Client-side filter on `submission.status`. Tab counts calculated from full list.

---

## Stream F — Wiring profile contributions + ModerationDashboard upgrade

### Profile wiring

Modify `apps/ui/src/app/[locale]/profile/[username]/_components/tabs/ContributionsTab.tsx`:

- Fetch real submissions via `/api/user-contributions/[username]` (new Next.js API route)
- Create `apps/ui/src/app/api/user-contributions/[username]/route.ts` — calls Strapi to get approved+published submissions for a user
- Display stats row + filtered submission list (type, library, date, rep)

Modify `apps/ui/src/app/[locale]/profile/[username]/_components/tabs/OverviewTab.tsx`:

- The "Recent contributions" section already renders placeholder items
- Wire it to real data from the profile's public submissions

### ModerationDashboard upgrade (Strapi admin)

`apps/strapi/src/plugins/content-moderation/admin/src/pages/ModerationDashboard.tsx`:

- Add `library_edit` type to `TYPE_LABELS`
- Add `LibraryEditDiffPanel` component — renders `fields.changes` as side-by-side diff
- Improve action: when approving a `new_library`, show confirmation noting the library needs to be created in Strapi content manager
- Add reviewer assignment field

### GlobalHeader role badge

Modify `apps/ui/src/components/global/GlobalHeader.tsx`:

- If session user's profile has `isVerifiedLibrarian === true`, show "VERIFIED LIBRARIAN" chip in nav (mono, aurora border, small)
- This already exists visually in the designs (top right of header)

---

## Roles summary (for documentation)

| Role               | How obtained                                        | Capabilities                                             |
| ------------------ | --------------------------------------------------- | -------------------------------------------------------- |
| Reader             | Default, no login                                   | Browse atlas, map, wiki                                  |
| Contributor        | Any signed-in user                                  | Add libraries, edit libraries, suggest topics            |
| Verified Librarian | Library claim approved by editorial board           | Fast-track review (avg 6h not 3 days), claim badge shown |
| Wiki Editor        | Invited by editorial board (set manually in Strapi) | Edit wiki/docs articles                                  |
| Editorial Board    | Set manually in Strapi                              | Approve/reject all submissions, publish to live          |

Roles stored in `user-profile.contributorRole`. Better Auth session does not carry the role — it must be fetched from the profile. For gating, client components call `useProfile()` which fetches `/api/profile/me`.

---

## Implementation order

**Run in parallel (Streams B, C, D, E are independent files):**

1. Stream A (Strapi schemas + service + build fix) — blocks nothing but makes auto-save functional
2. Stream B (Hub + nav + layout) — independent
3. Stream C (Add Library wizard) — independent (uses existing useCreateSubmission)
4. Stream D (Edit Library diff) — independent
5. Stream E (My Submissions) — independent (uses existing useMySubmissions)
6. Stream F (Profile wiring + ModerationDashboard) — can run after others

**Each stream is self-contained.** Streams B–E use the existing `useCreateSubmission` and `useMySubmissions` hooks; they do not depend on Stream A's schema extensions to render (they'll just have fewer fields). Stream A's draft endpoint is a progressive enhancement.
