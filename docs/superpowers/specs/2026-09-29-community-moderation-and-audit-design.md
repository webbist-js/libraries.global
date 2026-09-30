# Community moderation, role grants, audit trail, i18n review and coverage

**Date:** 2026-09-29
**Status:** Draft for review (revised 2026-09-30 against the Strapi review remediation commits 79ab1e3..c2fffdb)
**Supersedes in part:** `2026-09-26-access-contribution-pro-implementation-design.md` §12 ("A frontend moderator queue" is no longer out of scope) and decision I5 ("Only the owner has Strapi admin access") is kept, but moderation no longer requires admin access.
**Related:** ADR-0003 (programmatic location pages), CONTEXT.md vocabulary, `docs/strapi-role-permissions.md` (stale; rewritten by this work).

## 1. Summary

Six workstreams, one foundation. Contributor trust moves from a single enum to **Role Grants**: multiple roles per person, each optionally scoped to a moderation queue and a locale, with grantor, reason and expiry. Everything else builds on that:

| Workstream                             | Outcome                                                                                                                                                                                                                                     |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A. Role grants and scoped capabilities | Multi-role users, locale- and queue-scoped moderators and editors, role history, resolved by `@repo/access` and enforced by Strapi                                                                                                          |
| B. Audit trail                         | Append-only field-level Change Records for libraries and edit-level records for articles, captured on every write including admin and imports, plus a Review Event log for moderation; a public timeline and per-library activity histogram |
| C. Frontend moderation                 | A `/contribute/moderation` queue and review page for community Moderators, with server-side filtering, live "current" values, translation side-by-side, and a publish path for article suggestions                                          |
| D. Role applications and notifications | Apply to become a Knowledge or Journal editor after a track record; approval writes the grant; email to the applicant and to moderators@                                                                                                    |
| E. i18n                                | Locale on every Submission, a translation mode in the Index editor restricted to localized fields, locale-aware apply, English fallback rendering, all-locale search                                                                        |
| F. Coverage and location requests      | Every country published from the boundary seed data; Region and Area requests from the new-library flow; moderators set the hierarchy at approval                                                                                           |

Decisions already taken with the owner on 2026-09-29:

1. **No move to Strapi Users & Permissions roles.** U&P stays vestigial (every account holds `Authenticated`). Contributor routes keep the bridge-secret identity model. Rationale: U&P is one role per user with per-route permissions; it cannot express multi-role, locale, library or queue scope, and every contributor route is `auth: false` today, so U&P guards nothing. Strapi remains authoritative through its own policies, not through U&P.
2. **Applications are gated on track record, not on Plan.** "Money never buys trust" stays intact. Pro is irrelevant to the role path.
3. **Moderators with the matching scope can publish** approved article suggestions and non-editor articles from the frontend. Only a very small set of people need Strapi admin.
4. **All countries are imported before go-live.** Requests are needed only for Regions and Areas.

Go-live is 15 October 2026. §11 orders the work into what ships before, immediately after, and then.

## 2. Vocabulary

Existing CONTEXT.md terms apply unchanged: Submission, Submission State, Library Claim, Contributor Role, Capability, Entitlement, Plan, Tier, Moderator, Wiki (shown as Knowledge), Blog (shown as Journal), Pillar Institution.

New terms (add to CONTEXT.md):

- **Role Grant** — a row that gives one person one Contributor Role, optionally scoped to a Moderation Queue and a locale, with grantor, reason and expiry. A person's Contributor Roles are the union of their unexpired grants. _Avoid_: permission, U&P role.
- **Moderation Queue** — one of `index` (library submissions and location requests), `knowledge`, `journal`, `applications`. Every Submission type maps to exactly one queue.
- **Moderation Scope** — the (queue, locale) pairs a Moderator may review. `all` queue and `null` locale mean unrestricted.
- **Change Record** — one field of one library changing once: previous value, next value, who, when, why (which Submission), from which source. Grouped by a **Change Batch** (one write).
- **Article Change** — one edit event on a Knowledge or Journal article: who, when, locale, kind. No body diff.
- **Review Event** — one Submission State transition: from, to, reviewer, note, when. Append-only.
- **Role Application** — a Submission asking for a Knowledge or Journal editor role, reviewed in the `applications` queue.
- **Location Request** — a Submission asking for a missing Region or Area, reviewed in the `index` queue.

