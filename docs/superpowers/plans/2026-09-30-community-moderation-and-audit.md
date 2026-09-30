# Community Moderation, Role Grants and Audit Trail Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement `docs/superpowers/specs/2026-09-29-community-moderation-and-audit-design.md`: scoped Role Grants, a field-level audit trail, frontend moderation, role applications with notifications, locale-aware submissions and library translation, world country coverage and Location Requests.

**Architecture:** `@repo/access` becomes grant-based and stays the single resolver used by the UI and Strapi. Strapi owns every authoritative check (submission policy, moderation scope, self-review) and records every library and article write through a document-service middleware. The Next.js app adds a capability-gated moderation surface under `/contribute/moderation` that talks to new bridge-secret content-api routes on the content-moderation plugin.

**Tech Stack:** Strapi 5.55.1 (Document Service, `strapi.db.transaction`, knex via `strapi.db.connection` for aggregates only), Next.js 16 App Router, Better Auth, next-intl, Vitest, Playwright, pnpm workspaces.

**How to read the tasks:** each task lists its files, the interfaces it consumes and produces (exact names and types; neighbouring tasks rely on them), the behaviour rules, and the test cases to write first. Implementers write the code test-first from those rules. The spec is the reference for anything a task does not restate; where this plan and the spec differ, this plan wins (see "Clarifications" below).

## Global Constraints

- **Node 22:** run `source ~/.nvm/nvm.sh && nvm use 22` in every shell (the default shell is v20).
- **Main working tree only.** No worktrees, no side directories, no `git stash`, `checkout` or `reset`. Other agents run in the same tree at the same time on disjoint files: never edit, revert or reformat a file your task does not list. If you believe you need to touch an unlisted file, stop and report it instead.
- **Do not commit.** Leave changes in the working tree; the orchestrator reviews and commits each task.
- **Do not run `pnpm generate:types`, `pnpm install` or add dependencies.** The orchestrator regenerates `apps/strapi/types/generated/contentTypes.d.ts` between waves. Until then, cast new UIDs with `as any` where the generated types lack them, exactly as existing code does for `api::entitlement-grant.entitlement-grant`.
- **Strapi v5 rules:** `strapi.documents()` for reads and writes; `strapi.db.query` only where existing code already uses it (compare-and-set, derived-field writes); `strapi.db.connection` (knex) only for aggregates. `findMany` ignores `pagination: {}`: use flat `start`/`limit` and always a stable `sort`. `rest.strictParams` and `documents.strictParams` are on, so unknown query parameters throw: validate and clamp every parameter (`clampInt` pattern in `plugins/rewards/server/controllers/rewards.ts`).
- **Identity:** Next.js calls Strapi with `bridgeUserHeaders(user)` from `apps/ui/src/lib/bridge-user-headers.ts`. Strapi content-api routes are `auth: false` and check `isValidServiceSecret` plus `X-Ba-User-Id`. Never accept a user id, reviewer id or role from a request body.
- **Money never buys trust:** no Plan, Entitlement, Tier or Points value may feed a Capability, a Role Grant, moderation scope or review order. `packages/access/tests/invariants.test-d.ts` enforces it.
- **Domain words:** Submission, Submission State, Contributor Role, Capability, Entitlement, Library Claim, Moderator, Role Grant, Moderation Queue, Moderation Scope, Change Record, Change Batch, Article Change, Review Event, Role Application, Location Request (spec §2). Knowledge = `wiki-article`, Journal = `blog-article`.
- **UI rules (CLAUDE.md):** colours and fonts from `T` in `lib/design-tokens.ts` via inline styles; Tailwind for layout; DS components from `components/ds/index.ts` first (`PageHero`, `SearchField`, `Badge`, `Card`, `EmptyState`, `Pager`, `SectionTabs`); primary CTA pill `bg-(--t-accent-primary) hover:bg-(--t-accent-primary-hover) text-white rounded-full font-semibold`; status always colour + icon + text; no `overflow-x-hidden`/`overflow: hidden` on page wrappers; no client-side Strapi calls.
- **Never add `Co-Authored-By`** lines anywhere.
- **Verification per package (baseline 2026-09-30):**
  - `cd packages/access && pnpm test` (40 pass) and `pnpm build` after any change (the UI and Strapi import the built package).
  - `cd apps/strapi && pnpm test:unit` (556 pass) and `pnpm typecheck`.
  - `cd apps/ui && pnpm test` (595 pass) and `pnpm typecheck`.
  - Lint the files you changed: `cd apps/ui && pnpm exec eslint <files>` or `cd apps/strapi && pnpm exec eslint <files>`. Errors must be zero; warnings are tolerated.
- **Strapi tests** use `makeFakeStrapi` from `apps/strapi/tests/helpers/fake-strapi.ts` (in-memory `documents()`, draft/publish via `__published`, `db.transaction`, `db.connection` over `tables`). Extend the helper only if your task lists it.

## Clarifications to the spec

1. **Change Records carry `versionStatus`** (`draft` | `published`). Draft-only writes (admin Content Manager edits, publish-guard `draft_only` approvals) are recorded with `versionStatus: "draft"`; published writes and publishes with `"published"`. Public history and analytics read `published` rows only. This keeps contributor attribution on draft-only approvals without double-counting admin edits.
2. **`isVerifiedLibrarian`** is true when the user holds a `verified_librarian` Role Grant (not "or higher").
3. **A Moderator with `queue: "all"`** covers every queue, including `applications`.
4. **Expired grants:** a daily cron re-derives `contributorRole` for users whose grants expired in the last two days. The session bridge already ignores expired grants.
5. **Submission types are added in Task 1** (`role_application`, `location_request`) including the Submission schema enum, so the access package and schema move together. Their policies and apply branches arrive in Tasks 14 and 16; until then `canSubmit` returns false for both unless their capability is present, and approval of either is a no-op that logs.
6. **Article history panels ship in Task 6**, not Band 3.

## Waves

Tasks in the same wave touch disjoint files and run in parallel. The orchestrator regenerates Strapi types, runs all three suites and commits between waves.

| Wave | Tasks       |
| ---- | ----------- |
| 1    | 1           |
| 2    | 2, 3, 9, 10 |
| 3    | 4, 7, 8     |
| 4    | 5, 6        |
| 5    | 11          |
| 6    | 12, 14      |
| 7    | 15, 16      |
| 8    | 13, 17      |

---

## Task 1: `@repo/access` grants, scopes and new submission types

**Files:**

- Modify: `packages/access/src/roles.ts`, `packages/access/src/capabilities.ts`, `packages/access/src/limits.ts`, `packages/access/src/index.ts`
- Modify: `packages/access/tests/capabilities.test.ts`, `packages/access/tests/limits.test.ts`, `packages/access/tests/invariants.test-d.ts`
- Create: `packages/access/tests/moderation.test.ts`
- Modify (compile-only call-site updates): `apps/ui/src/lib/session-access.ts`, `apps/strapi/src/plugins/content-moderation/server/services/submission-policy.ts` (only the `resolveCapabilities` call in `loadCapabilities`)
- Modify: `apps/strapi/src/plugins/content-moderation/server/content-types/submission/schema.json` (`submissionType` enum only)
- Modify: `apps/strapi/src/api/user-profile/content-types/user-profile/schema.json` (`contributorRole` enum only)

**Interfaces produced (exact):**

```ts
// roles.ts
export const CONTRIBUTOR_ROLES = [
  "reader",
  "contributor",
  "verified_librarian",
  "wiki_editor",
  "journal_editor",
  "moderator",
  "editorial_board",
] as const
export type ContributorRole = (typeof CONTRIBUTOR_ROLES)[number]
export type GrantableRole = Exclude<ContributorRole, "reader">
export const GRANTABLE_ROLES: readonly GrantableRole[]
export function isGrantableRole(v: unknown): v is GrantableRole
export function highestRole(
  grants: readonly { role: GrantableRole }[]
): ContributorRole // "reader" when empty
// promoteRole and isContributorRole unchanged

// capabilities.ts
export const SUBMISSION_TYPES = [
  "correction",
  "new_library",
  "library_claim",
  "library_edit",
  "wiki_edit",
  "blog_submission",
  "topic_suggestion",
  "role_application",
  "location_request",
] as const
export const MODERATION_QUEUES = [
  "index",
  "knowledge",
  "journal",
  "applications",
] as const
export type ModerationQueue = (typeof MODERATION_QUEUES)[number]
export const QUEUE_OF_SUBMISSION_TYPE: Record<SubmissionType, ModerationQueue>
//   correction,new_library,library_claim,library_edit,topic_suggestion,location_request -> "index"
//   wiki_edit -> "knowledge"; blog_submission -> "journal"; role_application -> "applications"
export function submissionTypesOfQueue(q: ModerationQueue): SubmissionType[]
export type Capability = /* existing */
  | "moderate.queue"
  | "submit.roleApplication"
  | "submit.locationRequest"
export interface RoleGrant {
  role: GrantableRole
  queue: ModerationQueue | "all"
  locale: string | null
}
export interface ModerationScope {
  queue: ModerationQueue | "all"
  locale: string | null
}
export type EditorLocales = "all" | ReadonlySet<string>
export interface CapabilityInput {
  signedIn: boolean
  grants: RoleGrant[]
  claims: { libraryDocumentId: string }[]
  // Deliberately no plan, subscription or entitlement fields (spec §3.1).
}
export interface Capabilities {
  set: ReadonlySet<Capability>
  claimedLibraryIds: ReadonlySet<string>
  moderation: readonly ModerationScope[]
  editorLocales: { docs: EditorLocales; journal: EditorLocales }
}
export function resolveCapabilities(input: CapabilityInput): Capabilities
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
): boolean
export function canSubmit(
  c: Capabilities,
  type: SubmissionType,
  opts?: {
    libraryDocumentId?: string
    directWikiEdit?: boolean
    directJournalEdit?: boolean
    locale?: string
  }
): boolean
/** Transitional: one global grant for a legacy enum value (none for reader). */
export function grantsFromLegacyRole(role: ContributorRole | null): RoleGrant[]
/** JSON-safe form carried in the Better Auth session, and its inverse. */
export interface SessionCapabilities {
  capabilities: Capability[]
  claimedLibraryIds: string[]
  moderationScopes: ModerationScope[]
  editorLocales: { docs: "all" | string[]; journal: "all" | string[] }
}
export function toSessionCapabilities(c: Capabilities): SessionCapabilities
export function fromSessionCapabilities(
  s: Partial<SessionCapabilities> | null | undefined
): Capabilities

// limits.ts
export const ROLE_APPLICATION_MIN_ACCEPTED = 5
// STAFF_ROLES becomes { wiki_editor, journal_editor, moderator, editorial_board }
```

