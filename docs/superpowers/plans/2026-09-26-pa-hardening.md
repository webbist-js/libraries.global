# P-A Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the verified security and correctness defects in moderation, rewards and the Next→Strapi proxies. This is items A1–A13 of `docs/superpowers/specs/2026-09-26-access-contribution-pro-implementation-design.md` §4.

**Architecture:**

- **Strapi side:**
  - New pure modules in the content-moderation plugin: a status state machine, a payload hash, a wiki-body sanitiser and a submission policy.
  - A new pure package, `@repo/access`, holds the capability rules. Strapi uses it as the authoritative gate, and Next can reuse it later (P-B).
  - Approval becomes a compare-and-set on status, so its side effects run exactly once. Point awards carry an idempotency key.
- **Next side:** Path parameters are validated before they reach any bridge call, and responses stop leaking secrets and drafts.

**Tech Stack:** Strapi v5 (Document Service), Next.js 16 route handlers, Better Auth, Vitest, pnpm workspaces, TypeScript strict.

## Global Constraints

- Strapi v5: use `strapi.documents(uid)` for content reads and writes. `strapi.db.query` / knex is allowed only for (a) the atomic compare-and-set and increments in Tasks 5–6, (b) counts, and (c) the bulk PII scrub on deletion in Task 13. Both apply only to types with `draftAndPublish: false`.
- Node 22 (`nvm use`). The package manager is pnpm.
- Strapi tests live in `apps/strapi/tests/**/*.test.ts` (vitest, globals on). Run them with `pnpm --filter @repo/strapi test`.
- UI tests live in `apps/ui/src/**/*.test.ts`. Run them with `pnpm --filter @repo/ui test`.
- Package tests: `pnpm --filter @repo/access test`.
- After changing any file under `apps/strapi/src/plugins/content-moderation/server` or `rewards/server`, rebuild the plugins with `pnpm --filter @repo/strapi build:plugins` before starting Strapi. `dist/` is not tracked.
- Commit messages use Conventional Commits, with the header at most 72 characters. Never add `Co-Authored-By` lines. Commit straight to `dev`: the repo's branch hook requires `STAR-<n>` names, and the user works on `dev`.
- The pre-commit hook runs ESLint and SonarJS through lint-staged. Fix every error before committing; warnings are fine.
- Domain terms: Submission, Contributor Role, Library Claim, Points, Tier (CONTEXT.md).
- Contributor Roles, in ascending order: `reader`, `contributor`, `verified_librarian`, `wiki_editor`, `editorial_board`.
- Moderation statuses: `draft`, `pending`, `approved`, `rejected`, `needs_info`.
- **Do not push.** Section 4 of the spec contains exploit details, and the repository's visibility is unconfirmed (D-O4).

## File structure

| File                                                                           | Responsibility                                                                                                 |
| ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| `packages/access/` (new)                                                       | Pure capability rules: `resolveCapabilities`, `canSubmit`, `contributionLimits`, `promoteRole`                 |
| `apps/strapi/src/plugins/content-moderation/server/utils/transitions.ts` (new) | `canTransition(from, to)`: the status state machine                                                            |
| `…/server/utils/payload-hash.ts` (new)                                         | `payloadHash(submission)`: a stable SHA-256 of what the moderator reviews                                      |
| `…/server/utils/wiki-body.ts` (new)                                            | `sanitizeWikiBody(body)`: a dynamic-zone allowlist and heading-level clamp                                     |
| `…/server/utils/params.ts` (new)                                               | `SUBMISSION_TYPES`, `VERIFICATION_METHODS`, `isDocumentId()`                                                   |
| `…/server/services/submission-policy.ts` (new)                                 | Loads role, claims and tier for a baUserId, then applies `canSubmit` and the quotas                            |
| `…/server/services/submission.ts` (modify)                                     | Guards on create, save, finalize and approve. Targets resolved from top-level fields. Idempotent side effects. |
| `…/server/controllers/submission.ts` (modify)                                  | Wires in the policy and guards. Admin self-approval block.                                                     |
| `…/server/routes/admin.ts` (modify)                                            | `admin::hasPermissions`                                                                                        |
| `…/server/content-types/submission/schema.json` (modify)                       | `payloadHash` (private)                                                                                        |
| `…/server/content-types/submission-upload/` (new)                              | Ownership rows for files uploaded during a submission                                                          |
| `apps/strapi/src/plugins/rewards/server/services/points.ts` (modify)           | Idempotency key and atomic increment                                                                           |
| `…/rewards/server/content-types/point-event/schema.json` (modify)              | `idempotencyKey` (unique), missing enum values                                                                 |
| `…/rewards/server/routes/admin.ts` (modify)                                    | `admin::hasPermissions`                                                                                        |
| `…/rewards/server/services/leaderboard.ts` (modify)                            | No `baUserId`; respects privacy                                                                                |
| `apps/strapi/src/utils/read-status.ts` (new)                                   | `readStatus(ctx)`: draft only with the bridge secret                                                           |
| `apps/strapi/src/api/*/controllers/*.ts` (modify, 20 sites)                    | Use `readStatus(ctx)`                                                                                          |
| `apps/strapi/src/api/auth-bridge/controllers/auth-bridge.ts` (modify)          | Username format check, affiliation upsert, no role downgrade, scrub on delete                                  |
| `apps/ui/src/lib/bridge-params.ts` (new)                                       | `assertSubmissionType`, `assertDocumentId`                                                                     |
| `apps/ui/src/app/api/submissions/**` (modify)                                  | Validated params and body size cap                                                                             |
| `apps/ui/src/app/api/profile/me/sessions/route.ts` (modify)                    | No tokens in the response                                                                                      |
| `apps/ui/src/app/api/profile/me/notifications/route.ts` (modify)               | zod-validated `notifPrefs`                                                                                     |
| `apps/ui/src/lib/strapi-api/public.ts` (modify)                                | Sends the bridge secret only for server-side draft reads                                                       |
| `apps/ui/src/app/api/private-proxy/[...slug]/route.ts` (modify)                | Header allowlist                                                                                               |

---

### Task 1: `@repo/access` package with capability rules

**Files:**

- Create: `packages/access/package.json`
- Create: `packages/access/tsconfig.json`
- Create: `packages/access/src/index.ts`
- Create: `packages/access/src/roles.ts`
- Create: `packages/access/src/capabilities.ts`
- Create: `packages/access/src/limits.ts`
- Test: `packages/access/tests/capabilities.test.ts`
- Test: `packages/access/tests/limits.test.ts`

**Interfaces:**

- Produces:
  - `type ContributorRole = "reader" | "contributor" | "verified_librarian" | "wiki_editor" | "editorial_board"`
  - `type SubmissionType = "correction" | "new_library" | "library_claim" | "library_edit" | "wiki_edit" | "blog_submission" | "topic_suggestion"`
  - `type Capability = "submit.correction" | "submit.newLibrary" | "submit.claim" | "submit.libraryEdit" | "submit.docSuggestion" | "docs.directEdit" | "submit.journalPitch" | "submit.topicSuggestion" | "events.feed"`
  - `interface CapabilityInput { signedIn: boolean; contributorRole: ContributorRole | null; claims: { libraryDocumentId: string }[] }`
  - `interface Capabilities { set: ReadonlySet<Capability>; claimedLibraryIds: ReadonlySet<string> }`
  - `resolveCapabilities(input: CapabilityInput): Capabilities`
  - `canSubmit(c: Capabilities, type: SubmissionType, opts?: { libraryDocumentId?: string; directWikiEdit?: boolean }): boolean`
  - `promoteRole(current: ContributorRole | null, target: ContributorRole): ContributorRole`, which never lowers a role
  - `type TierName = "Reader" | "Indexer" | "Cartographer" | "Archivist" | "Scholar" | "Curator"`
  - `contributionLimits(tier: string | null): { pendingSubmissions: number; submissionsPerHour: number; uploadsPerDay: number }`

- [ ] **Step 1: Create the package scaffolding**

`packages/access/package.json`:

```json
{
  "name": "@repo/access",
  "version": "0.1.0",
  "private": true,
  "license": "MIT",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "require": "./dist/index.js"
    }
  },
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "typescript": "^5.0.0",
    "vitest": "^2.0.0"
  }
}
```

`packages/access/tsconfig.json` (the same as `packages/events-crypto`, but CommonJS output so Strapi's CJS plugin bundle can `require` it):

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["es2022"],
    "module": "CommonJS",
    "moduleResolution": "Node",
    "esModuleInterop": true,
    "declaration": true,
    "strict": true,
    "skipLibCheck": true,
    "rootDir": "src",
    "outDir": "dist"
  },
  "include": ["src"]
}
```

- [ ] **Step 2: Write the failing tests**

`packages/access/tests/capabilities.test.ts`:

```ts
import { describe, expect, expectTypeOf, it } from "vitest"

import {
  canSubmit,
  promoteRole,
  resolveCapabilities,
  type CapabilityInput,
} from "../src"

const input = (over: Partial<CapabilityInput> = {}): CapabilityInput => ({
  signedIn: true,
  contributorRole: "reader",
  claims: [],
  ...over,
})

describe("resolveCapabilities", () => {
  it("gives anonymous users nothing", () => {
    const c = resolveCapabilities(
      input({ signedIn: false, contributorRole: null })
    )
    expect(c.set.size).toBe(0)
    expect(canSubmit(c, "correction")).toBe(false)
  })

  it("lets any signed-in reader correct, propose, claim, suggest docs and pitch", () => {
    const c = resolveCapabilities(input())
    for (const t of [
      "correction",
      "new_library",
      "library_claim",
      "blog_submission",
      "topic_suggestion",
    ] as const)
      expect(canSubmit(c, t)).toBe(true)
    expect(canSubmit(c, "wiki_edit")).toBe(true) // free-text suggestion
    expect(canSubmit(c, "wiki_edit", { directWikiEdit: true })).toBe(false)
  })

  it("only allows library_edit on claimed libraries", () => {
    const c = resolveCapabilities(
      input({
        contributorRole: "verified_librarian",
        claims: [{ libraryDocumentId: "lib1" }],
      })
    )
    expect(canSubmit(c, "library_edit", { libraryDocumentId: "lib1" })).toBe(
      true
    )
    expect(canSubmit(c, "library_edit", { libraryDocumentId: "lib2" })).toBe(
      false
    )
    expect(canSubmit(c, "library_edit")).toBe(false)
  })

  it("does not let editors edit library records without a claim (D-C2)", () => {
    const c = resolveCapabilities(input({ contributorRole: "editorial_board" }))
    expect(canSubmit(c, "library_edit", { libraryDocumentId: "lib1" })).toBe(
      false
    )
  })

  it("grants direct doc editing to wiki_editor and editorial_board only", () => {
    for (const role of ["wiki_editor", "editorial_board"] as const)
      expect(
        canSubmit(
          resolveCapabilities(input({ contributorRole: role })),
          "wiki_edit",
          { directWikiEdit: true }
        )
      ).toBe(true)
    for (const role of ["reader", "contributor", "verified_librarian"] as const)
      expect(
        canSubmit(
          resolveCapabilities(input({ contributorRole: role })),
          "wiki_edit",
          { directWikiEdit: true }
        )
      ).toBe(false)
  })

  it("rejects unknown submission types", () => {
    const c = resolveCapabilities(input({ contributorRole: "editorial_board" }))
    expect(canSubmit(c, "pro_upgrade" as never)).toBe(false)
  })

  it("has no plan or entitlement inputs (money never buys trust)", () => {
    expectTypeOf<CapabilityInput>().not.toHaveProperty("plan")
    expectTypeOf<CapabilityInput>().not.toHaveProperty("subscription")
    expectTypeOf<CapabilityInput>().not.toHaveProperty("entitlements")
  })
})

describe("promoteRole", () => {
  it("raises but never lowers", () => {
    expect(promoteRole("reader", "verified_librarian")).toBe(
      "verified_librarian"
    )
    expect(promoteRole(null, "verified_librarian")).toBe("verified_librarian")
    expect(promoteRole("wiki_editor", "verified_librarian")).toBe("wiki_editor")
    expect(promoteRole("editorial_board", "verified_librarian")).toBe(
      "editorial_board"
    )
  })
})
```

`packages/access/tests/limits.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import { contributionLimits } from "../src"

describe("contributionLimits", () => {
  it("scales with tier and never drops below the Reader floor", () => {
    const reader = contributionLimits("Reader")
    const curator = contributionLimits("Curator")
    expect(reader).toEqual({
      pendingSubmissions: 5,
      submissionsPerHour: 10,
      uploadsPerDay: 20,
    })
    expect(curator.pendingSubmissions).toBeGreaterThan(
      reader.pendingSubmissions
    )
    expect(contributionLimits(null)).toEqual(reader)
    expect(contributionLimits("Nonsense")).toEqual(reader)
  })
})
```

- [ ] **Step 3: Run the tests and confirm they fail**

Run: `pnpm install && pnpm --filter @repo/access test`
Expected: FAIL with `Failed to resolve import "../src"`.

- [ ] **Step 4: Implement**

`packages/access/src/roles.ts`:

```ts
export const CONTRIBUTOR_ROLES = [
  "reader",
  "contributor",
  "verified_librarian",
  "wiki_editor",
  "editorial_board",
] as const
export type ContributorRole = (typeof CONTRIBUTOR_ROLES)[number]

export function isContributorRole(v: unknown): v is ContributorRole {
  return (
    typeof v === "string" &&
    (CONTRIBUTOR_ROLES as readonly string[]).includes(v)
  )
}

/** Returns the higher of the two roles. Approvals may raise a role, never lower it. */
export function promoteRole(
  current: ContributorRole | null,
  target: ContributorRole
): ContributorRole {
  if (!current) return target
  return CONTRIBUTOR_ROLES.indexOf(current) >= CONTRIBUTOR_ROLES.indexOf(target)
    ? current
    : target
}
```

`packages/access/src/capabilities.ts`:

```ts
import type { ContributorRole } from "./roles"

export const SUBMISSION_TYPES = [
  "correction",
  "new_library",
  "library_claim",
  "library_edit",
  "wiki_edit",
  "blog_submission",
  "topic_suggestion",
] as const
export type SubmissionType = (typeof SUBMISSION_TYPES)[number]