`reader` remains the name for "no grants".

## 3. Workstream A: Role Grants and scoped capabilities

### 3.1 Data

New admin-only collection `api::role-grant.role-grant` (`routes: []`, visible in the Content Manager, pattern of `entitlement-grant`):

| Field       | Type                                                                                                      | Notes                                                                              |
| ----------- | --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `baUserId`  | string, required, indexed                                                                                 | Better Auth id                                                                     |
| `role`      | enum `contributor`, `verified_librarian`, `wiki_editor`, `journal_editor`, `moderator`, `editorial_board` | `reader` is never a grant                                                          |
| `queue`     | enum `all`, `index`, `knowledge`, `journal`, `applications`; default `all`                                | Only meaningful for `moderator`; ignored for other roles                           |
| `locale`    | string, nullable                                                                                          | `null` = every locale. Meaningful for `moderator`, `wiki_editor`, `journal_editor` |
| `source`    | enum `admin`, `claim`, `application`, `migration`; default `admin`                                        |                                                                                    |
| `grantedBy` | string                                                                                                    | admin email or `ba:<id>` of the approving moderator                                |
| `reason`    | text                                                                                                      |                                                                                    |
| `expiresAt` | datetime, nullable                                                                                        |                                                                                    |

`user-profile.contributorRole` stays as a **derived display value**: the highest role among unexpired grants, in `CONTRIBUTOR_ROLES` order (`reader`, `contributor`, `verified_librarian`, `wiki_editor`, `journal_editor`, `moderator`, `editorial_board`). It is written only by `api::role-grant` lifecycles (`afterCreate`, `afterUpdate`, `afterDelete`) through a `syncDerivedRole(baUserId)` service. Nothing else writes it. `isVerifiedLibrarian` follows the same rule (true when a `verified_librarian` or higher grant exists).

**Migration** (bootstrap, idempotent, runs once guarded by a core-store flag): for every user-profile whose `contributorRole` is not `reader`, create a grant `{ role, queue: "all", locale: null, source: "migration", reason: "Backfilled from user-profile.contributorRole" }` if none exists.

**Writers of grants in code:**

- `grantVerifiedLibrarian` (`apps/strapi/src/utils/affiliations.ts`) creates a `verified_librarian` grant with `source: "claim"` if the user has none; it never removes a grant.
- Role Application approval (Workstream D) creates `wiki_editor` or `journal_editor` grants, one per requested locale, or one with `locale: null`.
- `erase-account.ts` deletes every role grant for the user, next to the entitlement grants and verifications it already removes in its transaction.
- The bridge already excludes `proposer` affiliations from claims (`claimAffiliationFilter`) and no longer mints a Strapi JWT, so nothing in Workstream A depends on U&P.

### 3.2 `@repo/access`

`packages/access` changes, all covered by unit and type-level tests:

```ts
export type GrantableRole = Exclude<ContributorRole, "reader">
export type ModerationQueue = "index" | "knowledge" | "journal" | "applications"
export interface RoleGrant {
  role: GrantableRole
  queue: ModerationQueue | "all"
  locale: string | null
}
export interface CapabilityInput {
  signedIn: boolean
  grants: RoleGrant[] // replaces contributorRole
  claims: { libraryDocumentId: string }[]
}
export interface Capabilities {
  set: ReadonlySet<Capability>
  claimedLibraryIds: ReadonlySet<string>
  moderation: ReadonlyArray<{
    queue: ModerationQueue | "all"
    locale: string | null
  }>
  editorLocales: {
    docs: "all" | ReadonlySet<string>
    journal: "all" | ReadonlySet<string>
  }
}
export const QUEUE_OF_SUBMISSION_TYPE: Record<SubmissionType, ModerationQueue>
export function highestRole(grants: RoleGrant[]): ContributorRole
export function canDirectEdit(
  c: Capabilities,
  kind: "docs" | "journal",
  locale: string
): boolean
export function canModerate(
  c: Capabilities,
  s: {
    submissionType: SubmissionType
    locale: string
    submittedByUserId: string
  },
  viewerBaUserId: string
): boolean // false for own submissions, always
```

