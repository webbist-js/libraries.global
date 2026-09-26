# Access, contribution hardening and Pro: implementation spec

**Date:** 2026-09-26
**Status:** Draft for review. The open decisions are in §10.
**Builds on:**

- `2026-09-26-pro-subscriptions-design.md` (product design for Pro). This spec is its implementation plan and overrides it where noted in §2.
- `2026-09-26-ace-libraries-activity-design.md` (Organisations, per-capita data).
- The **Atlas Explorer** design in claude.ai/design (`Atlas Explorer.html`). Frames 01–12, C1–C6, CM1–CM2 and M1–M5 are referenced by ID throughout.
- The contribution, security and personalisation audit of 2026-09-26. Its findings are summarised in §4 and not repeated in full.

---

## 1. Goal and ordering

Four pieces of work, one plan:

| Part                       | What                                                                                                                                                  | Why now                                                                                                                   |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| **A. Hardening**           | Fix the verified security and correctness defects in moderation, rewards and the API proxies                                                          | Pro puts money and entitlements behind the same session, bridge and moderation code. It can't sit on top of known holes.  |
| **B. Access model**        | One package that resolves **capabilities** (what you may contribute) and **entitlements** (what you've paid for or been granted), kept strictly apart | The contribution section, the Atlas and checkout all need to answer "what can this user do?" the same way, on the server. |
| **C. Contribution tracks** | Library data first, then Docs and Journal curation. A contribute section that adapts to your role. All of it goes through moderation and rewards.     | The hidden `/contribute/docs` editor is broken and undiscoverable. Approved library edits are never applied.              |
| **D. Pro and checkout**    | The Atlas Pro screens, plans, checkout (C1–C6, CM1–CM2), free-Pro verification and Team invoicing                                                     | New design. It depends on A and B.                                                                                        |

Personalisation for signed-in and signed-out visitors is the fifth track (§8). Some of it needs B, and some of it shares the upsell surfaces in D. The codebase is open source, but the service is gated. §11 explains how gating works with an open codebase: server enforcement, private data and compute, licence, trademark and self-hosting mode.

**Ordering rule:** A must land before anything in D is enabled, even behind a flag, in any shared environment. Go-live is 15 Oct 2026. A and B are go-live blockers. C is a go-live target. D follows go-live, as the Pro design spec recommends (decision D8).

---

## 2. What the Atlas design settles, compared with the Pro design spec

The design answers several open questions. Where it differs from `2026-09-26-pro-subscriptions-design.md`, **this spec follows the design** unless §10 says otherwise.

| Topic                                          | Pro design spec                               | Atlas design                                                                                                                        | Resolution                                                                                                                                                                                                                                                                |
| ---------------------------------------------- | --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Population and schools overlays                | Pro                                           | Free account ("Sign in" chip, frame 03)                                                                                             | **Free account.** This already matches `atlas.logic.ts`. Update the Pro spec's Atlas table.                                                                                                                                                                               |
| Accessibility, events and completeness layers  | Free account                                  | Free account                                                                                                                        | No change.                                                                                                                                                                                                                                                                |
| Per-capita, founded year, deprivation, transit | Pro                                           | Pro                                                                                                                                 | No change.                                                                                                                                                                                                                                                                |
| Complimentary Pro for library staff            | Automatic from `isVerifiedLibrarian`          | **Verified work or student email, renewed yearly** (C5). The copy says "Linking your library doesn't make you its steward."         | **Adopt the design.** Complimentary Pro no longer reads `isVerifiedLibrarian`. That flag is currently set just for getting a proposed library approved (audit finding M3), so it isn't a safe basis for a paid benefit. See §6.5.                                         |
| Other complimentary groups                     | Admin grant                                   | Self-serve for students and charities (C5)                                                                                          | Self-serve verification for all three groups. Admin grants stay available for press and partners.                                                                                                                                                                         |
| Earned Pro (Archivist tier)                    | Yes                                           | Not shown                                                                                                                           | **Keep it, subject to D-P4.** It needs a line in the plans footer.                                                                                                                                                                                                        |
| Prices                                         | Unset                                         | Pro £8/month or £80/year. Team "from £40/month", i.e. 5 seats at £96 per seat per year. Public-library discount 20%.                | Treat these as placeholders ("Prices are placeholders", frame 09). Store them only as Stripe Price IDs; nothing in code hard-codes an amount.                                                                                                                             |
| VAT display                                    | Unset                                         | Shown ex-VAT on plans, with VAT added at checkout (£8 becomes £9.60 due)                                                            | **Needs changing for consumers. See D-P2.** UK consumer rules expect consumer prices to include VAT, and adding mandatory charges late in the flow is treated as drip pricing. Show VAT-inclusive prices for Pro. Team can stay ex-VAT (B2B). Confirm with an accountant. |
| Payment methods                                | Stripe                                        | Card, PayPal, bank debit. "Payments by Stripe. We never see your card number."                                                      | Stripe, confirming D1. PayPal and Bacs Direct Debit come through Stripe payment methods. **Bacs takes several working days to confirm, and the design has no "payment pending" state**, so one must be added (§6.3).                                                      |
| Checkout placement                             | `/pro` page, returning to where you came from | **In the same side sheet as the plans**, keeping the map in view. Mobile is full screen (CM1).                                      | Build a global checkout sheet with URL state (§6.1). `/pro` renders the same plans table and opens the same sheet.                                                                                                                                                        |
| Team billing                                   | Phase 4, Stripe per seat                      | Invoice (30 days) or card, PO number, quote request, seat stepper (C6)                                                              | Stage it. First a **Team enquiry** that staff fulfil by hand through Stripe Invoicing, then self-serve Team later (§6.6).                                                                                                                                                 |
| Upgrade moment                                 | Upsell sheet                                  | **A non-blocking preview on a fixed sample area** (Glasgow), a toast and an inline card, with a "Not now" button (frames 08 and M5) | Adopt it. The preview must be **clipped on the server** (§7).                                                                                                                                                                                                             |
| Licence line                                   | Raw data is OGL/CC0                           | "Records are CC BY-SA"                                                                                                              | **Check this before publishing** (D-P6). Mixed-source records may not all be relicensable.                                                                                                                                                                                |

---

## 3. Access model: `@repo/access`

A new pure-TypeScript workspace package with no I/O, consumed by both `apps/ui` and `apps/strapi`. It follows the precedent of `packages/events-crypto`, which Strapi already imports. It replaces the separate `@repo/entitlements` proposed in the Pro design spec.

### 3.1 Three axes that never mix

| Axis                                                                                                                            | Source                                                                | Changes                                        | Governs                                                                                             |
| ------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | ---------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| **Contributor Role** (`reader`, `contributor`, `verified_librarian`, `wiki_editor`, `editorial_board`), plus **Library Claims** | Strapi `user-profile.contributorRole` and `library-affiliation`       | Assigned by staff, or set by an approved claim | **Capabilities**: what you may submit, what you may edit directly as a draft, what you may moderate |
| **Tier** (Reader through Curator)                                                                                               | Points                                                                | Earned                                         | **Limits and conveniences only**: quotas, early features, earned Pro. Never trust.                  |
| **Plan** (`public`, `free`, `pro`, `team`)                                                                                      | Better Auth `subscription` table, plus Strapi grants and verification | Paid, verified or granted                      | **Entitlements**: analysis, licensed data, exports, alerts                                          |

```ts
// packages/access/src/capabilities.ts
export type Capability =
  | "submit.correction"
  | "submit.newLibrary"
  | "submit.claim"
  | "submit.libraryEdit" // scoped: only for libraries in `claims`
  | "submit.docSuggestion" // free-text wiki_edit suggestion
  | "docs.directEdit" // block-editor wiki_edit (still moderated)
  | "submit.journalPitch" // blog_submission
  | "events.feed" // scoped: claimed libraries
  | "moderate.queue" // future Moderator role; not assigned yet
export interface CapabilityInput {
  signedIn: boolean
  contributorRole: ContributorRole | null
  claims: { libraryDocumentId: string; verificationMethod: string }[]
  // Deliberately no plan, subscription or entitlement fields.
}
export function resolveCapabilities(i: CapabilityInput): Capabilities
export function canSubmit(
  c: Capabilities,
  type: SubmissionType,
  target?: { libraryDocumentId?: string }
): boolean

// packages/access/src/entitlements.ts
// resolveEntitlements() as in the Pro design spec, with two changes:
//   - the isVerifiedLibrarian input is removed; replaced by `verifications: ProVerification[]`
//   - tier only feeds `earnedPro` and numeric limits
export function resolveEntitlements(i: EntitlementInput): Entitlements

// packages/access/src/limits.ts
// Tier-scaled contribution quotas, used by the Strapi submission policy (§4, A6)
export function contributionLimits(tier: TierName): {
  pendingSubmissions: number
  uploadsPerDay: number
  submissionsPerHour: number
}
```

**Invariants.** Each one has a test in `packages/access/__tests__`:

1. `CapabilityInput` has no plan fields. A type-level test (`expectTypeOf`) fails if a plan-related key is ever added.
2. No `Entitlements` value is accepted by any capability function.
3. Moderation state transitions don't depend on plan (checked in Strapi tests, §9).
4. `resolveEntitlements` is deterministic for a fixed `now`, and is table-tested across every subscription status, grace period, grant expiry and verification expiry.

### 3.2 Where it runs

| Layer                                        | Capabilities                                                                                                                                                | Entitlements                                                              |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| **Strapi** (authoritative)                   | The `submission-policy` service calls `canSubmit()` in `create`, `saveDraft` and `finalize`                                                                 | The `sync-plan` mirror, cron alerts and admin visibility                  |
| **Next route handlers**                      | Pre-checks for a fast 403 and better errors. Never the only gate.                                                                                           | `requireEntitlement(feature)` returns 401 or 402 with an upgrade payload  |
| **Session** (`customSession`, `lib/auth.ts`) | Attaches `capabilities: Capability[]`, from the role plus claims already fetched from the `session-profile` bridge (extend the bridge response with claims) | Attaches `plan`, `planSource` and `features[]`                            |
| **Client**                                   | `useCapabilities()` for UI only                                                                                                                             | `useEntitlements()`, which replaces `useTier()` in `AtlasExplorer.tsx:89` |

`customSession` currently calls Strapi on every session read, and `cookieCache` is off. Before D ships, add a per-user bridge cache of about 60 seconds, keyed by `baUserId` and invalidated by `sync-plan` and role changes. Revocation must still take effect within 60 seconds.

---

## 4. Part A: hardening (go-live blocker)

These findings are from the 2026-09-26 audit. ✅ means checked in code or with a live request.

| ID      | Fix                                                                                                                                                                                                                                                                                                                                                                  | Files                                                                                                  | Acceptance                                                                                                                                                                                                                            |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A1**  | `saveDraft` requires `status === "draft"`. When a submission is finalized, store `reviewedPayloadHash` (a SHA-256 of `fields` plus `draftData`). `updateStatus` refuses to approve if the hash has changed. ✅                                                                                                                                                       | `content-moderation/server/controllers/submission.ts:247`, `services/submission.ts:421`                | A PATCH to a pending, approved or rejected submission returns 409. Approving after tampering fails. ✔ fixed 01e0cd6                                                                                                                   |
| **A2**  | Every `apply*` handler resolves its target **only** from the submission's top-level `targetDocumentId` or `targetSlug`. `locale` is validated against the configured locales. `body` is validated against the blocks schema, with heading `level` limited to 1–6. ✅                                                                                                 | `services/submission.ts:671` (`applyWikiEdit`), claim `:243`, topic `:288`, new-library uploads `:159` | Changing `draftData.targetSlug` or `fields.entityRef` has no effect. Uploads must be owned by the submitter. ✔ fixed 05fb962 (live check pending)                                                                                     |
| **A3**  | A **status state machine**: `draft → pending → (approved \| rejected \| needs_info)` and `needs_info → pending`. Side effects run once, inside a transaction. Point events get a unique `(submissionId, action)` key and an atomic increment. ✅                                                                                                                     | `services/submission.ts:46`, `rewards/server/services/points.ts:92`                                    | Double-approving creates nothing extra. A concurrent-award test keeps the correct total. ✔ fixed 4e044c2 (live check pending)                                                                                                         |
| **A4**  | Enforce admin permissions on the moderation and rewards admin routes (`admin::hasPermissions` with the registered actions). Block self-approval. ✅                                                                                                                                                                                                                  | `content-moderation/server/routes/admin.ts`, `rewards/server/routes/admin.ts`                          | An Author-role admin gets 403 on approve and award. ✔ fixed 35a9dd8 (live check pending)                                                                                                                                              |
| **A5**  | A `submission-policy` service: `canSubmit()` from `@repo/access` in `create`, `saveDraft` and `finalize`. Allowlists for `submissionType` and `verificationMethod`. ✅                                                                                                                                                                                               | new `content-moderation/server/services/submission-policy.ts`; `controllers/submission.ts:59`          | A reader POSTing `wiki_edit` with `draftData` gets 403. A non-claimant POSTing `library_edit` gets 403. ✔ fixed 0ad6aff                                                                                                               |
| **A6**  | Abuse controls: tier-scaled `contributionLimits()` for pending submissions and uploads. Rate limits on `/api/submissions`, uploads, `subscribers` (with reCAPTCHA) and verification-link sends (§6.5). Body-size caps. Validate `notifPrefs` with zod.                                                                                                               | Next routes; Strapi policy                                                                             | Hitting a limit returns 429 with `Retry-After`. The limits are listed in the rewards "how it works" page. ✔ fixed 0ad6aff, 0be0cd0 (quotas + body caps only; edge/IP rate limiting and reCAPTCHA deferred to P-C; live check pending) |
| **A7**  | Path params are checked against an allowlist and passed through `encodeURIComponent`: `type` must be in the enum, `id` must match `/^[a-z0-9]{20,32}$/`. Prove the traversal is fixed with a live request, test first.                                                                                                                                               | `app/api/submissions/draft/[type]`, `[id]/draft`, `[id]/finalize`                                      | `..%2F` returns 400. ✔ fixed 0be0cd0 — covered by unit tests (`bridge-params.test.ts`); live run needs Next                                                                                                                           |
| **A8**  | The sessions list returns only `id`, `userAgent`, `ipAddress`, `createdAt` and `current`. Revocation is done by id on the server. ✅                                                                                                                                                                                                                                 | `app/api/profile/me/sessions/route.ts`                                                                 | No `token` in the response. ✔ fixed 9220de9 (live check pending)                                                                                                                                                                      |
| **A9**  | `?status=draft` is honoured only when the bridge secret or preview secret is present. ✅ (a live request returned 200)                                                                                                                                                                                                                                               | `api/wiki-article/controllers`, `api/blog-article/controllers`                                         | An unauthenticated draft request returns the published version or 404. ✔ fixed 12a45f0                                                                                                                                                |
| **A10** | Privacy: public contribution history respects `profileVisibility` and `showActivity`, and excludes rejected submissions. The leaderboard and `topContributors` drop `baUserId` and respect `showLocation`.                                                                                                                                                           | `services/submission.ts:539`, `rewards/services/leaderboard.ts:111`                                    | A private profile has no public activity. ✔ fixed babe466                                                                                                                                                                             |
| **A11** | Trust hygiene: never lower a role when a claim is approved. Upsert affiliations on `(baUserId, library)`. **Stop auto-granting `verified_librarian` when a new library is approved** (D-C5). Move profile role and flag writes to `strapi.documents()`.                                                                                                              | `services/submission.ts:204,273`, `auth-bridge.ts:368`                                                 | A `wiki_editor` who gets a claim approved keeps `wiki_editor`. ✔ fixed babe466 (live check pending)                                                                                                                                   |
| **A12** | Tidy-ups: a dedicated upload-only token instead of `STRAPI_REST_READONLY_API_KEY`; `private-proxy` header allowlist and path guard; server-side username format check `^[a-z0-9_]{3,30}$`; the missing point-event enum values; points for `library_edit` counted only on known changed fields; `deleteProfile` scrubs `submittedByEmail` and `baUserId` references. | various                                                                                                | Covered by the tests in §9. ✔ fixed f59bfa9, bee062f                                                                                                                                                                                  |
| **A13** | Check whether the Submission's `status` attribute clashes with Strapi v5's reserved document `status`. The MCP content-manager list returns `"published"` for every submission. If it clashes, rename it to `reviewStatus`, with a migration.                                                                                                                        | `content-moderation/server/content-types/submission/schema.json`                                       | Admin, the API and the MCP all show the moderation status. ✔ fixed 6d2ed8c (documented limitation, not a full fix — the MCP/content-manager still shows document `status`; live check confirms this on 2026-09-26)                    |

---

## 5. Part C: contribution tracks

### 5.1 Library data (priority)

- **C-L1: apply approved edits.** Add `applyLibraryEdit` and `applyCorrection`. They use the same field allowlist as `new_library` (`services/submission.ts:99-195`) and write through `strapi.documents("api::library.library").update` to the draft, then publish. Each write stores a revision entry (`libraries/:id/revisions` already exists). `correction` applies only structured fields: status, hours, address. Free-text corrections are marked "applied manually" by the moderator.
- **C-L2: fix routing.** The hub's "Suggest a correction", "Share a photo" and "Add a source" actions, `RecordsThatNeedYou.tsx:125` and home `TasksSection:152` go to `/contribute/correct/[slug]` for non-claimants and `/edit/[slug]` for claimants, based on `canSubmit(c, "library_edit", target)`. Fix the event-feed link (`LibraryDetailPage.tsx:278`, `/contribute/event-feed` → `/contribute/events`). Fix the claim links without parameters (`RolesTable.tsx:149`, `events/page.tsx:157`) so they go to a claim search.
- **C-L3: photo and source flows.** The hub advertises them. Build them as `correction` subtypes (`fields.kind: "photo" | "source"`) that reuse `ImageUploadEditor` and `EditSourcesSection`.

### 5.2 Docs (the "edit a doc" page)

A doc is a `wiki-article`, served at `/docs`. Anyone signed in can suggest a change. `wiki_editor` and `editorial_board` get the block editor. Both go through moderation.

- **C-D1: fix the pipeline.**
  - Strapi `create` accepts `draftData` and `asDraft`. The proxy sends `asDraft: true`.
  - IDs are `documentId` strings end to end. The numeric-id check in `api/contribute/wiki/[slug]/route.ts:104` is removed.
  - `targetSlug` is stored top-level and used by `applyWikiEdit` (A2).
  - Resume the existing draft on revisit (`GET /draft/wiki_edit?targetSlug=`).
- **C-D2: `/contribute/docs` hub.**
  - A list of articles with search.
  - "Your open doc suggestions".
  - "Propose a new doc" (`NewDocShell`).
  - Editors also get a "Start editing" shortcut.
  - A new **Docs** tab in `ContributeNavBar`, shown to everyone signed in, since everyone can suggest.
- **C-D3: editor UX parity with EditLibraryShell.**
  - Autosave status.
  - A **diff and preview** step before submit: a side-by-side of the published and proposed blocks, reusing `WikiEditDiffPanel` from the Strapi admin as the model.
  - An edit summary field.
  - Success links to `/contribute/submissions`.
  - Build these from existing patterns. Ask for a generated design only for the diff and preview view, and only if the reuse falls short.
- **C-D4: apply suggestions.** A free-text suggestion is marked "applied manually". The moderator's diff panel shows the suggestion alongside the live article. An approved `new_doc` proposal creates a **draft** `wiki-article` for editors to finish; it doesn't publish anything.
- **Points.** Pick one value set (D-C6). Award only after a real apply or a manual-apply confirmation, never on approval alone.

### 5.3 Journal (blog)

- **C-J1: pitch form** at `/contribute/journal` for any signed-in user (`submit.journalPitch`): title, angle, outline, links and a short bio. It creates a `blog_submission`. Approval creates a **draft** `blog-article` assigned to an editor, with the contributor credited.
- **C-J2:** editorial authoring stays in Strapi admin (D-C3). A Journal tab in the nav for signed-in users.

### 5.4 A contribute section that adapts to your role

- `HubActionChooser`, the nav tabs and `RecordsThatNeedYou` are driven by `useCapabilities()` from the session. Nothing is hard-coded.
- **Your libraries:** a card for claimants showing "Edit your library" and "Connect an event feed".
- **Editors:** Docs and Journal cards.
- **`RolesTable`** is rewritten to the real model: Contributor Role columns, what each unlocks and how you get it. Remove "publish without review" (D-C4) and the unimplemented "review others' changes". Add a "Tiers raise your limits; they never skip review" row. **Pro does not appear in this table** (principle 3).
- **Tier conveniences** (answering the "levels and unlocks" question): `contributionLimits(tier)` raises the pending-submission and upload quotas by tier, and the hub shows the next unlock ("Reach Cartographer to have 20 submissions in review at once"). Earned Pro at Archivist is the top unlock (D-P4).

---

## 6. Part D: Pro and checkout

### 6.1 Screen inventory

The Status column is compared against `apps/ui/src/components/atlas/*` today.

| Frame   | Screen                | Status                                                                 | Work                                                                                                                                                                                                | Gate (server)                                                                                    | Phase                             |
| ------- | --------------------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | --------------------------------- |
| 01      | Default explore       | Built (`AtlasSearchTab`, globe hint)                                   | Visual QA against the design                                                                                                                                                                        | none                                                                                             | done                              |
| 02      | Filters               | Built (`AtlasFiltersTab`)                                              | QA                                                                                                                                                                                                  | none                                                                                             | done                              |
| 03      | Layers                | Built (`AtlasLayersTab`, `layerAccess`)                                | Mobile routes are `ready:false`; data needed                                                                                                                                                        | free layers need sign-in                                                                         | done / data                       |
| 04      | Library selected      | Built (`AtlasLibraryPanel`)                                            | QA                                                                                                                                                                                                  | none                                                                                             | done                              |
| **05**  | Area selected         | **New:** `AtlasAreaPanel`                                              | Council-area boundaries (ONS/NRS GSS) and population (ACE spec). The panel shows count, per-100k, Sunday opening, completeness and a 2010–2024 sparkline.                                           | The panel itself is free. The **per-100k stat and "Compare with another area" need Pro** (D-P5). | P-D2                              |
| **06**  | Reach                 | **New:** `AtlasReachPanel`                                             | Self-hosted isochrones (Valhalla or ORS), population inside the bands, other libraries in range, export, report                                                                                     | `atlas.analysis`                                                                                 | P-D3                              |
| **07**  | Draw to analyse       | **New:** `AtlasDrawPanel`                                              | Accessible polygon drawing (keyboard point entry, per the design copy), H3 population aggregates, coverage gaps, CSV/GeoJSON, report                                                                | `atlas.analysis`, `atlas.export`                                                                 | P-D3                              |
| **08**  | Upgrade preview       | **New:** preview state in `AtlasLayersTab`, a toast and an inline card | The preview is clipped on the server to the sample-area bbox (§7). "Not now" is remembered per layer in localStorage (try/catch).                                                                   | tile proxy                                                                                       | P-D1                              |
| 09      | Plans side sheet      | Partly built (`AtlasPlansSheet`, prices "Coming soon")                 | Extract `components/billing/PlansTable` (shared with `/pro`). Real prices come from a server-provided price list. CTAs: Sign in, **Start Pro → C1**, **Talk to us → C6**. Footer lines.             | none                                                                                             | P-D1                              |
| **10**  | Compare areas         | **New:** `AtlasCompareView`                                            | A split view: two MapLibre instances with a shared scale and layer, a collapsed rail, and a stats table                                                                                             | `atlas.compare`                                                                                  | P-D2                              |
| 11      | List view             | Built (`AtlasListView`)                                                | QA                                                                                                                                                                                                  | none                                                                                             | done                              |
| 12a–d   | Edge states           | Built (`AtlasEdgeStates`)                                              | Add a **Pro "payment pending"** variant (§6.3)                                                                                                                                                      | –                                                                                                | P-D1                              |
| M1–M4   | Mobile sheet          | Built                                                                  | QA                                                                                                                                                                                                  | –                                                                                                | done                              |
| **M5**  | Mobile upgrade card   | **New**                                                                | The same component as 08, in the sheet                                                                                                                                                              | tile proxy                                                                                       | P-D1                              |
| **C1**  | Plan and billing      | **New:** `CheckoutSheet` step `plan`                                   | Annual or monthly, the eligibility banner, the Team link, the summary                                                                                                                               | none                                                                                             | P-D1                              |
| (C1.5)  | Details               | **New**, not in the design                                             | For signed-out users: inline sign-in or register, then resume. Skipped when signed in (the design shows it as done).                                                                                | –                                                                                                | P-D1                              |
| **C2**  | Payment               | **New:** step `payment`                                                | The Stripe payment UI (§6.2), VAT number, terms checkbox, "Pay £…"                                                                                                                                  | `POST /api/billing/checkout`                                                                     | P-D1                              |
| **C3**  | Payment declined      | **New**                                                                | The design's error state: `role="alert"`, field-level messages, focus moved to the first invalid field, "Nothing was charged", plan choice kept                                                     | –                                                                                                | P-D1                              |
| **C4**  | Done                  | **New**                                                                | Shown once the **entitlement is confirmed** (§6.3). The previewed layer stays on, now unclipped. Three next-step cards. Receipt link (Stripe hosted invoice). Order number = Stripe invoice number. | –                                                                                                | P-D1                              |
| **C5**  | Free Pro verification | **New:** `ProVerificationFlow`                                         | §6.5                                                                                                                                                                                                | rate-limited                                                                                     | P-D1                              |
| **C6**  | Team, by invoice      | **New:** `TeamEnquiryForm`                                             | §6.6                                                                                                                                                                                                | –                                                                                                | P-D1 (enquiry), P-D4 (self-serve) |
| CM1–CM2 | Mobile checkout       | **New**                                                                | Full-screen steps with a sticky Pay bar and a collapsible summary                                                                                                                                   | –                                                                                                | P-D1                              |

Also:

- **Header:** a Pro chip and avatar for Pro users, matching the design's header. An optional "Supporter" mark on profiles, off by default.
- **Settings:** a new **Plan & billing** section in `profile/settings/_components/` alongside `DataAccountSection`. It shows plan, source ("Paid", "Verified library staff until …", "Earned: Archivist"), renewal date, switch interval, cancel or resume, and **Manage billing** (the Stripe Customer Portal). An explicit line says what cancelling does.

### 6.2 Stripe integration

- **Provider:** Stripe (D1), through `@better-auth/stripe`. It supplies customer creation, the `subscription` table, the webhook at `/api/auth/stripe/webhook` and the Customer Portal.
- **Why a spike is needed (S1, one or two days, before building C2).** The design embeds payment inside our side sheet, with our own summary column. The plugin's default upgrade flow is a hosted Checkout redirect. The spike should find out:
  1. Can the plugin's checkout-session parameters use Stripe **Embedded Checkout** (`ui_mode: "embedded"`) and still reconcile the subscription into the plugin table? If so, use it. It's the least code, keeps PCI scope at SAQ A, and Stripe renders card errors itself.
  2. If not, use the **Payment Element** with our own `POST /api/billing/checkout`. That route creates the subscription with `payment_behavior: "default_incomplete"` and `metadata.referenceId = user.id`, and we confirm that the plugin's webhook handler adopts it.
  3. If neither works, redirect to hosted Checkout from the sheet and return to C4. The design's "map stays in view" becomes "you come back to the same map view", with the view state kept in the return URL.
- **Server-side rules, whatever the spike decides:**
  - The client sends only `{ plan: "pro", interval: "month" | "year" }`. The Price ID comes from a server allowlist (`STRIPE_PRICE_PRO_MONTHLY` and `STRIPE_PRICE_PRO_ANNUAL`). The client never sends an amount.
  - Idempotency key: `checkout:{userId}:{plan}:{interval}:{yyyy-mm-dd}`.
  - Refuse checkout (409) if the user is already entitled. For a complimentary user, the sheet explains why they don't need to pay (from the Pro design spec).
  - Stripe Tax is on. The VAT number field maps to a Stripe customer tax ID. Headline prices follow D-P2.
  - PayPal and Bacs Direct Debit are Stripe payment methods, enabled per D-P3.
- **CSP:** allow `js.stripe.com`, `*.stripe.com` frames and `api.stripe.com` connections, and nothing broader.

### 6.3 Payment state and the Done screen

The webhook is the only source of truth. The Done screen never assumes success from the client.

```
C2 submit ──► Stripe confirm ──► client: "Activating Pro…" (spinner, aria-live)
                                   │ poll GET /api/billing/status every 2 s, up to 20 s
                                   ├─ entitled ─────────────► C4 Done
                                   ├─ payment_failed ───────► C3 Declined (focus first field)
                                   ├─ processing (Bacs) ────► "Payment pending": we'll email you;
                                   │                          Pro starts when it clears (new state)
                                   └─ timeout ──────────────► "Taking longer than usual": we'll email;
                                                              no second charge if you retry (idempotency)
```

- `/api/billing/status` reads the Better Auth `subscription` row. It's cheap, needs no Stripe call, and is rate-limited per user.
- The Strapi mirror (`POST /api/auth-bridge/sync-plan`) is secret-gated, idempotent per Stripe subscription ID, retried with backoff, and reconciled nightly, as in the Pro design spec.
- Receipts and failed-payment emails come from Stripe. The "Welcome to Pro" and cancellation emails come from `lib/email.ts`.

### 6.4 Returning to context

- The checkout sheet is mounted once in `app/[locale]/layout.tsx`. It is driven by URL state (`?checkout=pro&step=plan|details|payment|done&interval=year&from=atlas-layer:perCapita`), so the back button, deep links and refreshes all work.
- `from=` is validated against an allowlist of internal return targets. It is never an arbitrary URL, to avoid open redirects.
- The Atlas passes its view state (centre, zoom, layers and preview layer) so C4 can say "Your Glasgow preview now works everywhere" and switch the layer to full.

### 6.5 Free Pro verification (C5)

- **Who qualifies:** library staff or volunteers, students and researchers, and charity or nonprofit staff. No card is needed.
- **Flow:**
  1. The user picks a group and enters a work or student email. Staff can optionally link a library.
  2. `POST /api/billing/verify/start` checks the email domain:
     - **Known domain** (an allowlist of library-service and council domains from the ACE Organisations data and the library `domain` field, university domains, and charity domains from reviewed registers): we send a one-time link.
     - **Unknown domain:** we still send the link. Once the email is confirmed, a `pro_verification` review item is created for a person to check within 2 working days. This is a new submission type in content-moderation, but it **earns no points and grants no role**. It uses the moderation queue only.
  3. The link token is 32 random bytes, stored as a SHA-256 hash, single-use, and valid for 24 hours. Starts are rate-limited to 3 per user per day and 10 per IP per day.
  4. On success, a `pro-verification` record is written to Strapi: `baUserId`, group, a domain hash (not the address), optional library, `verifiedAt`, `expiresAt` (+12 months) and method. `resolveEntitlements` reads unexpired verifications.
  5. A reminder email goes out 30 days before expiry, and re-verification is one click.
- **Separation from claims:** linking a library records context only. It creates **no** `library-affiliation` and doesn't touch `contributorRole` or `isVerifiedLibrarian`, as the design's copy promises. The reverse holds too: a Library Claim never grants Pro.
- **Privacy:**
  - The verification email address isn't stored after confirmation; we keep the domain hash, and the group for reporting.
  - It is never shown publicly.
  - It is included in data export and removed on account deletion.

### 6.6 Team (C6)

- **P-D1, the enquiry.**
  - C6 submits a `team-enquiry` to Strapi: organisation, seats, payment preference (invoice or card), PO number, billing email, and whether a quote is needed first.
  - Staff are notified. Fulfilment is manual through **Stripe Invoicing** (`collection_method: send_invoice`, `days_until_due: 30`), and each member gets an `entitlement-grant` (`plan: team`, `source: team`) until self-serve Team exists.
  - The "Public library discount" is a Stripe coupon that staff apply by hand after checking.
- **P-D4, self-serve.**
  - The Better Auth `organization` plugin, with the subscription `referenceId` set to the organisation.
  - Seats managed at `/settings/team`, with prorated changes.
  - The organisation is linked to the ACE `organisation` content type.
  - **Trusted service editors:** auto-approval comes from verified employment on the organisation, not from payment (Pro design spec, principle 3), and it changes CONTEXT.md's "every submission is reviewed" rule, so it needs its own ADR before it's built.

---

## 7. Server enforcement map (Pro)

| Capability             | Endpoint                                      | Rule                                                                                                                                                                                                                                                                                                                       |
| ---------------------- | --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pro layer tiles        | `GET /api/atlas/tiles/[layer]/[z]/[x]/[y]`    | Entitled users get the tile, or a signed CDN URL valid for 60 seconds. **Non-entitled users get only tiles that intersect `PREVIEW_BBOX[layer]`** (Glasgow City for per-capita, with a server-side constant per layer). Any other tile is an empty 204. The client can't widen the preview by panning or editing requests. |
| Area stats             | `GET /api/atlas/areas/[gss]`                  | The free fields are always returned. `perCapita` and comparison fields are returned only with `atlas.contextLayers`.                                                                                                                                                                                                       |
| Reach                  | `POST /api/atlas/reach`                       | `atlas.analysis`. Inputs are clamped (mode in an allowlist, minutes 5–30, point inside the supported coverage). Cost-limited per user per hour through entitlement limits. The routing engine is reachable only from the server.                                                                                           |
| Draw and coverage gaps | `POST /api/atlas/analyse`                     | `atlas.analysis`. Polygon of at most 200 vertices and an area cap. Validated GeoJSON. Computed over H3 aggregates.                                                                                                                                                                                                         |
| Compare                | `GET /api/atlas/compare?a=&b=`                | `atlas.compare`                                                                                                                                                                                                                                                                                                            |
| Exports (CSV/GeoJSON)  | `POST /api/export/atlas`, `/api/export/index` | `atlas.export` or `index.export`. A row cap from `limitOf(e,"exportRows")`. An attribution header. Output is escaped against CSV formula injection (cells starting with `=`, `+`, `-` or `@` are prefixed).                                                                                                                |
| Reports (PDF)          | `POST /api/reports`                           | Pro. Rendered as a server-side job.                                                                                                                                                                                                                                                                                        |
| Billing                | `/api/billing/*`                              | A signed-in session. An Origin check. Per-user rate limits. The Price ID comes from the server allowlist.                                                                                                                                                                                                                  |

Locked UI is there to explain, not to protect: every row above returns 401 or 402 when the UI is bypassed.

---

## 8. Personalisation

Everything below follows principle 1: nothing personalised hides or replaces library facts.

**Signed in (P-C, uses `@repo/access`):**

- **Contribute hub:**
  - `WelcomeBackWidget`, showing tier progress and the next unlock.
  - `QuickWinsSection`, which uses the existing nightly `quickWins` backend and `/api/contribute/quick-wins`. Both are built but never rendered today.
  - A "Your libraries" card.
- **Homepage:** a "Your libraries" strip of followed libraries with open-now state, and "Continue where you left off" for a draft submission.
- **`/index` and `/map`:** a "Your libraries" filter chip.
- **Events:** make `SaveEventButton` reachable from event cards. Add a "Saved events" list at `/profile/saved` with ICS export. Fix the signed-out behaviour (prompt to sign in) and replace the deprecated aurora tokens.
- **Account menu:** add Saved, Following and Plan links. Show "My submissions" to everyone who has submissions, not just `isVerifiedLibrarian`.
- **Notifications:** preferences exist but nothing sends. Delivery for followed-library change digests depends on D-P7 (free or Pro) and an email job. Until then, label the setting "Coming soon", or remove it.

**Signed out:**

- A "Join" button next to "Sign in" in `GlobalNavbarAuthSection`.
- **Contextual prompts:**
  - On library pages, a single dismissible card: "Follow this library to hear about changes. Join the index." It sits under the hero actions and passes the page as `callbackUrl`.
  - After three library page views in a session, a dismissible inline banner at the foot of the content, **not sticky**, with `role="region"` and a close button. It is shown at most once per 7 days, with the dismissal stored in localStorage (try/catch).
- **Recently viewed:** the last 8 libraries, kept in localStorage and shown on the homepage and in Atlas search. It is cleared on sign-in, or offered as an import into follows.
- Signed-out Follow on the library page gets a `callbackUrl` (it has none today).

**Upsell hygiene:**

- Pro prompts appear only where the user touches a Pro feature (frames 08, M5, and the Pro chips on area Compare and on reach, draw and export).
- There are no site-wide Pro banners.
- A "Not now" is remembered.

---

## 9. Testing

- **`@repo/access`:** table-driven unit tests covering capabilities for every role and claim combination, entitlements for every status, grace period, grant and verification, the type-level invariants in §3.1, and tier limits.
- **Strapi (content-moderation, rewards):**
  - Integration tests: the state machine, the idempotency of `apply*` handlers and points, hash-guarded approval, policy denials per type, rejection of target spoofing, and admin permission enforcement.
  - A regression test for every audit item from A1 to A13.
- **Next route gates:** a 401, 402 or 403 then 200 matrix per route. A path-traversal test (A7). A test that no session token appears in the sessions response.
- **Stripe:**
  - Run `stripe listen` against local, with fixtures for created, updated, `past_due`, canceled, deleted and `payment_intent.processing` (Bacs).
  - Test cards: `4242…` succeeds; `4000 0000 0000 0002` is declined, which is the C3 screen. Also test 3DS with `4000 0027 6000 3184`.
  - Test that the reconcile job repairs a mirror left stale on purpose.
- **E2E (Playwright, `qa/tests/`), one seeded user per row: anonymous, reader, contributor, verified_librarian with a claim, wiki_editor, editorial_board, free, pro (paid), pro (verified), pro (earned):**
  - The contribute hub shows exactly the actions that row's capabilities allow, and every hidden action is also refused by the server.
  - Docs: suggest, then approve, then applied. Editor block edit, then diff, then approve, then the article updates, with points once.
  - Library edit: claimant edit, then approve, then the library updates.
  - Atlas: a free user turns on a Pro layer and sees the Glasgow-only preview (tiles outside the bbox return 204), then Start Pro, then a test card, then C4, then the layer covers the UK.
  - Declined card: C3, focus on the card field, and nothing charged.
  - Cancel: access holds to the end of the period.
  - Account deletion: the Stripe customer and verifications are removed.
- **Accessibility:**
  - axe on every new screen.
  - Keyboard-only runs through checkout and the draw tool.
  - Screen reader checks that C3 errors are announced and C4 status uses `role="status"`.
  - Every Pro, Sign-in and locked state is conveyed in text as well as colour, as the design's component sheet requires.

**Seeding:** `scripts/seed-access-fixtures.ts` creates the users above through Better Auth, which the Strapi user-profile needs for login, and sets roles, claims, grants and verifications. It runs **only** when `NODE_ENV !== "production"` and the database host is local.

---

## 10. Phasing and decisions

### 10.1 Phases

| Phase                                          | Scope                                                                                                                                                                                                                                            | Gate to exit                                                                                                                                    |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| **P-A** (blocker, now → go-live)               | A1–A13; `SECURITY.md`; gitleaks and secret scanning; a CI check of the Strapi public-role permissions (§11)                                                                                                                                      | All regression tests pass. A re-run of the audit's exploit scenarios fails every one. Must finish before the repository is public or announced. |
| **P-B** (blocker)                              | `@repo/access`, session capabilities and entitlements (entitlements return `free` or `public` until P-D), the Strapi `submission-policy`, the bridge cache                                                                                       | Invariant tests, and the role matrix E2E                                                                                                        |
| **P-C** (go-live target)                       | C-L1 to C-L3, C-D1 to C-D4, C-J1 and C-J2, the adaptive hub, and the signed-in and signed-out personalisation in §8; `LICENSE`, `CONTRIBUTING.md` and the trademark policy; nightly open-data dumps and edge rate limits on public reads (§11.3) | Contribution E2E per role                                                                                                                       |
| **P-D1** (after go-live, behind `PRO_ENABLED`) | Stripe spike S1, plans table and `/pro`, the checkout sheet (C1–C4, CM1–CM2), payment state machine, Plan & billing in settings, free-Pro verification (C5), Team enquiry (C6), upgrade preview (08, M5), tile proxy clipping, export (in view)  | Stripe test mode: full E2E and an accessibility pass                                                                                            |
| **P-D2**                                       | The area panel (05), per-capita layer and compare (10). Needs ACE Organisations and ONS/NRS boundaries.                                                                                                                                          | Data licensing checked                                                                                                                          |
| **P-D3**                                       | Reach (06) and draw or coverage gaps (07), on self-hosted routing and H3 aggregates. PDF reports.                                                                                                                                                | Cost limits load-tested                                                                                                                         |
| **P-D4**                                       | Self-serve Team, organisations, trusted service editors (after an ADR)                                                                                                                                                                           | ADR accepted                                                                                                                                    |

### 10.2 Decisions

The defaults below were proposed on 2026-09-26. Confirm or change them.

| #    | Decision                                                                                                 | Default                                                                                                                                                    |
| ---- | -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D-C1 | Three separate axes (Role, Tier, Plan)                                                                   | **Yes**                                                                                                                                                    |
| D-C2 | Can `wiki_editor` and `editorial_board` edit library records?                                            | **No.** They curate Docs and Journal only. Library edits need a claim.                                                                                     |
| D-C3 | Blog authoring                                                                                           | **Strapi admin for editors, plus a public pitch form**                                                                                                     |
| D-C4 | "Publish without review" for trusted contributors                                                        | **Drop it from `RolesTable`.** Revisit only with Team trusted service editors, through an ADR.                                                             |
| D-C5 | Should an approved new library auto-grant `verified_librarian`?                                          | **No.** Keep the auto-affiliation only as "proposer", with no role change.                                                                                 |
| D-C6 | Canonical points values                                                                                  | Take CONTEXT.md as canonical (`correction` 2, `claim` 10, `wiki_edit` 5, translation 15). Update the points doc and the wiki spec to match.                |
| D-P1 | Stripe payment UI (spike S1)                                                                             | **Embedded Checkout** if the plugin supports it; otherwise the Payment Element                                                                             |
| D-P2 | VAT display                                                                                              | **VAT-inclusive consumer prices** (for example £9.60/month and £96/year, or re-price to round inclusive amounts). Team ex-VAT. Confirm with an accountant. |
| D-P3 | Payment methods at launch                                                                                | **Card and PayPal.** Bacs Direct Debit for annual and Team only, once the pending state is built.                                                          |
| D-P4 | Earned Pro at Archivist                                                                                  | **Keep it**, with a 90-day hold, and say so in the plans footer                                                                                            |
| D-P5 | Area panel: is the free part free?                                                                       | **Yes.** Counts, Sunday opening and completeness are free. Per-100k and compare are Pro.                                                                   |
| D-P6 | Licence line "Records are CC BY-SA"                                                                      | **Check the licence** against imported sources before it goes on the plans sheet                                                                           |
| D-P7 | Followed-library digest: free or Pro?                                                                    | **Free weekly digest, Pro instant alerts.** This keeps the existing free settings promise honest.                                                          |
| D-P8 | Sample area for previews                                                                                 | **Glasgow City** for UK layers. Pick a per-country sample when non-UK data lands.                                                                          |
| D-O1 | Code licence                                                                                             | **AGPL-3.0 for apps, MIT for the small packages.** A CLA or DCO before outside contributions, if relicensing might be wanted.                              |
| D-O2 | Trademark policy for the name and logo                                                                   | **Yes.** Forks rebrand.                                                                                                                                    |
| D-O3 | Private package for the gating code                                                                      | **No.** Enforce on the server. Keep data and compute private, and put a service seam at `ANALYSIS_SERVICE_URL` (§11.4).                                    |
| D-O4 | Is the repository public today? If so, keep this spec's §4 off the public branch until P-A ships (§11.5) | Confirm visibility                                                                                                                                         |

---

## 11. Open source codebase, gated service

### 11.1 Position

The code is not what people pay for, so there is **no private package for the gating logic**. Pro is paid for by things a fork doesn't get just by cloning the repo:

1. **Licensed and derived data.** Examples: per-capita figures joined to population, deprivation, transit, and H3 population aggregates. These are built by pipelines whose outputs live in private storage, never in the repo or a public bucket.
2. **Compute we run and pay for.** Routing and isochrones, spatial analysis, exports and PDF rendering.
3. **The live, community-moderated dataset,** and the community, moderation and trust built around it.
4. **The brand and the canonical URL.**

Enforcement already lives on the server (§7). Publishing `resolveEntitlements()` gives an attacker nothing: knowing that `/api/atlas/reach` needs `atlas.analysis` doesn't let you call it. Hiding the gate code would be security through obscurity. It would also break every fork's build, and Strapi and Next both need to import it.

**On scraping:** you're right not to worry much. The free data is meant to be free (principle 1), and if the records are published under an open licence (D-P6), taking them is allowed as long as the licence terms are kept, such as attribution and share-alike. What we protect against is **load and abuse**, not access. So we make the legitimate route easier than scraping (§11.3) and rate-limit the rest.

### 11.2 What must stay private, and where it lives

| Private                                                                 | Mechanism                                                                                                                                                                                                                                                                  |
| ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Secrets (Stripe, bridge secret, API tokens, the Meilisearch master key) | Environment variables only. Add `gitleaks` in pre-commit and CI, and GitHub secret scanning and push protection. Keep `.env.example` files as placeholders.                                                                                                                |
| Licensed context data and derived Pro datasets                          | Private object storage. The data pipeline (`apps/data-pipeline` or a private repo) runs against private credentials. The tile proxy (§7) serves it only to entitled users. Nothing licensed goes under `apps/ui/public/`. `public/boundaries/` holds open boundaries only. |
| Infrastructure configuration (routing engine host, CDN signing keys)    | Environment variables. The routing engine is reachable from the server only.                                                                                                                                                                                               |
| Unfixed vulnerability details                                           | See §11.5                                                                                                                                                                                                                                                                  |

What stays **public**, deliberately: the gating code, the entitlement tables, the preview bbox constants, the verification domain rules (the domain lists come from data, not code) and the analysis algorithms.

### 11.3 The public data surface

The free data is pullable by design, so give it a proper interface:

- **Bulk open-data downloads.** Publish nightly CSV and GeoJSON dumps of published library records, with a licence and attribution file, from `/data/downloads`. This reduces scraping and delivers on "facts are free".
- **Rate limits** on every anonymous read path:
  - `public-proxy`: per-IP limits at the edge (Vercel Firewall, or middleware backed by a shared store).
  - **Meilisearch:** the browser search key is public by necessity. Put Meilisearch behind a CDN rule with per-IP rate limits, or proxy search through `/api/search` with limits. Keep only published, non-personal fields in the index (the case today; add a test).
  - Strapi public role: `find`/`findOne` on public types only. A check in CI compares the `up_permissions` export against an allowlist.
- **API keys** (Pro design spec phase 4): a free key with low limits for anyone who wants more than the dumps, and higher limits on Team. These use the same entitlements.
- **Terms of use:** attribution and fair-use limits. An honest `robots.txt`.

### 11.4 Licence and self-hosting

- **Code licence (D-O1):** recommend **AGPL-3.0** for `apps/*`. It's a copyleft licence, so anyone running a modified copy as a public service must publish their changes. That covers the risk of a closed SaaS clone. MIT or Apache-2.0 suit the small reusable packages (`@repo/access`, `events-crypto`, `design-system`). If you want to keep the option of relicensing or dual-licensing later, add a **CLA or DCO** before accepting outside contributions. Add `LICENSE`, `SECURITY.md`, `CONTRIBUTING.md`, plus a `license` field in each `package.json` (none exist today).
- **Data licence:** a separate decision (D-P6), recorded in the dumps and on the plans sheet.
- **Trademark (D-O2):** a short trademark policy. Forks must not use the name "libraries.global" or the logo for their own deployments. This, not code secrecy, is what stops a fork passing itself off as the real service.
- **Self-hosting mode.** Add `ENTITLEMENTS_MODE = "billing" | "open"`:
  - `billing` is our deployment. Plans resolve from Stripe, grants and verification.
  - `open` is for forks and local development. Every feature whose backing service is configured is available to every signed-in user. Features without a backing service (no routing URL, no licensed tiles) show as unavailable, not locked.
  - **Fail closed:** in production, startup refuses to boot unless `ENTITLEMENTS_MODE` is set explicitly. Setting it to `open` alongside `STRIPE_SECRET_KEY` is also a boot error. This stops our own deployment being accidentally unlocked.
- **A seam for Pro compute:** reach, analyse, compare and report call `ANALYSIS_SERVICE_URL` over HTTP. The service can live in the monorepo (`apps/analysis`, open) or move to a private repo later, without touching `apps/ui` or `apps/strapi`. **This is the only place a private component would make sense**, and only if a licence or contract ever requires it (for example, a commercial data client whose terms forbid publishing it). No private package is needed now.

### 11.5 Open source raises the bar for security

When the source is public, every flaw in §4 can be found by anyone reading it.

- **Fix P-A before the repository is public**, or before it's announced if it's already public.
- **Keep exploit details out of public history until fixed.** §4 of this spec lists exploitable issues with file and line numbers. If the repo is public, either keep this spec on a private branch until P-A ships, or cut §4 down to non-specific fix items. The same goes for the `.scratch/` issues for P-A.
- **Add `SECURITY.md`** with a private disclosure route (GitHub private vulnerability reporting, or a security@ address).
- **Turn on Dependabot and CodeQL.** Treat the audit's regression tests (§9) as the permanent guard.

## 12. Out of scope

- Visual changes to already-built Atlas frames beyond QA fixes.
- A frontend moderator queue. Moderation stays in Strapi admin. A future Moderator role would add `moderate.queue`.
- Donations or Ko-fi.
- Ads.
- Paying for moderation priority.
- API keys, which are Pro design spec phase 4.

## 13. Environment additions

`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_PRO_MONTHLY`, `STRIPE_PRICE_PRO_ANNUAL`, `STRIPE_PRICE_TEAM_SEAT`, `STRIPE_PUBLISHABLE_KEY`, `PRO_ENABLED`, `STRAPI_UPLOAD_API_KEY` (A12), `ROUTING_ENGINE_URL` (P-D3, internal only), `PRO_VERIFY_TOKEN_TTL_HOURS`, `ENTITLEMENTS_MODE` (required in production, §11.4), `ANALYSIS_SERVICE_URL`. Add them all to `docs/pre-golive-checklist.md`.

- `STRIPE_PUBLISHABLE_KEY` is the only one that is `NEXT_PUBLIC_`.
- Everything else is server-only.