export type Capability =
  | "submit.correction"
  | "submit.newLibrary"
  | "submit.claim"
  | "submit.libraryEdit"
  | "submit.docSuggestion"
  | "docs.directEdit"
  | "submit.journalPitch"
  | "submit.topicSuggestion"
  | "events.feed"

export interface CapabilityInput {
  signedIn: boolean
  contributorRole: ContributorRole | null
  claims: { libraryDocumentId: string }[]
  // Deliberately no plan, subscription or entitlement fields (spec §3.1).
}

export interface Capabilities {
  set: ReadonlySet<Capability>
  claimedLibraryIds: ReadonlySet<string>
}

const EDITOR_ROLES: ReadonlySet<ContributorRole> = new Set([
  "wiki_editor",
  "editorial_board",
])

export function resolveCapabilities(input: CapabilityInput): Capabilities {
  const set = new Set<Capability>()
  const claimedLibraryIds = new Set(
    input.claims.map((c) => c.libraryDocumentId)
  )
  if (!input.signedIn) return { set, claimedLibraryIds }

  set.add("submit.correction")
  set.add("submit.newLibrary")
  set.add("submit.claim")
  set.add("submit.docSuggestion")
  set.add("submit.journalPitch")
  set.add("submit.topicSuggestion")
  if (claimedLibraryIds.size > 0) {
    set.add("submit.libraryEdit")
    set.add("events.feed")
  }
  if (input.contributorRole && EDITOR_ROLES.has(input.contributorRole))
    set.add("docs.directEdit")

  return { set, claimedLibraryIds }
}

export function isSubmissionType(v: unknown): v is SubmissionType {
  return (
    typeof v === "string" && (SUBMISSION_TYPES as readonly string[]).includes(v)
  )
}

export function canSubmit(
  c: Capabilities,
  type: SubmissionType,
  opts: { libraryDocumentId?: string; directWikiEdit?: boolean } = {}
): boolean {
  switch (type) {
    case "correction":
      return c.set.has("submit.correction")
    case "new_library":
      return c.set.has("submit.newLibrary")
    case "library_claim":
      return c.set.has("submit.claim")
    case "library_edit":
      return (
        c.set.has("submit.libraryEdit") &&
        !!opts.libraryDocumentId &&
        c.claimedLibraryIds.has(opts.libraryDocumentId)
      )
    case "wiki_edit":
      return opts.directWikiEdit
        ? c.set.has("docs.directEdit")
        : c.set.has("submit.docSuggestion")
    case "blog_submission":
      return c.set.has("submit.journalPitch")
    case "topic_suggestion":
      return c.set.has("submit.topicSuggestion")
    default:
      return false
  }
}
```

`packages/access/src/limits.ts`:

```ts
export const TIER_NAMES = [
  "Reader",
  "Indexer",
  "Cartographer",
  "Archivist",
  "Scholar",
  "Curator",
] as const
export type TierName = (typeof TIER_NAMES)[number]

type Limits = {
  pendingSubmissions: number
  submissionsPerHour: number
  uploadsPerDay: number
}

const LIMITS: Record<TierName, Limits> = {
  Reader: { pendingSubmissions: 5, submissionsPerHour: 10, uploadsPerDay: 20 },
  Indexer: {
    pendingSubmissions: 10,
    submissionsPerHour: 20,
    uploadsPerDay: 40,
  },
  Cartographer: {
    pendingSubmissions: 20,
    submissionsPerHour: 30,
    uploadsPerDay: 60,
  },
  Archivist: {
    pendingSubmissions: 40,
    submissionsPerHour: 40,
    uploadsPerDay: 100,
  },
  Scholar: {
    pendingSubmissions: 60,
    submissionsPerHour: 50,
    uploadsPerDay: 150,
  },
  Curator: {
    pendingSubmissions: 100,
    submissionsPerHour: 60,
    uploadsPerDay: 200,
  },
}

/** Tier-scaled contribution quotas. Tiers raise limits; they never skip review. */
export function contributionLimits(tier: string | null): Limits {
  return (TIER_NAMES as readonly string[]).includes(tier ?? "")
    ? LIMITS[tier as TierName]
    : LIMITS.Reader
}
```

`packages/access/src/index.ts`:

```ts
export * from "./capabilities"
export * from "./limits"
export * from "./roles"
```

- [ ] **Step 5: Run the tests and confirm they pass**

Run: `pnpm --filter @repo/access test && pnpm --filter @repo/access build`
Expected: PASS (9 tests). `packages/access/dist/index.js` exists.

- [ ] **Step 6: Wire the package into the content-moderation plugin**

Add to `apps/strapi/src/plugins/content-moderation/package.json` under `dependencies`:

```json
"@repo/access": "workspace:*",
```

Add `"@repo/access": "workspace:*",` to `apps/strapi/package.json` `dependencies`, keeping alphabetical order (after `@repo/catalogues`).

Run: `pnpm install && pnpm --filter @repo/strapi build:plugins`
Expected: the plugin builds without errors.

- [ ] **Step 7: Commit**

```bash
git add packages/access apps/strapi/package.json apps/strapi/src/plugins/content-moderation/package.json pnpm-lock.yaml
git commit -m "feat(access): capability rules package for contribution gating"
```

---

### Task 2: Pure moderation helpers (transitions, payload hash, params)

**Files:**

- Create: `apps/strapi/src/plugins/content-moderation/server/utils/transitions.ts`
- Create: `apps/strapi/src/plugins/content-moderation/server/utils/payload-hash.ts`
- Create: `apps/strapi/src/plugins/content-moderation/server/utils/params.ts`
- Test: `apps/strapi/tests/content-moderation/helpers.test.ts`

**Interfaces:**

- Produces:
  - `type ModerationStatus = "draft" | "pending" | "approved" | "rejected" | "needs_info"`
  - `canTransition(from: ModerationStatus, to: ModerationStatus): boolean`
  - `payloadHash(s: { submissionType: string; targetDocumentId?: string | null; targetSlug?: string | null; fields?: unknown; draftData?: unknown }): string`, a 64-character hex string
  - `VERIFICATION_METHODS: readonly ["email_domain", "vouching", "contact_us"]`
  - `isDocumentId(v: unknown): v is string`

- [ ] **Step 1: Write the failing test**

`apps/strapi/tests/content-moderation/helpers.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import { isDocumentId } from "../../src/plugins/content-moderation/server/utils/params"
import { payloadHash } from "../../src/plugins/content-moderation/server/utils/payload-hash"
import { canTransition } from "../../src/plugins/content-moderation/server/utils/transitions"

describe("canTransition", () => {
  it.each([
    ["draft", "pending", true],
    ["pending", "approved", true],
    ["pending", "rejected", true],
    ["pending", "needs_info", true],
    ["needs_info", "pending", true],
    ["needs_info", "approved", true],
    ["needs_info", "rejected", true],
    ["approved", "approved", false],
    ["approved", "pending", false],
    ["rejected", "approved", false],
    ["draft", "approved", false],
  ] as const)("%s → %s = %s", (from, to, ok) => {
    expect(canTransition(from, to)).toBe(ok)
  })
})

describe("payloadHash", () => {
  const base = {
    submissionType: "wiki_edit",
    targetSlug: "a",
    fields: { x: 1, y: [1, 2] },
    draftData: { body: [] },
  }
  it("is stable across key order", () => {
    expect(payloadHash(base)).toBe(
      payloadHash({
        draftData: { body: [] },
        fields: { y: [1, 2], x: 1 },
        targetSlug: "a",
        submissionType: "wiki_edit",
      })
    )
  })
  it("changes when content or target changes", () => {
    expect(payloadHash(base)).not.toBe(
      payloadHash({ ...base, targetSlug: "b" })
    )
    expect(payloadHash(base)).not.toBe(
      payloadHash({ ...base, fields: { x: 2, y: [1, 2] } })
    )
  })
})

describe("isDocumentId", () => {
  it("accepts Strapi document ids and rejects traversal", () => {
    expect(isDocumentId("um66mf6ytj5r7ct0rrgxxh8u")).toBe(true)
    expect(isDocumentId("../../auth-bridge")).toBe(false)
    expect(isDocumentId("12")).toBe(false)
    expect(isDocumentId(42)).toBe(false)
  })
})
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `pnpm --filter @repo/strapi test -- tests/content-moderation/helpers.test.ts`
Expected: FAIL, because the modules can't be resolved.

- [ ] **Step 3: Implement**

`…/server/utils/transitions.ts`:

```ts
export type ModerationStatus =
  | "draft"
  | "pending"
  | "approved"
  | "rejected"
  | "needs_info"

const ALLOWED: Record<ModerationStatus, readonly ModerationStatus[]> = {
  draft: ["pending"],
  pending: ["approved", "rejected", "needs_info"],
  needs_info: ["pending", "approved", "rejected"],
  approved: [],
  rejected: [],
}

export function canTransition(
  from: ModerationStatus,
  to: ModerationStatus
): boolean {
  return ALLOWED[from]?.includes(to) ?? false
}

/** Statuses a moderator may act on. */
export const REVIEWABLE: readonly ModerationStatus[] = ["pending", "needs_info"]
```

`…/server/utils/payload-hash.ts`:

```ts
import { createHash } from "node:crypto"

function canonical(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(canonical)
  if (v && typeof v === "object")
    return Object.fromEntries(
      Object.keys(v as Record<string, unknown>)
        .sort()
        .map((k) => [k, canonical((v as Record<string, unknown>)[k])])
    )
  return v ?? null
}

/** SHA-256 over exactly what a moderator reviews. Stored when a submission enters review. */
export function payloadHash(s: {
  submissionType: string
  targetDocumentId?: string | null
  targetSlug?: string | null
  fields?: unknown
  draftData?: unknown
}): string {
  const doc = canonical({
    submissionType: s.submissionType,
    targetDocumentId: s.targetDocumentId ?? null,
    targetSlug: s.targetSlug ?? null,
    fields: s.fields ?? null,
    draftData: s.draftData ?? null,
  })
  return createHash("sha256").update(JSON.stringify(doc)).digest("hex")
}
```

`…/server/utils/params.ts`:

```ts
export const VERIFICATION_METHODS = [
  "email_domain",
  "vouching",
  "contact_us",
] as const
export type VerificationMethod = (typeof VERIFICATION_METHODS)[number]

// Strapi v5 documentIds are 24 lowercase alphanumerics; allow 20–32 for safety.
const DOCUMENT_ID = /^[a-z0-9]{20,32}$/

export function isDocumentId(v: unknown): v is string {
  return typeof v === "string" && DOCUMENT_ID.test(v)
}
```

- [ ] **Step 4: Run it and confirm it passes**

Run: `pnpm --filter @repo/strapi test -- tests/content-moderation/helpers.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/strapi/src/plugins/content-moderation/server/utils apps/strapi/tests/content-moderation/helpers.test.ts
git commit -m "feat(moderation): state machine, payload hash and param helpers"
```

---

### Task 3: A1, drafts are editable only while they're drafts, and reviewed payloads are hashed

**Files:**

- Modify: `apps/strapi/src/plugins/content-moderation/server/content-types/submission/schema.json`
- Modify: `apps/strapi/src/plugins/content-moderation/server/services/submission.ts:1-23` (`create`), `:421-476` (`saveDraft`, `finalizeDraft`)
- Modify: `apps/strapi/src/plugins/content-moderation/server/controllers/submission.ts:246-268` (`saveDraft`)
- Test: `apps/strapi/tests/content-moderation/drafts.test.ts`
- Create: `apps/strapi/tests/helpers/fake-strapi.ts`

**Interfaces:**

- Consumes: `payloadHash` from Task 2.
- Produces:
  - `service.saveDraft(documentId, userId, draftData, stepCompleted)`, which returns `{ error: "not_found" | "forbidden" | "not_draft" } | { data }`. **This signature changes**: `userId` is now the second argument.
  - Every submission entering `pending` gets `payloadHash` set.
  - `makeFakeStrapi()`, a test helper used by Tasks 3–7.

- [ ] **Step 1: Add the fake Strapi test helper**

`apps/strapi/tests/helpers/fake-strapi.ts`:

```ts
import { vi } from "vitest"

type Doc = Record<string, any> & { documentId: string }

/** In-memory stand-in for strapi.documents() and the few strapi.db calls the moderation code uses. */
export function makeFakeStrapi(seed: Record<string, Doc[]> = {}) {
  const store: Record<string, Doc[]> = structuredClone(seed)
  let n = 0
  const table = (uid: string) => (store[uid] ??= [])
  const match = (d: Doc, filters: Record<string, any> = {}) =>
    Object.entries(filters).every(([k, v]) => {
      if (v && typeof v === "object" && "$eq" in v) return d[k] === v.$eq
      if (v && typeof v === "object" && "$in" in v) return v.$in.includes(d[k])
      if (v && typeof v === "object" && "$ne" in v) return d[k] !== v.$ne
      return d[k] === v
    })

  const documents = vi.fn((uid: string) => ({
    findOne: vi.fn(
      async ({ documentId }: { documentId: string }) =>
        table(uid).find((d) => d.documentId === documentId) ?? null
    ),
    findMany: vi.fn(
      async ({ filters }: { filters?: Record<string, any> } = {}) =>
        table(uid).filter((d) => match(d, filters))
    ),
    count: vi.fn(
      async ({ filters }: { filters?: Record<string, any> } = {}) =>
        table(uid).filter((d) => match(d, filters)).length
    ),
    create: vi.fn(async ({ data }: { data: Record<string, any> }) => {
      const doc = {
        id: ++n,
        documentId: `doc${String(n).padStart(21, "0")}`,
        createdAt: new Date().toISOString(),
        ...data,
      }
      table(uid).push(doc)
      return doc
    }),
    update: vi.fn(
      async ({
        documentId,
        data,
      }: {
        documentId: string
        data: Record<string, any>
      }) => {
        const doc = table(uid).find((d) => d.documentId === documentId)
        if (!doc) return null
        Object.assign(doc, data)
        return doc
      }
    ),
  }))

  const db = {
    query: vi.fn((uid: string) => ({
      updateMany: vi.fn(
        async ({
          where,
          data,
        }: {
          where: Record<string, any>
          data: Record<string, any>
        }) => {
          const rows = table(uid).filter((d) => match(d, where))
          rows.forEach((r) => Object.assign(r, data))
          return { count: rows.length }
        }
      ),
      findOne: vi.fn(
        async ({ where }: { where: Record<string, any> }) =>
          table(uid).find((d) => match(d, where)) ?? null
      ),
    })),
  }

  const services: Record<string, any> = {}
  const strapi: any = {
    documents,
    db,
    log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    plugin: vi.fn((name: string) => ({
      service: (s: string) => services[`${name}.${s}`],
    })),
    service: vi.fn((uid: string) => services[uid]),
  }
  return { strapi, store, services }
}
```