- New capabilities: `moderate.queue` (any moderation scope; drives the tab), `submit.roleApplication`, `submit.locationRequest`.
- `docs.directEdit` / `journal.directEdit` stay as "in at least one locale" for UI; `canDirectEdit` is the locale-aware check used by the Strapi policy and at apply time.
- `editorial_board` implies `docs`, `journal` and `moderation: [{ queue: "all", locale: null }]`.
- `moderator` grants add `moderation` scopes; nothing else.
- `contributionLimits(tier, role)` treats `journal_editor`, `moderator` and `editorial_board` as staff roles (fixes the current omission).
- Type-level test `invariants.test-d.ts` is updated deliberately: `keyof CapabilityInput` is exactly `signedIn | grants | claims`, and `RoleGrant` has no plan field. The entitlement invariant is unchanged.
- `promoteRole` remains for the derived display value.

### 3.3 Session and Strapi policy

- **Bridge** (`sessionProfile` in `auth-bridge.ts`) returns `grants: RoleGrant[]` (unexpired, at most 50) in addition to the derived `contributorRole`. `session-profile.ts` validates it with zod.
- **`buildSessionAccess`** passes grants to `resolveCapabilities`; the session gains `moderationScopes` and `editorLocales` (serialised as arrays). `useCapabilities()` exposes `moderation` and `canDirectEdit(kind, locale)`.
- **Cache invalidation:** a `role-grant` lifecycle posts to the Next route `POST /api/internal/session/invalidate` (bridge-secret gated) with the `baUserId`. Best effort and per instance; the 60-second TTL remains the guarantee. Documented in CLAUDE.md.
- **`submission-policy.loadCapabilities`** reads grants instead of the enum and returns the full `Capabilities`. `check()` uses `canDirectEdit` with the submission locale for direct article edits.
- **Self-review** is `canModerate`'s job and is enforced in Strapi for every moderation route, keyed on `baUserId`.

### 3.4 Admin users

Strapi admin routes for moderation stay, thin, for the owner. Admin reviewers are recorded as `admin:<id>`; community moderators as `ba:<baUserId>`. The existing `reviewedByUserId` string is kept and now always carries one of those prefixes; the migration prefixes existing values with `admin:`.

## 4. Workstream B: Audit trail

### 4.1 Change Records for libraries

New collection `api::library-change.library-change` (`routes: []`; read through the content-moderation content-api, §4.4):

| Field                  | Type                                                        |
| ---------------------- | ----------------------------------------------------------- |
| `batchId`              | string (uuid), indexed                                      |
| `libraryDocumentId`    | string, indexed (survives library deletion)                 |
| `entityRef`            | string                                                      |
| `locale`               | string                                                      |
| `action`               | enum `create`, `update`, `publish`, `unpublish`, `delete`   |
| `field`                | string (`*` for create/delete/unpublish snapshots)          |
| `previous`             | json, nullable                                              |
| `next`                 | json, nullable                                              |
| `source`               | enum `submission`, `admin`, `api_token`, `import`, `system` |
| `actorKind`            | enum `contributor`, `admin`, `token`, `system`              |
| `actorId`              | string (`ba:<id>`, `admin:<id>`, token name)                |
| `actorName`            | string, nullable                                            |
| `reviewerId`           | string, nullable                                            |
| `submissionDocumentId` | string, nullable                                            |
| `changedAt`            | datetime, indexed                                           |

**Capture** is a document-service middleware (`strapi.documents.use`) registered in the `bootstrap` of `src/index.ts`, for `api::library.library`. The repo has no other document middleware since the catalogue port was removed, so this creates `src/documentMiddlewares/change-records.ts`. Writes made through `strapi.db.query` (the `completeness` and `entityRef` lifecycles, the submission compare-and-set) bypass it by design: they are derived fields, not content changes.

