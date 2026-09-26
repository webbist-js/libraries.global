# P-B: Access Package, Session Capabilities and Entitlements — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put Contributor Role capabilities and (inert) Plan entitlements on every Better Auth session, gate the Next routes through them, and prove the role matrix end to end.

**Architecture:** `@repo/access` gains a pure `entitlements.ts` next to the existing `capabilities.ts` and `limits.ts`. The Strapi `session-profile` bridge returns role, tier and claims. The Next `customSession` resolves them into `capabilities[]` and entitlement fields through a per-user cache (60 s TTL). Route handlers and client hooks read those fields instead of raw `contributorRole`. Strapi's `submission-policy` stays the authoritative gate.

**Tech Stack:** TypeScript, vitest 2, Strapi v5 (Document Service), Next.js 16 route handlers, Better Auth 1.4 `customSession`, Playwright.

Spec: `docs/superpowers/specs/2026-09-26-access-contribution-pro-implementation-design.md` §3, §9, §10.1 (P-B row).

## Global Constraints

- Three axes never mix. `CapabilityInput` has no plan, subscription or entitlement fields, and no capability function accepts an `Entitlements` value (spec §3.1 invariants 1–2).
- Moderation state transitions and the submission policy don't depend on plan (invariant 3).
- `resolveEntitlements` is deterministic for a fixed `now` and table-tested across every subscription status, grace period, grant expiry and verification expiry (invariant 4).
- Until P-D, the session passes only `{ signedIn, now }` into `resolveEntitlements`, so every session resolves to plan `public` (signed out) or `free` (signed in). No Stripe or subscription reads in P-B.
- Status rules: `active` and `trialing` are entitled. `past_due` stays entitled for a 7-day grace period. `canceled` is entitled until `periodEnd`. Anything else is free.
- Earned Pro: tier Archivist or above, held for 90 days after dropping below (D-P4).
- Bridge cache: per `baUserId`, TTL 60 seconds. Revocation must take effect within 60 seconds.
- Next route checks are pre-checks for a fast 403. Strapi `submission-policy` stays authoritative. Missing session fields mean deny (fail closed).
- Strapi v5: use `strapi.documents()` for content reads, not `strapi.db.query()`.
- Commit scopes are pnpm package names (`access`, `strapi`, `ui`). Headers are 72 characters or fewer. **No `Co-Authored-By` or any self-credit lines in commit messages.**
- Work on `dev`. The branch hook rejects non-`STAR-<n>` branches.
- Node 22 (`nvm use`). Rebuild `@repo/access` (`pnpm --filter @repo/access build`) after changing it, because Strapi and the UI consume `dist/`.

## File Structure

| File                                                             | Responsibility                                                             |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `packages/access/src/entitlements.ts` (new)                      | Plans, features and limits. `resolveEntitlements`, `can`, `limitOf`. Pure. |
| `packages/access/tests/entitlements.test.ts` (new)               | Table tests (invariant 4)                                                  |
| `packages/access/tests/invariants.test-d.ts` (new)               | Type-level invariants 1–2, checked by `tsc`                                |
| `packages/access/tsconfig.typecheck.json` (new)                  | Type-checks `src` and `tests` together                                     |
| `apps/strapi/src/api/auth-bridge/controllers/auth-bridge.ts`     | `sessionProfile` returns role, username, tier and claims                   |
| `apps/strapi/tests/session-profile.test.ts` (new)                | Bridge response shape and secret gate                                      |
| `apps/strapi/tests/content-moderation/policy.test.ts`            | Invariant 3: plan fields don't change the verdict                          |
| `apps/ui/src/lib/session-profile.ts` (new)                       | Bridge fetch, 60 s cache and `invalidateSessionProfile`                    |
| `apps/ui/src/lib/session-access.ts` (new)                        | Pure `buildSessionAccess(profile)`, which returns the session fields       |
| `apps/ui/src/lib/auth.ts`                                        | `customSession` uses the two modules above                                 |
| `apps/ui/src/lib/auth-server.ts`                                 | `BetterAuthUser` gains the access fields                                   |
| `apps/ui/src/app/api/profile/me/route.ts`                        | Invalidates the cache after PUT, PATCH and DELETE                          |
| `apps/ui/src/lib/access-server.ts` (new)                         | `capabilitiesOf(user)`, `requireCapability`, `requireEntitlement`          |
| `apps/ui/src/lib/access-client.ts` (new)                         | `useCapabilities()`, `useEntitlements()`                                   |
| Wiki, finalize and upload routes, docs page, `AtlasExplorer.tsx` | Use the helpers instead of raw roles                                       |
| `qa/tests/playwright/helpers/seed-access-fixtures.ts` (new)      | Seeds one user per role (local only)                                       |
| `qa/tests/playwright/e2e/access/role-matrix.spec.ts` (new)       | API-level role matrix E2E                                                  |

---

### Task 1: Entitlements module and type-level invariants

**Files:**

- Create: `packages/access/src/entitlements.ts`
- Modify: `packages/access/src/index.ts`
- Create: `packages/access/tests/entitlements.test.ts`
- Create: `packages/access/tests/invariants.test-d.ts`
- Create: `packages/access/tsconfig.typecheck.json`
- Modify: `packages/access/package.json` (`typecheck` script)

**Interfaces:**

- Consumes: `TIER_NAMES` from `packages/access/src/limits.ts`.
- Produces: the `PlanKey`, `PlanSource`, `Feature`, `Limit`, `Entitlements` and `EntitlementInput` types, plus `resolveEntitlements(input: EntitlementInput): Entitlements`, `can(e, f): boolean`, `limitOf(e, l): number` and `FEATURES: readonly Feature[]`.

- [ ] **Step 1: Write the failing table tests**