**Rules for `resolveCapabilities`:**

- Signed out: empty everything, `editorLocales` both an empty set, `moderation: []`.
- Signed in: the existing six base capabilities plus `submit.roleApplication` and `submit.locationRequest`.
- Claims add `submit.libraryEdit` and `events.feed` (unchanged).
- `wiki_editor` grant: its `locale` added to `editorLocales.docs`, or `"all"` when `locale` is null. `journal_editor` the same for `journal`. `editorial_board`: both `"all"` and a moderation scope `{ queue: "all", locale: null }`. `moderator`: one moderation scope `{ queue, locale }` per grant. `contributor` and `verified_librarian` add nothing.
- `docs.directEdit` when `editorLocales.docs` is `"all"` or non-empty; `journal.directEdit` likewise; `moderate.queue` when `moderation.length > 0`.
- `canDirectEdit(c, kind, locale)`: `editorLocales[kind] === "all" || editorLocales[kind].has(locale)`.
- `canModerate`: false when `s.submittedByUserId === viewerBaUserId`; otherwise true when some scope has (`queue === "all"` or `queue === QUEUE_OF_SUBMISSION_TYPE[s.submissionType]`) and (`locale === null` or `locale === s.locale`).
- `canSubmit`: `wiki_edit` with `directWikiEdit` uses `canDirectEdit(c, "docs", opts.locale)` when `opts.locale` is given, else `c.set.has("docs.directEdit")`; `blog_submission` the same with `journal`. `role_application` needs `submit.roleApplication`; `location_request` needs `submit.locationRequest`.
- `grantsFromLegacyRole(r)`: `[]` for null or `reader`, else `[{ role: r, queue: "all", locale: null }]`.

**Call-site updates (compile only, behaviour unchanged):** in `session-access.ts` and `submission-policy.loadCapabilities`, replace `contributorRole: role` with `grants: grantsFromLegacyRole(role)`. Tasks 2 and 3 replace these with real grants.

**Schema edits:** add `role_application` and `location_request` to the Submission `submissionType` enum; add `moderator` to the user-profile `contributorRole` enum between `journal_editor` and `editorial_board`.

- [ ] **Step 1: Write failing tests.** `capabilities.test.ts`: base set for a signed-in user with no grants includes the two new `submit.*` capabilities; a `wiki_editor` grant with `locale: "fr"` gives `docs.directEdit` and `canDirectEdit(c,"docs","fr") === true`, `("docs","en") === false`; a null-locale `journal_editor` gives `canDirectEdit(c,"journal","cs") === true`; `editorial_board` gives both `"all"` and `moderate.queue`; `canSubmit(c,"wiki_edit",{directWikiEdit:true,locale:"en"})` false for the French-only editor. `moderation.test.ts`: the scope matrix (global moderator sees every type; `{queue:"knowledge",locale:"fr"}` sees `wiki_edit` in `fr` only, not `blog_submission`, not `wiki_edit` in `en`; `queue:"all"` sees `role_application`); own submission always false, including for `editorial_board`; `QUEUE_OF_SUBMISSION_TYPE` has an entry for every `SUBMISSION_TYPES` member; `submissionTypesOfQueue("index")` lists the six index types; `toSessionCapabilities` → JSON → `fromSessionCapabilities` round-trips a capabilities object with `"all"` and a set; `highestRole([])` is `"reader"`, `highestRole([{role:"moderator"},{role:"wiki_editor"}])` is `"moderator"`. `limits.test.ts`: `journal_editor` and `moderator` get Curator limits. `invariants.test-d.ts`: `keyof CapabilityInput` equals `"signedIn" | "grants" | "claims"`; `keyof RoleGrant` equals `"role" | "queue" | "locale"`; keep the entitlement assertions.
- [ ] **Step 2:** `cd packages/access && pnpm test`. Expected: FAIL (missing exports).
- [ ] **Step 3:** Implement the interfaces above. Export everything from `index.ts`.
- [ ] **Step 4:** `pnpm test` passes; `pnpm build`.
- [ ] **Step 5:** Apply the two call-site updates and the two schema enum edits. Run `cd apps/strapi && pnpm test:unit && pnpm typecheck` and `cd apps/ui && pnpm test && pnpm typecheck`. Existing tests that call `resolveCapabilities({ contributorRole })` directly must be updated to `grants: grantsFromLegacyRole(...)`; list every test file you changed in your report.

---

## Task 2: Role Grant collection, derived role, bridge and policy (Strapi)

**Files:**

- Create: `apps/strapi/src/api/role-grant/content-types/role-grant/schema.json`, `apps/strapi/src/api/role-grant/routes/role-grant.ts` (`export default { routes: [] }`), `apps/strapi/src/api/role-grant/controllers/role-grant.ts`, `apps/strapi/src/api/role-grant/services/role-grant.ts` (core factories, as `api/entitlement-grant/`)
- Create: `apps/strapi/src/utils/role-grants.ts`
- Create: `apps/strapi/src/lifeCycles/roleGrant.ts`
- Modify: `apps/strapi/src/index.ts` (register the subscriber; call the migration in `bootstrap`)
- Modify: `apps/strapi/src/utils/affiliations.ts` (`grantVerifiedLibrarian`)
- Modify: `apps/strapi/src/utils/erase-account.ts`
- Modify: `apps/strapi/src/api/auth-bridge/controllers/auth-bridge.ts` (`sessionProfile` only)
- Modify: `apps/strapi/src/plugins/content-moderation/server/services/submission-policy.ts` (`loadCapabilities`)
- Modify: `apps/strapi/config/cron-tasks.ts` (one new daily job)
- Test: `apps/strapi/tests/role-grants.test.ts`, extend `apps/strapi/tests/session-profile.test.ts`, `apps/strapi/tests/erase-account.test.ts`, `apps/strapi/tests/auth-bridge-affiliation.test.ts`

**Interfaces:**

- Consumes: Task 1 `RoleGrant`, `GrantableRole`, `highestRole`, `resolveCapabilities`, `CapabilityInput`.
- Produces:

```ts
// utils/role-grants.ts
export const ROLE_GRANT = "api::role-grant.role-grant"
export type RoleGrantRow = RoleGrant & {
  documentId: string
  baUserId: string
  source: "admin" | "claim" | "application" | "migration"
  grantedBy: string | null
  reason: string | null
  expiresAt: string | null
}
export async function activeGrants(
  strapi: any,
  baUserId: string,
  now?: Date
): Promise<RoleGrant[]> // unexpired, max 50, sorted by createdAt
export async function createGrant(
  strapi: any,
  input: {
    baUserId: string
    role: GrantableRole
    queue?: RoleGrant["queue"]
    locale?: string | null
    source: RoleGrantRow["source"]
    grantedBy?: string | null
    reason?: string | null
    expiresAt?: string | null
  }
): Promise<{ documentId: string; created: boolean }> // idempotent on (baUserId, role, queue, locale)
export async function syncDerivedRole(
  strapi: any,
  baUserId: string
): Promise<void>
export async function migrateContributorRolesToGrants(
  strapi: any
): Promise<{ migrated: number }>
export async function notifySessionInvalidated(
  strapi: any,
  baUserId: string
): Promise<void>
```

- Session bridge response gains `grants: RoleGrant[]` (at most 50). `contributorRole` stays and is the derived value.
- `submission-policy.loadCapabilities(baUserId)` returns `{ caps, tier, role }` where `caps` comes from `activeGrants` and `role` is `highestRole(grants)`.

**Rules:**

- Schema (`collectionName: "role_grants"`, `draftAndPublish: false`, visible in the Content Manager): fields per spec §3.1 exactly (`baUserId` required; `role` enum of the six grantable roles; `queue` enum `all,index,knowledge,journal,applications` default `all`; `locale` string; `source` enum default `admin`; `grantedBy` string; `reason` text; `expiresAt` datetime).
- `syncDerivedRole`: loads active grants, writes `contributorRole = highestRole(grants)` and `isVerifiedLibrarian = grants.some(g => g.role === "verified_librarian")` to the user-profile, only when they differ. Uses `documents().update`.
- Lifecycle (`strapi.db.lifecycles.subscribe({ models: [ROLE_GRANT] })`, `afterCreate`, `afterUpdate`, `afterDelete`): for the row's `baUserId`, `await syncDerivedRole`, then `notifySessionInvalidated` without awaiting failures. Admin edits in the Content Manager therefore take effect.
- `notifySessionInvalidated`: `POST ${APP_PUBLIC_URL}/api/internal/session/invalidate` with header `X-Service-Secret: STRAPI_BRIDGE_SECRET`, JSON `{ baUserId }`, 3 s timeout; logs and returns on any failure. Skipped when either env var is unset.
- `grantVerifiedLibrarian(strapi, baUserId)`: `createGrant({ role: "verified_librarian", source: "claim", reason: "Approved Library Claim" })`; no direct profile write (the lifecycle syncs it). Keep its export name and signature.
- `migrateContributorRolesToGrants`: guarded by core-store key `role-grants-migrated-v1` (`strapi.store({ type: "core", name: "role-grants" })`); for each user-profile with `contributorRole` not `reader` and not null, `createGrant({ role, source: "migration", reason: "Backfilled from user-profile.contributorRole" })`. Page through profiles with `start`/`limit` 200 and `sort: "id:asc"`. Called from `bootstrap` in `src/index.ts`; errors are logged and never block boot.
- `erase-account.ts`: inside its existing transaction, delete every role grant for the user (same place as entitlement grants).
- Cron: daily `0 4 * * *` job `resyncExpiredRoleGrants`: find grants with `expiresAt` between now-48h and now, `syncDerivedRole` for each distinct `baUserId`.