- `update`: read the current document in the same `documentId`, `locale` and `status` before `next()`, diff the allowlisted attributes against the result after, write one record per changed field with a shared `batchId`. Relations are compared as sorted `documentId` lists; components and JSON as stable-stringified values. Ignored: `updatedAt`, `publishedAt`, `updatedBy`, `createdBy`, `localizations`. `contentUpdatedAt` and `lastVerifiedAt` are recorded (they feed the verification timeline).
- `publish`: diff the previously published version against the newly published one (same rules), `action: "publish"`; a publish with no field difference writes a single `field: "*"` record.
- `create`, `delete`, `unpublish`: one `field: "*"` record with the snapshot in `next` or `previous`.
- Ignored as derived: `completeness`.
- The record insert runs after `next()` resolves and **inside the caller's transaction** when there is one (`updateStatus` wraps the compare-and-set and every apply in `strapi.db.transaction`; Strapi's transaction context propagates to nested queries). An insert failure propagates, so an approval whose change could not be recorded rolls back and reports `apply_failed`: the audit row is part of the write. `CHANGE_RECORDS_ENABLED=false` is the kill switch for an emergency, logged loudly at boot.
- The publish guard (`utils/publish-guard.ts`) may write an approval to the draft only when an admin has unpublished edits; that is recorded as `action: "update"` on the draft version, and the later admin publish is recorded as `publish`.

**Actor resolution** (`src/utils/change-context.ts`), in priority order:

1. An `AsyncLocalStorage` context set by the moderation service around every apply: `{ source: "submission", actorKind: "contributor", actorId: "ba:<submitter>", actorName, reviewerId, submissionDocumentId }`.
2. `strapi.requestContext.get()`: `ctx.state.user` (admin panel) → `admin`; `ctx.state.auth?.credentials?.name` (API token) → `api_token` with the token name, or `import` when the token name starts with `import` or `ingest`; `X-Ba-User-Id` header with a valid bridge secret → `contributor`.
3. Otherwise `system`.

Scripts under `apps/strapi/scripts/` are updated to use an API token named `ingest-*` so their writes are classed as imports.

### 4.2 Article Changes

New collection `api::article-change.article-change`: `articleKind` (`wiki` | `blog`), `articleDocumentId`, `slug`, `locale`, `kind` (`created`, `edited`, `translated`, `published`, `unpublished`, `deleted`), `actorKind`, `actorId`, `actorName`, `reviewerId`, `submissionDocumentId`, `editSummary`, `bodyHash` (sha256 of the stable-stringified body), `changedAt`. Same middleware pattern for `api::wiki-article.wiki-article` and `api::blog-article.blog-article`, same actor resolution. `translated` is used when the write creates a locale version that did not exist.

### 4.3 Review Events and submission links

- New plugin collection `plugin::content-moderation.review-event`: `submission` (relation), `fromStatus`, `toStatus`, `reviewerId`, `reviewerKind` (`admin` | `contributor`), `note`, `createdAt`. Written inside `updateStatus`'s transaction after the compare-and-set succeeds, and on `finalize` (`draft → pending`, reviewerKind `contributor`, the submitter). `reviewNote` stays as "latest note" for back-compat.
- Submission gains `resultDocumentId` (string): the library, article, region or area created by approval. `new_library`, `location_request` and new-article approvals set it.
- The old `findLibraryRevisions` is replaced by a query over `library-change` batches (§4.4). A one-off backfill script turns each existing approved library submission into a batch with `field` rows from `fields` keys (meta keys `kind` and `previous` excluded), `previous`/`next` null, `source: "submission"`, `changedAt: reviewedAt`.

### 4.4 Read API and UI

Content-api routes on the content-moderation plugin (public, sanitized):

- `GET /libraries/:documentId/history?page&pageSize` → batches `{ batchId, changedAt, action, source, actor: { username | null, kind }, fields: [{ field, previous?, next? }], submissionDocumentId }`. `username` only when the contributor's profile activity is public (same rule as today). `previous`/`next` are included only when the caller holds the entitlement `library.history` (new Feature in `@repo/access`, granted to `pro` and `team`; the Next proxy checks `requireEntitlement` and asks Strapi with `?values=1` plus the bridge secret). Public callers get field names only.
- `GET /libraries/:documentId/history/stats?months=24` → `[{ month, batches, fields, contributors }]` plus `byField: [{ field, count }]`, `byAction`, `verificationEvents` (months where `lastVerifiedAt` changed). Computed with `strapi.db` aggregation in the plugin service.
- `GET /articles/:kind/:documentId/history` → Article Changes (who, when, locale, kind, summary), same privacy rule.