- [ ] **Step 2: Write the failing test**

`apps/strapi/tests/content-moderation/drafts.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import createService from "../../src/plugins/content-moderation/server/services/submission"
import { payloadHash } from "../../src/plugins/content-moderation/server/utils/payload-hash"
import { makeFakeStrapi } from "../helpers/fake-strapi"

const UID = "plugin::content-moderation.submission"
const sub = (over: Record<string, any>) => ({
  documentId: "s0000000000000000000001",
  submissionType: "wiki_edit",
  submittedByUserId: "u1",
  targetSlug: "a",
  fields: {},
  draftData: {},
  ...over,
})

describe("saveDraft", () => {
  it.each(["pending", "approved", "rejected", "needs_info"])(
    "refuses edits once %s",
    async (status) => {
      const { strapi, store } = makeFakeStrapi({ [UID]: [sub({ status })] })
      const res = await createService({ strapi }).saveDraft(
        "s0000000000000000000001",
        "u1",
        { title: "evil" },
        1
      )
      expect(res).toEqual({ error: "not_draft" })
      expect(store[UID][0].draftData).toEqual({})
    }
  )

  it("refuses edits by another user", async () => {
    const { strapi } = makeFakeStrapi({ [UID]: [sub({ status: "draft" })] })
    expect(
      await createService({ strapi }).saveDraft(
        "s0000000000000000000001",
        "u2",
        {},
        1
      )
    ).toEqual({ error: "forbidden" })
  })

  it("saves while in draft", async () => {
    const { strapi, store } = makeFakeStrapi({
      [UID]: [sub({ status: "draft" })],
    })
    const res = await createService({ strapi }).saveDraft(
      "s0000000000000000000001",
      "u1",
      { title: "ok" },
      2
    )
    expect("data" in res).toBe(true)
    expect(store[UID][0].draftData).toEqual({ title: "ok" })
  })
})

describe("payloadHash on entering review", () => {
  it("is set by create when not a draft", async () => {
    const { strapi, store } = makeFakeStrapi()
    await createService({ strapi }).create({
      submissionType: "correction",
      targetSlug: "x",
      fields: { a: 1 },
      submittedByUserId: "u1",
      submittedByEmail: "e",
    })
    expect(store[UID][0].status).toBe("pending")
    expect(store[UID][0].payloadHash).toBe(payloadHash(store[UID][0]))
  })

  it("is set by finalizeDraft", async () => {
    const { strapi, store } = makeFakeStrapi({
      [UID]: [sub({ status: "draft" })],
    })
    await createService({ strapi }).finalizeDraft(
      "s0000000000000000000001",
      "u1",
      { title: "t" }
    )
    expect(store[UID][0].status).toBe("pending")
    expect(store[UID][0].payloadHash).toBe(payloadHash(store[UID][0]))
  })
})
```

- [ ] **Step 3: Run it and confirm it fails**

Run: `pnpm --filter @repo/strapi test -- tests/content-moderation/drafts.test.ts`
Expected: FAIL. The `saveDraft` signature and the `payloadHash` field don't exist yet.

- [ ] **Step 4: Implement**

In `schema.json`, add inside `attributes`:

```json
"payloadHash": { "type": "string", "private": true },
```

In `services/submission.ts`, add at the top:

```ts
import { payloadHash } from "../utils/payload-hash"
```

Replace `create` (lines 2–23) with:

```ts
  async create(data: {
    submissionType: string
    targetEntityType?: string
    targetDocumentId?: string
    targetSlug?: string
    fields?: Record<string, unknown>
    draftData?: Record<string, unknown>
    note?: string
    verificationMethod?: string
    editSummary?: string
    evidenceType?: string
    evidenceUrl?: string
    submittedByUserId: string
    submittedByEmail: string
    submittedByName?: string
    asDraft?: boolean
  }) {
    const { asDraft, ...rest } = data
    const status = asDraft ? "draft" : "pending"
    return strapi.documents("plugin::content-moderation.submission").create({
      data: {
        ...rest,
        status,
        ...(status === "pending" ? { payloadHash: payloadHash(rest) } : {}),
      },
    })
  },
```

Replace `saveDraft` (lines 421–445) with:

```ts
  async saveDraft(
    documentId: string,
    userId: string,
    draftData: Record<string, unknown>,
    stepCompleted: number
  ): Promise<{ error: "not_found" | "forbidden" | "not_draft" } | { data: unknown }> {
    const existing = await strapi
      .documents("plugin::content-moderation.submission")
      .findOne({ documentId })
    if (!existing) return { error: "not_found" }
    if (existing.submittedByUserId !== userId) return { error: "forbidden" }
    // A1: once a submission is in review (or decided) its content is frozen.
    if (existing.status !== "draft") return { error: "not_draft" }

    const safeDraft =
      draftData && typeof draftData === "object" ? draftData : {}
    const { editSummary, evidenceType, evidenceUrl, note, ...libraryFields } =
      safeDraft as Record<string, unknown>

    const updateData: Record<string, unknown> = {
      draftData: safeDraft,
      stepCompleted,
      fields: libraryFields,
    }
    if (editSummary !== undefined) updateData.editSummary = editSummary
    if (evidenceType !== undefined) updateData.evidenceType = evidenceType
    if (evidenceUrl !== undefined) updateData.evidenceUrl = evidenceUrl
    if (note !== undefined) updateData.note = note

    const data = await strapi
      .documents("plugin::content-moderation.submission")
      .update({ documentId, data: updateData })
    return { data }
  },
```

In `finalizeDraft`, replace the final `return strapi.documents(...).update({...})` (lines 472–475) with:

```ts
const next = { ...existing, ...updateData }
updateData.payloadHash = payloadHash(next)

return strapi.documents("plugin::content-moderation.submission").update({
  documentId,
  data: updateData,
})
```

In `controllers/submission.ts`, replace the body of `saveDraft` (lines 247–268) with:

```ts
  async saveDraft(ctx: any) {
    const user = await resolveUser(strapi, ctx)
    if (!user) return ctx.unauthorized("You must be signed in.")
    const { id } = ctx.params
    if (!isDocumentId(id)) return ctx.badRequest("Invalid id")
    const { draftData, stepCompleted } = (ctx.request.body ?? {}) as {
      draftData?: Record<string, unknown>
      stepCompleted?: number
    }
    const result = await strapi
      .plugin("content-moderation")
      .service("submission")
      .saveDraft(id, user.id, draftData ?? {}, Number(stepCompleted) || 0)
    if ("error" in result) {
      if (result.error === "not_found") return ctx.notFound()
      if (result.error === "forbidden")
        return ctx.forbidden("You do not own this submission.")
      return ctx.conflict("This submission is already in review and can't be edited.")
    }
    ctx.body = { data: result.data }
  },
```

Add at the top of the controller:

```ts
import { isDocumentId } from "../utils/params"
```

`ctx.conflict` is Koa's `ctx.throw(409)` helper. If it's undefined in Strapi's ctx, use `ctx.status = 409; ctx.body = { error: { status: 409, message: "…" } }; return`.

- [ ] **Step 5: Run the tests and confirm they pass**

Run: `pnpm --filter @repo/strapi test -- tests/content-moderation`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/strapi/src/plugins/content-moderation apps/strapi/tests
git commit -m "fix(moderation): freeze submissions once they enter review"
```

---

### Task 4: A2, approvals resolve targets only from reviewed top-level fields

**Files:**

- Create: `apps/strapi/src/plugins/content-moderation/server/utils/wiki-body.ts`
- Modify: `apps/strapi/src/plugins/content-moderation/server/services/submission.ts`:
  - `applyWikiEdit` (lines 671–722)
  - the `library_claim` block (lines 236–280)
  - the `topic_suggestion` block (lines 282–294)
  - the `new_library` image handling (lines 79–86)
- Create: `apps/strapi/src/plugins/content-moderation/server/content-types/submission-upload/schema.json` and add it to `content-types/index.ts`
- Create: route, controller and service method `POST /api/content-moderation/uploads` (secret-gated)
- Modify: `apps/ui/src/app/api/submissions/upload-image/route.ts`
- Test: `apps/strapi/tests/content-moderation/apply-targets.test.ts`

**Interfaces:**

- Consumes: `makeFakeStrapi` (Task 3).
- Produces:
  - `sanitizeWikiBody(body: unknown): unknown[] | null`
  - `service.recordUpload(fileId: number, baUserId: string)`
  - `service.ownedUploadIds(baUserId: string, ids: number[]): Promise<Set<number>>`

- [ ] **Step 1: Write the failing tests**

`apps/strapi/tests/content-moderation/apply-targets.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest"

import createService from "../../src/plugins/content-moderation/server/services/submission"
import { sanitizeWikiBody } from "../../src/plugins/content-moderation/server/utils/wiki-body"
import { makeFakeStrapi } from "../helpers/fake-strapi"

const WIKI = "api::wiki-article.wiki-article"

describe("sanitizeWikiBody", () => {
  it("keeps allowed components, strips ids and clamps heading levels", () => {
    const out = sanitizeWikiBody([
      {
        __component: "content.rich-text",
        id: 9,
        body: [
          {
            type: "heading",
            level: 99,
            children: [{ type: "text", text: "x" }],
          },
        ],
      },
      { __component: "evil.script", html: "<script>" },
    ])
    expect(out).toEqual([
      {
        __component: "content.rich-text",
        body: [
          {
            type: "heading",
            level: 6,
            children: [{ type: "text", text: "x" }],
          },
        ],
      },
    ])
  })
  it("returns null for non-arrays", () => {
    expect(sanitizeWikiBody("x")).toBeNull()
  })
})

describe("applyWikiEdit", () => {
  it("targets submission.targetSlug, ignoring draftData.targetSlug", async () => {
    const { strapi, store } = makeFakeStrapi({
      [WIKI]: [
        {
          documentId: "wa0000000000000000000001",
          id: 1,
          slug: "article-a",
          title: "A",
        },
        {
          documentId: "wa0000000000000000000002",
          id: 2,
          slug: "article-b",
          title: "B",
        },
      ],
      "api::user-profile.user-profile": [],
    })
    strapi.plugin = vi.fn(() => ({
      service: () => ({ find: async () => [{ code: "en" }] }),
    }))
    await createService({ strapi }).applyWikiEdit({
      targetSlug: "article-a",
      draftData: { targetSlug: "article-b", title: "Hijacked", locale: "en" },
      submittedByUserId: "u1",
    })
    expect(store[WIKI][0].title).toBe("Hijacked")
    expect(store[WIKI][1].title).toBe("B")
  })

  it("refuses unknown locales", async () => {
    const { strapi, store } = makeFakeStrapi({
      [WIKI]: [
        {
          documentId: "wa0000000000000000000001",
          id: 1,
          slug: "a",
          title: "A",
        },
      ],
    })
    strapi.plugin = vi.fn(() => ({
      service: () => ({ find: async () => [{ code: "en" }] }),
    }))
    await createService({ strapi }).applyWikiEdit({
      targetSlug: "a",
      draftData: { title: "T", locale: "xx" },
    })
    expect(store[WIKI][0].title).toBe("A")
  })
})
```

- [ ] **Step 2: Run them and confirm they fail**

Run: `pnpm --filter @repo/strapi test -- tests/content-moderation/apply-targets.test.ts`
Expected: FAIL. `wiki-body` is missing, and the article-b title changes.

- [ ] **Step 3: Implement `sanitizeWikiBody`**

`…/server/utils/wiki-body.ts`:

```ts
const ALLOWED_COMPONENTS = new Set([
  "content.rich-text",
  "content.image-block",
  "content.code-block",
  "content.quote-block",
  "content.callout",
])

function clampBlocks(nodes: unknown): unknown {
  if (!Array.isArray(nodes)) return nodes
  return nodes.map((n) => {
    if (!n || typeof n !== "object") return n
    const node = { ...(n as Record<string, unknown>) }
    if (node.type === "heading") {
      const lvl = Number(node.level)
      node.level = Number.isInteger(lvl) ? Math.min(6, Math.max(1, lvl)) : 2
    }
    if ("children" in node) node.children = clampBlocks(node.children)
    return node
  })
}

/** Allowlist dynamic-zone components, drop client-supplied ids, clamp heading levels to 1–6. */
export function sanitizeWikiBody(body: unknown): unknown[] | null {
  if (!Array.isArray(body)) return null
  return body
    .filter(
      (c): c is Record<string, unknown> =>
        !!c &&
        typeof c === "object" &&
        ALLOWED_COMPONENTS.has(String((c as any).__component))
    )
    .map(({ id: _id, ...rest }) => {
      if (rest.__component === "content.rich-text")
        rest.body = clampBlocks(rest.body)
      return rest
    })
}
```

- [ ] **Step 4: Rewrite `applyWikiEdit`**

Replace lines 671–722 of `services/submission.ts`:

```ts
  async applyWikiEdit(submission: any): Promise<void> {
    try {
      // A2: the target is whatever the moderator saw, never draftData.
      const slug: string | undefined = submission.targetSlug ?? undefined
      if (!slug) return
      const draftData = (submission.draftData ?? {}) as Record<string, unknown>

      const locales: { code: string }[] = await strapi
        .plugin("i18n")
        .service("locales")
        .find()
      const locale = typeof draftData.locale === "string" ? draftData.locale : "en"
      if (!locales.some((l) => l.code === locale)) {
        strapi.log.warn(`[content-moderation] applyWikiEdit: unknown locale ${locale}`)
        return
      }

      const [article] = (await strapi
        .documents("api::wiki-article.wiki-article" as any)
        .findMany({ filters: { slug: { $eq: slug } } as any, limit: 1 })) as any[]
      if (!article) return

      const updateData: Record<string, unknown> = {}
      if (typeof draftData.title === "string" && draftData.title.trim())
        updateData.title = draftData.title.trim().slice(0, 200)
      const body = sanitizeWikiBody(draftData.body)
      if (body) updateData.body = body
      if (Object.keys(updateData).length === 0) return

      await strapi.documents("api::wiki-article.wiki-article" as any).update({
        documentId: article.documentId,
        locale,
        status: "published",
        data: updateData,
      })

      if (submission.submittedByUserId) {
        const [profile] = (await strapi
          .documents("api::user-profile.user-profile")
          .findMany({
            filters: { baUserId: { $eq: submission.submittedByUserId } } as any,
            fields: ["documentId"] as any,
            limit: 1,
          })) as any[]
        if (profile)
          await strapi.documents("api::wiki-article.wiki-article" as any).update({
            documentId: article.documentId,
            locale,
            data: { contributors: { connect: [{ documentId: profile.documentId }] } },
          })
      }
    } catch (err) {
      strapi.log.error("[content-moderation] applyWikiEdit failed", err)
    }
  },