`packages/access/tests/entitlements.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import {
  can,
  limitOf,
  resolveEntitlements,
  type EntitlementInput,
} from "../src"

const NOW = new Date("2026-10-01T12:00:00Z")
const days = (n: number) =>
  new Date(NOW.getTime() + n * 86_400_000).toISOString()
const base = (over: Partial<EntitlementInput> = {}): EntitlementInput => ({
  signedIn: true,
  now: NOW,
  ...over,
})

describe("resolveEntitlements: plan baseline", () => {
  it("is public when signed out, whatever else is passed", () => {
    const e = resolveEntitlements(
      base({ signedIn: false, subscription: { plan: "pro", status: "active" } })
    )
    expect(e.plan).toBe("public")
    expect(e.source).toBe("none")
    expect(e.features.size).toBe(0)
  })

  it("is free when signed in with nothing else (the P-B session)", () => {
    const e = resolveEntitlements({ signedIn: true, now: NOW })
    expect(e).toMatchObject({ plan: "free", source: "none" })
    expect(e.features.size).toBe(0)
    expect(limitOf(e, "savedViews")).toBe(3)
  })
})

describe("resolveEntitlements: subscription status", () => {
  it.each([
    ["active", {}, "pro"],
    ["trialing", {}, "pro"],
    ["past_due", { pastDueSince: days(-6) }, "pro"],
    ["past_due", { pastDueSince: days(-8) }, "free"],
    ["past_due", {}, "free"],
    ["canceled", { periodEnd: days(3) }, "pro"],
    ["canceled", { periodEnd: days(-1) }, "free"],
    ["canceled", {}, "free"],
    ["incomplete", {}, "free"],
    ["unpaid", {}, "free"],
  ] as const)("%s %o resolves to %s", (status, extra, plan) => {
    const e = resolveEntitlements(
      base({ subscription: { plan: "pro", status, ...extra } })
    )
    expect(e.plan).toBe(plan)
    expect(e.source).toBe(plan === "pro" ? "paid" : "none")
  })

  it("ignores an unknown subscription plan", () => {
    expect(
      resolveEntitlements(
        base({ subscription: { plan: "platinum", status: "active" } })
      ).plan
    ).toBe("free")
  })
})

describe("resolveEntitlements: grants, verifications and earned Pro", () => {
  it("honours an unexpired grant and ignores an expired one", () => {
    expect(
      resolveEntitlements(
        base({ grants: [{ plan: "pro", expiresAt: days(1) }] })
      )
    ).toMatchObject({ plan: "pro", source: "grant" })
    expect(
      resolveEntitlements(base({ grants: [{ plan: "pro", expiresAt: null }] }))
        .plan
    ).toBe("pro")
    expect(
      resolveEntitlements(
        base({ grants: [{ plan: "pro", expiresAt: days(-1) }] })
      ).plan
    ).toBe("free")
  })

  it("a team grant outranks paid pro", () => {
    const e = resolveEntitlements(
      base({
        subscription: { plan: "pro", status: "active" },
        grants: [{ plan: "team", expiresAt: null }],
      })
    )
    expect(e).toMatchObject({ plan: "team", source: "grant" })
    expect(can(e, "team.workspace")).toBe(true)
  })

  it("an unexpired verification gives verified pro", () => {
    expect(
      resolveEntitlements(base({ verifications: [{ expiresAt: days(30) }] }))
    ).toMatchObject({ plan: "pro", source: "verified" })
    expect(
      resolveEntitlements(base({ verifications: [{ expiresAt: days(-1) }] }))
        .plan
    ).toBe("free")
  })

  it.each([
    ["Cartographer", null, "free"],
    ["Archivist", null, "pro"],
    ["Curator", null, "pro"],
    ["Cartographer", days(10), "pro"],
    ["Cartographer", days(-1), "free"],
  ] as const)("tier %s with hold %s resolves to %s", (tier, hold, plan) => {
    const e = resolveEntitlements(
      base({ rewardsTier: tier, earnedProUntil: hold })
    )
    expect(e.plan).toBe(plan)
    if (plan === "pro") expect(e.source).toBe("earned")
  })

  it("prefers paid over grant over verified over earned at the same plan", () => {
    const all = {
      subscription: { plan: "pro", status: "active" },
      grants: [{ plan: "pro" as const, expiresAt: null }],
      verifications: [{ expiresAt: null }],
      rewardsTier: "Curator",
    }
    expect(resolveEntitlements(base(all)).source).toBe("paid")
    expect(
      resolveEntitlements(base({ ...all, subscription: null })).source
    ).toBe("grant")
    expect(
      resolveEntitlements(base({ ...all, subscription: null, grants: [] }))
        .source
    ).toBe("verified")
  })

  it("is deterministic for a fixed now", () => {
    const input = base({ subscription: { plan: "pro", status: "active" } })
    const a = resolveEntitlements(input)
    const b = resolveEntitlements(input)
    expect([...a.features]).toEqual([...b.features])
    expect(a.limits).toEqual(b.limits)
  })
})

describe("features", () => {
  it("free has none of the Pro features; pro has the atlas and index set", () => {
    const free = resolveEntitlements(base())
    const pro = resolveEntitlements(
      base({ subscription: { plan: "pro", status: "active" } })
    )
    expect(can(free, "atlas.contextLayers")).toBe(false)
    expect(can(pro, "atlas.contextLayers")).toBe(true)
    expect(can(pro, "index.export")).toBe(true)
    expect(can(pro, "team.workspace")).toBe(false)
  })
})
```

- [ ] **Step 2: Write the type-level invariants**

`packages/access/tests/invariants.test-d.ts`:

```ts
// Type-level invariants from spec §3.1. Checked by `pnpm --filter @repo/access typecheck`.
// Adding a plan field to CapabilityInput, or letting a capability function take
// Entitlements, makes this file fail to compile.
import {
  canSubmit,
  resolveCapabilities,
  resolveEntitlements,
  type CapabilityInput,
} from "../src"

type Equals<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false
const assertTrue = <T extends true>() => undefined as unknown as T

// Invariant 1: CapabilityInput has no plan-related keys.
type PlanishKeys = Extract<
  keyof CapabilityInput,
  | "plan"
  | "planSource"
  | "subscription"
  | "entitlements"
  | "features"
  | "grants"
  | "verifications"
  | "tier"
  | "rewardsTier"
>
assertTrue<Equals<PlanishKeys, never>>()

// Invariant 2: no capability function accepts an Entitlements value.
const ent = resolveEntitlements({ signedIn: true, now: new Date(0) })
// @ts-expect-error Entitlements is not a CapabilityInput
resolveCapabilities(ent)
// @ts-expect-error Entitlements is not Capabilities
canSubmit(ent, "correction")
```

`packages/access/tsconfig.typecheck.json`:

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": { "noEmit": true, "rootDir": "." },
  "include": ["src", "tests"]
}
```

In `packages/access/package.json`, set `"typecheck": "tsc -p tsconfig.typecheck.json"`.

- [ ] **Step 3: Run both to verify they fail**

Run: `cd packages/access && npx vitest run tests/entitlements.test.ts; pnpm typecheck`
Expected: vitest fails to import `resolveEntitlements`. tsc reports that `resolveEntitlements` is not exported.

- [ ] **Step 4: Implement `packages/access/src/entitlements.ts`**

```ts
import { TIER_NAMES } from "./limits"

export type PlanKey = "public" | "free" | "pro" | "team"
export type PlanSource = "none" | "paid" | "grant" | "verified" | "earned"
export type Feature =
  | "atlas.contextLayers"
  | "atlas.analysis"
  | "atlas.export"
  | "atlas.compare"
  | "index.export"
  | "index.alerts"
  | "index.compare"
  | "library.watch"
  | "library.notes"
  | "catalogue.editions"
  | "data.benchmark"
  | "data.explorerExport"
  | "events.personalFeed"
  | "team.workspace"
  | "team.bulkUpload"
  | "team.embed"
  | "api.key"
export type Limit =
  | "savedViews"
  | "savedSearches"
  | "catalogueChecksPerHour"
  | "exportRows"

export interface Entitlements {
  plan: PlanKey
  source: PlanSource
  features: ReadonlySet<Feature>
  limits: Readonly<Record<Limit, number>>
}

export interface EntitlementInput {
  signedIn: boolean
  now: Date
  /** Better Auth `subscription` row (P-D). */
  subscription?: {
    plan: string
    status: string
    periodEnd?: string | null
    pastDueSince?: string | null
  } | null
  /** Strapi `entitlement-grant` rows (P-D). */
  grants?: { plan: "pro" | "team"; expiresAt: string | null }[]
  /** Free-Pro verifications (C5, P-D). */
  verifications?: { expiresAt: string | null }[]
  rewardsTier?: string | null
  /** End of the 90-day hold after dropping below Archivist. */
  earnedProUntil?: string | null
}