UI:

- Library detail: the "Sources and changes" section becomes **Changes**, backed by history batches, with a 24-month bar histogram of batches (inline SVG, DS tokens, `aria-label` with the numbers, no third-party chart lib), the by-field top five as a compact list, and the batch timeline with expandable field rows. Pro users see previous → next per field; others see field names and an "Upgrade to see values" line from `lib/plans.ts` copy.
- Knowledge and Journal article pages: an **Edit history** panel under the article: contributor, date, locale, kind. No values.
- Profile activity: unchanged in scope; it may link to batches later.

## 5. Workstream C: Frontend moderation

### 5.1 Strapi content-api (bridge identity, `canModerate` re-check on every request)

| Route                                                                          | Purpose                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /moderation/submissions?status&type&locale&q&page&pageSize=25`            | Server-side filtering, search (`submittedByName`, `submittedByEmail`, `targetSlug`, summary text), pagination. Results are filtered to the caller's Moderation Scopes and exclude their own submissions.                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `GET /moderation/submissions/:documentId`                                      | Full detail, plus `review`: for record corrections and library edits the live values and option names from `utils/record-review.ts` (`recordReview`, already used by the admin list) in the submission locale; for article edits the live article (title, summary, body) in the submission locale and, for translations, the source-locale article.                                                                                                                                                                                                                                                                         |
| `PUT /moderation/submissions/:documentId/status`                               | `{ status, note, publish? }`. `publish: true` is accepted for `wiki_edit`/`blog_submission` (makes `article-apply` publish instead of drafting) and for `new_library` (publishes the created library instead of leaving a `PENDING-` draft; requires the hierarchy to be set, §8.2, and the `entityRef` lifecycle to have produced a real reference, else the approval is refused with `apply_refused: no_hierarchy`). Only when the caller's scope covers that queue and locale. The publish guard's `apply_refused: not_published` is surfaced as "This record has no published version; an admin must publish it first." |
| `PUT /moderation/submissions/:documentId/target`                               | For `new_library` and `location_request`: set or override `continent`/`country`/`region`/`area` document ids before approval (§9.2). Stored on `draftData.moderatorTarget`.                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `GET /moderation/relation-labels?type=`                                        | Port of the admin route.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `GET /moderation/stats`                                                        | Counts per status per queue within the caller's scope.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `GET /moderation/submissions/:documentId/events`                               | Review Events for the thread view.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `GET /moderation/option-suggestions`, `PUT /moderation/option-suggestions/:id` | The Suggested Additions decisions (accept or decline a new option name), mirroring the admin routes; `editorial_board` only.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |

The admin routes keep working and share the same service methods. `updateStatus` takes a `reviewer: { id: "ba:…" | "admin:…", kind, email, baUserId? }` object; the self-review check compares `baUserId` for contributors and email for admins.

### 5.2 Next.js

- Proxy routes under `apps/ui/src/app/api/moderation/*`, each gated by `requireCapability(user, "moderate.queue")` and forwarding with `userHeaders()`.
- `/contribute/moderation` (tab **Moderation**, shown only with `moderate.queue`; `ContributeNavBar` becomes capability-driven as spec §5.4 intended, keeping the existing tabs static for everyone else). Compact `PageHero`; segmented status control (Pending, Needs changes, Decided); filters: queue/type, locale, search; table with Type, Submission, Contributor, Locale, Submitted, Status; server pagination with `Pager`.
- `/contribute/moderation/[documentId]`: the review page. Left column: metadata card, summary/note, per-type panel (ported from `submissionMeta.ts` and the admin panels to DS components): Field / Current / Proposed table using the server's `current`; article preview with side-by-side source locale for translations; facilities Yes/No; claim domain check; role application statement and samples; location request with the hierarchy picker. Right sticky column: decision form (note required for Needs changes and Reject; **Approve**, **Approve and publish** when applicable, **Needs changes**, **Reject**), the Review Events thread, and links to the target record. Decided submissions are read-only.
- A **Suggestions** view under the tab for `editorial_board`, listing open Option Suggestions with request counts and Accept / Decline.
- Next routes build headers with `lib/bridge-user-headers.ts` and rate-limit decisions with `lib/rate-limit.ts` (30 a minute per user), the same limiter the submission routes use. `strictParams` is on in Strapi, so every query parameter is validated and clamped (`clampInt`).
- Errors map: 403 (out of scope or own submission), 409 (conflict), 422 (tampered), 409 `apply_refused` with the reason copy, 500 with `apply_failed` copy.

### 5.3 Fixtures and E2E

`seed:access` gains three users: a global Moderator, a Knowledge-queue French Moderator, and a Journal editor with `locale: "fr"`. Playwright `access` project covers: tab visibility, scope filtering (the French moderator does not see English Journal items), self-review denial, approve-and-publish of a suggestion, needs-info note appearing to the contributor.

### 5.4 ADR

`docs/adr/0005-moderation-runs-in-the-frontend.md`: community Moderators review Submissions at `/contribute/moderation`; Strapi admin keeps a thin queue for the owner; every moderation request is re-authorised in Strapi with `canModerate`; no Plan, Tier or role skips review.

## 6. Workstream D: Role applications and notifications

### 6.1 Role Application

- New `SUBMISSION_TYPES` member `role_application`, queue `applications`, `targetEntityType: "user_profile"`.
- `fields`: `{ role: "wiki_editor" | "journal_editor", locales: string[] (empty = all), statement: string (≤ 2,000 chars), samples: string[] (≤ 5 URLs) }`.
- Eligibility, enforced in `submission-policy` and mirrored in the UI: signed in, at least `ROLE_APPLICATION_MIN_ACCEPTED = 5` approved submissions (constant in `@repo/access/limits.ts`), no open application for the same role, no existing grant for that role covering the requested locales. Never Plan-related.
- Approval creates the grants (`source: "application"`, `grantedBy: reviewerId`, `reason: "Approved application <documentId>"`), sets `resultDocumentId` to the profile, invalidates the session profile, and awards no points.
- Reviewable only by `editorial_board` or a Moderator whose scope includes `applications`.
- `statement` and `samples` run through `submission-policy.checkContent` on create and finalize like every other submission.

### 6.2 UI

- `/contribute/knowledge/apply`: eligibility card (progress "3 of 5 accepted changes" from `/api/contribute/standing`), the form (role, locales multi-select from the configured locales, statement, sample links), and the state of any open or decided application with the moderator's note. Replaces the mailto on the Knowledge landing (`DocsPage.tsx`) and adds the same link to the Journal landing.
- `RolesTable.tsx` drops the two unimplemented promises and adds "Apply" to the editor columns.

### 6.3 Notifications

A `notifications` service in the content-moderation plugin, called from `updateStatus`, `finalize` and `create`; best effort, logged, never blocks a transition. Sends through `strapi.plugin("email").service("email").send` with the configured provider (Mailgun or Mailtrap; a missing provider logs and skips).

| Event                                                          | Recipient                                                  | Respects                                               |
| -------------------------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------ |
| Submission `approved`, `rejected`, `needs_info`                | Submitter (`submittedByEmail`)                             | `user-profile.notifPrefs.editsReviewed` (default true) |
| New `role_application` or `location_request` reaches `pending` | `MODERATORS_EMAIL` (default `moderators@libraries.global`) | always                                                 |
| `role_application` decided                                     | Applicant                                                  | always                                                 |

Templates are plain text with a minimal HTML twin in `server/utils/email-templates.ts`; the from address is the plugin's `defaultFrom`. Links point to `${APP_PUBLIC_URL}/contribute/submissions`. No digests, no moderator notifications for ordinary submissions (out of scope).

## 7. Workstream E: i18n

### 7.1 Locale on Submissions

- `submission.locale` (string, default `"en"`). Set by `create` and `finalizeDraft` from `body.locale`, validated against the configured locales; falls back to the default locale. Backfill from `draftData.locale` for existing rows.
- `findDraft` is scoped by `(user, type, targetSlug, locale)`.
- `payloadHash` includes `locale`.
- The queue filters by `locale`; `canModerate` uses it.

### 7.2 Articles

- Existing-article apply finds the article by `slug` in the submission locale; when that locale version is missing it loads the default locale and writes the new locale version (Strapi v5 `update` with `locale` creates it). `uniqueSlug` checks without a locale filter (slug is shared).
- Journal translations award `journal_translated` (15 points; new rewards action). `wiki_translated` unchanged.
- Review page shows source-locale title, summary and body beside the translation (§5.1 `current.source`).

### 7.3 Libraries

- `LOCALIZED_LIBRARY_FIELDS` exported from `@repo/shared-data`: `name`, `shortName`, `summary`, `description`, `city`, `district`, `streetAddress`, `closureReason`, `visitNotes`, `admissionInfo`, `accessibilityNotes`, `buildingInfo`, `transitInfo`. A test asserts it matches the schema's `localized: true` string/text/blocks attributes.
- Index editor `/contribute/index/[slug]?locale=xx`: when `xx` is not the default locale the wizard is in **translation mode**: prefilled from the `xx` version if it exists, otherwise from the default locale with a "Translating into xx" banner; only `LOCALIZED_LIBRARY_FIELDS` are editable; the payload carries `locale: "xx"`. Without `?locale` the editor always edits the default locale, regardless of the route locale (fixes the current overwrite bug). A "Translate this record" action on the library page's help panel links to it when more than one locale is configured.
- `library-record.ts`: `findLibrary(documentId | slug, locale)`; for a non-default locale it ignores every non-localized field server-side. `publish-guard.ts` gains an `applyToLocale` mode: when the requested locale has no version yet, the guard requires the **default-locale** version to be published and then creates the new locale version directly as published (no draft can diverge yet); otherwise the existing `applyToPublished` rules apply per locale. `facility-answers.ts` and `new_library` write the default locale explicitly.
- `description` and `seo` remain non-editable in the Index editor (unchanged scope).

### 7.4 Rendering and search

- `fetchLibrary`, `fetchWikiArticle`, `fetchBlogArticle` fall back to the default locale when the requested locale version is missing, returning `{ …doc, localeFallback: true }`. Pages render a small "Not yet translated into xx" line and emit `robots: noindex` for fallback renders. `generateStaticParams` is unchanged.
- Meilisearch: the three indexes already fetch `locale` and key documents by `documentId` plus `locale`. Add `entriesQuery.locale: "all"` for `library`, `wiki-article` and `blog-article`, add `locale` to their `filterableAttributes`, and extend the seed script and its parity test (`scripts/seed-meilisearch.mjs`) to index every locale; UI search filters by the route locale when it is in `LIVE_LOCALES`, else the default locale.
- `LIVE_LOCALES` stays `[en]` until a locale has content; adding one is a one-line change and is documented.

## 8. Workstream F: Coverage and Location Requests

### 8.1 Countries

Script `apps/strapi/scripts/populate-world-countries.ts` (run with an `ingest-*` API token, idempotent):

- Reads `apps/ui/public/boundaries/seed-data.json` `continents/*` lists (247 countries).
- Maps the seed's `americas` list to Strapi's `north-america` and `south-america` by a fixed ISO set for South America (`AR BO BR CL CO EC GY PY PE SR UY VE FK GF`); everything else in that list is North America (including Central America and the Caribbean).
- Creates missing continents and countries as **published** with `name`, `slug`, `iso2`, `mapConfig` (centroid and bbox), `boundaryUrl`, `sourceAttribution`, `continent`. Existing rows are matched by `iso2` then `slug` and only have empty fields filled. Existing **draft** countries and regions created by earlier scripts are published (reported in the script output).
- Added to `docs/pre-golive-checklist.md` as a go-live step.

### 8.2 Location Request

- New `SUBMISSION_TYPES` member `location_request`, queue `index`, `targetEntityType: "region" | "area"`.
- `fields`: `{ kind: "region" | "area", name, typeLabel?, countryDocumentId, regionDocumentId? (required for areas), note?, evidenceUrl }`.
- UI: a "Not listed?" link under the Region and Area selects in `LocationHierarchySelector` opens an inline form that creates the request on submit and stores `{ proposedRegionName | proposedAreaName, locationRequestDocumentId }` on the wizard form, so the `new_library` submission carries it. The hierarchy fields stay optional.
- `name`, `typeLabel`, `note` and `evidenceUrl` run through `submission-policy.checkContent`.
- Approval creates the Region or Area **published**, with `slug` from the name, `typeLabel`, parent relations, and sets `resultDocumentId`. The review page lets the moderator edit name and type label before approving.
- `new_library` review shows `proposedRegionName` and the moderator's target picker (§5.1); approval uses `draftData.moderatorTarget` over the submitter's ids when set. Free-text `country`/`city`/`district` are kept on the library as today.
- New `location_request` submissions email `MODERATORS_EMAIL` (§6.3).

## 9. Cross-cutting

### 9.1 Security

- Every moderation, history-with-values and application route is authorised in Strapi with `canModerate` / `canSubmit` / entitlement checks, never only in Next.
- Self-review is impossible by construction (`canModerate` returns false for own submissions).
- Reviewer ids carry the `ba:` or `admin:` prefix; no route accepts a reviewer id from the client.
- Change Records and Review Events are append-only: no update or delete routes, and the Content Manager view is read-only for admins other than super admin (documented; enforced by admin RBAC in `docs/strapi-role-permissions.md`).
- The bridge secret model is unchanged in this work. Hardening it (a signed identity token) is a separate, later item.

### 9.2 Tests

- `packages/access`: unit tests for `resolveCapabilities` with grants, `canModerate` scope matrix, `canDirectEdit`, `highestRole`, `QUEUE_OF_SUBMISSION_TYPE` covering every type; type-level invariants updated.
- `apps/strapi/tests`: policy tests for `role_application` eligibility and `location_request`; `updateStatus` with contributor reviewers and scope denial; Review Event written on each transition; `library-change` middleware diff rules (relations, components, ignored fields, locale, publish); actor resolution; article-apply `publish` override; locale-aware library apply (non-localized fields ignored, locale version created); notifications called with the right recipients and never throwing.
- `apps/ui`: vitest for `ContributeNavBar` visibility, history rendering with and without values, translation-mode field filtering.
- Playwright `access` project: §5.3 plus the application form and a location request.

### 9.3 Documentation

- CLAUDE.md "Access model" and "Contribution & moderation" sections; CONTEXT.md vocabulary (§2) and the `journal_editor`/`moderator` roles; `docs/strapi-role-permissions.md` rewritten to describe grants and the two moderation surfaces; ADR-0005; `.env.example` for `MODERATORS_EMAIL`, `APP_PUBLIC_URL`; `docs/pre-golive-checklist.md` for the country import and the backfill scripts.

## 10. Out of scope

- Moving roles to Strapi Users & Permissions, or forwarding a Strapi JWT.
- Stripe or any paid plan work (P-D1).
- The contributor's resubmission flow for `needs_info` (C-M1) and contributor replies in the thread (C-M2); the Review Events log lays the foundation and the review page shows the thread read-only to the contributor on their submission card.
- Digest emails, moderator emails for ordinary submissions, in-app notification centre.
- Region and country analytics beyond per-library stats; a global analytics dashboard.
- Trusted service editors / auto-approval (needs its own ADR, per the access spec).
- RTL and new UI locales; `LIVE_LOCALES` remains English.
- Signing the bridge identity.

## 11. Delivery order

**Band 1, before go-live (15 Oct):**

1. A: role-grant collection, migration, `@repo/access` grants API, bridge and session, policy. (Everything else depends on it.)
2. B: library-change and article-change middleware, actor context, review-event, `resultDocumentId`, backfill script, history routes, library **Changes** section with histogram.
3. E core: `submission.locale`, locale-scoped drafts, locale-aware article and library apply, the Index editor translation mode, fallback rendering, Meilisearch all-locale.
4. F.1: world countries script, run locally and listed for go-live.
5. Small fixes: staff roles, `RolesTable` (rebuilt on 2026-09-30; verify the two unimplemented promises are gone), `/contribute/claim` bounce, translate-wiki quick-win URL, CONTEXT.md, stale doc.

**Band 2, immediately after:** 6. C: moderation content-api, Next proxies, `/contribute/moderation` queue and review page, fixtures and E2E, ADR-0005. 7. D: role applications, notifications service, apply page. 8. F.2: location requests and the moderator target picker.

**Band 3:** article edit-history panels, Pro value gating polish, analytics extensions.

Each numbered item is one implementation-plan section and one subagent task; items 2, 3 and 4 can run in parallel after 1.