```

Add the import `import { sanitizeWikiBody } from "../utils/wiki-body"`.

- [ ] **Step 5: Fix the claim and topic targets**

In the `library_claim` block, replace the `targetLibrary` lookup (lines 242–247) with:

```ts
// A2: resolve by the reviewed targetDocumentId, never fields.entityRef.
const targetLibrary = submission.targetDocumentId
  ? await strapi.documents("api::library.library").findOne({
      documentId: submission.targetDocumentId,
      fields: ["id", "documentId"] as any,
    })
  : null
if (!targetLibrary) {
  strapi.log.warn(
    `[content-moderation] claim ${documentId} has no valid targetDocumentId; skipping affiliation`
  )
}
```

Then wrap the affiliation creation so it only runs `if (targetLibrary)`. Task 12 replaces this block with an upsert, so keep the change minimal here.

In the `topic_suggestion` block, replace `fields.topicDocumentId` with `submission.targetDocumentId`:

```ts
if (submission.targetEntityType === "topic" && submission.targetDocumentId) {
  await strapi.documents("api::topic.topic").update({
    documentId: submission.targetDocumentId,
    data: { status: "approved" },
  })
}
```

If `targetEntityType` doesn't include `topic`, add `"topic"` to the `targetEntityType` enum in `schema.json`.

- [ ] **Step 6: Upload ownership for new-library images**

Create `content-types/submission-upload/schema.json`:

```json
{
  "kind": "collectionType",
  "collectionName": "cm_submission_uploads",
  "info": {
    "singularName": "submission-upload",
    "pluralName": "submission-uploads",
    "displayName": "Submission Upload"
  },
  "options": { "draftAndPublish": false },
  "pluginOptions": {
    "content-manager": { "visible": false },
    "content-type-builder": { "visible": false }
  },
  "attributes": {
    "fileId": { "type": "integer", "required": true, "unique": true },
    "baUserId": { "type": "string", "required": true }
  }
}
```

Register it in `content-types/index.ts` next to `submission`:

```ts
import submissionUpload from "./submission-upload/schema.json"
// …
export default {
  submission: { schema: submission },
  "submission-upload": { schema: submissionUpload },
}
```

Match the existing export shape in that file. If it uses a different import style, mirror it.

Add service methods to `services/submission.ts`:

```ts
  async recordUpload(fileId: number, baUserId: string) {
    return strapi
      .documents("plugin::content-moderation.submission-upload" as any)
      .create({ data: { fileId, baUserId } })
  },

  async ownedUploadIds(baUserId: string, ids: number[]): Promise<Set<number>> {
    if (ids.length === 0) return new Set()
    const rows = (await strapi
      .documents("plugin::content-moderation.submission-upload" as any)
      .findMany({ filters: { baUserId: { $eq: baUserId }, fileId: { $in: ids } } as any, limit: ids.length })) as { fileId: number }[]
    return new Set(rows.map((r) => r.fileId))
  },
```

In `updateStatus`, replace lines 80–86 (the `uploadedImages` parsing) with:

```ts
type UploadedImage = { strapiId: number; url: string; isHero: boolean }
const claimed = Array.isArray(f.uploadedImages)
  ? (f.uploadedImages as UploadedImage[])
  : []
// A2: only attach files this submitter uploaded through the submission flow.
const owned = await (this as any).ownedUploadIds(
  submission.submittedByUserId,
  claimed.map((i) => Number(i.strapiId)).filter(Number.isInteger)
)
const uploadedImages = claimed.filter((i) => owned.has(Number(i.strapiId)))
const heroImage =
  uploadedImages.find((img) => img.isHero) ?? uploadedImages[0] ?? null
const galleryImages = uploadedImages.filter((img) => img !== heroImage)
```

Add the controller `recordUpload` to `controllers/submission.ts`:

```ts
  // POST /api/content-moderation/uploads  (content-api, secret-gated)
  async recordUpload(ctx: any) {
    const user = await resolveUser(strapi, ctx)
    if (!user) return ctx.unauthorized()
    const fileId = Number((ctx.request.body as any)?.fileId)
    if (!Number.isInteger(fileId)) return ctx.badRequest("fileId required")
    await strapi.plugin("content-moderation").service("submission").recordUpload(fileId, user.id)
    ctx.body = { ok: true }
  },
```

Add the route to `routes/content-api.ts`:

```ts
  {
    method: "POST",
    path: "/uploads",
    handler: "submission.recordUpload",
    config: { auth: false, policies: [] },
  },
```

In `apps/ui/src/app/api/submissions/upload-image/route.ts`, after `const first = uploaded[0]` and its guard, before the final `return`, add:

```ts
const secret = process.env.STRAPI_BRIDGE_SECRET
if (secret) {
  await fetch(`${STRAPI}/api/content-moderation/uploads`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Service-Secret": secret,
      "X-Ba-User-Id": session.user.id,
      "X-Ba-User-Email": session.user.email,
    },
    body: JSON.stringify({ fileId: first.id }),
  })
}
```

- [ ] **Step 7: Run the tests and confirm they pass**

Run: `pnpm --filter @repo/strapi test -- tests/content-moderation`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/strapi/src/plugins/content-moderation apps/strapi/tests apps/ui/src/app/api/submissions/upload-image/route.ts
git commit -m "fix(moderation): resolve approval targets from reviewed fields only"
```

---

### Task 5: A3, approval runs once (compare-and-set plus hash check)

**Files:**

- Modify: `apps/strapi/src/plugins/content-moderation/server/services/submission.ts:46-61`
- Modify: `apps/strapi/src/plugins/content-moderation/server/controllers/submission.ts:199-224`
- Test: `apps/strapi/tests/content-moderation/approve-once.test.ts`

**Interfaces:**

- Consumes: `canTransition`, `REVIEWABLE` (Task 2); `payloadHash` (Task 2); `payloadHash` stored on entry to review (Task 3).
- Produces: `service.updateStatus(...)` returns `{ error: "not_found" | "invalid_transition" | "conflict" | "tampered" } | { data }`. Side effects run only when the compare-and-set wins.

- [ ] **Step 1: Write the failing test**