const PRO_FEATURES: readonly Feature[] = [
  "atlas.contextLayers",
  "atlas.analysis",
  "atlas.export",
  "atlas.compare",
  "index.export",
  "index.alerts",
  "index.compare",
  "library.watch",
  "library.notes",
  "catalogue.editions",
  "data.benchmark",
  "data.explorerExport",
  "events.personalFeed",
]
const TEAM_FEATURES: readonly Feature[] = [
  ...PRO_FEATURES,
  "team.workspace",
  "team.bulkUpload",
  "team.embed",
  "api.key",
]
export const FEATURES: readonly Feature[] = TEAM_FEATURES

const PLAN_FEATURES: Record<PlanKey, readonly Feature[]> = {
  public: [],
  free: [],
  pro: PRO_FEATURES,
  team: TEAM_FEATURES,
}

const PLAN_LIMITS: Record<PlanKey, Record<Limit, number>> = {
  public: {
    savedViews: 0,
    savedSearches: 0,
    catalogueChecksPerHour: 10,
    exportRows: 0,
  },
  free: {
    savedViews: 3,
    savedSearches: 3,
    catalogueChecksPerHour: 30,
    exportRows: 0,
  },
  pro: {
    savedViews: 1000,
    savedSearches: 1000,
    catalogueChecksPerHour: 300,
    exportRows: 10_000,
  },
  team: {
    savedViews: 1000,
    savedSearches: 1000,
    catalogueChecksPerHour: 600,
    exportRows: 50_000,
  },
}

const PAST_DUE_GRACE_MS = 7 * 86_400_000
const EARNED_PRO_TIERS: ReadonlySet<string> = new Set(
  TIER_NAMES.slice(TIER_NAMES.indexOf("Archivist"))
)
const PLAN_RANK: Record<PlanKey, number> = {
  public: 0,
  free: 1,
  pro: 2,
  team: 3,
}
// At equal plan, the earlier source wins.
const SOURCE_ORDER: readonly PlanSource[] = [
  "paid",
  "grant",
  "verified",
  "earned",
]

const notExpired = (iso: string | null | undefined, now: Date) =>
  iso === null || (iso !== undefined && Date.parse(iso) > now.getTime())

function paidPlan(
  s: EntitlementInput["subscription"],
  now: Date
): PlanKey | null {
  if (!s || (s.plan !== "pro" && s.plan !== "team")) return null
  const plan = s.plan
  switch (s.status) {
    case "active":
    case "trialing":
      return plan
    case "past_due":
      return s.pastDueSince &&
        now.getTime() - Date.parse(s.pastDueSince) <= PAST_DUE_GRACE_MS
        ? plan
        : null
    case "canceled":
      return s.periodEnd && Date.parse(s.periodEnd) > now.getTime()
        ? plan
        : null
    default:
      return null
  }
}

function build(plan: PlanKey, source: PlanSource): Entitlements {
  return {
    plan,
    source,
    features: new Set(PLAN_FEATURES[plan]),
    limits: { ...PLAN_LIMITS[plan] },
  }
}

export function resolveEntitlements(i: EntitlementInput): Entitlements {
  if (!i.signedIn) return build("public", "none")

  const candidates: { plan: PlanKey; source: PlanSource }[] = []
  const paid = paidPlan(i.subscription, i.now)
  if (paid) candidates.push({ plan: paid, source: "paid" })
  for (const g of i.grants ?? [])
    if (notExpired(g.expiresAt, i.now))
      candidates.push({ plan: g.plan, source: "grant" })
  if ((i.verifications ?? []).some((v) => notExpired(v.expiresAt, i.now)))
    candidates.push({ plan: "pro", source: "verified" })
  if (
    EARNED_PRO_TIERS.has(i.rewardsTier ?? "") ||
    (i.earnedProUntil != null && notExpired(i.earnedProUntil, i.now))
  )
    candidates.push({ plan: "pro", source: "earned" })

  if (candidates.length === 0) return build("free", "none")

  const best = candidates.reduce((a, b) =>
    PLAN_RANK[b.plan] > PLAN_RANK[a.plan] ||
    (PLAN_RANK[b.plan] === PLAN_RANK[a.plan] &&
      SOURCE_ORDER.indexOf(b.source) < SOURCE_ORDER.indexOf(a.source))
      ? b
      : a
  )

  return build(best.plan, best.source)
}

export const can = (e: Entitlements, f: Feature): boolean => e.features.has(f)
export const limitOf = (e: Entitlements, l: Limit): number => e.limits[l]
```

Add `export * from "./entitlements"` to `packages/access/src/index.ts`.

- [ ] **Step 5: Run the tests, typecheck and build**

Run: `cd packages/access && npx vitest run && pnpm typecheck && pnpm build`
Expected: all tests pass (the existing 11 plus the new ones), tsc exits 0, and `dist/entitlements.js` exists. As a sanity check, temporarily add `plan?: string` to `CapabilityInput`, confirm `pnpm typecheck` fails on `invariants.test-d.ts`, then revert.

- [ ] **Step 6: Commit**

```bash
git add packages/access
git commit -m "feat(access): add resolveEntitlements and type-level invariants"
```

---

### Task 2: Strapi `session-profile` bridge returns tier and claims, plus the plan-independence test

**Files:**

- Modify: `apps/strapi/src/api/auth-bridge/controllers/auth-bridge.ts` (`sessionProfile`, around lines 601–617)
- Create: `apps/strapi/tests/session-profile.test.ts`
- Modify: `apps/strapi/tests/content-moderation/policy.test.ts`

**Interfaces:**

- Consumes: `isValidServiceSecret` from `apps/strapi/src/utils/service-secret.ts`, and `makeFakeStrapi` from `apps/strapi/tests/helpers/fake-strapi.ts`.
- Produces: `GET /api/auth-bridge/session-profile?baUserId=` returns `{ contributorRole: string, username: string | null, tier: string | null, claims: string[] }`. `claims` holds library `documentId`s from `api::library-affiliation.library-affiliation` for that `baUserId`, at most 100. Task 3 consumes this shape.

- [ ] **Step 1: Write the failing test**

`apps/strapi/tests/session-profile.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import controller from "../src/api/auth-bridge/controllers/auth-bridge"
import { makeFakeStrapi } from "./helpers/fake-strapi"

const PROFILE = "api::user-profile.user-profile"
const AFF = "api::library-affiliation.library-affiliation"

function ctx(query: Record<string, string>, secret = "s3cret") {
  const c: any = {
    query,
    request: { header: { "x-service-secret": secret } },
    send: (b: unknown) => (c.body = b),
    unauthorized: (m: string) => ((c.status = 401), (c.body = m)),
    badRequest: (m: string) => ((c.status = 400), (c.body = m)),
  }

  return c
}