- [ ] **Step 1: Write failing tests** in `role-grants.test.ts`: `createGrant` is idempotent on the key; `activeGrants` excludes expired rows and caps at 50; `syncDerivedRole` writes `moderator` for grants `[wiki_editor, moderator]` and `isVerifiedLibrarian: true` only with a `verified_librarian` grant; `migrateContributorRolesToGrants` creates one grant per non-reader profile, runs once (second call migrates 0); `notifySessionInvalidated` posts the secret and body (stub `fetch`) and swallows a rejected fetch. Extend `session-profile.test.ts`: response includes `grants`, excludes expired grants. `erase-account.test.ts`: grants removed. `auth-bridge-affiliation.test.ts`: auto-verification creates a `verified_librarian` grant with `source: "claim"`.
- [ ] **Step 2:** `pnpm test:unit`, confirm the new tests fail.
- [ ] **Step 3:** Implement. For the lifecycle, unit-test the handler functions directly (export them from `lifeCycles/roleGrant.ts`).
- [ ] **Step 4:** `pnpm test:unit && pnpm typecheck` pass; lint changed files.

---

## Task 3: Session grants, hooks and invalidation (Next.js)

**Files:**

- Modify: `apps/ui/src/lib/session-profile.ts`, `apps/ui/src/lib/session-access.ts`, `apps/ui/src/lib/access-client.ts`, `apps/ui/src/lib/access-server.ts`, `apps/ui/src/lib/auth.ts` (only if the custom session type needs the new fields), `apps/ui/src/lib/proxies/basic-auth-scope.ts`
- Create: `apps/ui/src/app/api/internal/session/invalidate/route.ts`
- Test: `apps/ui/src/lib/__tests__/session-access.test.ts` (create or extend), `apps/ui/src/lib/__tests__/session-invalidate-route.test.ts`, extend the existing basic-auth-scope test if one exists (search `basic-auth-scope` under `__tests__`)

**Interfaces:**

- Consumes: Task 1 `RoleGrant`, `resolveCapabilities`, `toSessionCapabilities`, `fromSessionCapabilities`, `canDirectEdit`, `canModerate`, `ModerationScope`, `SessionCapabilities`.
- Produces:

```ts
// session-profile.ts
export type SessionProfile = { /* existing */ grants: RoleGrant[] }
// session-access.ts: SessionAccess gains
  moderationScopes: ModerationScope[]
  editorLocales: { docs: "all" | string[]; journal: "all" | string[] }
// access-client.ts
export function useCapabilities(): {
  has(cap: Capability): boolean
  claimedLibraryIds: string[]
  moderationScopes: ModerationScope[]
  canDirectEdit(kind: "docs" | "journal", locale: string): boolean
  ready: boolean
}
// access-server.ts
export function sessionCapabilities(user: unknown): Capabilities // fromSessionCapabilities over the session fields
```

**Rules:**

- The zod `Body` accepts `grants` (array ≤ 50 of `{ role: string, queue: string, locale: string | null }`); unknown roles or queues are dropped, not fatal. A bridge that omits `grants` falls back to `grantsFromLegacyRole(contributorRole)` so a stale Strapi still works during deploy.
- `buildSessionAccess` passes `grants` to `resolveCapabilities` and spreads `toSessionCapabilities(caps)` (`capabilities`, `claimedLibraryIds`, `moderationScopes`, `editorLocales`). A missing profile yields empty scopes and `editorLocales: { docs: [], journal: [] }`.
- `POST /api/internal/session/invalidate`: 401 unless `X-Service-Secret` equals `STRAPI_BRIDGE_SECRET` (timing-safe, as `lib/` already does elsewhere; search for `timingSafeEqual`); body `{ baUserId: string }` (zod, ≤ 200 chars); calls `invalidateSessionProfile(baUserId)`; returns 204.
- Add `/api/internal` to `EXEMPT_PREFIXES` with the comment `// Strapi callbacks, bridge secret`.

- [ ] **Step 1: Write failing tests:** `buildSessionAccess` with grants `[{role:"moderator",queue:"knowledge",locale:"fr"}]` yields `moderate.queue`, the scope, and `editorLocales` empty; with `wiki_editor`/`fr` yields `editorLocales.docs === ["fr"]`; a bridge body without `grants` and `contributorRole: "wiki_editor"` still yields `docs.directEdit`. Route: 401 without secret, 400 on bad body, 204 and `invalidateSessionProfile` called with the id. Basic-auth scope: `/api/internal/session/invalidate` is exempt.
- [ ] **Step 2:** `cd apps/ui && pnpm test`, confirm failures.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** `pnpm test && pnpm typecheck`; lint changed files.

---

## Task 4: Change Records and Article Changes capture (Strapi)

**Files:**

- Create: `apps/strapi/src/api/library-change/content-types/library-change/schema.json`, `.../routes/library-change.ts` (`routes: []`), `.../controllers/library-change.ts`, `.../services/library-change.ts`
- Create: `apps/strapi/src/api/article-change/` (same four files)
- Create: `apps/strapi/src/utils/change-context.ts`, `apps/strapi/src/utils/change-diff.ts`, `apps/strapi/src/documentMiddlewares/change-records.ts`
- Modify: `apps/strapi/src/index.ts` (register the middleware in `bootstrap`, after the existing subscribers)
- Test: `apps/strapi/tests/change-diff.test.ts`, `apps/strapi/tests/change-context.test.ts`, `apps/strapi/tests/change-records-middleware.test.ts`

**Interfaces produced:**

```ts
// utils/change-context.ts
export type ChangeSource =
  | "submission"
  | "admin"
  | "api_token"
  | "import"
  | "system"
export type ActorKind = "contributor" | "admin" | "token" | "system"
export interface ChangeContext {
  source: ChangeSource
  actorKind: ActorKind
  actorId: string
  actorName?: string | null
  reviewerId?: string | null
  submissionDocumentId?: string | null
  editSummary?: string | null
}
export function runWithChangeContext<T>(
  ctx: ChangeContext,
  fn: () => Promise<T>
): Promise<T> // AsyncLocalStorage
export function resolveChangeContext(strapi: any): ChangeContext
// Priority: runWithChangeContext value; else strapi.requestContext.get(): ctx.state.user (admin) ->
// { source:"admin", actorKind:"admin", actorId:`admin:${id}`, actorName: firstname lastname };
// ctx.state.auth?.credentials?.name (API token) -> actorKind "token", actorId the token name,
// source "import" when the name starts with "import" or "ingest", else "api_token";
// valid bridge secret + x-ba-user-id header -> { source:"submission", actorKind:"contributor", actorId:`ba:${id}` };
// else { source:"system", actorKind:"system", actorId:"system" }.

// utils/change-diff.ts
export function stableStringify(v: unknown): string // sorted keys; null/undefined/"" all "null"
export function trackedAttributes(
  schema: { attributes: Record<string, any> },
  ignore: ReadonlySet<string>
): {
  scalars: string[]
  relations: string[]
  components: string[]
  media: string[]
}
export function normaliseForDiff(
  doc: Record<string, unknown>,
  attrs: ReturnType<typeof trackedAttributes>
): Record<string, unknown>
// relations -> sorted documentId arrays; media -> sorted file ids; components/json -> stableStringify-able values
export function diffVersions(
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
  fields: readonly string[]
): { field: string; previous: unknown; next: unknown }[]

// documentMiddlewares/change-records.ts
export const LIBRARY_IGNORED: ReadonlySet<string> // id, documentId, locale, createdAt, updatedAt, publishedAt, createdBy, updatedBy, localizations, completeness
export function registerChangeRecordsMiddleware({
  strapi,
}: {
  strapi: any
}): void
```

**Library-change schema** (`collectionName: "library_changes"`, `draftAndPublish: false`, visible in the Content Manager, no REST routes): `batchId` string required; `libraryDocumentId` string required; `entityRef` string; `locale` string; `versionStatus` enum `draft,published`; `action` enum `create,update,publish,unpublish,delete`; `field` string required; `previous` json; `next` json; `source` enum; `actorKind` enum; `actorId` string; `actorName` string; `reviewerId` string; `submissionDocumentId` string; `changedAt` datetime required.

**Article-change schema** (`collectionName: "article_changes"`): `articleKind` enum `wiki,blog`; `articleDocumentId`; `slug`; `locale`; `versionStatus`; `kind` enum `created,edited,translated,published,unpublished,deleted`; `actorKind`; `actorId`; `actorName`; `reviewerId`; `submissionDocumentId`; `editSummary` text; `bodyHash` string; `changedAt` datetime.

**Middleware rules:**