`apps/strapi/tests/content-moderation/approve-once.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest"

import createService from "../../src/plugins/content-moderation/server/services/submission"
import { payloadHash } from "../../src/plugins/content-moderation/server/utils/payload-hash"
import { makeFakeStrapi } from "../helpers/fake-strapi"

const UID = "plugin::content-moderation.submission"
const pending = () => {
  const s: any = {
    documentId: "s0000000000000000000001",
    submissionType: "correction",
    status: "pending",
    submittedByUserId: "u1",
    targetSlug: "x",
    fields: { a: 1 },
    draftData: null,
  }
  s.payloadHash = payloadHash(s)
  return s
}

function setup(seed = pending()) {
  const f = makeFakeStrapi({ [UID]: [seed] })
  const award = vi.fn(async () => {})
  f.services["rewards.points"] = { award }
  f.services["api::user-profile.quick-wins"] = {
    computeAndSave: vi.fn(async () => {}),
  }
  return { ...f, award, svc: createService({ strapi: f.strapi }) }
}

describe("updateStatus", () => {
  it("awards points exactly once across two approvals", async () => {
    const { svc, award } = setup()
    const a = await svc.updateStatus(
      "s0000000000000000000001",
      "approved",
      "admin1"
    )
    const b = await svc.updateStatus(
      "s0000000000000000000001",
      "approved",
      "admin1"
    )
    expect("data" in a).toBe(true)
    expect(b).toEqual({ error: "invalid_transition" })
    expect(award).toHaveBeenCalledTimes(1)
  })

  it("refuses to re-open a decided submission", async () => {
    const { svc } = setup({ ...pending(), status: "approved" })
    expect(
      await svc.updateStatus("s0000000000000000000001", "pending", "admin1")
    ).toEqual({ error: "invalid_transition" })
  })

  it("refuses to approve if the payload changed after review started", async () => {
    const tampered = { ...pending(), fields: { a: 999 } }
    const { svc, award } = setup(tampered)
    expect(
      await svc.updateStatus("s0000000000000000000001", "approved", "admin1")
    ).toEqual({ error: "tampered" })
    expect(award).not.toHaveBeenCalled()
  })

  it("passes an idempotency key to rewards", async () => {
    const { svc, award } = setup()
    await svc.updateStatus("s0000000000000000000001", "approved", "admin1")
    expect(award).toHaveBeenCalledWith(
      "u1",
      "correction_approved",
      2,
      expect.anything(),
      "s0000000000000000000001:correction_approved"
    )
  })
})
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `pnpm --filter @repo/strapi test -- tests/content-moderation/approve-once.test.ts`
Expected: FAIL. `award` is called twice, and the result shape doesn't match.

- [ ] **Step 3: Implement the guard**

Replace the start of `updateStatus` (lines 46–61) with:

```ts
  async updateStatus(
    documentId: string,
    status: "approved" | "rejected" | "needs_info" | "pending",
    reviewedByUserId: string,
    reviewNote?: string
  ): Promise<{ error: "not_found" | "invalid_transition" | "conflict" | "tampered" } | { data: unknown }> {
    const submission = await strapi
      .documents("plugin::content-moderation.submission")
      .findOne({ documentId })
    if (!submission) return { error: "not_found" }
    if (!canTransition(submission.status, status)) return { error: "invalid_transition" }
    if (
      status === "approved" &&
      submission.payloadHash &&
      submission.payloadHash !== payloadHash(submission)
    )
      return { error: "tampered" }

    // Compare-and-set: only one concurrent request can move it out of `submission.status`.
    // Submissions have draftAndPublish:false, so the db layer sees the same row as documents().
    const { count } = await strapi.db
      .query("plugin::content-moderation.submission")
      .updateMany({
        where: { documentId, status: submission.status },
        data: { status, reviewedByUserId, reviewNote, reviewedAt: new Date() },
      })
    if (count !== 1) return { error: "conflict" }
    const updated = { ...submission, status, reviewedByUserId, reviewNote }
```

Add the imports:

```ts
import { canTransition } from "../utils/transitions"
```

At the very end of `updateStatus`, change `return updated` to `return { data: updated }`.

In every `rewards.points.award(...)` call inside `updateStatus`, add a fifth argument `` `${documentId}:${action}` ``. For the literal-action calls, use the literal string:

- `award(submission.submittedByUserId, "new_library_approved", 50, {...}, `${documentId}:new_library_approved`)`
- `award(..., action, pts, {...}, `${documentId}:${action}`)` for `library_edit`
- `award(..., "correction_approved", 2, {...}, `${documentId}:correction_approved`)`
- `award(..., "claim_approved", 10, {...}, `${documentId}:claim_approved`)`
- for `wiki_edit`, compute `const wikiAction = isTranslation ? "wiki_translated" : "edit_accepted_minor"` and pass `` `${documentId}:${wikiAction}` ``

In `controllers/submission.ts`, replace `updateStatus` (lines 199–224) with:

```ts
  async updateStatus(ctx: any) {
    const { id } = ctx.params
    if (!isDocumentId(id)) return ctx.badRequest("Invalid id")
    const { status, reviewNote } = (ctx.request.body ?? {}) as { status: string; reviewNote?: string }

    const VALID_STATUSES = ["approved", "rejected", "needs_info", "pending"]
    if (!VALID_STATUSES.includes(status))
      return ctx.badRequest(`Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}`)

    const admin = ctx.state.user ?? ctx.state.admin
    const reviewerId = String(admin?.id ?? "unknown")

    const result = await strapi
      .plugin("content-moderation")
      .service("submission")
      .updateStatus(id, status, reviewerId, reviewNote)

    if ("error" in result) {
      if (result.error === "not_found") return ctx.notFound()
      ctx.status = 409
      ctx.body = { error: { status: 409, name: result.error, message: `Cannot change status: ${result.error}` } }
      return
    }
    ctx.body = { data: result.data }
  },
```

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `pnpm --filter @repo/strapi test -- tests/content-moderation`
Expected: PASS. Earlier tests still pass.

- [ ] **Step 5: Check the admin panel caller**

Run: `grep -rn "submissions/.*status\|updateStatus" apps/strapi/src/plugins/content-moderation/admin/src | head`
For each caller that reads `res.data.data`: the shape is unchanged for success, `{ data }`. Add handling so a 409 shows the error message with the existing notification/toast helper in that file.

- [ ] **Step 6: Commit**

```bash
git add apps/strapi/src/plugins/content-moderation apps/strapi/tests
git commit -m "fix(moderation): approvals run once and refuse tampered payloads"
```

---

### Task 6: A3, idempotent, atomic point awards

**Files:**

- Modify: `apps/strapi/src/plugins/rewards/server/content-types/point-event/schema.json`
- Modify: `apps/strapi/src/plugins/rewards/server/services/points.ts:92-167`
- Test: `apps/strapi/tests/rewards/award.test.ts`

**Interfaces:**

- Produces: `award(baUserId, action, pts, metadata?, idempotencyKey?)`. It returns `{ awarded: boolean }`. If `idempotencyKey` has been seen before, nothing happens and it returns `{ awarded: false }`. The points total is incremented atomically.

- [ ] **Step 1: Write the failing test**

`apps/strapi/tests/rewards/award.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest"

import createPoints from "../../src/plugins/rewards/server/services/points"

function fakeStrapi() {
  const events: any[] = []
  const profile = {
    baUserId: "u1",
    points: 0,
    pointsThisMonth: 0,
    lastActivityDate: null,
  }
  const increment = vi.fn(async (col: string, by: number) => {
    ;(profile as any)[col] += by
  })
  const knex: any = vi.fn(() => ({
    where: () => ({ increment, update: vi.fn(async () => {}) }),
  }))
  const strapi: any = {
    db: {
      connection: knex,
      query: vi.fn((uid: string) => ({
        findOne: vi.fn(async ({ where }: any) =>
          uid.includes("point-event")
            ? (events.find((e) => e.idempotencyKey === where.idempotencyKey) ??
              null)
            : profile
        ),
        create: vi.fn(async ({ data }: any) => {
          events.push(data)
          return data
        }),
        update: vi.fn(async ({ data }: any) => Object.assign(profile, data)),
        count: vi.fn(async () => 1),
      })),
    },
    log: { warn: vi.fn(), error: vi.fn() },
    plugin: () => ({
      service: () => ({ checkAndAward: vi.fn(async () => {}) }),
    }),
  }
  return { strapi, events, profile }
}

describe("points.award", () => {
  it("is idempotent per key", async () => {
    const { strapi, events, profile } = fakeStrapi()
    const svc: any = createPoints({ strapi })
    svc.updateStreak = vi.fn(async () => 1)
    expect(
      await svc.award(
        "u1",
        "correction_approved",
        2,
        {},
        "s1:correction_approved"
      )
    ).toEqual({ awarded: true })
    expect(
      await svc.award(
        "u1",
        "correction_approved",
        2,
        {},
        "s1:correction_approved"
      )
    ).toEqual({ awarded: false })
    expect(events).toHaveLength(1)
    expect(profile.points).toBe(2)
  })
})
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `pnpm --filter @repo/strapi test -- tests/rewards/award.test.ts`
Expected: FAIL. `award` returns undefined and creates two events.

- [ ] **Step 3: Implement**

In `point-event/schema.json`, add the attribute and the enum values:

```json
    "idempotencyKey": { "type": "string", "unique": true, "private": true },
```

Add `"correction_approved"` and `"claim_approved"` to the `action` enum, after `"edit_accepted_major"`.

Replace `award` in `points.ts` (lines 92–167) with:

```ts
  async award(
    baUserId: string,
    action: PointAction,
    pts: number,
    metadata?: Record<string, unknown>,
    idempotencyKey?: string
  ): Promise<{ awarded: boolean }> {
    const now = new Date()

    if (idempotencyKey) {
      const seen = await strapi.db
        .query("plugin::rewards.point-event")
        .findOne({ where: { idempotencyKey } })
      if (seen) return { awarded: false }
    }

    try {
      await strapi.db.query("plugin::rewards.point-event").create({
        data: { baUserId, action, points: pts, metadata: metadata ?? null, awardedAt: now, idempotencyKey: idempotencyKey ?? null },
      })
    } catch (err) {
      // Unique violation on idempotencyKey: a concurrent award won the race.
      if (idempotencyKey) return { awarded: false }
      throw err
    }

    let profile = await strapi.db
      .query("api::user-profile.user-profile")
      .findOne({ where: { baUserId } })
    if (!profile) {
      strapi.log.warn(`[rewards] No user-profile for ${baUserId}; creating minimal record`)
      try {
        const count = await strapi.db.query("api::user-profile.user-profile").count()
        profile = await strapi.db.query("api::user-profile.user-profile").create({
          data: { baUserId, username: `contributor${count + 1}`, contributorNumber: count + 1 },
        })
      } catch (createErr) {
        strapi.log.error(`[rewards] Failed to create fallback profile for ${baUserId}:`, createErr)
        return { awarded: true }
      }
    }

    const today = now.toISOString().slice(0, 10)
    const currentMonth = today.slice(0, 7)
    const sameMonth = profile.lastActivityDate?.slice(0, 7) === currentMonth

    // Atomic increments: concurrent awards can't lose updates.
    await strapi.db.connection("user_profiles").where({ ba_user_id: baUserId }).increment("points", pts)
    if (sameMonth) {
      await strapi.db.connection("user_profiles").where({ ba_user_id: baUserId }).increment("points_this_month", pts)
    } else {
      await strapi.db.connection("user_profiles").where({ ba_user_id: baUserId }).update({ points_this_month: pts })
    }

    const fresh = await strapi.db.query("api::user-profile.user-profile").findOne({ where: { baUserId } })
    const newStreak = await (this as any).updateStreak(baUserId)
    await strapi.db.query("api::user-profile.user-profile").update({
      where: { baUserId },
      data: { tier: computeTier(fresh?.points ?? 0).name, streak: newStreak, lastActivityDate: today },
    })

    await strapi.plugin("rewards").service("badges").checkAndAward(baUserId)
    return { awarded: true }
  },
```

- [ ] **Step 4: Verify the column names against the database**

Run: `docker exec -i $(docker ps -qf name=postgres | head -1) psql -U postgres -d strapi -c "\d user_profiles" | grep -E "points|ba_user_id"`
(Adjust the container name, user and database from `apps/strapi/.env`: `DATABASE_*`.)
Expected: the columns `ba_user_id`, `points` and `points_this_month` exist. If the names differ, update the knex calls to match.

- [ ] **Step 5: Run the tests and confirm they pass**

Run: `pnpm --filter @repo/strapi test -- tests/rewards tests/content-moderation`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/strapi/src/plugins/rewards apps/strapi/tests/rewards
git commit -m "fix(rewards): idempotent point awards with atomic increments"
```

---

### Task 7: A4, admin permissions enforced, and no self-approval

**Files:**

- Modify: `apps/strapi/src/plugins/content-moderation/server/routes/admin.ts`
- Modify: `apps/strapi/src/plugins/rewards/server/routes/admin.ts`
- Modify: `apps/strapi/src/plugins/content-moderation/server/controllers/submission.ts` (`updateStatus`)
- Test: `apps/strapi/tests/content-moderation/admin-routes.test.ts`

**Interfaces:**

- Produces: admin routes require `plugin::content-moderation.read` or `plugin::content-moderation.update`, and `plugin::rewards.read` or `plugin::rewards.award`.

- [ ] **Step 1: Write the failing test**

`apps/strapi/tests/content-moderation/admin-routes.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import cmRoutes from "../../src/plugins/content-moderation/server/routes/admin"
import rwRoutes from "../../src/plugins/rewards/server/routes/admin"

const perm = (r: any) =>
  r.config.policies.find(
    (p: any) => typeof p === "object" && p.name === "admin::hasPermissions"
  )?.config.actions

describe("admin routes", () => {
  it("every moderation route checks a permission", () => {
    for (const r of cmRoutes) expect(perm(r)?.length).toBeGreaterThan(0)
    expect(
      perm(cmRoutes.find((r: any) => r.path === "/submissions/:id/status"))
    ).toEqual(["plugin::content-moderation.update"])
  })
  it("every rewards route checks a permission, and award needs award", () => {
    for (const r of rwRoutes) expect(perm(r)?.length).toBeGreaterThan(0)
    expect(perm(rwRoutes.find((r: any) => r.path === "/award"))).toEqual([
      "plugin::rewards.award",
    ])
  })
})
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `pnpm --filter @repo/strapi test -- tests/content-moderation/admin-routes.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

`content-moderation/server/routes/admin.ts`:

```ts
const can = (action: "read" | "update") => [
  "admin::isAuthenticatedAdmin",
  {
    name: "admin::hasPermissions",
    config: { actions: [`plugin::content-moderation.${action}`] },
  },
]

export default [
  {
    method: "GET",
    path: "/submissions",
    handler: "submission.findAll",
    config: { policies: can("read") },
  },
  {
    method: "PUT",
    path: "/submissions/:id/status",
    handler: "submission.updateStatus",
    config: { policies: can("update") },
  },
  {
    method: "GET",
    path: "/relation-labels",
    handler: "submission.relationLabels",
    config: { policies: can("read") },
  },
]
```

`rewards/server/routes/admin.ts`:

```ts
const can = (action: "read" | "award") => [
  "admin::isAuthenticatedAdmin",
  {
    name: "admin::hasPermissions",
    config: { actions: [`plugin::rewards.${action}`] },
  },
]

export default [
  {
    method: "GET",
    path: "/events",
    handler: "rewards.adminEvents",
    config: { policies: can("read") },
  },
  {
    method: "PUT",
    path: "/award",
    handler: "rewards.adminAward",
    config: { policies: can("award") },
  },
  {
    method: "GET",
    path: "/stats",
    handler: "rewards.adminStats",
    config: { policies: can("read") },
  },
  {
    method: "GET",
    path: "/chart-data",
    handler: "rewards.adminChartData",
    config: { policies: can("read") },
  },
  {
    method: "POST",
    path: "/snapshot",
    handler: "rewards.adminTakeSnapshot",
    config: { policies: can("award") },
  },
]
```

Self-approval block. In `controllers/submission.ts` `updateStatus`, after `const admin = …` and before calling the service, add:

```ts
const target = await strapi
  .documents("plugin::content-moderation.submission")
  .findOne({ documentId: id })
if (
  target &&
  admin?.email &&
  target.submittedByEmail &&
  String(admin.email).toLowerCase() ===
    String(target.submittedByEmail).toLowerCase()
)
  return ctx.forbidden("You can't review your own submission.")
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `pnpm --filter @repo/strapi test -- tests/content-moderation/admin-routes.test.ts`
Expected: PASS.

- [ ] **Step 5: Verify manually**

Run: `pnpm --filter @repo/strapi build:plugins && pnpm --filter @repo/strapi develop`
In the admin panel, go to Settings → Roles → Super Admin and confirm that "Content Moderation → Update submission status" and "Rewards → award" appear and are ticked. Approving as Super Admin still works. Create an Author-role admin with no plugin permissions: approving returns 403.

- [ ] **Step 6: Commit**

```bash
git add apps/strapi/src/plugins apps/strapi/tests/content-moderation/admin-routes.test.ts
git commit -m "fix(moderation): enforce admin permissions and block self-review"
```

---

### Task 8: A5 and A6, submission policy (role, claim and quota) inside Strapi

**Files:**

- Create: `apps/strapi/src/plugins/content-moderation/server/services/submission-policy.ts`
- Modify: `apps/strapi/src/plugins/content-moderation/server/services/index.ts` (register it)
- Modify: `apps/strapi/src/plugins/content-moderation/server/controllers/submission.ts` (`create`, `finalize`)
- Test: `apps/strapi/tests/content-moderation/policy.test.ts`

**Interfaces:**

- Consumes: `resolveCapabilities`, `canSubmit`, `isSubmissionType`, `contributionLimits`, `isContributorRole` from `@repo/access`; `VERIFICATION_METHODS` and `isDocumentId` (Task 2).
- Produces: `policy.check({ baUserId, submissionType, targetDocumentId, directWikiEdit, verificationMethod }): Promise<{ ok: true } | { ok: false; status: 400 | 403 | 429; message: string }>`

- [ ] **Step 1: Write the failing test**

`apps/strapi/tests/content-moderation/policy.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import createPolicy from "../../src/plugins/content-moderation/server/services/submission-policy"
import { makeFakeStrapi } from "../helpers/fake-strapi"

const PROFILE = "api::user-profile.user-profile"
const AFF = "api::library-affiliation.library-affiliation"
const SUB = "plugin::content-moderation.submission"

function setup(role = "reader", claims: string[] = [], pending = 0) {
  const { strapi } = makeFakeStrapi({
    [PROFILE]: [
      {
        documentId: "p0000000000000000000001",
        baUserId: "u1",
        contributorRole: role,
        tier: "Reader",
      },
    ],
    [AFF]: claims.map((lib, i) => ({
      documentId: `a${i}`,
      baUserId: "u1",
      library: { documentId: lib },
    })),
    [SUB]: Array.from({ length: pending }, (_, i) => ({
      documentId: `s${i}`,
      submittedByUserId: "u1",
      status: "pending",
    })),
  })
  return createPolicy({ strapi })
}

describe("submission policy", () => {
  it("rejects unknown types", async () => {
    expect(
      await setup().check({ baUserId: "u1", submissionType: "evil" })
    ).toMatchObject({ ok: false, status: 400 })
  })
  it("blocks direct wiki edits for readers", async () => {
    expect(
      await setup().check({
        baUserId: "u1",
        submissionType: "wiki_edit",
        directWikiEdit: true,
      })
    ).toMatchObject({ ok: false, status: 403 })
  })
  it("allows direct wiki edits for wiki_editor", async () => {
    expect(
      await setup("wiki_editor").check({
        baUserId: "u1",
        submissionType: "wiki_edit",
        directWikiEdit: true,
      })
    ).toEqual({ ok: true })
  })
  it("requires a claim for library_edit", async () => {
    expect(
      await setup("verified_librarian", ["lib0000000000000000000001"]).check({
        baUserId: "u1",
        submissionType: "library_edit",
        targetDocumentId: "lib0000000000000000000002",
      })
    ).toMatchObject({ ok: false, status: 403 })
    expect(
      await setup("verified_librarian", ["lib0000000000000000000001"]).check({
        baUserId: "u1",
        submissionType: "library_edit",
        targetDocumentId: "lib0000000000000000000001",
      })
    ).toEqual({ ok: true })
  })
  it("rejects unknown verification methods", async () => {
    expect(
      await setup().check({
        baUserId: "u1",
        submissionType: "library_claim",
        verificationMethod: "trust_me",
      })
    ).toMatchObject({ ok: false, status: 400 })
  })
  it("enforces the tier pending quota", async () => {
    expect(
      await setup("reader", [], 5).check({
        baUserId: "u1",
        submissionType: "correction",
      })
    ).toMatchObject({ ok: false, status: 429 })
  })
})
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `pnpm --filter @repo/strapi test -- tests/content-moderation/policy.test.ts`
Expected: FAIL, because the module is missing.

- [ ] **Step 3: Implement**

`…/server/services/submission-policy.ts`:

```ts
import {
  canSubmit,
  contributionLimits,
  isContributorRole,
  isSubmissionType,
  resolveCapabilities,
} from "@repo/access"

import { isDocumentId, VERIFICATION_METHODS } from "../utils/params"

type Result =
  | { ok: true }
  | { ok: false; status: 400 | 403 | 429; message: string }

export default ({ strapi }: { strapi: any }) => ({
  async check(input: {
    baUserId: string
    submissionType: unknown
    targetDocumentId?: unknown
    directWikiEdit?: boolean
    verificationMethod?: unknown
  }): Promise<Result> {
    const { baUserId, submissionType } = input
    if (!isSubmissionType(submissionType))
      return { ok: false, status: 400, message: "Unknown submission type" }
    if (input.targetDocumentId != null && !isDocumentId(input.targetDocumentId))
      return { ok: false, status: 400, message: "Invalid target" }
    if (
      input.verificationMethod != null &&
      !(VERIFICATION_METHODS as readonly string[]).includes(
        String(input.verificationMethod)
      )
    )
      return { ok: false, status: 400, message: "Invalid verification method" }

    const [profile] = (await strapi
      .documents("api::user-profile.user-profile")
      .findMany({
        filters: { baUserId: { $eq: baUserId } },
        fields: ["contributorRole", "tier"],
        limit: 1,
      })) as { contributorRole?: string; tier?: string }[]

    const affiliations = (await strapi
      .documents("api::library-affiliation.library-affiliation")
      .findMany({
        filters: { baUserId: { $eq: baUserId } },
        populate: { library: { fields: ["documentId"] } },
        limit: 100,
      })) as { library?: { documentId?: string } }[]

    const caps = resolveCapabilities({
      signedIn: true,
      contributorRole: isContributorRole(profile?.contributorRole)
        ? (profile!.contributorRole as any)
        : "reader",
      claims: affiliations
        .map((a) => a.library?.documentId)
        .filter((id): id is string => !!id)
        .map((libraryDocumentId) => ({ libraryDocumentId })),
    })
    if (
      !canSubmit(caps, submissionType, {
        libraryDocumentId:
          typeof input.targetDocumentId === "string"
            ? input.targetDocumentId
            : undefined,
        directWikiEdit: !!input.directWikiEdit,
      })
    )
      return {
        ok: false,
        status: 403,
        message: "You can't submit this type of change.",
      }

    const limits = contributionLimits(profile?.tier ?? null)
    const pending = await strapi
      .documents("plugin::content-moderation.submission")
      .count({
        filters: {
          submittedByUserId: { $eq: baUserId },
          status: { $in: ["pending", "needs_info"] },
        },
      })
    if (pending >= limits.pendingSubmissions)
      return {
        ok: false,
        status: 429,
        message: `You have ${pending} submissions in review. Wait for some to be reviewed before adding more.`,
      }

    const hourAgo = new Date(Date.now() - 3600_000).toISOString()
    const lastHour = await strapi
      .documents("plugin::content-moderation.submission")
      .count({
        filters: {
          submittedByUserId: { $eq: baUserId },
          createdAt: { $gte: hourAgo },
        },
      })
    if (lastHour >= limits.submissionsPerHour)
      return {
        ok: false,
        status: 429,
        message: "Too many submissions this hour. Try again later.",
      }

    return { ok: true }
  },
})
```

The fake strapi's `match` ignores `$gte`. Extend `makeFakeStrapi`'s `match` in `tests/helpers/fake-strapi.ts` with:

```ts
if (v && typeof v === "object" && "$gte" in v)
  return String(d[k] ?? "") >= String(v.$gte)
```

Also make the fake `findMany` resolve `filters.baUserId.$eq` against `library` docs as stored. It already does, through `match`.

Register it in `services/index.ts`:

```ts
import submission from "./submission"
import submissionPolicy from "./submission-policy"

export default { submission, "submission-policy": submissionPolicy }
```

In `controllers/submission.ts` `create`, after the `if (!submissionType)` check, add:

```ts
const directWikiEdit =
  submissionType === "wiki_edit" &&
  Array.isArray((ctx.request.body as any)?.draftData?.body)
const verdict = await strapi
  .plugin("content-moderation")
  .service("submission-policy")
  .check({
    baUserId: user.id,
    submissionType,
    targetDocumentId,
    directWikiEdit,
    verificationMethod,
  })
if (!verdict.ok) {
  ctx.status = verdict.status
  ctx.body = { error: { status: verdict.status, message: verdict.message } }
  return
}
```

Also pass `draftData` through from the body to `service.create` by adding `draftData` to the destructured body and to the `create({...})` call. This is needed by C-D1 later, and it's policy-checked now.

In `finalize`, before calling `finalizeDraft`, load the draft and re-check the policy. This catches a reader who created an empty `wiki_edit` draft and then saved a block body into it:

```ts
if (!isDocumentId(id)) return ctx.badRequest("Invalid id")
const draft = await strapi
  .documents("plugin::content-moderation.submission")
  .findOne({ documentId: id })
if (draft) {
  const directWikiEdit =
    draft.submissionType === "wiki_edit" && Array.isArray(draft.draftData?.body)
  const verdict = await strapi
    .plugin("content-moderation")
    .service("submission-policy")
    .check({
      baUserId: user.id,
      submissionType: draft.submissionType,
      targetDocumentId: draft.targetDocumentId ?? undefined,
      directWikiEdit,
    })
  if (!verdict.ok) {
    ctx.status = verdict.status
    ctx.body = { error: { status: verdict.status, message: verdict.message } }
    return
  }
}
```

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `pnpm --filter @repo/strapi test`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/strapi/src/plugins/content-moderation apps/strapi/tests
git commit -m "fix(moderation): enforce contribution policy and quotas in Strapi"
```

---

### Task 9: A7 and A6, validate bridge path params and cap bodies in Next

**Files:**

- Create: `apps/ui/src/lib/bridge-params.ts`
- Test: `apps/ui/src/lib/__tests__/bridge-params.test.ts`
- Modify: `apps/ui/src/app/api/submissions/draft/[type]/route.ts`
- Modify: `apps/ui/src/app/api/submissions/[id]/draft/route.ts`
- Modify: `apps/ui/src/app/api/submissions/[id]/finalize/route.ts`
- Modify: `apps/ui/src/app/api/submissions/route.ts`
- Modify: `apps/ui/src/app/api/profile/me/notifications/route.ts`

**Interfaces:**

- Produces:
  - `isSubmissionTypeParam(v: string): boolean`
  - `isDocumentIdParam(v: string): boolean`
  - `readJsonCapped(req: Request, maxBytes: number): Promise<{ ok: true; body: unknown } | { ok: false; status: 400 | 413 }>`

- [ ] **Step 1: Write the failing test**

`apps/ui/src/lib/__tests__/bridge-params.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import {
  isDocumentIdParam,
  isSubmissionTypeParam,
  readJsonCapped,
} from "@/lib/bridge-params"

describe("bridge params", () => {
  it("rejects traversal in submission types", () => {
    expect(isSubmissionTypeParam("wiki_edit")).toBe(true)
    expect(
      isSubmissionTypeParam("../../auth-bridge/user-affiliations?baUserId=x")
    ).toBe(false)
  })
  it("accepts only document ids", () => {
    expect(isDocumentIdParam("um66mf6ytj5r7ct0rrgxxh8u")).toBe(true)
    expect(isDocumentIdParam("..%2F..")).toBe(false)
    expect(isDocumentIdParam("../x")).toBe(false)
  })
  it("caps body size", async () => {
    const big = new Request("http://x", {
      method: "POST",
      body: JSON.stringify({ a: "x".repeat(2000) }),
    })
    expect(await readJsonCapped(big, 1000)).toEqual({ ok: false, status: 413 })
    const bad = new Request("http://x", { method: "POST", body: "{" })
    expect(await readJsonCapped(bad, 1000)).toEqual({ ok: false, status: 400 })
    const ok = new Request("http://x", { method: "POST", body: '{"a":1}' })
    expect(await readJsonCapped(ok, 1000)).toEqual({ ok: true, body: { a: 1 } })
  })
})
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `pnpm --filter @repo/ui test -- src/lib/__tests__/bridge-params.test.ts`
Expected: FAIL, because the module is missing.

- [ ] **Step 3: Implement**

`apps/ui/src/lib/bridge-params.ts`:

```ts
import { isSubmissionType } from "@repo/access"

const DOCUMENT_ID = /^[a-z0-9]{20,32}$/

export const isSubmissionTypeParam = (v: string) => isSubmissionType(v)
export const isDocumentIdParam = (v: string) => DOCUMENT_ID.test(v)

export async function readJsonCapped(
  req: Request,
  maxBytes: number
): Promise<{ ok: true; body: unknown } | { ok: false; status: 400 | 413 }> {
  const text = await req.text()
  if (new TextEncoder().encode(text).length > maxBytes)
    return { ok: false, status: 413 }
  try {
    return { ok: true, body: JSON.parse(text) }
  } catch {
    return { ok: false, status: 400 }
  }
}
```

Add `"@repo/access": "workspace:*"` to `apps/ui/package.json` `dependencies`, then run `pnpm install && pnpm --filter @repo/access build`.

In `submissions/draft/[type]/route.ts`, after `const { type } = await params`:

```ts
if (!isSubmissionTypeParam(type))
  return NextResponse.json(
    { error: "Invalid submission type" },
    { status: 400 }
  )
```

Build the URL with `encodeURIComponent(type)`:

```ts
const strapiUrl = new URL(
  `${STRAPI}/api/content-moderation/submissions/draft/${encodeURIComponent(type)}`
)
```

In `[id]/draft/route.ts` and `[id]/finalize/route.ts`, after `const { id } = await params`:

```ts
if (!isDocumentIdParam(id))
  return NextResponse.json({ error: "Invalid id" }, { status: 400 })
```

Use `${encodeURIComponent(id)}` in the fetch URL. Replace the `req.json()` try/catch with:

```ts
const parsed = await readJsonCapped(req, 512 * 1024)
if (!parsed.ok)
  return NextResponse.json(
    { error: "Invalid request body" },
    { status: parsed.status }
  )
const body = parsed.body as Record<string, unknown>
```

In `submissions/route.ts` `POST`, replace the `req.json()` try/catch the same way, with a cap of `512 * 1024`.

In `profile/me/notifications/route.ts` `PUT`, replace `const body = (await req.json()) as Record<string, unknown>` with:

```ts
const NotifPrefs = z
  .object({
    soundOn: z.boolean(),
    marketing: z.boolean(),
    newFollowers: z.boolean(),
    weeklyDigest: z.boolean(),
    editsReviewed: z.boolean(),
    editorialMessages: z.boolean(),
    productUpdates: z.boolean(),
  })
  .partial()
  .strict()
const parsed = await readJsonCapped(req, 4 * 1024)
if (!parsed.ok)
  return NextResponse.json(
    { error: "Invalid request body" },
    { status: parsed.status }
  )
const result = NotifPrefs.safeParse(parsed.body)
if (!result.success)
  return NextResponse.json({ error: "Invalid preferences" }, { status: 400 })
const body = result.data
```

Add the imports `import { z } from "zod"` and `import { readJsonCapped } from "@/lib/bridge-params"`. Check the keys against `NotificationsSection.tsx`: `grep -n "key:\|notifPrefs\." apps/ui/src/app/[locale]/profile/settings/_components/NotificationsSection.tsx`. Add any keys that are missing, so saving current settings still works.

- [ ] **Step 4: Run the tests and typecheck**

Run: `pnpm --filter @repo/ui test -- src/lib/__tests__/bridge-params.test.ts && pnpm --filter @repo/ui exec tsc --noEmit`
Expected: PASS, with no type errors.

- [ ] **Step 5: Commit**

```bash
git add apps/ui/src/lib/bridge-params.ts apps/ui/src/lib/__tests__/bridge-params.test.ts apps/ui/src/app/api/submissions apps/ui/src/app/api/profile/me/notifications apps/ui/package.json pnpm-lock.yaml
git commit -m "fix(ui): validate bridge path params and cap request bodies"
```

---

### Task 10: A8, don't send session tokens to the browser

**Files:**

- Modify: `apps/ui/src/app/api/profile/me/sessions/route.ts`
- Modify: any client component that revokes by token (find with grep, below)

- [ ] **Step 1: Find the callers**

Run: `grep -rn "profile/me/sessions\|revokeSession\|\.token" apps/ui/src/app/\[locale\]/profile/settings | head`
Note which component calls revoke, and whether it sends `token`.

- [ ] **Step 2: Implement**

Replace the mapping in `GET` of `sessions/route.ts`:

```ts
const currentId = session.session?.id
const data = sessions.map((s) => ({
  id: s.id,
  userAgent: s.userAgent ?? null,
  ipAddress: s.ipAddress ?? null,
  createdAt: s.createdAt,
  expiresAt: s.expiresAt,
  current: currentId != null && s.id === currentId,
}))
```

If the file has a revoke handler (`DELETE`/`POST`), or the settings component calls `authClient.revokeSession({ token })`, add a `DELETE` handler to `sessions/route.ts` that revokes by id:

```ts
export async function DELETE(req: Request) {
  const h = await headers()
  const session = await auth.api.getSession({ headers: h })
  if (!session?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id } = (await req.json().catch(() => ({}))) as { id?: string }
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 })
  const sessions = await auth.api.listSessions({ headers: h })
  const target = sessions.find((s) => s.id === id)
  if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 })
  await auth.api.revokeSession({ headers: h, body: { token: target.token } })
  return NextResponse.json({ ok: true })
}
```

Update the settings component to call `fetch("/api/profile/me/sessions", { method: "DELETE", body: JSON.stringify({ id }) })` instead of passing a token.

- [ ] **Step 3: Verify**

Run: `pnpm --filter @repo/ui exec tsc --noEmit`, then start the UI. Sign in on two browsers, open Settings → Sign-in & security, and revoke the other session. The list refreshes, and the other browser is signed out. In DevTools → Network, the `/api/profile/me/sessions` response has no `token` field.

- [ ] **Step 4: Commit**

```bash
git add apps/ui/src/app/api/profile/me/sessions apps/ui/src/app/\[locale\]/profile/settings
git commit -m "fix(ui): stop exposing session tokens; revoke sessions by id"
```

---

### Task 11: A9, drafts are readable only with the bridge secret

**Files:**

- Create: `apps/strapi/src/utils/read-status.ts`
- Test: `apps/strapi/tests/read-status.test.ts`
- Modify (20 sites): every `status === "draft" ? "draft" : "published"` in `apps/strapi/src/api/*/controllers/*.ts`
- Modify: `apps/ui/src/lib/strapi-api/public.ts`

**Interfaces:**

- Produces: `readStatus(ctx: { query?: any; request: { headers: Record<string, unknown> } }): "draft" | "published"`

- [ ] **Step 1: Write the failing test**

`apps/strapi/tests/read-status.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { readStatus } from "../src/utils/read-status"

describe("readStatus", () => {
  beforeEach(() => {
    process.env.STRAPI_BRIDGE_SECRET = "s3cret"
  })
  afterEach(() => {
    delete process.env.STRAPI_BRIDGE_SECRET
  })
  const ctx = (status?: string, secret?: string) => ({
    query: status ? { status } : {},
    request: { headers: secret ? { "x-service-secret": secret } : {} },
  })
  it("defaults to published", () => expect(readStatus(ctx())).toBe("published"))
  it("ignores ?status=draft without the secret", () =>
    expect(readStatus(ctx("draft"))).toBe("published"))
  it("ignores a wrong secret", () =>
    expect(readStatus(ctx("draft", "nope"))).toBe("published"))
  it("allows draft with the secret", () =>
    expect(readStatus(ctx("draft", "s3cret"))).toBe("draft"))
})
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `pnpm --filter @repo/strapi test -- tests/read-status.test.ts`
Expected: FAIL, because the module is missing.

- [ ] **Step 3: Implement**

`apps/strapi/src/utils/read-status.ts`:

```ts
import { isValidServiceSecret } from "./service-secret"

/** Draft content is only served to the Next.js server (bridge secret), never to the public. */
export function readStatus(ctx: {
  query?: Record<string, unknown>
  request: { headers: Record<string, unknown> }
}): "draft" | "published" {
  return ctx.query?.status === "draft" &&
    isValidServiceSecret(ctx.request.headers["x-service-secret"])
    ? "draft"
    : "published"
}
```

Replace every occurrence. List them with:
Run: `grep -rn 'status === "draft" ? "draft" : "published"' apps/strapi/src/api`
There are 20 sites, in area, blog-article, wiki-article, library, wiki-landing, region, continent, country and blog-landing. For each:

- `ctx.query.status === "draft" ? "draft" : "published"` becomes `readStatus(ctx)`
- `q.status === "draft" ? "draft" : "published"` becomes `readStatus(ctx)`. `q` is `ctx.query` in those files; confirm by reading two lines up.

Add `import { readStatus } from "../../../utils/read-status"` to each controller. The path is relative to `src/api/<x>/controllers/`.

Run: `grep -rn 'status === "draft" ? "draft"' apps/strapi/src/api | wc -l`
Expected: `0`.

In `apps/ui/src/lib/strapi-api/public.ts`, inside the `else` branch (server-side), after `headers = { ...authHeader }`, add:

```ts
// Draft reads (preview mode) must carry the bridge secret; Strapi ignores
// ?status=draft from anyone else.
const bridgeSecret = process.env.STRAPI_BRIDGE_SECRET
if (bridgeSecret && (params as Record<string, unknown>)?.status === "draft") {
  headers["X-Service-Secret"] = bridgeSecret
}
```

This branch only runs on the server (`useProxy` is for the client), so the secret never reaches a browser bundle. Confirm the file has no `"use client"` directive and is imported only from server code: `grep -rn "strapi-api/public" apps/ui/src --include=*.tsx | xargs grep -l '"use client"'` should print nothing.

- [ ] **Step 4: Run the tests and verify live**

Run: `pnpm --filter @repo/strapi test -- tests/read-status.test.ts`
Expected: PASS.

With Strapi running, run: `curl -s "http://127.0.0.1:1337/api/blog-articles/detail/this-is-a-blog-article?status=draft" | head -c 200`
Expected: the published version, or `{"data":null`, not the draft.

Then turn on Next draft mode (the existing preview route) and load that blog article in the UI. The draft renders.

- [ ] **Step 5: Commit**

```bash
git add apps/strapi/src/utils/read-status.ts apps/strapi/tests/read-status.test.ts apps/strapi/src/api apps/ui/src/lib/strapi-api/public.ts
git commit -m "fix(strapi): serve drafts only to requests with the bridge secret"
```

---

### Task 12: A10 and A11, privacy of public activity and leaderboard, plus trust hygiene

**Files:**

- Modify: `apps/strapi/src/plugins/content-moderation/server/services/submission.ts` (`findPublicByBaUserId`, `findPublicByUsername`, `findPublicByDocumentId`, the claim and new-library blocks)
- Modify: `apps/strapi/src/plugins/rewards/server/services/leaderboard.ts:95-120`
- Modify: `apps/strapi/src/api/auth-bridge/controllers/auth-bridge.ts:355-375` (`createAffiliation`)
- Modify: `apps/ui/src/app/[locale]/contribute/community/_components/LeaderboardRows.tsx:28`, `LeaderboardPodium.tsx:39`
- Test: `apps/strapi/tests/content-moderation/privacy-trust.test.ts`

**Interfaces:**

- Consumes: `promoteRole` from `@repo/access`.
- Produces:
  - A private profile, or `publicPrefs.showActivity === false`, gives `[]` from the public submission endpoints.
  - Rejected submissions are never public.
  - Leaderboard rows have no `baUserId`. Location is null when `showLocation` is false. Private profiles are listed as "Private contributor".
  - Approving a claim upserts the affiliation and uses `promoteRole`.
  - Approving a new library no longer changes `contributorRole` or `isVerifiedLibrarian` (D-C5 default).

- [ ] **Step 1: Write the failing test**

`apps/strapi/tests/content-moderation/privacy-trust.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest"

import createService from "../../src/plugins/content-moderation/server/services/submission"
import { payloadHash } from "../../src/plugins/content-moderation/server/utils/payload-hash"
import { makeFakeStrapi } from "../helpers/fake-strapi"

const PROFILE = "api::user-profile.user-profile"
const SUB = "plugin::content-moderation.submission"
const AFF = "api::library-affiliation.library-affiliation"
const LIB = "api::library.library"

describe("public activity", () => {
  it("is empty for private profiles", async () => {
    const { strapi } = makeFakeStrapi({
      [PROFILE]: [
        {
          documentId: "p1",
          username: "alice",
          baUserId: "u1",
          profileVisibility: "private",
        },
      ],
      [SUB]: [
        {
          documentId: "s1",
          submittedByUserId: "u1",
          status: "approved",
          submissionType: "correction",
        },
      ],
    })
    expect(
      await createService({ strapi }).findPublicByUsername("alice")
    ).toEqual([])
  })
  it("hides rejected submissions", async () => {
    const { strapi } = makeFakeStrapi({
      [PROFILE]: [
        {
          documentId: "p1",
          username: "bob",
          baUserId: "u2",
          profileVisibility: "public",
        },
      ],
      [SUB]: [
        {
          documentId: "s1",
          submittedByUserId: "u2",
          status: "rejected",
          submissionType: "correction",
        },
        {
          documentId: "s2",
          submittedByUserId: "u2",
          status: "approved",
          submissionType: "correction",
        },
      ],
    })
    const out = await createService({ strapi }).findPublicByUsername("bob")
    expect(out.map((s: any) => s.documentId)).toEqual(["s2"])
  })
})

describe("claim approval", () => {
  it("never downgrades a wiki_editor", async () => {
    const claim: any = {
      documentId: "s0000000000000000000009",
      submissionType: "library_claim",
      status: "pending",
      submittedByUserId: "u3",
      targetDocumentId: "lib0000000000000000000001",
      fields: {},
    }
    claim.payloadHash = payloadHash(claim)
    const f = makeFakeStrapi({
      [SUB]: [claim],
      [PROFILE]: [
        { documentId: "p3", baUserId: "u3", contributorRole: "wiki_editor" },
      ],
      [LIB]: [{ documentId: "lib0000000000000000000001", id: 7 }],
      [AFF]: [],
    })
    f.services["rewards.points"] = {
      award: vi.fn(async () => ({ awarded: true })),
    }
    f.services["api::user-profile.quick-wins"] = {
      computeAndSave: vi.fn(async () => {}),
    }
    await createService({ strapi: f.strapi }).updateStatus(
      "s0000000000000000000009",
      "approved",
      "admin"
    )
    expect(f.store[PROFILE][0].contributorRole).toBe("wiki_editor")
    expect(f.store[PROFILE][0].isVerifiedLibrarian).toBe(true)
    expect(f.store[AFF]).toHaveLength(1)
  })
})
```

The fake `findMany` ignores `fields` and `populate`, which is fine for these assertions.

- [ ] **Step 2: Run it and confirm it fails**

Run: `pnpm --filter @repo/strapi test -- tests/content-moderation/privacy-trust.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement the privacy changes**

In `findPublicByUsername` and `findPublicByDocumentId`, fetch the visibility fields and gate on them. Replace the profile lookup in `findPublicByUsername`:

```ts
const [profile] = (await strapi
  .documents("api::user-profile.user-profile")
  .findMany({
    filters: { username: { $eq: username } } as any,
    fields: ["baUserId", "profileVisibility", "publicPrefs"] as any,
    limit: 1,
  })) as any[]
if (!profile?.baUserId || !isActivityPublic(profile)) return []
return (this as any).findPublicByBaUserId(profile.baUserId)
```

In `findPublicByDocumentId`, add `"profileVisibility", "publicPrefs"` to `fields` and the same `isActivityPublic(profile)` guard.

Add at module scope:

```ts
function isActivityPublic(p: {
  profileVisibility?: string
  publicPrefs?: any
}): boolean {
  if (p.profileVisibility === "private") return false
  return p.publicPrefs?.showActivity !== false
}
```

In `findPublicByBaUserId`, change the filter to exclude rejected submissions:

```ts
        filters: {
          submittedByUserId: baUserId,
          status: { $in: ["pending", "approved", "needs_info"] },
        },
```

The fake strapi supports `$in`. Real Strapi supports it too.

- [ ] **Step 4: Implement the trust hygiene**

Add `import { promoteRole, isContributorRole } from "@repo/access"` to `services/submission.ts`, then add this module-scope helper:

```ts
async function grantVerifiedLibrarian(strapi: any, baUserId: string) {
  const [profile] = (await strapi
    .documents("api::user-profile.user-profile")
    .findMany({
      filters: { baUserId: { $eq: baUserId } },
      fields: ["documentId", "contributorRole"],
      limit: 1,
    })) as { documentId: string; contributorRole?: string }[]
  if (!profile) return
  await strapi.documents("api::user-profile.user-profile").update({
    documentId: profile.documentId,
    data: {
      isVerifiedLibrarian: true,
      contributorRole: promoteRole(
        isContributorRole(profile.contributorRole)
          ? profile.contributorRole
          : null,
        "verified_librarian"
      ),
    },
  })
}

async function upsertAffiliation(
  strapi: any,
  data: {
    baUserId: string
    libraryId: number
    role?: string | null
    department?: string | null
    verificationMethod: string
  }
) {
  const existing = (await strapi
    .documents("api::library-affiliation.library-affiliation")
    .findMany({
      filters: {
        baUserId: { $eq: data.baUserId },
        library: { id: { $eq: data.libraryId } },
      },
      limit: 1,
    })) as { documentId: string }[]
  const payload = {
    baUserId: data.baUserId,
    role: data.role ?? null,
    department: data.department ?? null,
    verificationMethod: data.verificationMethod,
    library: { connect: [{ id: data.libraryId }] },
  }
  if (existing[0])
    return strapi
      .documents("api::library-affiliation.library-affiliation")
      .update({ documentId: existing[0].documentId, data: payload as any })
  return strapi
    .documents("api::library-affiliation.library-affiliation")
    .create({ data: payload as any })
}
```

The fake strapi's `match` treats nested `library: {id: {$eq}}` as a strict equality miss, so an existing affiliation looks absent and `create` runs. That's fine for the test.

In the `library_claim` approval block, replace both the `affiliationData` creation and the `strapi.db.query(...).update(...)` role write with:

```ts
if (targetLibrary) {
  await upsertAffiliation(strapi, {
    baUserId: submission.submittedByUserId,
    libraryId: targetLibrary.id,
    role: (fields.role as string) ?? null,
    department: (fields.department as string) ?? null,
    verificationMethod:
      (submission.verificationMethod as string) ?? "contact_us",
  })
  await grantVerifiedLibrarian(strapi, submission.submittedByUserId)
}
```

In the `new_library` block, replace the auto-claim `if (submission.submittedByUserId && newLibrary?.id) { … }` body with an affiliation only, without a role change (D-C5):

```ts
if (submission.submittedByUserId && newLibrary?.id) {
  await upsertAffiliation(strapi, {
    baUserId: submission.submittedByUserId,
    libraryId: newLibrary.id,
    role: "proposer",
    verificationMethod: "contact_us",
  })
  // D-C5: proposing a library does not make you verified staff. Role
  // changes come only from an approved Library Claim.
}
```

In `auth-bridge.ts` `createAffiliation` (lines 355–375), replace the `strapi.db.query` profile update with the same promote logic:

```ts
const [profile] = (await strapi
  .documents("api::user-profile.user-profile")
  .findMany({
    filters: { baUserId: { $eq: baUserId } },
    fields: ["documentId", "contributorRole"],
    limit: 1,
  })) as { documentId: string; contributorRole?: string }[]
if (profile) {
  await strapi.documents("api::user-profile.user-profile").update({
    documentId: profile.documentId,
    data: {
      isVerifiedLibrarian: true,
      contributorRole: promoteRole(
        isContributorRole(profile.contributorRole)
          ? profile.contributorRole
          : null,
        "verified_librarian"
      ),
    },
  })
}
```

Add `import { isContributorRole, promoteRole } from "@repo/access"` there. `apps/strapi/package.json` already depends on it (Task 1).

- [ ] **Step 5: Leaderboard privacy**

In `leaderboard.ts`, replace the `return rows.map(...)` object (lines ~101–118) with:

```ts
const isPrivate = (profile as any)?.profileVisibility === "private"
const showLocation = (profile as any)?.publicPrefs?.showLocation !== false
return {
  rank: currentRank,
  rankChange,
  username: isPrivate ? null : (profile?.username ?? null),
  firstName: isPrivate ? "Private" : (profile?.firstName ?? null),
  lastName: isPrivate ? "contributor" : (profile?.lastName ?? null),
  avatarUrl: isPrivate ? null : (profile?.avatarUrl ?? null),
  country: isPrivate || !showLocation ? null : (profile?.country ?? null),
  contributorRole: isPrivate ? null : (profile?.contributorRole ?? null),
  periodPoints: Number(row.periodPoints),
  totalPoints: profile?.points ?? 0,
  tier: profile?.tier ?? "Reader",
}
```

Find `getStanding` and any other caller that reads `baUserId` from these rows: `grep -n "baUserId" apps/strapi/src/plugins/rewards/server/services/leaderboard.ts apps/strapi/src/plugins/rewards/server/controllers/rewards.ts`. If `getStanding` finds the user's rank via `row.baUserId`, change it to use `row.ba_user_id` from the raw query rows before mapping.

Do the same for wiki `topContributors`. In `apps/strapi/src/api/wiki-article/controllers/wiki-article.ts` around line 114, remove `baUserId` from the returned objects (keep it only for the internal sort lookup).

In the UI, change `key={entry.baUserId}` to `key={entry.rank}` in `LeaderboardRows.tsx:28` and `LeaderboardPodium.tsx:39`, and remove `baUserId` from their row type. Find the type with `grep -rn "baUserId" apps/ui/src/app/\[locale\]/contribute/community`.

- [ ] **Step 6: Run the tests and typecheck**

Run: `pnpm --filter @repo/strapi test && pnpm --filter @repo/ui exec tsc --noEmit`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/strapi/src apps/strapi/tests apps/ui/src/app/\[locale\]/contribute/community
git commit -m "fix: respect profile privacy in public activity and never lower roles"
```

---

### Task 13: A12, tidy-ups (username, private proxy, profile deletion, points counting, upload token)

**Files:**

- Modify: `apps/strapi/src/api/auth-bridge/controllers/auth-bridge.ts` (`upsertProfile`, `deleteProfile`)
- Modify: `apps/ui/src/app/api/private-proxy/[...slug]/route.ts`
- Modify: `apps/strapi/src/plugins/content-moderation/server/services/submission.ts` (library_edit points)
- Modify: `apps/ui/src/app/api/upload/route.ts`, `apps/ui/src/app/api/submissions/upload-image/route.ts`, `apps/ui/src/app/api/profile/me/avatar/route.ts`
- Modify: `apps/ui/.env.local.example`
- Test: `apps/strapi/tests/auth-bridge-username.test.ts`

- [ ] **Step 1: Write the failing username test**

`apps/strapi/tests/auth-bridge-username.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import { isValidUsername } from "../src/utils/username"

describe("isValidUsername", () => {
  it.each([
    ["alice_01", true],
    ["ab", false],
    ["Alice", false],
    ["аlice", false],
    ["a".repeat(31), false],
    ["admin", false],
  ])("%s → %s", (u, ok) => expect(isValidUsername(u)).toBe(ok))
})
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `pnpm --filter @repo/strapi test -- tests/auth-bridge-username.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement the username check**

`apps/strapi/src/utils/username.ts`:

```ts
const RESERVED = new Set([
  "admin",
  "administrator",
  "moderator",
  "support",
  "staff",
  "librariesglobal",
  "system",
  "root",
  "api",
  "settings",
  "profile",
  "deleted",
])
export function isValidUsername(u: unknown): u is string {
  return (
    typeof u === "string" &&
    /^[a-z0-9_]{3,30}$/.test(u) &&
    !RESERVED.has(u) &&
    !u.startsWith("deleted-")
  )
}
```

In `upsertProfile`, before building `data`, add:

```ts
if (
  "username" in fields &&
  fields.username !== null &&
  !isValidUsername(fields.username)
)
  return ctx.badRequest(
    "Username must be 3–30 characters: lowercase letters, numbers and underscores."
  )
```

Import it: `import { isValidUsername } from "../../../utils/username"`.
Check that the UI's `check-username` regex agrees: `grep -rn "a-z0-9_" apps/ui/src/app/api/profile apps/ui/src/app/\[locale\]/profile | head`. If the UI allows uppercase, lowercase the input before sending, or align the UI regex to `^[a-z0-9_]{3,30}$`.

- [ ] **Step 4: Scrub on deletion**

In `deleteProfile`, after the profile update and before deleting the users-permissions user, add:

```ts
// Scrub PII left on moderation and rewards records.
await strapi.db.query("plugin::content-moderation.submission").updateMany({
  where: { submittedByUserId: baUserId },
  data: {
    submittedByEmail: "deleted@invalid",
    submittedByName: null,
    submittedByUserId: `deleted-${baUserId}`,
  },
})
await strapi.db.query("plugin::rewards.point-event").updateMany({
  where: { baUserId },
  data: { baUserId: `deleted-${baUserId}` },
})
await strapi.db
  .query("api::library-affiliation.library-affiliation")
  .deleteMany({ where: { baUserId } })
```

These three types have `draftAndPublish: false`, so bulk `db.query` updates are consistent with the Document Service (see Global Constraints).

- [ ] **Step 5: Count points only on known library fields**

In `updateStatus`'s `library_edit` points block, replace the `fieldCount` computation with:

```ts
const LIBRARY_FIELDS = new Set([
  "name",
  "shortName",
  "summary",
  "libraryType",
  "operationalStatus",
  "operatorType",
  "streetAddress",
  "city",
  "district",
  "postalCode",
  "website",
  "catalogueUrl",
  "planVisitUrl",
  "membershipUrl",
  "bookingUrl",
  "donationUrl",
  "virtualTourUrl",
  "email",
  "phone",
  "admissionInfo",
  "transitInfo",
  "languagesServed",
  "foundedYear",
  "openedYear",
  "closedYear",
  "architect",
  "buildingInfo",
  "iiifEndpoint",
  "classificationSystem",
  "openingTimes",
  "accessibilityNotes",
  "visitNotes",
  "services",
  "amenities",
  "accessibility",
  "location",
])
const fieldCount = Object.keys(fields).filter(
  (k) =>
    LIBRARY_FIELDS.has(k) &&
    fields[k] !== null &&
    fields[k] !== undefined &&
    fields[k] !== ""
).length
```

- [ ] **Step 6: Private-proxy header allowlist**

In `private-proxy/[...slug]/route.ts`, replace:

```ts
    headers: {
      // Convert headers to object
      ...Object.fromEntries(clonedRequest.headers),
    },
```

with:

```ts
    headers: Object.fromEntries(
      ["authorization", "content-type", "accept", "accept-language"]
        .map((h) => [h, clonedRequest.headers.get(h)])
        .filter((e): e is [string, string] => !!e[1])
    ),
```

Add a traversal guard after `const path = …`:

```ts
if (
  path
    .split("/")
    .some((seg) => seg === ".." || seg === "." || seg.includes("\\"))
)
  return NextResponse.json(
    { error: { message: "Invalid path", name: "BadRequest" } },
    { status: 400 }
  )
```

- [ ] **Step 7: Dedicated upload token**

In the three upload routes, replace `process.env.STRAPI_REST_READONLY_API_KEY` in the upload `fetch` with `process.env.STRAPI_UPLOAD_API_KEY`. In `apps/ui/.env.local.example`, add:

```
# Strapi API token with ONLY upload.create permission (Settings → API Tokens → Custom)
STRAPI_UPLOAD_API_KEY=
```

Create the token by hand in the local Strapi admin: Settings → API Tokens → Create, type Custom, with only Upload → upload ticked. Put it in `apps/ui/.env.local`. Then edit the existing read-only token and **untick** Upload → upload.

- [ ] **Step 8: Run the tests and verify**

Run: `pnpm --filter @repo/strapi test && pnpm --filter @repo/ui exec tsc --noEmit`
Expected: PASS.
Upload an image in the Add Library wizard. It succeeds with the new token.

- [ ] **Step 9: Commit**

```bash
git add apps/strapi/src apps/strapi/tests apps/ui/src/app/api apps/ui/.env.local.example
git commit -m "fix: username rules, deletion scrub, proxy headers, upload token"
```

---

### Task 14: A13, check whether the Submission `status` attribute clashes with Strapi's document status

**Files:**

- Possibly modify: `…/content-types/submission/schema.json`, services, controllers and admin UI (only if it clashes)

- [ ] **Step 1: Reproduce**

With Strapi running, fetch one submission through the admin content-manager API and one through the plugin's own admin route:

```bash
TOKEN=<admin JWT from browser devtools → localStorage jwtToken>
curl -s -H "Authorization: Bearer $TOKEN" "http://127.0.0.1:1337/content-manager/collection-types/plugin::content-moderation.submission?pageSize=1" | head -c 600; echo
curl -s -H "Authorization: Bearer $TOKEN" "http://127.0.0.1:1337/content-moderation/submissions" | head -c 600
```

Also check the database directly:
`psql … -c "select document_id, status from cm_submissions limit 5"`

- [ ] **Step 2: Decide**

- **The database and the plugin route show `pending`/`approved`, and only the content-manager shows `published`:** the clash is in the content-manager response layer only. The moderation code is correct. Document it with a comment above the `status` attribute in `schema.json`, and stop here:

```json
    "status": {
      "type": "enumeration",
      "required": true,
      "default": "draft",
      "enum": ["draft", "pending", "approved", "rejected", "needs_info"],
      "comment": "Moderation status. Note: Strapi's content-manager overlays its own document `status` key in list responses; read moderation state via the plugin routes."
    },
```

If Strapi rejects the unknown `comment` key, use a `// NOTE` in `services/submission.ts` next to `create` instead.

- **The database or the plugin route also shows `published`:** stop. This is a data-integrity bug that needs a rename to `reviewStatus`, with a migration. Report back before continuing; that becomes its own task.

- [ ] **Step 3: Commit (if a note was added)**

```bash
git add apps/strapi/src/plugins/content-moderation
git commit -m "docs(moderation): note content-manager status overlay on submissions"
```

---

### Task 15: Regression run and a re-run of the exploit scenarios

**Files:**

- Create: `qa/tests/security/pa-regressions.md` (a manual checklist, kept with the QA suite)

- [ ] **Step 1: Run the full suites**

Run: `pnpm --filter @repo/access test && pnpm --filter @repo/strapi test && pnpm --filter @repo/ui test && pnpm --filter @repo/ui exec tsc --noEmit`
Expected: all green.

- [ ] **Step 2: Re-run each audit exploit against a local stack and record the result**

Start Strapi and the UI. Sign in as the local reader test user. Using the browser devtools console on `localhost:3000`, run and record:

1. **Content swap after review (A1):** `POST /api/submissions` with a correction, then `PATCH /api/submissions/{documentId}/draft` with new `draftData`. Expect **409**.
2. **Wiki target hijack (A2):** as `wiki_editor`, create a wiki_edit for `targetSlug: "a"` with `draftData.targetSlug: "b"`, then approve it in admin. Article `b` is unchanged.
3. **Double approval (A3):** approve the same submission twice through `PUT /content-moderation/submissions/:id/status`. Expect a second response of 409, and one point-event row.
4. **Author admin approval (A4):** as an Author-role admin, expect 403.
5. **Reader wiki_edit (A5):** as a reader, `POST /api/submissions` with `{submissionType:"wiki_edit", targetSlug:"a", draftData:{body:[…]}}`. Expect **403**.
6. **Traversal (A7):** `GET /api/submissions/draft/..%2F..%2F..%2Fauth-bridge%2Fuser-affiliations%3FbaUserId%3Dx%26a=`. Expect **400**.
7. **Session tokens (A8):** the `/api/profile/me/sessions` response has no `token`.
8. **Draft leak (A9):** `curl …/blog-articles/detail/<slug>?status=draft` returns the published version.
9. **Private activity (A10):** with the profile set to private, `GET /api/content-moderation/submissions/by-username/<u>` returns `[]`.
10. **Role downgrade (A11):** give the test user `wiki_editor` through the MCP, approve a claim, and the role is still `wiki_editor`.

Write the outcomes into `qa/tests/security/pa-regressions.md` as a table: scenario, expected, observed, pass/fail, date.

- [ ] **Step 3: Tick A1–A13 in the spec**

In `docs/superpowers/specs/2026-09-26-access-contribution-pro-implementation-design.md` §4, add a `✔ fixed <commit>` note to each row's Acceptance cell.

- [ ] **Step 4: Commit**

```bash
git add qa/tests/security/pa-regressions.md docs/superpowers/specs/2026-09-26-access-contribution-pro-implementation-design.md
git commit -m "test(security): record P-A regression results"
```

---

## Self-review notes

- **Spec coverage:**
  - A1 is Task 3; A2 is Task 4; A3 is Tasks 5 and 6; A4 is Task 7; A5 is Task 8; A6 is Tasks 8 and 9 (quotas, body caps, notifPrefs).
  - Edge and IP rate limits for uploads and subscribers need a shared store. They're deferred to P-C, in the §11.3 public-surface work. Upload quotas count `submission-upload` rows per day in P-C; the table exists after Task 4.
  - A7 is Task 9; A8 is Task 10; A9 is Task 11; A10 and A11 are Task 12; A12 is Task 13; A13 is Task 14. Regression is Task 15.
- **Signature changes that ripple:**
  - `service.saveDraft` now takes `userId` second (Task 3). Its only caller is the controller, which is updated.
  - `service.updateStatus` returns `{error}|{data}` (Task 5). The controller and admin UI are updated.
  - `points.award` gains a fifth `idempotencyKey` parameter (Task 6). Every caller in `updateStatus` passes it. `adminAward` doesn't need one.
- **Known follow-up for P-C (C-D1):** the Next wiki proxy (`api/contribute/wiki/[slug]`) still posts without `asDraft`, and uses numeric ids. It keeps failing safely after this plan: the policy blocks readers, and the id check returns 400. It's fixed properly in P-C.