describe("auth-bridge sessionProfile", () => {
  beforeEach(() => {
    process.env.STRAPI_BRIDGE_SECRET = "s3cret"
    const { strapi } = makeFakeStrapi({
      [PROFILE]: [
        {
          documentId: "p1",
          baUserId: "u1",
          contributorRole: "verified_librarian",
          username: "ada",
          tier: "Indexer",
        },
      ],
      [AFF]: [
        { documentId: "a1", baUserId: "u1", library: { documentId: "libA" } },
        { documentId: "a2", baUserId: "u2", library: { documentId: "libB" } },
      ],
    })
    ;(globalThis as any).strapi = strapi
  })
  afterEach(() => {
    delete (globalThis as any).strapi
  })

  it("rejects a bad secret", async () => {
    const c = ctx({ baUserId: "u1" }, "wrong")
    await controller.sessionProfile(c)
    expect(c.status).toBe(401)
  })

  it("returns role, username, tier and only this user's claims", async () => {
    const c = ctx({ baUserId: "u1" })
    await controller.sessionProfile(c)
    expect(c.body).toEqual({
      contributorRole: "verified_librarian",
      username: "ada",
      tier: "Indexer",
      claims: ["libA"],
    })
  })

  it("defaults an unknown user to a reader with nothing", async () => {
    const c = ctx({ baUserId: "nobody" })
    await controller.sessionProfile(c)
    expect(c.body).toEqual({
      contributorRole: "reader",
      username: null,
      tier: null,
      claims: [],
    })
  })
})
```

If the fake's `findMany` ignores `fields` or `populate`, that's fine: the controller only reads the keys it needs. If `makeFakeStrapi` doesn't return `{ strapi }` in this shape, read `tests/helpers/fake-strapi.ts` and adapt the setup, not the assertions.

- [ ] **Step 2: Run it to verify it fails**

Run: `cd apps/strapi && npx vitest run tests/session-profile.test.ts`
Expected: FAIL. `tier` and `claims` are missing, and the fake has no `db.query("api::user-profile…").findOne`.

- [ ] **Step 3: Implement**

Replace the body after the `baUserId` check in `sessionProfile`:

```ts
const [profile] = (await strapi
  .documents("api::user-profile.user-profile")
  .findMany({
    filters: { baUserId: { $eq: baUserId } },
    fields: ["contributorRole", "username", "tier"],
    limit: 1,
  })) as { contributorRole?: string; username?: string; tier?: string }[]

const affiliations = (await strapi
  .documents("api::library-affiliation.library-affiliation")
  .findMany({
    filters: { baUserId: { $eq: baUserId } },
    populate: { library: { fields: ["documentId"] } },
    limit: 100,
  })) as { library?: { documentId?: string } }[]

return ctx.send({
  contributorRole: profile?.contributorRole ?? "reader",
  username: profile?.username ?? null,
  tier: profile?.tier ?? null,
  claims: affiliations
    .map((a) => a.library?.documentId)
    .filter((id): id is string => !!id),
})
```

- [ ] **Step 4: Add the invariant 3 test to `policy.test.ts`**

Append inside the `describe("submission policy", …)` block:

```ts
it("ignores plan fields on the profile (invariant 3)", async () => {
  const { strapi } = makeFakeStrapi({
    [PROFILE]: [
      {
        documentId: "p0000000000000000000001",
        baUserId: "u1",
        contributorRole: "reader",
        tier: "Reader",
        plan: "pro",
        planSource: "paid",
      },
    ],
  })
  const verdict = await createPolicy({ strapi }).check({
    baUserId: "u1",
    submissionType: "wiki_edit",
    directWikiEdit: true,
  })
  expect(verdict).toMatchObject({ ok: false, status: 403 })
})
```

- [ ] **Step 5: Run the Strapi suite and tsc**

Run: `cd apps/strapi && npx vitest run && npx tsc --noEmit -p .`
Expected: all pass (136 before this task, plus 4), and tsc is clean.

- [ ] **Step 6: Commit**

```bash
git add apps/strapi/src/api/auth-bridge/controllers/auth-bridge.ts apps/strapi/tests/session-profile.test.ts apps/strapi/tests/content-moderation/policy.test.ts
git commit -m "feat(strapi): session-profile returns tier and library claims"
```

---

### Task 3: Session enrichment with a 60-second bridge cache

**Files:**

- Create: `apps/ui/src/lib/session-profile.ts`
- Create: `apps/ui/src/lib/session-access.ts`
- Create: `apps/ui/src/lib/__tests__/session-profile.test.ts`
- Create: `apps/ui/src/lib/__tests__/session-access.test.ts`
- Modify: `apps/ui/src/lib/auth.ts` (`customSession`, lines 120–151)
- Modify: `apps/ui/src/lib/auth-server.ts` (`BetterAuthUser`)
- Modify: `apps/ui/src/app/api/profile/me/route.ts` (PUT, PATCH, DELETE)

**Interfaces:**

- Consumes: the bridge shape from Task 2 (`{ contributorRole, username, tier, claims }`), plus `resolveCapabilities`, `isContributorRole`, `resolveEntitlements`, `Capability`, `Feature`, `PlanKey` and `PlanSource` from `@repo/access`.
- Produces:
  - `type SessionProfile = { contributorRole: ContributorRole; username: string | null; tier: string | null; claims: string[] }`
  - `fetchSessionProfile(baUserId: string): Promise<SessionProfile | null>`, cached for 60 s per id. It returns `null` on any failure and never caches a failure.
  - `invalidateSessionProfile(baUserId: string): void`
  - `SESSION_PROFILE_TTL_MS = 60_000`
  - `type SessionAccess = { profileLoaded: boolean; contributorRole: ContributorRole; username: string | null; capabilities: Capability[]; claimedLibraryIds: string[]; plan: PlanKey; planSource: PlanSource; features: Feature[] }`
  - `buildSessionAccess(profile: SessionProfile | null, now?: Date): SessionAccess`
  - Session `user` gains every `SessionAccess` field.

- [ ] **Step 1: Write the failing tests**

`apps/ui/src/lib/__tests__/session-access.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import { buildSessionAccess } from "../session-access"

describe("buildSessionAccess", () => {
  it("fails closed to a free reader with no capabilities when the bridge failed", () => {
    expect(buildSessionAccess(null)).toEqual({
      profileLoaded: false,
      contributorRole: "reader",
      username: null,
      capabilities: [],
      claimedLibraryIds: [],
      plan: "free",
      planSource: "none",
      features: [],
    })
  })

  it("resolves a wiki editor's capabilities", () => {
    const a = buildSessionAccess({
      contributorRole: "wiki_editor",
      username: "ed",
      tier: "Reader",
      claims: [],
    })
    expect(a.profileLoaded).toBe(true)
    expect(a.capabilities).toContain("docs.directEdit")
    expect(a.capabilities).not.toContain("submit.libraryEdit")
  })

  it("scopes library edit to claims", () => {
    const a = buildSessionAccess({
      contributorRole: "verified_librarian",
      username: "lib",
      tier: null,
      claims: ["libA"],
    })
    expect(a.capabilities).toContain("submit.libraryEdit")
    expect(a.claimedLibraryIds).toEqual(["libA"])
  })

  it("stays free in P-B even at Archivist tier", () => {
    const a = buildSessionAccess({
      contributorRole: "contributor",
      username: "x",
      tier: "Archivist",
      claims: [],
    })
    expect(a.plan).toBe("free")
    expect(a.features).toEqual([])
  })

  it("coerces an unknown role to reader", () => {
    const a = buildSessionAccess({
      contributorRole: "overlord" as never,
      username: null,
      tier: null,
      claims: [],
    })
    expect(a.contributorRole).toBe("reader")
    expect(a.capabilities).not.toContain("docs.directEdit")
  })
})
```

`apps/ui/src/lib/__tests__/session-profile.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  fetchSessionProfile,
  invalidateSessionProfile,
  SESSION_PROFILE_TTL_MS,
} from "../session-profile"

const body = {
  contributorRole: "contributor",
  username: "ada",
  tier: "Reader",
  claims: [],
}