- Acts only when `context.uid` is `api::library.library`, `api::wiki-article.wiki-article` or `api::blog-article.blog-article`, and `context.action` is `create`, `update`, `delete`, `publish` or `unpublish`. Every other call passes through untouched.
- Skipped entirely when `process.env.CHANGE_RECORDS_ENABLED === "false"` (log a warning once at registration).
- Before `next()`: for `update`, `delete`, `unpublish`, `publish`, load the existing version with `strapi.documents(uid).findOne({ documentId, locale, status, populate })`, where `status` is `params.status ?? "draft"` for update/delete and `"published"` for publish/unpublish, and `populate` requests only `documentId` for relations and `id` for media. For `publish`, also load the draft. `locale` is `params.locale ?? default locale` (`strapi.plugin("i18n").service("locales").getDefaultLocale()`).
- After `next()`: load the new version the same way (none for delete/unpublish) and diff.
  - Library `update`: one row per changed field, shared `batchId` (`crypto.randomUUID()`), `versionStatus` = the written status. No rows when nothing changed.
  - Library `publish`: diff previous published vs new published; `action: "publish"`, `versionStatus: "published"`; no field changes gives one `field: "*"` row.
  - Library `create`: one `field: "*"` row with `next` = the normalised document, `versionStatus` from `params.status ?? "draft"`. `delete`/`unpublish`: one `field: "*"` row with `previous`.
  - Articles: one Article Change row per write: `kind` = `created` (create), `translated` (update or create where the locale version did not exist before), `edited` (update), `published`, `unpublished`, `deleted`; `bodyHash` = sha256 of `stableStringify(body)` after the write; `editSummary` from `ChangeContext.editSummary` when present.
- Actor fields from `resolveChangeContext(strapi)`.
- Inserts use `strapi.documents(uid).create` per row, awaited, **not** wrapped in try/catch: when called inside `strapi.db.transaction`, a failed insert must fail the write (spec §4.1). Outside a transaction a failed insert also propagates; this is intended.
- Recursion: the middleware's own `findOne`/`create` calls on `library-change`/`article-change` pass through (uid check).

- [ ] **Step 1: Write failing tests.** `change-diff.test.ts`: `stableStringify` equal for key-reordered objects and for `null`/`""`/`undefined`; relations compared as sorted id lists (`[{documentId:"b"},{documentId:"a"}]` equals `["a","b"]`); an unchanged component is not a change; `diffVersions(null, doc)` lists every tracked field. `change-context.test.ts`: `runWithChangeContext` value wins over a request context; admin, token (`ingest-uk` → `import`, `ci-bot` → `api_token`), bridge and system resolution. `change-records-middleware.test.ts` (drive the registered middleware with a fake `strapi.documents.use` capture and `makeFakeStrapi`): an update changing `name` and `services` writes two rows sharing a `batchId`; a no-op update writes none; `completeness` changes are ignored; a publish with a real difference writes `action: "publish"` rows with `versionStatus: "published"`; a failing `library-change` create rejects the outer write; `CHANGE_RECORDS_ENABLED=false` writes nothing; an article update in a new locale writes `kind: "translated"`; non-tracked uids pass through with zero extra calls.
- [ ] **Step 2:** Run, confirm failures.
- [ ] **Step 3:** Implement; register in `src/index.ts` `bootstrap` with `registerChangeRecordsMiddleware({ strapi })`.
- [ ] **Step 4:** `pnpm test:unit && pnpm typecheck`; lint changed files. Report whether you could confirm, from Strapi's source in `node_modules/@strapi/core`, that `update({ status: "published" })` reaches document middleware as a single `update` action (not also a separate `publish`); state what you found.

---

## Task 5: Review Events, apply context, history API (Strapi, content-moderation)

**Files:**