describe("fetchSessionProfile", () => {
  beforeEach(() => {
    process.env.STRAPI_BRIDGE_SECRET = "s"
    vi.useFakeTimers()
    invalidateSessionProfile("u1")
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it("caches per user for the TTL, then refetches", async () => {
    const f = vi.fn(async () => Response.json(body))
    vi.stubGlobal("fetch", f)
    await fetchSessionProfile("u1")
    await fetchSessionProfile("u1")
    expect(f).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(SESSION_PROFILE_TTL_MS + 1)
    await fetchSessionProfile("u1")
    expect(f).toHaveBeenCalledTimes(2)
  })

  it("invalidate forces a refetch", async () => {
    const f = vi.fn(async () => Response.json(body))
    vi.stubGlobal("fetch", f)
    await fetchSessionProfile("u1")
    invalidateSessionProfile("u1")
    await fetchSessionProfile("u1")
    expect(f).toHaveBeenCalledTimes(2)
  })

  it("returns null and caches nothing on failure", async () => {
    const f = vi.fn(async () => new Response("no", { status: 500 }))
    vi.stubGlobal("fetch", f)
    expect(await fetchSessionProfile("u1")).toBeNull()
    await fetchSessionProfile("u1")
    expect(f).toHaveBeenCalledTimes(2)
  })

  it("rejects a malformed body", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ contributorRole: 7, claims: "x" }))
    )
    expect(await fetchSessionProfile("u1")).toBeNull()
  })

  it("returns null without a bridge secret", async () => {
    delete process.env.STRAPI_BRIDGE_SECRET
    const f = vi.fn()
    vi.stubGlobal("fetch", f)
    expect(await fetchSessionProfile("u1")).toBeNull()
    expect(f).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run them to verify they fail**

Run: `cd apps/ui && npx vitest run src/lib/__tests__/session-access.test.ts src/lib/__tests__/session-profile.test.ts`
Expected: FAIL, because the modules don't exist.

- [ ] **Step 3: Implement `apps/ui/src/lib/session-profile.ts`**

```ts
import "server-only"

import { type ContributorRole, isContributorRole } from "@repo/access"
import { z } from "zod"

export const SESSION_PROFILE_TTL_MS = 60_000

export type SessionProfile = {
  contributorRole: ContributorRole
  username: string | null
  tier: string | null
  claims: string[]
}

const Body = z.object({
  contributorRole: z.string(),
  username: z.string().nullable().optional(),
  tier: z.string().nullable().optional(),
  claims: z.array(z.string()).max(100).optional(),
})

// Per-process cache. On serverless each instance has its own; the TTL bounds
// how long a revoked role or claim survives anywhere (spec §3.2: 60 s).
const cache = new Map<string, { at: number; value: SessionProfile }>()

export function invalidateSessionProfile(baUserId: string): void {
  cache.delete(baUserId)
}

export async function fetchSessionProfile(
  baUserId: string
): Promise<SessionProfile | null> {
  const hit = cache.get(baUserId)
  if (hit && Date.now() - hit.at < SESSION_PROFILE_TTL_MS) return hit.value

  const secret = process.env.STRAPI_BRIDGE_SECRET
  if (!secret) return null
  const strapiUrl = process.env.STRAPI_URL ?? "http://127.0.0.1:1337"
  try {
    const res = await fetch(
      `${strapiUrl}/api/auth-bridge/session-profile?baUserId=${encodeURIComponent(baUserId)}`,
      { cache: "no-store", headers: { "X-Service-Secret": secret } }
    )
    if (!res.ok) return null
    const parsed = Body.safeParse(await res.json())
    if (!parsed.success) return null
    const d = parsed.data
    const value: SessionProfile = {
      contributorRole: isContributorRole(d.contributorRole)
        ? d.contributorRole
        : "reader",
      username: d.username ?? null,
      tier: d.tier ?? null,
      claims: d.claims ?? [],
    }
    cache.set(baUserId, { at: Date.now(), value })

    return value
  } catch {
    return null
  }
}
```

The zod dependency already exists in `apps/ui` (the notifications validation uses it). The vitest `server-only` import is already handled if other tested `lib` modules import it. If it throws under vitest, add `resolve.alias: { "server-only": path.resolve(__dirname, "./src/test/empty.ts") }` to `apps/ui/vitest.config.ts`, with an empty `export {}` module.

- [ ] **Step 4: Implement `apps/ui/src/lib/session-access.ts`**

```ts
import {
  type Capability,
  type ContributorRole,
  type Feature,
  isContributorRole,
  type PlanKey,
  type PlanSource,
  resolveCapabilities,
  resolveEntitlements,
} from "@repo/access"

import type { SessionProfile } from "./session-profile"

export type SessionAccess = {
  /** False when the bridge failed; gates on `username === null` must check this. */
  profileLoaded: boolean
  contributorRole: ContributorRole
  username: string | null
  capabilities: Capability[]
  claimedLibraryIds: string[]
  plan: PlanKey
  planSource: PlanSource
  features: Feature[]
}

/**
 * Turns the bridge profile into the session's access fields. A missing
 * profile (bridge down) yields a reader with no capabilities: the UI hides
 * actions and route pre-checks deny, while Strapi stays the real gate.
 */
export function buildSessionAccess(
  profile: SessionProfile | null,
  now: Date = new Date()
): SessionAccess {
  const role =
    profile && isContributorRole(profile.contributorRole)
      ? profile.contributorRole
      : "reader"
  const caps = profile
    ? resolveCapabilities({
        signedIn: true,
        contributorRole: role,
        claims: profile.claims.map((libraryDocumentId) => ({
          libraryDocumentId,
        })),
      })
    : null
  // P-B: no subscription, grant, verification or tier input, so this is
  // always "free" for a signed-in user. P-D wires the real inputs.
  const ent = resolveEntitlements({ signedIn: true, now })

  return {
    profileLoaded: profile !== null,
    contributorRole: role,
    username: profile?.username ?? null,
    capabilities: caps ? [...caps.set] : [],
    claimedLibraryIds: caps ? [...caps.claimedLibraryIds] : [],
    plan: ent.plan,
    planSource: ent.source,
    features: [...ent.features],
  }
}
```

- [ ] **Step 5: Wire `customSession` in `apps/ui/src/lib/auth.ts`**

Replace the whole `customSession(async ({ user, session }) => { … })` callback with the following, and add the imports `fetchSessionProfile` from `./session-profile` and `buildSessionAccess` from `./session-access`:

```ts
    customSession(async ({ user, session }) => {
      const profile = await fetchSessionProfile(user.id)

      return { user: { ...user, ...buildSessionAccess(profile) }, session }
    }),
```

This changes one behaviour on purpose. When the bridge fails, the user previously had no `contributorRole` at all. Now they get `reader` with empty `capabilities`, `username: null` and `profileLoaded: false`. The onboarding redirect fires on `username === null`, so a Strapi outage would bounce signed-in users to `/profile/onboarding`. Change every such check to `user.profileLoaded && user.username === null`. Find them with `grep -rn "onboarding" apps/ui/src --include=*.ts --include=*.tsx | grep -i "username"`.

- [ ] **Step 6: Extend `BetterAuthUser` in `apps/ui/src/lib/auth-server.ts`**

Replace the `contributorRole` and `username` fields with:

```ts
  // Added by customSession (lib/session-access.ts). Missing means deny.
  contributorRole?: ContributorRole | null
  username?: string | null
  profileLoaded?: boolean
  capabilities?: Capability[]
  claimedLibraryIds?: string[]
  plan?: PlanKey
  planSource?: PlanSource
  features?: Feature[]
```

Import the types from `@repo/access`.

- [ ] **Step 7: Invalidate the cache on profile writes**

In `apps/ui/src/app/api/profile/me/route.ts`, import `invalidateSessionProfile` from `@/lib/session-profile`. In `PUT`, `PATCH` and `DELETE`, call `invalidateSessionProfile(session.user.id)` right after the Strapi call succeeds, before returning. This makes a username set during onboarding show up at once instead of after 60 s. Do the same in any other route under `apps/ui/src/app/api/` that writes `username` or `contributorRole`. Find them with `grep -rln "username" apps/ui/src/app/api | xargs grep -l "PUT\|PATCH\|POST"`, and read each one to confirm it writes.

- [ ] **Step 8: Run the UI tests and tsc**

Run: `cd apps/ui && npx vitest run && npx tsc --noEmit`
Expected: all pass (99 before this task, plus the new ones), and tsc is clean. If tsc flags `(session.user as Record<string, unknown>).contributorRole` casts elsewhere, leave them. Task 4 replaces them.

- [ ] **Step 9: Live check**

With Strapi on :1337 and `pnpm --filter @repo/ui dev` on :3000, sign in and open `http://localhost:3000/api/auth/get-session`. Expected: `user.capabilities` is an array, `plan` is `"free"`, and `profileLoaded` is `true`. Refresh twice within 60 s. The Strapi log (scratchpad `strapi.log`) shows only one `GET /api/auth-bridge/session-profile`.

- [ ] **Step 10: Commit**

```bash
git add apps/ui/src/lib apps/ui/src/app/api/profile apps/ui/vitest.config.ts
git commit -m "feat(ui): session capabilities and plan with a 60s bridge cache"
```

Include any onboarding redirect file you changed in Step 5.

---

### Task 4: Route gates and client hooks read session capabilities

**Files:**

- Create: `apps/ui/src/lib/access-server.ts`
- Create: `apps/ui/src/lib/access-client.ts`
- Create: `apps/ui/src/lib/__tests__/access-server.test.ts`
- Modify: `apps/ui/src/app/api/contribute/wiki/[slug]/route.ts` (three role checks, lines about 7, 18–24, 45–51 and 88–94)
- Modify: `apps/ui/src/app/api/contribute/wiki/[slug]/finalize/route.ts` (line about 14)
- Modify: `apps/ui/src/app/api/upload/route.ts` (lines 8 and 15–20)
- Modify: `apps/ui/src/app/[locale]/contribute/docs/[slug]/page.tsx` (`DIRECT_EDIT_ROLES`, line about 41)
- Modify: `apps/ui/src/components/atlas/AtlasExplorer.tsx` (`useTier`, lines 89–97)

**Interfaces:**

- Consumes: the session `user` fields from Task 3, plus the `Capability` and `Feature` types, `can` and `resolveEntitlements` from `@repo/access`.
- Produces:
  - `hasCapability(user: { capabilities?: unknown } | null | undefined, cap: Capability): boolean`
  - `requireCapability(user, cap): Response | null`. It returns 401 JSON `{ error: "Unauthorized" }` when there is no user, 403 `{ error: "Forbidden" }` without the capability, and `null` when allowed.
  - `requireEntitlement(user: { features?: unknown } | null | undefined, feature: Feature): Response | null`. It returns 401 when there is no user and 402 `{ error: "Upgrade required", feature, upgradeUrl: "/pro" }` without the feature. There are no call sites until P-D.
  - `useCapabilities(): { has(cap: Capability): boolean; claimedLibraryIds: string[]; ready: boolean }`
  - `useEntitlements(): { plan: PlanKey; can(f: Feature): boolean; ready: boolean }`

- [ ] **Step 1: Write the failing test**

`apps/ui/src/lib/__tests__/access-server.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import {
  hasCapability,
  requireCapability,
  requireEntitlement,
} from "../access-server"

describe("access-server", () => {
  it("hasCapability fails closed on missing or malformed fields", () => {
    expect(hasCapability(null, "docs.directEdit")).toBe(false)
    expect(hasCapability({}, "docs.directEdit")).toBe(false)
    expect(
      hasCapability({ capabilities: "docs.directEdit" }, "docs.directEdit")
    ).toBe(false)
    expect(
      hasCapability({ capabilities: ["docs.directEdit"] }, "docs.directEdit")
    ).toBe(true)
  })

  it("requireCapability returns 401, 403 or null", async () => {
    expect(requireCapability(null, "docs.directEdit")?.status).toBe(401)
    expect(
      requireCapability({ capabilities: [] }, "docs.directEdit")?.status
    ).toBe(403)
    expect(
      requireCapability(
        { capabilities: ["docs.directEdit"] },
        "docs.directEdit"
      )
    ).toBeNull()
  })

  it("requireEntitlement returns 401, 402 with an upgrade payload, or null", async () => {
    expect(requireEntitlement(null, "atlas.export")?.status).toBe(401)
    const r = requireEntitlement({ features: [] }, "atlas.export")
    expect(r?.status).toBe(402)
    expect(await r?.json()).toEqual({
      error: "Upgrade required",
      feature: "atlas.export",
      upgradeUrl: "/pro",
    })
    expect(
      requireEntitlement({ features: ["atlas.export"] }, "atlas.export")
    ).toBeNull()
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd apps/ui && npx vitest run src/lib/__tests__/access-server.test.ts`
Expected: FAIL, because the module doesn't exist.

- [ ] **Step 3: Implement `apps/ui/src/lib/access-server.ts`**

```ts
import type { Capability, Feature } from "@repo/access"

type WithCaps = { capabilities?: unknown } | null | undefined
type WithFeatures = { features?: unknown } | null | undefined

const listHas = (v: unknown, x: string) => Array.isArray(v) && v.includes(x)

/** Route pre-check only. Strapi's submission-policy remains the real gate. */
export function hasCapability(user: WithCaps, cap: Capability): boolean {
  return !!user && listHas(user.capabilities, cap)
}

export function requireCapability(
  user: WithCaps,
  cap: Capability
): Response | null {
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 })
  if (!hasCapability(user, cap))
    return Response.json({ error: "Forbidden" }, { status: 403 })

  return null
}

export function requireEntitlement(
  user: WithFeatures,
  feature: Feature
): Response | null {
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 })
  if (!listHas(user.features, feature))
    return Response.json(
      { error: "Upgrade required", feature, upgradeUrl: "/pro" },
      { status: 402 }
    )

  return null
}
```

- [ ] **Step 4: Implement `apps/ui/src/lib/access-client.ts`**

```ts
"use client"

import type { Capability, Feature, PlanKey } from "@repo/access"

import { authClient } from "./auth-client"

/** UI only: hides or shows actions. Servers re-check every one. */
export function useCapabilities() {
  const { data, isPending } = authClient.useSession()
  const caps = (data?.user?.capabilities ?? []) as Capability[]

  return {
    has: (cap: Capability) => caps.includes(cap),
    claimedLibraryIds: (data?.user?.claimedLibraryIds ?? []) as string[],
    ready: !isPending,
  }
}

export function useEntitlements() {
  const { data, isPending } = authClient.useSession()
  const plan: PlanKey = data?.user ? (data.user.plan ?? "free") : "public"
  const features = (data?.user?.features ?? []) as Feature[]

  return {
    plan,
    can: (f: Feature) => features.includes(f),
    ready: !isPending,
  }
}
```

`customSessionClient<typeof auth>()` infers the fields from `buildSessionAccess`, so `data.user.capabilities` should type-check without casts. If it doesn't, keep the `as` casts shown and nothing broader.

- [ ] **Step 5: Replace the raw role checks**

- **`api/contribute/wiki/[slug]/route.ts`:** delete `WIKI_EDITOR_ROLES`. In each handler, replace the `if (!session?.user) … 401` plus `WIKI_EDITOR_ROLES.has(…)` pair with:

  ```ts
  const denied = requireCapability(session?.user, "docs.directEdit")
  if (denied) return denied
  ```

  After this point, `session!.user` is non-null. Use `session!.user`, or keep a narrowing `if (!session) return` above it if tsc needs it.

- **`finalize/route.ts`:** make the same replacement with `"docs.directEdit"`.
- **`api/upload/route.ts`:** delete `WIKI_EDITOR_ROLES` and replace the role block with `requireCapability(session?.user, "docs.directEdit")`.
- **`[locale]/contribute/docs/[slug]/page.tsx`:** delete `DIRECT_EDIT_ROLES` and set `const canDirectEdit = hasCapability(session.user, "docs.directEdit")`.
- **`AtlasExplorer.tsx`:** replace the body of `useTier()` with the following, and drop the `authClient` import if nothing else uses it:

  ```ts
  function useTier(): Tier {
    const { plan } = useEntitlements()

    return plan === "public" ? "public" : plan === "free" ? "free" : "pro"
  }
  ```

- [ ] **Step 6: Confirm no raw role gates remain**

Run: `grep -rn "WIKI_EDITOR_ROLES\|DIRECT_EDIT_ROLES\|contributorRole as" apps/ui/src`
Expected: no matches. Other `contributorRole` reads for display, such as the leaderboard, may stay.

- [ ] **Step 7: Run the UI tests, tsc and lint**

Run: `cd apps/ui && npx vitest run && npx tsc --noEmit && npx eslint src/lib src/app/api/contribute src/app/api/upload src/components/atlas/AtlasExplorer.tsx`
Expected: all pass, tsc is clean and lint shows no errors.

- [ ] **Step 8: Live check**

With both servers running, use a reader account. `POST /api/contribute/wiki/<any-slug>` returns 403. `GET /map` loads with the Pro layers locked, just as before.

- [ ] **Step 9: Commit**

```bash
git add apps/ui/src
git commit -m "feat(ui): gate routes on session capabilities; add access hooks"
```

---

### Task 5: Role-matrix E2E with seeded fixtures

**Files:**

- Create: `qa/tests/playwright/helpers/seed-access-fixtures.ts`
- Create: `qa/tests/playwright/e2e/access/role-matrix.spec.ts`
- Modify: `qa/tests/playwright/.env.example` (new vars)
- Modify: `qa/tests/playwright/package.json` (`seed:access` script and the `pg` dev dependency)

**Interfaces:**

- Consumes: the Better Auth endpoints `POST /api/auth/sign-up/email`, `POST /api/auth/sign-in/email` and `GET /api/auth/get-session`. Also the session fields from Task 3 and the 401 and 403 route gates from Task 4. Strapi REST, with a full-access API token, updates `api::user-profile.user-profile` and creates `api::library-affiliation.library-affiliation`.
- Produces: `pnpm --filter @repo/tests-playwright seed:access`, which seeds these users with password `Access-fixture-2026!`:
  - `access-reader@example.test`
  - `access-contributor@example.test`
  - `access-librarian@example.test`
  - `access-wiki-editor@example.test`
  - `access-editorial@example.test`

  It also produces `playwright test e2e/access`.

Environment (`qa/tests/playwright/.env`, git-ignored):

```
BASE_URL=http://localhost:3000
STRAPI_URL=http://127.0.0.1:1337
STRAPI_SEED_TOKEN=            # Strapi full-access API token, local only
BA_DATABASE_URL=postgresql://admin:…@localhost:5433/librariesglobal
```

- [ ] **Step 1: Write the seed script**

`qa/tests/playwright/helpers/seed-access-fixtures.ts`:

```ts
/**
 * Seeds one Better Auth user per Contributor Role for the access E2E.
 * Local only: refuses to run in production or against a non-local host.
 */
import { Client } from "pg"

export const FIXTURE_PASSWORD = "Access-fixture-2026!"
export const FIXTURES = [
  { key: "reader", role: "reader", claim: false },
  { key: "contributor", role: "contributor", claim: false },
  { key: "librarian", role: "verified_librarian", claim: true },
  { key: "wiki-editor", role: "wiki_editor", claim: false },
  { key: "editorial", role: "editorial_board", claim: false },
] as const
export const emailFor = (key: string) => `access-${key}@example.test`

const LOCAL = /^(localhost|127\.0\.0\.1)$/

function assertLocal(): void {
  if (process.env.NODE_ENV === "production")
    throw new Error("Refusing: production")
  for (const v of ["BASE_URL", "STRAPI_URL", "BA_DATABASE_URL"]) {
    const raw = process.env[v]
    if (!raw) throw new Error(`Missing ${v}`)
    if (!LOCAL.test(new URL(raw).hostname))
      throw new Error(`Refusing: ${v} is not local`)
  }
  if (!process.env.STRAPI_SEED_TOKEN)
    throw new Error("Missing STRAPI_SEED_TOKEN")
}

async function strapi(path: string, init: RequestInit = {}) {
  const res = await fetch(`${process.env.STRAPI_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.STRAPI_SEED_TOKEN}`,
      ...init.headers,
    },
  })
  if (!res.ok)
    throw new Error(
      `${init.method ?? "GET"} ${path} → ${res.status} ${await res.text()}`
    )

  return res.json()
}

export async function seedAccessFixtures(): Promise<void> {
  assertLocal()
  const db = new Client({ connectionString: process.env.BA_DATABASE_URL })
  await db.connect()
  try {
    const { data: libs } = await strapi(
      "/api/libraries?pagination[pageSize]=1&fields[0]=documentId"
    )
    const claimLibrary: string = libs[0].documentId

    for (const f of FIXTURES) {
      const email = emailFor(f.key)
      // Sign-up is idempotent here: an existing user returns 422 and is reused.
      await fetch(`${process.env.BASE_URL}/api/auth/sign-up/email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: process.env.BASE_URL!,
        },
        body: JSON.stringify({
          email,
          password: FIXTURE_PASSWORD,
          name: `Access ${f.key}`,
        }),
      })
      const { rows } = await db.query(
        `UPDATE "user" SET "emailVerified" = true WHERE email = $1 RETURNING id`,
        [email]
      )
      const baUserId: string = rows[0].id

      const { data: profiles } = await strapi(
        `/api/user-profiles?filters[baUserId][$eq]=${encodeURIComponent(baUserId)}`
      )
      if (!profiles[0])
        throw new Error(`No user-profile for ${email}; sign-up sync failed`)
      await strapi(`/api/user-profiles/${profiles[0].documentId}`, {
        method: "PUT",
        body: JSON.stringify({
          data: {
            contributorRole: f.role,
            username: `access_${f.key.replace("-", "_")}`,
            profileVisibility: "private",
          },
        }),
      })

      if (f.claim) {
        const { data: existing } = await strapi(
          `/api/library-affiliations?filters[baUserId][$eq]=${encodeURIComponent(baUserId)}`
        )
        if (!existing[0])
          await strapi("/api/library-affiliations", {
            method: "POST",
            body: JSON.stringify({ data: { baUserId, library: claimLibrary } }),
          })
      }
    }
  } finally {
    await db.end()
  }
}

if (require.main === module)
  seedAccessFixtures().then(
    () => console.log("access fixtures seeded"),
    (e) => {
      console.error(e)
      process.exit(1)
    }
  )
```

Add `"seed:access": "tsx helpers/seed-access-fixtures.ts"` to the scripts, and `pg` plus `@types/pg` to the devDependencies. Add the four variables to `.env.example` with empty values.

Adapt to reality, and record every adaptation in the report:

- The Better Auth user table may be named differently. Check with `\dt` in the BA database.
- Required affiliation fields may differ. Read `apps/strapi/src/api/library-affiliation/content-types/library-affiliation/schema.json`, and add any required fields such as `verificationMethod: "manual"` or `status`.
- The Strapi user-profile controller may strip fields on REST update. If it does, use the `libraries-local` MCP or a `strapi.documents()` console script as the fallback, and describe it in the report.

- [ ] **Step 2: Create the Strapi token and run the seed**

The Strapi token must be created by hand in the Strapi admin: Settings → API Tokens, full access, local only. If you can't create it, stop and report `NEEDS_CONTEXT` asking for `STRAPI_SEED_TOKEN`. Don't use the upload token.

Run: `cd qa/tests/playwright && pnpm seed:access`
Expected: `access fixtures seeded`. Running it a second time also succeeds.

- [ ] **Step 3: Write the role-matrix spec**

`qa/tests/playwright/e2e/access/role-matrix.spec.ts`:

```ts
import { expect, request, test } from "@playwright/test"