- Create: `apps/strapi/src/plugins/content-moderation/server/content-types/review-event/schema.json`; register in `.../content-types/index.ts`
- Modify: `.../content-types/submission/schema.json` (add `resultDocumentId` string)
- Modify: `.../services/submission.ts` (`updateStatus`, `finalizeDraft`, the `new_library` branch, replace `findLibraryRevisions`), `.../controllers/submission.ts` (revisions handler → history handlers; admin `updateStatus` reviewer prefix), `.../routes/content-api.ts`
- Create: `.../services/history.ts` (register in `.../services/index.ts`), `.../utils/reviewer.ts`
- Modify: `.../server/bootstrap.ts` (or the plugin's bootstrap entry; find it via `strapi-server.ts`) for two guarded one-off migrations
- Test: `apps/strapi/tests/content-moderation/review-events.test.ts`, `.../history.test.ts`, update `.../approve-once.test.ts` and any test asserting `findLibraryRevisions`

**Interfaces:**

- Consumes: Task 4 `runWithChangeContext`, `ChangeContext`; `library-change` and `article-change` UIDs.
- Produces:

```ts
// utils/reviewer.ts
export type Reviewer = { id: string; kind: "admin" | "contributor"; email: string | null; baUserId: string | null }
export function adminReviewer(admin: { id: number | string; email?: string | null }): Reviewer // id `admin:${id}`
export function contributorReviewer(u: { id: string; email?: string | null }): Reviewer // id `ba:${id}`, baUserId set
export function isSelfReview(r: Reviewer, s: { submittedByUserId: string; submittedByEmail?: string | null }): boolean
// contributor: baUserId === submittedByUserId; admin: trimmed case-insensitive email match (existing rule)

// services/submission.ts
updateStatus(documentId: string, status: "approved" | "rejected" | "needs_info" | "pending",
  reviewer: Reviewer, reviewNote?: string, opts?: { publish?: boolean }): Promise<...same result union... | { error: "self_review" }>
// opts.publish is stored for Task 11; this task only threads it through to the article/new_library apply calls as a no-op param.

// services/history.ts
libraryHistory(documentId: string, o: { page: number; pageSize: number; values: boolean }): Promise<{
  data: { batchId: string; changedAt: string; action: string; source: string;
          actor: { kind: string; username: string | null };
          fields: { field: string; previous?: unknown; next?: unknown }[];
          submissionDocumentId: string | null }[]
  meta: { page: number; pageSize: number; total: number }
}>
libraryHistoryStats(documentId: string, months: number): Promise<{
  months: { month: string; batches: number; fields: number; contributors: number }[]
  byField: { field: string; count: number }[]
  byAction: { action: string; count: number }[]
  verificationEvents: string[] // YYYY-MM where lastVerifiedAt changed
}>
articleHistory(kind: "wiki" | "blog", documentId: string, o: { page: number; pageSize: number }): Promise<{
  data: { changedAt: string; kind: string; locale: string; actor: { kind: string; username: string | null }; editSummary: string | null }[]
  meta: { page: number; pageSize: number; total: number }
}>
```

**Routes (content-api, `auth: false`):** `GET /libraries/:documentId/history?page&pageSize&values`, `GET /libraries/:documentId/history/stats?months`, `GET /articles/:kind/:documentId/history?page&pageSize`. Remove `GET /libraries/:documentId/revisions` and its handler (the UI switches in Task 6; keep the UI's `fetchLibraryRevisions` compiling by leaving it for Task 6 to delete). `values=1` is honoured only with a valid `X-Service-Secret`; otherwise values are stripped. `pageSize` clamp 1–50 (default 20), `months` clamp 1–60 (default 24), `kind` must be `wiki` or `blog`.

**Rules:**

- Review Event schema (`collectionName: "cm_review_events"`, hidden from Content Manager and builder): `submissionDocumentId` string required, `fromStatus`, `toStatus`, `reviewerId`, `reviewerKind` enum `admin,contributor`, `note` text, `createdAt` default. (A string id, not a relation, matching the plugin's existing style.)
- `updateStatus`: after the compare-and-set succeeds and inside the same transaction, create a Review Event. Wrap every apply side effect (library record, facility answers, photo, article apply, new_library create, claim) in `runWithChangeContext({ source: "submission", actorKind: "contributor", actorId: `ba:${submission.submittedByUserId}`, actorName: submission.submittedByName, reviewerId: reviewer.id, submissionDocumentId: submission.documentId, editSummary: submission.editSummary ?? null })`. Store `reviewer.id` in `reviewedByUserId`. Refuse with `{ error: "self_review" }` before the compare-and-set when `isSelfReview`.
- `new_library` approval writes the created library's documentId to `resultDocumentId` inside the transaction; article-apply outcomes `created_published`/`created_draft` write the new article's documentId (have `applyArticleSubmission` return it; extend its return type additively).
- `finalizeDraft` writes a Review Event `draft → pending`, reviewer `ba:<submitter>`, kind `contributor`.
- Admin controller `updateStatus` builds `adminReviewer(ctx.state.user ?? ctx.state.admin)` and maps `self_review` to 403 with the existing copy; remove the controller's own email comparison.
- History: batches from `library-change` rows with `libraryDocumentId`, `versionStatus: "published"`, ordered `changedAt desc`; group by `batchId` in the service after a keyset page of batch ids (query distinct `batch_id, max(changed_at)` via knex, then load rows). `actor.username`: for `actorKind: "contributor"`, look up the profile by `baUserId` and return `username` only when the profile's activity is public, using the same rule as `findPublicByBaUserId` (reuse it); otherwise null. Admin, token and system actors return `username: null` with their `kind`.
- Stats with knex over `library_changes` (Postgres `date_trunc('month', changed_at)`; SQLite `strftime('%Y-%m', changed_at)`, branch on `strapi.db.dialect.client` as the rewards chart does).
- Migrations (plugin bootstrap, each guarded by a core-store flag, errors logged):
  - `reviewer-prefix-v1`: prefix every non-empty `reviewedByUserId` lacking `admin:`/`ba:` with `admin:`.
  - `library-history-backfill-v1`: for every approved submission with `targetEntityType: "library"` and a `targetDocumentId`, create one batch: rows for each key of `fields` excluding `RECORD_META_KEYS` (import from `utils/record-review.ts`), `previous`/`next` null, `source: "submission"`, `actorKind: "contributor"`, `actorId: ba:<submittedByUserId>`, `versionStatus: "published"`, `action: "update"`, `changedAt: reviewedAt`. Page with `start`/`limit` 200.

- [ ] **Step 1: Write failing tests.** `review-events.test.ts`: approve writes exactly one Review Event with from/to/reviewer; a conflict writes none; a failing apply rolls back the event (fake transaction); finalize writes `draft → pending`; a contributor reviewer approving their own submission gets `self_review`; an admin with the submitter's email (case and space variants) gets `self_review`; apply side effects see the change context (assert via a `library-change` row's `actorId` and `reviewerId` when Task 4's middleware is registered on the fake, or by spying on `runWithChangeContext`). `history.test.ts`: batches grouped and ordered, draft rows excluded, values stripped without `values`, username only for public profiles, stats per month, the backfill creates one batch per approved library submission and runs once, the prefix migration is idempotent.
- [ ] **Step 2:** Run, confirm failures. **Step 3:** Implement. **Step 4:** `pnpm test:unit && pnpm typecheck`; lint.

---

## Task 6: History UI: library Changes section, histogram, article edit history (Next.js)

**Files:**

- Modify: `packages/access/src/entitlements.ts` (add `"library.history"` to `Feature` and `PRO_FEATURES`), `packages/access/tests/entitlements.test.ts`
- Modify: `apps/ui/src/lib/plans.ts` (`PRO_FEATURE_COPY` entry), `apps/ui/src/lib/plan-compare.ts` (row, if features are enumerated there)
- Modify: `apps/ui/src/lib/strapi-api/content/server.ts` (replace `fetchLibraryRevisions` with `fetchLibraryHistory` and `fetchLibraryHistoryStats`; add `fetchArticleHistory`)
- Modify: `apps/ui/src/components/library/LibrarySections.tsx` (the "Sources and changes" section becomes "Changes"), `apps/ui/src/app/[locale]/[continent]/[country]/[region]/[library]/page.tsx`
- Create: `apps/ui/src/components/library/ChangeHistogram.tsx`, `apps/ui/src/components/library/LibraryChangeTimeline.tsx`, `apps/ui/src/app/api/libraries/[documentId]/history/route.ts`
- Create: `apps/ui/src/components/docs/ArticleEditHistory.tsx`; modify `apps/ui/src/components/docs/DocsArticlePage.tsx` and the Journal article page component (find it under `components/blog/`, the one rendered by `app/[locale]/journal/[section]/[slug]/page.tsx`)
- Test: `apps/ui/src/components/library/__tests__/ChangeHistogram.test.tsx`, `.../LibraryChangeTimeline.test.tsx`, `apps/ui/src/app/api/libraries/__tests__/history-route.test.ts`

**Interfaces:**

- Consumes: Task 5 routes and response shapes (exact, above).
- Produces: `fetchLibraryHistory(documentId, { page?: number; values: boolean }): Promise<LibraryHistoryPage>`, `fetchLibraryHistoryStats(documentId): Promise<LibraryHistoryStats | null>`, `fetchArticleHistory(kind, documentId): Promise<ArticleHistoryPage>` with types mirroring Task 5.

**Rules:**

- The library page (RSC) reads the session with the existing server session helper; `values` is true only when `session.user.features` includes `library.history`. With values, the Strapi call sends `bridgeUserHeaders(user)` and `values=1`; without, no secret.
- `GET /api/libraries/[documentId]/history?page=` for "Load more": `requireEntitlement` is **not** required (field names are public); values are included only when the session has `library.history`. documentId validated `^[a-z0-9]{20,32}$`; page clamp 1–100.
- `ChangeHistogram`: inline SVG bar chart of `months` (24 bars, month labels every 6th, `T.accent.primary` bars, `T.border.line` baseline, `role="img"` and an `aria-label` like "Changes per month, last 24 months: 3 in Oct 2025, …", plus a visually hidden `<table>` with the same numbers). Months with a verification event get a small dot marker explained in a legend ("Checked"). No chart library.
- Beside the histogram: "Most changed" top five `byField` entries, human labels from the Index editor field labels (reuse `FIELD_GROUPS`/labels from `app/[locale]/contribute/index/_components/wizard.constants.ts` if present; otherwise a local map, and list unknown keys as-is).
- `LibraryChangeTimeline`: one row per batch: verb (Added / Changed / Published / Imported by source+action), field count and names, actor (`@username` link to `/profile/[username]`, else "A contributor", "Libraries Global staff" for admin, "Data import" for import), date. Expandable rows show `previous → next` when present; when absent and the viewer lacks the feature, one line under the list: "See what changed, field by field, with Pro." linking to `/contribute/membership` (copy lives in `lib/plans.ts`).
- Empty state: "No changes recorded yet." (honest, no fake data).
- `ArticleEditHistory`: collapsible "Edit history" under the article: contributor, date, locale badge when not the page locale, kind ("Translated into French", "Edited", "Published"). No values.

- [ ] **Step 1: Write failing tests:** histogram renders 24 bars and an aria-label containing the non-zero months; timeline shows values only when provided and shows the upgrade line otherwise; actor labels per kind; route includes values only with the feature (mock `auth.api.getSession` and `fetch`); `entitlements.test.ts`: `pro` and `team` have `library.history`, `free` does not.
- [ ] **Step 2–4:** Run, implement, `cd packages/access && pnpm test && pnpm build`, `cd apps/ui && pnpm test && pnpm typecheck`; lint.

---

## Task 7: Locale-aware submissions and apply (Strapi)

**Files:**

- Modify: `apps/strapi/src/plugins/content-moderation/server/content-types/submission/schema.json` (add `locale` string, default `"en"`)
- Modify: `.../services/submission.ts` (`create`, `finalizeDraft`, `findDraft`, the points branch for journal translations), `.../controllers/submission.ts` (read `locale` from the body on create/finalize/draft lookup)
- Modify: `.../utils/payload-hash.ts` (include `locale`), `.../utils/article-apply.ts`, `.../utils/library-record.ts`, `.../utils/facility-answers.ts`, `.../utils/publish-guard.ts`
- Create: `.../utils/locales.ts`
- Modify: `apps/strapi/src/plugins/rewards/server/content-types/point-event/schema.json` (add `journal_translated` to the `action` enum), `apps/strapi/src/plugins/rewards/server/controllers/rewards.ts` (label in `howItWorks`)
- Create: `packages/shared-data/src/localized-library-fields.ts` (export from the package index; find it with `cat packages/shared-data/package.json`)
- Modify: the plugin bootstrap (one guarded backfill)
- Test: `apps/strapi/tests/content-moderation/locale.test.ts`, update `article-apply.test.ts`, `library-record.test.ts`, `drafts.test.ts`, `helpers.test.ts` (payload hash) as needed; `apps/strapi/tests/localized-library-fields.test.ts`

**Interfaces produced:**

```ts
// utils/locales.ts
export async function configuredLocales(strapi: any): Promise<string[]> // i18n locales service, memo 60 s
export async function defaultLocale(strapi: any): Promise<string>
export async function normaliseLocale(strapi: any, v: unknown): Promise<string> // known locale, else default
// @repo/shared-data
export const LOCALIZED_LIBRARY_FIELDS: readonly string[] // name, shortName, summary, description, city, district, streetAddress, closureReason, visitNotes, admissionInfo, accessibilityNotes, buildingInfo, transitInfo
// utils/publish-guard.ts
export async function applyToLocale(
  strapi: any,
  uid: string,
  documentId: string,
  data: Record<string, unknown>,
  o: { locale: string; defaultLocale: string; fields?: readonly string[] }
): Promise<ApplyMode | { mode: "created_locale" }>
```

**Rules:**

- `submission.locale` set on `create` and `finalizeDraft` from `body.locale` through `normaliseLocale`; for articles, when `body.locale` is absent use `draftData.locale`. `payloadHash` includes `locale`.
- `findDraft(userId, type, targetSlug, locale)`: locale-scoped; the draft lookup route accepts `?locale=`.
- Backfill (plugin bootstrap, flag `submission-locale-v1`): set `locale` from `draftData.locale` or `fields.locale` when valid, else the default, for rows where `locale` is null.
- `article-apply`: use `submission.locale`; find the existing article by `slug` without a locale filter (slug is shared), then write the submission locale version; `uniqueSlug` checks across all locales; direct-edit re-check becomes `canDirectEdit(caps, kind, locale)`.
- `applyToLocale`: when `locale === defaultLocale`, delegate to `applyToPublished`. Otherwise, when the locale version exists (published), delegate to `applyToPublished` with that locale. When it doesn't exist, require the default-locale version to be published (`ApplyRefusedError("not_published")` otherwise) and `documents(uid).update({ documentId, locale, status: "published", data })`, returning `{ mode: "created_locale" }`.
- `library-record.ts`: `findLibrary` takes the submission locale; for a non-default locale, drop every key not in `LOCALIZED_LIBRARY_FIELDS` from the computed data before writing (log the dropped keys) and write through `applyToLocale`. Default locale behaviour unchanged.
- `facility-answers.ts` and the `new_library` create write the default locale explicitly.
- Points: a `blog_submission` whose `draftData.isTranslation` is true and whose apply changed something awards `journal_translated` (15).
- `localized-library-fields.test.ts` reads `apps/strapi/src/api/library/content-types/library/schema.json` and asserts `LOCALIZED_LIBRARY_FIELDS` equals the set of `string`/`text`/`blocks` attributes with `pluginOptions.i18n.localized: true`, minus `seo` (a component).

- [ ] **Step 1: Write failing tests** for: locale stored and normalised on create/finalize; payload hash changes with locale; two drafts (en and cs) for the same article no longer collide; article translation applied to an article that exists only in `en` creates the `cs` version; an unknown locale falls back to the default; a `cs` library correction ignores `website` and writes `summary` to the `cs` version; `applyToLocale` refuses when the default is unpublished; journal translation awards `journal_translated`; the shared-data parity test.
- [ ] **Step 2–4:** Run, implement, `pnpm test:unit && pnpm typecheck`; rebuild shared-data if it has a build script; lint.

---

## Task 8: Index editor translation mode, fallback rendering, all-locale search (Next.js + Meilisearch config)

**Files:**

- Modify: `apps/ui/src/app/[locale]/contribute/index/[slug]/page.tsx`, `apps/ui/src/app/[locale]/contribute/index/_components/IndexRecordWizard.tsx`, `.../WizardSteps.tsx`, `.../WizardFields.tsx` (only to disable non-localized fields), `.../wizard.types.ts`
- Create: `apps/ui/src/app/[locale]/contribute/index/_components/TranslationBanner.tsx`, `.../translation-mode.ts`
- Modify: `apps/ui/src/lib/strapi-api/content/server.ts` (`fetchLibrary`, `fetchLibraryForEditing`, the wiki and blog article fetchers: default-locale fallback), the library, Knowledge article and Journal article page files under `apps/ui/src/app/[locale]/` (render the fallback line and `robots` noindex)
- Modify: `apps/ui/src/components/library/LibraryHelpPanel.tsx` ("Translate this record" link)
- Modify: `apps/strapi/config/plugins.ts` (Meilisearch `library`, `wiki-article`, `blog-article`: `entriesQuery.locale: "all"`, `locale` in `filterableAttributes`), `apps/strapi/scripts/seed-meilisearch.mjs`, `apps/strapi/tests/meilisearch-config.test.ts`
- Modify: `apps/ui/src/lib/meilisearch.ts` (locale filter)
- Test: `apps/ui/src/app/[locale]/contribute/index/_components/translation-mode.test.ts`, `apps/ui/src/lib/__tests__/locale-fallback.test.ts`, extend `apps/strapi/tests/meilisearch-config.test.ts`

**Interfaces:**

- Consumes: Task 7 `LOCALIZED_LIBRARY_FIELDS` from `@repo/shared-data`; Strapi accepts `locale` on the submission body.
- Produces: `fetchLibrary(slug, locale)` returns `{ …existing, localeFallback: boolean }` (same for the article fetchers). `translationMode(locale: string, defaultLocale: string): boolean`; `editableFields(mode: boolean, all: readonly string[]): string[]`.

**Rules:**

- `/contribute/index/[slug]` reads `?locale=`. Without it the editor loads and submits the **default** locale whatever the route locale (fixes the overwrite bug). With a non-default configured locale it is in translation mode: prefill from that locale version when it exists, else from the default locale; only `LOCALIZED_LIBRARY_FIELDS` are editable (others rendered read-only with "Shared across languages"); `TranslationBanner` says "Translating into {language name}. Only text that differs by language can be changed here."; the submission body includes `locale`. An unknown `?locale` is ignored.
- "Translate this record" in `LibraryHelpPanel` appears when more than one locale is configured (fetch the list server-side through the existing `fetchArticleLocales()`-style helper in `lib/article-editor-server.ts`, or pass it down as a prop) and links to `/contribute/index/{slug}?locale={first non-default locale}` with a locale picker if more than one.
- Fallback: when the requested locale version is missing and the locale is not the default, fetch the default locale and set `localeFallback: true`. Pages show "Not yet translated into {language}." under the title and return `robots: { index: false, follow: true }` in metadata for fallback renders. `generateStaticParams` unchanged.
- Meilisearch: the plugin config change and the seed script index every locale; `displayedAttributes` include `locale`; the parity test in `meilisearch-config.test.ts` stays green. UI search adds `filter: locale = "<routeLocale>"` when the route locale is in `LIVE_LOCALES` (`lib/seo/metadata.ts`), else the default locale.

- [ ] **Step 1: Write failing tests:** `translationMode`/`editableFields`; fallback fetch returns the default doc with `localeFallback: true` (mock the Strapi client); Meilisearch config has `locale: "all"` and `locale` filterable for the three indexes; the wizard submits `locale` only in translation mode.
- [ ] **Step 2–4:** Run, implement, `apps/ui` and `apps/strapi` suites and typecheck; lint.

---

## Task 9: World countries import (script)

**Files:**

- Create: `apps/strapi/scripts/populate-world-countries.ts`, `apps/strapi/scripts/world-countries.ts` (pure mapping)
- Modify: `docs/pre-golive-checklist.md`
- Test: `apps/strapi/tests/world-countries.test.ts`

**Interfaces produced:**

```ts
// scripts/world-countries.ts
export const SOUTH_AMERICA_ISO2: ReadonlySet<string> // AR BO BR CL CO EC GY PY PE SR UY VE FK GF
export type SeedCountry = {
  name: string
  code: string
  slug: string
  centroidLat: number
  centroidLng: number
  bboxNorth: number
  bboxSouth: number
  bboxEast: number
  bboxWest: number
  boundaryUrl: string
  sourceAttribution: string
}
export function continentSlugFor(
  seedContinent: string,
  iso2: string
): "africa" | "asia" | "europe" | "oceania" | "north-america" | "south-america"
export function countriesFromSeed(
  seed: Record<string, unknown>
): { continentSlug: string; country: SeedCountry }[] // only `continents/*` keys
export function mapConfigFor(c: SeedCountry): Record<string, unknown> // same shape existing country rows use; read one with the MCP or a country schema/mapConfig example in scripts/populate-eu-boundaries.ts
```

**Rules:**

- Uses `StrapiClient` from `scripts/strapi-client.ts` with `STRAPI_API_TOKEN` (the token must be named `ingest-*`; document this at the top of the file).
- Reads `apps/ui/public/boundaries/seed-data.json`. For each country: match an existing row by `iso2`, then `slug`. Existing: fill only empty `iso2`, `mapConfig`, `boundaryUrl`, `sourceAttribution`, `continent`; never overwrite. Missing: create published with those fields and `name`, `slug`.
- Continents: ensure `north-america` and `south-america` exist (create published if missing); never create an `americas` continent.
- Publishes existing draft countries and regions (report counts). Prints a summary table: created, filled, published, skipped.
- `--dry-run` flag prints the plan without writing.
- Checklist: add "Run `populate-world-countries.ts` with an `ingest-*` token, then reindex Meilisearch" under go-live data steps.

- [ ] **Step 1:** Tests for `continentSlugFor` (BR → south-america, MX → north-america, JM → north-america, FR → europe), `countriesFromSeed` count equals the seed's continent lists total (247) and ignores `countries/*` keys, `mapConfigFor` shape.
- [ ] **Step 2–4:** Run, implement, `pnpm test:unit && pnpm typecheck`. Do not run the script against Strapi; the orchestrator runs it with `--dry-run` then for real.

---

## Task 10: Small fixes (UI and Strapi)

**Files:**

- Modify: `apps/ui/src/app/[locale]/contribute/_components/RolesTable.tsx` (path may differ; find with `grep -rl "RolesTable" apps/ui/src`)
- Modify: `apps/ui/src/app/[locale]/contribute/claim/page.tsx`
- Modify: `apps/strapi/src/api/user-profile/services/quick-wins.ts` (the `translate_wiki` action URL)
- Modify: `apps/strapi/src/plugins/content-moderation/package.json` (remove unused `diff` dependency only if nothing imports it: `grep -rn "from \"diff\"" apps/strapi/src/plugins/content-moderation` must be empty; do not touch the lockfile, report that it needs `pnpm install`)
- Test: extend the nearest existing tests; add `apps/ui/src/app/[locale]/contribute/claim/__tests__/claim-page.test.tsx` if none exists

**Rules:**

- `RolesTable`: no row promises reviewing others' changes or publishing without review, except where a role grants it now (`wiki_editor`, `journal_editor`: "Publish approved Knowledge/Journal edits directly"; `moderator`: "Review submissions in their queue and language"; `editorial_board`: both). Add `journal_editor` and `moderator` columns if roles are columns. Every link in it resolves (no bare `/contribute/claim`: link to `/contribute/index` with copy "Find your library, then choose Claim").
- `/contribute/claim` with no `libraryDocumentId`/`librarySlug`: redirect to `/contribute/index?intent=claim` instead of the hub.
- Quick win `translate_wiki` URL: `/contribute/knowledge/{slug}?locale={code}` (the editor's locale query; check `ArticleEditorShell` for the parameter name it reads and use that).

- [ ] **Step 1–4:** Tests for the redirect target and the quick-win URL; implement; suites and typecheck; lint.

---

## Task 11: Moderation content-api (Strapi)

**Files:**

- Create: `apps/strapi/src/plugins/content-moderation/server/controllers/moderation.ts`, `.../services/moderation.ts` (register both in their `index.ts`)
- Modify: `.../routes/content-api.ts`, `.../services/submission.ts` (`updateStatus` honours `opts.publish`; `new_library` publish path; `moderatorTarget`), `.../utils/article-apply.ts` (publish override), `.../controllers/option-suggestion.ts` (export the decide logic for reuse if it is inline)
- Test: `apps/strapi/tests/content-moderation/moderation-api.test.ts`

**Interfaces:**

- Consumes: Task 1 `canModerate`, `submissionTypesOfQueue`, `QUEUE_OF_SUBMISSION_TYPE`, `Capabilities`; Task 2 `loadCapabilities`; Task 5 `Reviewer`, `contributorReviewer`, `updateStatus(…, reviewer, note, { publish })`, Review Events; Task 7 `submission.locale`; existing `preloadRecordReviews`/`recordReview`.
- Produces (all `auth: false`, bridge secret + `X-Ba-User-Id` required, 401 otherwise, 403 when the caller has no moderation scope):

| Method and path                                                                | Request                                                                                                                                                     | Response                                                                                                                                                            |
| ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /moderation/submissions`                                                  | `status` (`pending`,`needs_info`,`decided`; default `pending`), `queue`, `type`, `locale`, `q` (≤ 100 chars), `page` (1–500), `pageSize` (1–50, default 25) | `{ data: ModerationRow[], meta: { page, pageSize, total } }`                                                                                                        |
| `GET /moderation/submissions/:documentId`                                      |                                                                                                                                                             | `{ data: ModerationDetail }` or 404 (also 404 when out of scope, to avoid leaking)                                                                                  |
| `PUT /moderation/submissions/:documentId/status`                               | `{ status: "approved"\|"rejected"\|"needs_info", note?: string ≤ 2000, publish?: boolean }`                                                                 | `{ data }`; 400 missing note for reject/needs_info; 403 out of scope or self-review; 409 conflict / `apply_refused` with `reason`; 422 tampered; 500 `apply_failed` |
| `PUT /moderation/submissions/:documentId/target`                               | `{ continent?, country?, region?, area? }` document ids                                                                                                     | `{ data }`; only `new_library`/`location_request` in `pending`/`needs_info`                                                                                         |
| `GET /moderation/submissions/:documentId/events`                               |                                                                                                                                                             | `{ data: ReviewEvent[] }`                                                                                                                                           |
| `GET /moderation/stats`                                                        |                                                                                                                                                             | `{ data: { queue, status, count }[] }` within scope                                                                                                                 |
| `GET /moderation/relation-labels?type=`                                        | as the admin route                                                                                                                                          | as the admin route                                                                                                                                                  |
| `GET /moderation/option-suggestions`, `PUT /moderation/option-suggestions/:id` | as the admin routes                                                                                                                                         | as the admin routes; 403 unless the caller holds a `{ queue: "all", locale: null }` scope (editorial board)                                                         |

```ts
type ModerationRow = {
  documentId: string
  submissionType: string
  queue: ModerationQueue
  status: string
  locale: string
  summary: string
  targetSlug: string | null
  submittedByName: string | null
  createdAt: string
  reviewedAt: string | null
}
type ModerationDetail = ModerationRow & {
  fields: unknown
  draftData: unknown
  note: string | null
  editSummary: string | null
  evidenceUrl: string | null
  reviewNote: string | null
  review: unknown | null
  article: {
    current: { title; summary; body } | null
    source: { locale; title; summary; body } | null
  } | null
  canPublish: boolean
}
```

**Rules:**

- Scope filter: `$or` of one clause per moderation scope: `{ submissionType: { $in: submissionTypesOfQueue(q) } }` (or no type clause for `all`), plus `{ locale: { $eq: scope.locale } }` when not null; always `submittedByUserId: { $ne: viewer }` and `status: { $ne: "draft" }`. `decided` means `approved` or `rejected`. Sort `createdAt: "desc"`, `id: "desc"`.
- `q`: `$or` over `submittedByName`, `targetSlug`, `editSummary`, `note` with `$containsi` (never email, which is personal data not needed for search from the frontend).
- `summary` computed server-side with a port of `summaryOf` from `admin/src/components/submissionMeta.ts` into `server/utils/submission-summary.ts` (create it; the admin keeps its own copy).
- Rows and details never include `submittedByEmail`, `payloadHash`, `draftRevision`, `reviewerAssignedTo`.
- Detail `review`: `recordReview` for record corrections and library edits; topic review for `topic_suggestion` (as `findAll`). `article`: for `wiki_edit`/`blog_submission` targeting an existing slug, the live article in the submission locale (`current`) and, when `draftData.isTranslation`, the `sourceLocale` version (`source`); bodies as the Strapi dynamic-zone JSON.
- `canPublish`: `wiki_edit`/`blog_submission` suggestions or non-editor new articles, and `new_library`, when the caller's scope covers the queue and locale.
- `publish: true` → article-apply treats the submission as a direct edit for the write mode only (publishes via the publish guard) without changing points rules; `new_library` → after create, set the hierarchy from `draftData.moderatorTarget` or the submitter's ids; if continent, country or region is missing return `apply_refused` with reason `no_hierarchy` (roll back); else publish the library.
- Every handler re-loads capabilities with `loadCapabilities(viewer)` per request and checks `canModerate` against the loaded submission; the reviewer is `contributorReviewer({ id: viewer, email: header email })`.

- [ ] **Step 1: Write failing tests:** 401 without secret; 403 with no scope; list returns only in-scope rows (French Knowledge moderator vs mixed seed), excludes own and drafts, paginates, searches; detail 404 out of scope; approve by a scoped moderator writes a Review Event with `ba:` reviewer; self-review 403; reject without note 400; `publish: true` publishes a suggestion's draft version; `new_library` with `publish` and no region returns `apply_refused: no_hierarchy` and leaves no library; `target` rejected for other types; option-suggestions 403 for a non-board moderator; `summary` port matches the admin's for three sample rows.
- [ ] **Step 2–4:** Run, implement, `pnpm test:unit && pnpm typecheck`; lint.

---

## Task 12: Frontend moderation queue and review page (Next.js)

**Files:**

- Create: `apps/ui/src/app/api/moderation/submissions/route.ts`, `.../submissions/[documentId]/route.ts`, `.../submissions/[documentId]/status/route.ts`, `.../submissions/[documentId]/target/route.ts`, `.../submissions/[documentId]/events/route.ts`, `.../stats/route.ts`, `.../relation-labels/route.ts`, `.../option-suggestions/route.ts`, `.../option-suggestions/[id]/route.ts`
- Create: `apps/ui/src/lib/moderation-proxy.ts` (shared: session, `requireCapability(user, "moderate.queue")`, rate limit, parameter allowlist, forward with `bridgeUserHeaders`)
- Create: `apps/ui/src/app/[locale]/contribute/moderation/page.tsx`, `.../moderation/[documentId]/page.tsx`, `.../moderation/suggestions/page.tsx`
- Create: `apps/ui/src/components/moderation/` — `ModerationQueue.tsx`, `ModerationFilters.tsx`, `ReviewDecisionForm.tsx`, `ReviewThread.tsx`, `RecordChangesTable.tsx`, `ArticleReviewPanel.tsx`, `FacilitiesPanel.tsx`, `ClaimPanel.tsx`, `NewLibraryPanel.tsx`, `submissionMeta.ts` (port of the admin's pure helpers), `index.ts`
- Modify: `apps/ui/src/app/[locale]/contribute/_components/ContributeNavBar.tsx` (Moderation tab when `has("moderate.queue")`; `SEGMENT_TO_TAB.moderation = "moderation"`)
- Modify: `apps/ui/src/app/robots.ts` (`/contribute/moderation` private)
- Test: `apps/ui/src/lib/__tests__/moderation-proxy.test.ts`, `apps/ui/src/components/moderation/__tests__/*.test.tsx`, extend the ContributeNavBar test (create if absent)

**Interfaces:**

- Consumes: Task 11 routes and types exactly; Task 3 `useCapabilities().moderationScopes`, `sessionCapabilities`.
- Produces: pages at `/contribute/moderation`, `/contribute/moderation/[documentId]`, `/contribute/moderation/suggestions`; exported `moderationRowLabel(row)` in `components/moderation/submissionMeta.ts` (Task 16 extends the panels map).

**Rules:**

- Proxies: 401/403 from `requireCapability`; 30 requests a minute per user via `lib/rate-limit.ts`; forward only allowlisted query params; JSON body capped with `readJsonCapped` (16 KB) for PUTs; pass Strapi's status and body through.
- Queue page (RSC shell + client table): compact `PageHero` (eyebrow "Moderation", title "Review _submissions_", lead naming the caller's scopes, e.g. "Knowledge in French, and the Index"); segmented control Pending / Needs changes / Decided; filters in a `fieldset`/`legend`: queue (only the caller's queues), locale (only when a scope is unrestricted or covers several), `SearchField`; table columns Type, Submission, Contributor, Language, Submitted, Status; row links to the review page; result count announced with `aria-live`; `Pager`; `EmptyState` "Nothing waiting. Thank you."
- Review page: left column metadata card, contributor note, the per-type panel (record corrections: `RecordChangesTable` Field / Current (from `review.current`) / Proposed; facilities; claim domain check; article: current vs proposed, and for translations source and translation side by side with the locale badges; new library: fields plus a hierarchy picker that calls the `target` route, reusing `LocationHierarchySelector` from the Index editor by import); right sticky column `ReviewDecisionForm` (note textarea, required for Needs changes and Reject, buttons Approve, "Approve and publish" when `canPublish`, Needs changes, Reject; confirmation text before Approve and publish), `ReviewThread` from the events route, links to the target record. Decided submissions render read-only. Errors from Strapi shown inline with the spec §5.2 copy.
- Suggestions page (only with an `all`/null scope; otherwise `notFound()`): open Option Suggestions with request counts and Accept / Decline with a note.
- No Strapi call from client components: the client calls `/api/moderation/*`.

- [ ] **Step 1: Write failing tests:** proxy denies without the capability and forwards allowlisted params only; NavBar shows Moderation only with the capability; decision form requires a note for reject/needs_info and shows "Approve and publish" only when `canPublish`; `RecordChangesTable` renders live current values; `submissionMeta` port matches the admin helper for sample rows.
- [ ] **Step 2–4:** Run, implement, `pnpm test && pnpm typecheck`; lint.

---

## Task 13: Fixtures, E2E and ADR-0005

**Files:**

- Modify: `qa/tests/playwright/helpers/seed-access-fixtures.ts`, `qa/tests/playwright/helpers/strapi-access-writer.cjs`, `qa/tests/playwright/helpers/access-fixtures.ts`
- Create: `qa/tests/playwright/e2e/access/moderation.spec.ts`, `qa/tests/playwright/e2e/access/role-application.spec.ts`, `qa/tests/playwright/e2e/access/location-request.spec.ts`
- Modify: `qa/tests/playwright/e2e/access/role-matrix.spec.ts` (grants instead of the enum)
- Create: `docs/adr/0005-moderation-runs-in-the-frontend.md`

**Rules:**

- Fixtures write Role Grants through the headless Document Service writer (never REST), replacing direct `contributorRole` writes: existing role fixtures get one global grant each; add `moderator-global` (`moderator`, `all`, null), `moderator-knowledge-fr` (`moderator`, `knowledge`, `fr`), `journal-editor-fr` (`journal_editor`, `all`, `fr`). The local-only guard stays. Update `TEST-USERS.local.md` generation if the seed writes it (never commit that file).
- E2E: Moderation tab visible only to moderators; the French Knowledge moderator sees a seeded `fr` wiki suggestion and not an `en` Journal one; a moderator cannot open their own submission; approve-and-publish of a suggestion makes the article live; a needs-info note appears on the contributor's submission card. Role application: a fixture with five approved submissions applies, a moderator approves, the applicant's session shows the Knowledge direct-edit capability within 60 s (poll). Location request: a contributor requests an Area from the new-library flow, a moderator approves, the Area appears in the picker.
- ADR-0005 (context, decision, consequences) per spec §5.4, noting it supersedes the access spec §12 frontend-queue exclusion.
- The orchestrator starts Strapi and the UI before running `npx playwright test --project=access`; the implementer writes the specs and runs them if servers are up (check `curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:1337/_health`), else reports that they were not run.

---

## Task 14: Role applications, eligibility and notifications (Strapi)

**Files:**

- Modify: `apps/strapi/src/plugins/content-moderation/server/services/submission-policy.ts` (`role_application` eligibility in `check`), `.../services/submission.ts` (approval branch; notification calls after commit and on finalize/create), `.../utils/params.ts` (validate `role_application` fields)
- Create: `.../services/notifications.ts` (register in `services/index.ts`), `.../utils/email-templates.ts`
- Modify: `apps/strapi/.env.example` (`MODERATORS_EMAIL=moderators@libraries.global`, note `APP_PUBLIC_URL`)
- Test: `apps/strapi/tests/content-moderation/role-application.test.ts`, `.../notifications.test.ts`

**Interfaces produced:**

```ts
// services/notifications.ts
submissionDecided(s: SubmissionRow, status: "approved" | "rejected" | "needs_info"): Promise<void>
submissionPending(s: SubmissionRow): Promise<void> // only role_application and location_request notify moderators
// utils/email-templates.ts
export function decidedEmail(i: { name: string | null; type: string; status: string; note: string | null; url: string }): { subject: string; text: string; html: string }
export function moderatorAlertEmail(i: { type: string; summary: string; url: string }): { subject: string; text: string; html: string }
export function applicationDecidedEmail(i: { name: string | null; role: string; locales: string[]; status: string; note: string | null; url: string }): { subject: string; text: string; html: string }
```

**Rules:**

- `fields` for `role_application`: `{ role: "wiki_editor" | "journal_editor", locales: string[] (each a configured locale; empty = all), statement: string 20–2000 chars, samples: string[] ≤ 5 http(s) URLs }`; `targetEntityType: "user_profile"`; `checkContent` runs on it (already generic).
- Eligibility in `check` (403 with a clear message each): at least `ROLE_APPLICATION_MIN_ACCEPTED` approved submissions by the user, excluding `role_application`; no `pending`/`needs_info`/`draft` application for the same role; no active grant for that role covering every requested locale (a null-locale grant covers all).
- Approval (inside the transaction): one `createGrant` per requested locale, or one with `locale: null` when `locales` is empty; `source: "application"`, `grantedBy: reviewer.id`, `reason: "Approved application <documentId>"`; `resultDocumentId` = the applicant's profile documentId. No points.
- Notifications (after commit, never throwing, each wrapped and logged `[notifications]`): `strapi.plugin("email").service("email").send({ to, subject, text, html })`; skip with a log when no provider is configured (`strapi.config.get("plugin::email.provider")` falsy or `send` missing). Submitter emails respect `user-profile.notifPrefs.editsReviewed !== false`; application decisions always send. Moderator alerts go to `MODERATORS_EMAIL` (default `moderators@libraries.global`). Links use `APP_PUBLIC_URL` (`/contribute/submissions` for submitters, `/contribute/moderation/<documentId>` for moderators). Templates: plain sentences, no marketing, the moderator's note quoted when present.

- [ ] **Step 1: Write failing tests:** eligibility (4 accepted → 403, 5 → ok; open application → 403; covering grant → 403; partial locale overlap → ok); approval creates grants per locale and sets `resultDocumentId`, awards no points; notifications: approved correction emails the submitter, `editsReviewed: false` suppresses it, a pending application emails `MODERATORS_EMAIL`, a throwing `send` doesn't fail the approval, no provider logs and skips.
- [ ] **Step 2–4:** Run, implement, `pnpm test:unit && pnpm typecheck`; lint.

---

## Task 15: Role application UI (Next.js)

**Files:**

- Create: `apps/ui/src/app/[locale]/contribute/knowledge/apply/page.tsx`, `apps/ui/src/components/contribute/RoleApplicationForm.tsx`
- Modify: `apps/ui/src/app/api/contribute/standing/route.ts` (add `acceptedCount`, the number of approved submissions excluding `role_application`; fetch from Strapi through the existing standing/bridge call or `GET /submissions/my`)
- Modify: `apps/ui/src/components/docs/DocsPage.tsx` (replace the `WIKI_EDITOR_APPLY_HREF` mailto with a link to `/contribute/knowledge/apply?role=wiki_editor`), the Journal landing component (link `?role=journal_editor`), the `RolesTable` editor columns ("Apply" link)
- Modify: `apps/ui/src/app/[locale]/contribute/_components/ContributeNavBar.tsx` only if `SEGMENT_TO_TAB` needs `apply` under knowledge (it is nested under `knowledge`, so likely not)
- Test: `apps/ui/src/components/contribute/__tests__/RoleApplicationForm.test.tsx`

**Rules:**

- Signed-out users are redirected to sign in (existing pattern in `knowledge/page.tsx`).
- Eligibility card: "{n} of 5 accepted changes" with a progress bar (text plus bar, never colour alone), and when below five, the form is disabled with "Keep contributing: corrections and new libraries all count." and a link to `/contribute`.
- Form: role radio (Knowledge editor, Journal editor; preselected from `?role=`), languages multi-select of configured locales with "All languages" as the empty default, statement textarea (20–2000, live count), up to five sample links. Client-side checks mirror the server; `findUnsafeContent` from `@repo/shared-data` for early feedback. Submits `POST /api/submissions` with `submissionType: "role_application"`, `targetEntityType: "user_profile"`, `fields`.
- Shows any open or decided application for each role (from `/api/submissions/my`), with the moderator's note when decided or needs-info.
- Copy never mentions Pro or paying.

- [ ] **Step 1–4:** Tests: disabled below five, payload shape, statement bounds, existing application shown; implement; `pnpm test && pnpm typecheck`; lint.

---

## Task 16: Location Requests (Strapi + Next.js)

**Files:**

- Modify: `apps/strapi/src/plugins/content-moderation/server/services/submission.ts` (`location_request` approval; `new_library` uses `draftData.moderatorTarget` first), `.../services/submission-policy.ts` (validation), `.../utils/params.ts`
- Modify: `apps/ui/src/app/[locale]/contribute/index/_components/LocationHierarchySelector.tsx`, `.../wizard.types.ts`, `.../IndexRecordWizard.tsx` (carry the proposal on the `new_library` fields)
- Create: `apps/ui/src/app/[locale]/contribute/index/_components/LocationRequestForm.tsx`
- Create: `apps/ui/src/components/moderation/LocationRequestPanel.tsx`; modify `apps/ui/src/components/moderation/index.ts` and the panel map in the review page to use it, and `NewLibraryPanel.tsx` to show `proposedRegionName`/`proposedAreaName`
- Test: `apps/strapi/tests/content-moderation/location-request.test.ts`, `apps/ui/src/app/[locale]/contribute/index/_components/__tests__/LocationRequestForm.test.tsx`

**Rules:**

- `fields`: `{ kind: "region" | "area", name: 2–120 chars, typeLabel?: ≤ 60, countryDocumentId, regionDocumentId (required for area), note?: ≤ 1000, evidenceUrl: http(s) }`; `targetEntityType` = `kind`; `checkContent` applies.
- Approval (inside the transaction, under `runWithChangeContext`): create the Region (`country` relation, and `continent` from the country) or Area (`region` and `country`) **published**, `slug` = slugified `name` made unique within the parent (append `-2`, `-3`); `name` and `typeLabel` taken from `draftData.moderatorEdit` when the moderator changed them (Task 12's panel sends them through the `target` route; extend `PUT /moderation/submissions/:documentId/target` to accept `{ name?, typeLabel? }` for `location_request`); set `resultDocumentId`. No points.
- UI: under the Region and Area selects, a "Not listed?" button opens `LocationRequestForm` inline (name, type label, evidence link, note) for the currently selected country/region; on submit it creates the `location_request` and stores `{ proposedRegionName | proposedAreaName, locationRequestDocumentId }` on the wizard form so the `new_library` submission carries it in `fields`. The selects stay optional. A success line: "Thanks. A moderator will add it, and your library will be linked when both are approved."
- `new_library` approval: the moderator's `moderatorTarget` wins over the submitter's ids; if the submission references a `locationRequestDocumentId` whose request is approved, use its `resultDocumentId` for region/area.
- The `LocationRequestPanel` lets the moderator edit name and type label and shows the parent hierarchy.

- [ ] **Step 1–4:** Tests: validation (area without region 400), approval creates a published region with a unique slug and `resultDocumentId`, `moderatorEdit` wins, `new_library` picks up an approved request's area; form submits and stores the proposal; implement; both suites and typecheck; lint.

---

## Task 17: Documentation

**Files:**

- Modify: `CLAUDE.md` ("Access model", "Contribution & moderation", "Testing access"), `CONTEXT.md` (spec §2 terms; `journal_editor` and `moderator` in Contributor Role; Moderator is no longer "future"), `docs/strapi-role-permissions.md` (rewrite: grants, the two moderation surfaces, admin RBAC for the owner, append-only collections), `apps/ui/.env.local.example` (nothing new unless Tasks added vars), `apps/strapi/.env.example` (`CHANGE_RECORDS_ENABLED`, `MODERATORS_EMAIL`), `docs/pre-golive-checklist.md` (backfills run automatically at boot; the world-countries step; reindex)

**Rules:** describe what exists after Tasks 1–16, in the existing voice of each file; no aspirational claims. CLAUDE.md keeps its structure; replace sentences that became false (roles on `user-profile.contributorRole`, moderators are Strapi admin users only, "Still to come" items now built).

- [ ] **Step 1:** Edit. **Step 2:** Re-read each changed section against the code it describes (grep the names you mention).