import { emailFor, FIXTURE_PASSWORD } from "../../helpers/seed-access-fixtures"

const ALL_SIGNED_IN = [
  "submit.correction",
  "submit.newLibrary",
  "submit.claim",
  "submit.docSuggestion",
  "submit.journalPitch",
  "submit.topicSuggestion",
]

const MATRIX = [
  { key: "reader", extra: [], directEdit: false },
  { key: "contributor", extra: [], directEdit: false },
  {
    key: "librarian",
    extra: ["submit.libraryEdit", "events.feed"],
    directEdit: false,
  },
  { key: "wiki-editor", extra: ["docs.directEdit"], directEdit: true },
  { key: "editorial", extra: ["docs.directEdit"], directEdit: true },
] as const

// Any existing docs slug works for the gate check; the GET only reads a draft.
const DOC_SLUG = process.env.ACCESS_DOC_SLUG ?? "dewey-decimal-classification"

test.describe("access role matrix (API)", () => {
  test("anonymous: no session, gated routes refuse with 401", async ({
    baseURL,
  }) => {
    const api = await request.newContext({ baseURL })
    const s = await (await api.get("/api/auth/get-session")).json()
    expect(s?.user ?? null).toBeNull()
    expect((await api.get(`/api/contribute/wiki/${DOC_SLUG}`)).status()).toBe(
      401
    )
    expect((await api.post("/api/upload", { multipart: {} })).status()).toBe(
      401
    )
  })

  for (const row of MATRIX) {
    test(`${row.key}: session capabilities and route gates match`, async ({
      baseURL,
    }) => {
      const api = await request.newContext({ baseURL })
      const signIn = await api.post("/api/auth/sign-in/email", {
        data: { email: emailFor(row.key), password: FIXTURE_PASSWORD },
        headers: { Origin: baseURL! },
      })
      expect(signIn.ok()).toBe(true)

      const { user } = await (await api.get("/api/auth/get-session")).json()
      expect(user.profileLoaded).toBe(true)
      expect([...user.capabilities].sort()).toEqual(
        [...ALL_SIGNED_IN, ...row.extra].sort()
      )
      expect(user.plan).toBe("free")
      expect(user.features).toEqual([])
      // Money never buys trust, and trust never shows up as a plan.
      expect(user).not.toHaveProperty("subscription")

      const wiki = await api.get(`/api/contribute/wiki/${DOC_SLUG}`)
      if (row.directEdit) expect(wiki.status()).toBe(200)
      else expect(wiki.status()).toBe(403)

      const upload = await api.post("/api/upload", { multipart: {} })
      // Allowed callers get past the gate and fail validation (400); others get 403.
      expect(upload.status()).toBe(row.directEdit ? 400 : 403)
    })
  }

  test("server refuses a reader's direct wiki edit even if the UI is bypassed", async ({
    baseURL,
  }) => {
    const api = await request.newContext({ baseURL })
    await api.post("/api/auth/sign-in/email", {
      data: { email: emailFor("reader"), password: FIXTURE_PASSWORD },
      headers: { Origin: baseURL! },
    })
    const res = await api.post(`/api/contribute/wiki/${DOC_SLUG}`, {
      data: { draftData: { body: [] } },
    })
    expect(res.status()).toBe(403)
  })
})
```

Before running, confirm that `DOC_SLUG` exists. Check with `mcp__libraries-local__list_wiki-article`, or `curl -s "$STRAPI_URL/api/wiki-articles?fields[0]=slug&pagination[pageSize]=5"`, and put a real slug in the default. If `POST /api/upload` with an empty multipart body errors before the 400 check, compare it with the route. The assertion must prove that the gate passed (any non-401/403) for editors and that the gate refused (403) for others. Adjust only the allowed-branch expectation, and record why.

- [ ] **Step 4: Run the E2E**

Run (with Strapi on :1337 and the UI on :3000): `cd qa/tests/playwright && npx playwright test e2e/access --project=chromium`
Expected: 7 passed.

- [ ] **Step 5: Commit**

```bash
git add qa/tests/playwright/helpers/seed-access-fixtures.ts qa/tests/playwright/e2e/access qa/tests/playwright/package.json qa/tests/playwright/.env.example pnpm-lock.yaml
git commit -m "test: role-matrix E2E for session capabilities and gates"
```

If commitlint requires a scope, use the package's name without the `@repo/` prefix (for example `test(tests-playwright): …`).

---

## Self-review notes

- **Spec coverage (P-B row):**
  - `@repo/access`: Task 1.
  - Session capabilities and entitlements: Tasks 3 and 4.
  - `submission-policy`: already authoritative from P-A. Invariant 3 is added in Task 2.
  - Bridge cache: Task 3.
  - Invariant tests: Tasks 1 and 2.
  - Role-matrix E2E: Task 5.
- **Deferred:**
  - The Pro rows of the E2E matrix go to P-D.
  - The hub UI driven by `useCapabilities()` goes to P-C (C-5.4).
  - The `event-feed` route still checks `isVerifiedLibrarian`. It moves to the `events.feed` capability in P-C alongside C-L2 routing, because switching it changes who qualifies (legacy flag versus affiliation) and needs a data check first.
- **Cache invalidation on Strapi-side role changes** relies on the 60 s TTL, which meets the spec's revocation bound. There is no cross-process push.
