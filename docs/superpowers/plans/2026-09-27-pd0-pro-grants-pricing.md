# P-D0: Pro via grants, pricing page, onboarding and user-type E2E — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Pro real without payments. Admin grants, earned Archivist status and verification records each switch a user to Pro. Add a `/pro` pricing page, one server-gated Pro feature (Atlas export), and test users of every type, with E2E coverage of onboarding and the Pro rows. Update the docs to match.

**Architecture:** Strapi gains the `entitlement-grant` and `pro-verification` collections, which are admin-only with no REST routes, plus `user-profile.earnedProUntil`. The `session-profile` bridge returns them. `buildSessionAccess` feeds them into `resolveEntitlements`, which was built in P-B. The UI reads `plan`, `planSource`, `features` and `limits` from the session. Stripe is out of scope; it comes in P-D1 behind `PRO_ENABLED`.

**Tech Stack:** Strapi v5 (Document Service), Next.js 16 App Router, Better Auth 1.4 `customSession`, `@repo/access`, vitest, Playwright.

Specs:

- `docs/superpowers/specs/2026-09-26-access-contribution-pro-implementation-design.md` §3, §6.5, §7 and §10
- `docs/superpowers/specs/2026-09-27-pricing-and-membership.md`
- `docs/superpowers/specs/2026-09-26-pro-subscriptions-design.md` (the principles)

## Global Constraints

- **Three axes never mix.** Grants, verifications, tier and plan feed only `resolveEntitlements`. Capabilities still come only from role and claims. The P-B invariant tests must keep passing (`cd packages/access && pnpm test`).
- **Money never buys trust.** No plan or entitlement changes a Contributor Role, points, tier, badges or moderation.
- **Library facts are free.** Every existing page and dataset stays free. The Pro export is a convenience over public data, and the bulk open-data route stays free.
- **Server enforcement:**
  - Every Pro capability is gated on the server with `requireEntitlement` (`apps/ui/src/lib/access-server.ts`). UI locks are for explanation only.
  - Missing session fields mean deny. `limits` missing means a row cap of 0.
- **The new Strapi collections are admin-only:**
  - `routes: []`, following `apps/strapi/src/api/library-affiliation/routes/library-affiliation.ts`.
  - Visible in the content-manager, so the owner can grant.
  - Never readable through public or authenticated REST.
  - Read only by the secret-gated bridge.
- **Status rules** are already in `resolveEntitlements`: an unexpired grant, an unexpired verification, a tier of Archivist or above, or `earnedProUntil` in the future. **Earned Pro holds for 90 days** after dropping below Archivist (D-P4).
- **Prices are placeholders.** They're read from one config module and labelled "Prices are placeholders". No feature code hard-codes an amount. Use the proposal's amounts:
  - Supporter £3/month or £30/year
  - Pro at the founding price, £5/month or £50/year, rising to the standard £8/month or £80/year
  - Team £480/year ex VAT for 5 seats, with 20% off for public library services
- **No checkout.** Paid "Join" buttons show "Coming soon". Team gets a "Talk to us" mail link.
- **Design system:**
  - v2 "warm paper" tokens from `apps/ui/src/lib/design-tokens.ts` (`T`). Inline styles carry the token values, and Tailwind handles layout.
  - `PageHero` is the only hero band (see `CLAUDE.md`).
  - Primary CTAs are indigo pills.
  - Status is shown as colour plus icon plus text.
- **Strapi v5:** use `strapi.documents()` for content reads and writes. `strapi.db.query` is allowed only where the existing code already uses it for raw updates (`points.ts`).
- **Commits:**
  - Scopes are package names (`access`, `strapi`, `ui`, `tests-playwright`). Headers are 72 characters or fewer and lower case.
  - **No Co-Authored-By or any self-credit lines.**
  - Stage by explicit path only. Other agents may be editing the tree, so run `git status` before each commit, and never commit files you didn't change.
- Node 22 (`nvm use`).
- Rebuild `@repo/access` after changing it (`pnpm --filter @repo/access build`).
- Rebuild the Strapi plugins after changing plugin sources (`pnpm --filter @repo/strapi build:plugins`). `strapi develop` doesn't hot-reload plugin `dist`. Tell the controller if a Strapi restart is needed; don't restart it yourself.
- Regenerate the Strapi types after schema changes (`cd apps/strapi && pnpm strapi ts:generate-types`, or the repo's script; check `apps/strapi/package.json`).

---

### Task 1: Strapi data for complimentary Pro

**Files:**

- Modify: `packages/access/src/entitlements.ts` (export the earned-Pro rule)
- Test: `packages/access/tests/entitlements.test.ts`
- Create: `apps/strapi/src/api/entitlement-grant/{content-types/entitlement-grant/schema.json,controllers/entitlement-grant.ts,routes/entitlement-grant.ts,services/entitlement-grant.ts}`
- Create: `apps/strapi/src/api/pro-verification/{content-types/pro-verification/schema.json,controllers/pro-verification.ts,routes/pro-verification.ts,services/pro-verification.ts}`
- Modify: `apps/strapi/src/api/user-profile/content-types/user-profile/schema.json` (add `earnedProUntil`)
- Modify: `apps/strapi/src/plugins/rewards/server/services/points.ts` (the hold logic, around lines 197–209)
- Test: `apps/strapi/tests/rewards/award.test.ts`, extending it or adding `earned-pro-hold.test.ts` next to it
- Regenerate: `apps/strapi/types/generated/*`

**Interfaces:**

- Produces:
  - from `@repo/access`: `isEarnedProTier(tier: string | null | undefined): boolean` and `EARNED_PRO_HOLD_DAYS = 90`
  - the Strapi UIDs `api::entitlement-grant.entitlement-grant` and `api::pro-verification.pro-verification`
  - the `user-profile.earnedProUntil` datetime field

- [ ] **Step 1: Access helper, test first**

Add these tests to `packages/access/tests/entitlements.test.ts`:

```ts
import { EARNED_PRO_HOLD_DAYS, isEarnedProTier } from "../src"

describe("isEarnedProTier", () => {
  it("is true from Archivist up and false below or unknown", () => {
    expect(isEarnedProTier("Archivist")).toBe(true)
    expect(isEarnedProTier("Scholar")).toBe(true)
    expect(isEarnedProTier("Curator")).toBe(true)
    expect(isEarnedProTier("Cartographer")).toBe(false)
    expect(isEarnedProTier(null)).toBe(false)
    expect(isEarnedProTier("archivist")).toBe(false)
  })
  it("holds for 90 days", () => {
    expect(EARNED_PRO_HOLD_DAYS).toBe(90)
  })
})
```

In `entitlements.ts`:

- Export `EARNED_PRO_HOLD_DAYS = 90`.
- Export `isEarnedProTier(tier) { return EARNED_PRO_TIERS.has(tier ?? "") }`.
- Use `isEarnedProTier` inside `resolveEntitlements` instead of the inline `.has`.

Run `cd packages/access && pnpm test && pnpm build`. The build must pass.

- [ ] **Step 2: The two admin-only collections**

`apps/strapi/src/api/entitlement-grant/content-types/entitlement-grant/schema.json`:

```json
{
  "kind": "collectionType",
  "collectionName": "entitlement_grants",
  "info": {
    "singularName": "entitlement-grant",
    "pluralName": "entitlement-grants",
    "displayName": "Entitlement Grant",
    "description": "Complimentary Pro or Team, granted by staff. Read only by the session-profile bridge."
  },
  "options": { "draftAndPublish": false },
  "attributes": {
    "baUserId": { "type": "string", "required": true },
    "plan": {
      "type": "enumeration",
      "enum": ["pro", "team"],
      "required": true,
      "default": "pro"
    },
    "source": {
      "type": "enumeration",
      "enum": ["admin", "press", "partner", "team", "grant_funder"],
      "default": "admin"
    },
    "reason": { "type": "text" },
    "expiresAt": { "type": "datetime" },
    "grantedBy": { "type": "string" }
  }
}
```

`apps/strapi/src/api/pro-verification/content-types/pro-verification/schema.json`:

```json
{
  "kind": "collectionType",
  "collectionName": "pro_verifications",
  "info": {
    "singularName": "pro-verification",
    "pluralName": "pro-verifications",
    "displayName": "Pro Verification",
    "description": "Verified library staff, student or charity. Complimentary Pro while unexpired (spec §6.5). Self-serve C5 flow comes in P-D1; staff create rows by hand until then."
  },
  "options": { "draftAndPublish": false },
  "attributes": {
    "baUserId": { "type": "string", "required": true },
    "kind": {
      "type": "enumeration",
      "enum": ["library_staff", "student", "charity"],
      "required": true
    },
    "verifiedEmail": { "type": "email" },
    "verifiedAt": { "type": "datetime" },
    "expiresAt": { "type": "datetime" }
  }
}
```

The routes file for both is:

```ts
// No REST routes. Admin-only via the content-manager; read by the
// session-profile bridge (server-to-server with the bridge secret).
export default { routes: [] }
```

The controllers and services use the core factories, as `library-affiliation` does. Copy that module's controller and service files, changing only the UID. Don't set `content-manager.visible: false`, because the owner must be able to create rows.

- [ ] **Step 3: `earnedProUntil` on user-profile**

Add this to the `attributes` in `user-profile/schema.json`, next to `tier`:

```json
"earnedProUntil": { "type": "datetime", "private": true }
```

`private: true` keeps it out of REST responses.

- [ ] **Step 4: The hold logic, test first**

In `points.ts`, `award()`, the code reads `fresh` before computing `tier`. Use `fresh.tier` as the previous tier:

```ts
const tier = computeTier(fresh?.points ?? 0)
const wasEarned = isEarnedProTier(fresh?.tier)
const isEarned = isEarnedProTier(tier.name)
// D-P4: dropping below Archivist keeps earned Pro for 90 days. The hold is
// set once, on the downward crossing, and cleared on reaching it again.
const earnedProUntil = isEarned
  ? null
  : wasEarned
    ? new Date(Date.now() + EARNED_PRO_HOLD_DAYS * 86_400_000).toISOString()
    : undefined

await strapi.db.query("api::user-profile.user-profile").update({
  where: { baUserId },
  data: {
    tier: tier.name,
    streak: newStreak,
    lastActivityDate: today,
    ...(earnedProUntil !== undefined ? { earnedProUntil } : {}),
  },
})
```

Import `EARNED_PRO_HOLD_DAYS` and `isEarnedProTier` from `@repo/access`, which the plugin already imports from.

Write the tests first, using the existing rewards award test harness (`apps/strapi/tests/rewards/award.test.ts`). Read it and follow its fake. Cover three cases:

- **Dropping below Archivist:** previous tier Archivist, points now below 1500 because of a negative award, if the service allows negative awards. If it doesn't, seed `points` lower than the tier and award 0, or call the smallest path that recomputes. The update must set `earnedProUntil` about 90 days out.
- **Reaching Archivist:** previous tier Cartographer, now Archivist. `earnedProUntil` is set to `null`.
- **Staying below:** previous tier Reader, still Reader. `earnedProUntil` is not in the update.

If the award path has no way to lower points, say so in the report. Keep the logic anyway: admin point adjustments may lower them.

- [ ] **Step 5: Types, build and suite**

Run:

- `cd apps/strapi && pnpm build:plugins`, or the plugin build script
- regenerate the types
- `npx vitest run && npx tsc --noEmit -p .`

Check the running Strapi's log, `/private/tmp/claude-501/-Users-alexbennett-Development-personal-libraries-global/ed1db8de-5f62-4e68-a65d-c51d9697132a/scratchpad/strapi.log`, for a clean reload after the schema change. `develop` restarts on schema changes. Confirm that `GET http://127.0.0.1:1337/api/entitlement-grants` returns 404 or 403, not data.

- [ ] **Step 6: Commit**

Make two commits:

- `feat(access): export the earned-pro tier rule and hold length`
- `feat(strapi): add admin-only pro grants and verifications`, with the schema, types and points hold. Split it if it's large, for example `feat(strapi): hold earned pro for 90 days below archivist`.

---

### Task 2: The bridge returns plan inputs and the session resolves the real plan

**Files:**

- Modify: `apps/strapi/src/api/auth-bridge/controllers/auth-bridge.ts` (`sessionProfile`, around lines 542–576)
- Test: `apps/strapi/tests/session-profile.test.ts`
- Modify: `apps/ui/src/lib/session-profile.ts` (the `SessionProfile` type and zod `Body`)
- Modify: `apps/ui/src/lib/session-access.ts` (`buildSessionAccess`)
- Test: `apps/ui/src/lib/__tests__/session-profile.test.ts` and `session-access.test.ts`
- Modify: `qa/tests/playwright/e2e/access/role-matrix.spec.ts`, only if an existing assertion breaks. It shouldn't: the fixtures have no grants and are at the Reader tier.

**Interfaces:**

- Consumes: the Task 1 collections, plus `resolveEntitlements` and `Limit` from `@repo/access`.
- Produces:
  - The bridge response gains:
    - `grants: { plan: "pro" | "team"; expiresAt: string | null }[]`, at most 20, unexpired only
    - `verifications: { expiresAt: string | null }[]`, at most 20, unexpired only
    - `earnedProUntil: string | null`
  - `SessionProfile` gains the same three fields.
  - `SessionAccess` gains `limits: Record<Limit, number>`, and `plan`, `planSource` and `features` now reflect the real inputs.

- [ ] **Step 1: Bridge test first**

Extend `apps/strapi/tests/session-profile.test.ts`:

- Seed `api::entitlement-grant.entitlement-grant` with three rows: `{ baUserId:"u1", plan:"pro", expiresAt:null }`, `{ baUserId:"u1", plan:"team", expiresAt:"2020-01-01T00:00:00Z" }` (expired) and `{ baUserId:"u2", plan:"pro" }`.
- Seed `api::pro-verification.pro-verification` with `{ baUserId:"u1", kind:"student", expiresAt: <a future ISO date> }`.
- Set `earnedProUntil` on u1's profile.

Assert that u1's response contains:

- `grants: [{ plan: "pro", expiresAt: null }]`. The expired row and u2's row are excluded. Filter expiry in the query where the fake supports `$or`/`$null`/`$gt`; otherwise filter in code after `findMany`, still limited to 20, and say which in the report.
- `verifications: [{ expiresAt: <future> }]`
- `earnedProUntil` as set.

Assert that the unknown-user default gains `grants: []`, `verifications: []` and `earnedProUntil: null`.

Read `tests/helpers/fake-strapi.ts` to see which filter operators it supports. Add `$gt` or `$or` to the fake only if it's needed, and keep the change minimal.

- [ ] **Step 2: Bridge implementation**

In `sessionProfile`:

- Add `"earnedProUntil"` to the profile `fields`.
- Add two `findMany` calls, run in parallel with `Promise.all` together with the existing affiliations call:
  - `api::entitlement-grant.entitlement-grant` with `filters: { baUserId: { $eq: baUserId } }`, `fields: ["plan", "expiresAt"]`, `limit: 20`
  - `api::pro-verification.pro-verification` with `fields: ["expiresAt"]` and the same filter and limit
- In code, drop any row whose `expiresAt` is non-null and not in the future. Map the rest to the output shape, keeping only `plan === "pro" || plan === "team"`.

Because `earnedProUntil` is `private`, it's still readable here: the Document Service returns private fields server-side. Check this, and if it isn't returned, use `strapi.db.query` for that single field and say why.

- [ ] **Step 3: UI tests first**

- In `session-profile.test.ts`, the body with the new fields parses into `SessionProfile`. A body _without_ them (the old bridge) still parses, with the fields defaulting to `[]`, `[]` and `null`. That keeps rollout order-independent. A grant with `plan: "enterprise"` is dropped at parse time.
- In `session-access.test.ts`:
  - A profile with an unexpired pro grant gives `plan: "pro"`, `planSource: "grant"`, `features` containing `"atlas.export"` and `limits.exportRows === 10000`.
  - A verification gives `planSource: "verified"`.
  - `tier: "Archivist"` gives `planSource: "earned"`.
  - `earnedProUntil` one day in the future at a Cartographer tier gives `"earned"`.
  - The null profile stays `free`/`none`, with `limits` equal to the free limits and `profileLoaded: false`.
  - **Capabilities are identical with and without grants.** This checks that axes don't mix.

- [ ] **Step 4: UI implementation**

`session-profile.ts`:

- `Body` gains three fields:
  - `grants: z.array(z.object({ plan: z.string(), expiresAt: z.string().nullable() })).max(20).optional()`
  - `verifications: z.array(z.object({ expiresAt: z.string().nullable() })).max(20).optional()`
  - `earnedProUntil: z.string().nullable().optional()`
- Map these into `SessionProfile`. Keep only grants whose plan is `"pro"` or `"team"`, and default the missing fields.

`session-access.ts`:

- Replace the P-B comment and call with:

```ts
const ent = resolveEntitlements({
  signedIn: true,
  now,
  grants: profile?.grants ?? [],
  verifications: profile?.verifications ?? [],
  rewardsTier: profile?.tier ?? null,
  earnedProUntil: profile?.earnedProUntil ?? null,
})
```

- Add `limits: { ...ent.limits }` to the returned object and to the `SessionAccess` type.
- `BetterAuthUser` derives from `Partial<SessionAccess>`, so it picks up `limits` automatically.
- Don't pass `tier` or anything else to `resolveCapabilities`.

- [ ] **Step 5: Run and commit**

Run:

- `cd apps/strapi && npx vitest run && npx tsc --noEmit -p .`
- `cd apps/ui && npx vitest run && npx tsc --noEmit`
- `cd packages/access && pnpm test`

Live check: with the UI on :3000, sign in as `access-reader@example.test`. The password is in `qa/tests/playwright/.env` as `ACCESS_FIXTURE_PASSWORD`; never print it. `/api/auth/get-session` should show `plan: "free"` and a `limits` object.

Commit:

- `feat(strapi): session-profile returns plan grants and verifications`
- `feat(ui): resolve the session plan from grants, tier and verification`

---

### Task 3: The pricing page and plan surfaces

**Files:**

- Create: `apps/ui/src/lib/plans.ts` (the single source of plan copy and placeholder prices)
- Test: `apps/ui/src/lib/__tests__/plans.test.ts`
- Create: `apps/ui/src/components/pro/PlansTable.tsx` (shared)
- Create: `apps/ui/src/components/pro/PlanStatusBanner.tsx`
- Create: `apps/ui/src/app/[locale]/pro/page.tsx`
- Modify: `apps/ui/src/components/atlas/AtlasPlansSheet.tsx`, to read names, prices and "who" from `lib/plans.ts`, dropping its local `PLANS`. Keep its layout.
- Modify: `apps/ui/src/components/global/GlobalLoggedUserMenu.tsx`, to add a "Plan: Free/Pro" item linking to `/pro`, with a small Pro chip when the plan is `pro` or `team`
- Modify: `apps/ui/src/app/sitemap.ts` (add `/pro`)
- Footer: find where footer links come from.
  - If the footer is CMS-driven, from the Strapi `footer` single type, add a "Plans & Pro" link through the CMS. Use the `libraries-local` MCP (`get_footer`/`write_footer`), keep every existing link, and say what you changed.
  - If it's hard-coded in `GlobalFooter.tsx`, add it there.

**Interfaces:**

- Consumes: the session fields `plan`, `planSource` and `features` (Task 2); `FEATURES` and `Feature` from `@repo/access`.
- Produces:
  - `PLANS: readonly PlanCard[]`, where `PlanCard` is `{ key: "public" | "free" | "supporter" | "pro" | "team"; name: string; price: { monthly?: string; yearly?: string; note?: string } | "free"; who: string; includes: string[]; cta: { kind: "none" | "signup" | "soon" | "contact"; label: string; href?: string } }`
  - `PRICES_ARE_PLACEHOLDERS = true`
  - `PRO_FEATURE_COPY: Record<Feature, { label: string; status: "live" | "soon" }>`. `atlas.export` is `"live"`, because Task 4 ships it; everything else is `"soon"`.
  - `planStatusCopy(plan, planSource): string | null`. It returns:
    - `"You have Pro, granted by the libraries.global team."` for a grant
    - `"You have Pro for your contributions (Archivist tier)."` for earned
    - `"You have Pro as verified library staff, student or charity."` for verified
    - `"You're on Pro."` for paid, which is reserved
    - `null` for free and public

- [ ] **Step 1: Test the config first**

`plans.test.ts` asserts:

- `PLANS` keys are exactly `public, free, supporter, pro, team`, in that order.
- Every `Feature` has an entry in `PRO_FEATURE_COPY`: loop over `FEATURES` from `@repo/access`.
- Only `atlas.export` is `live`.
- Supporter's `includes` has no Pro feature label. Patronage doesn't buy features.
- Every paid CTA (`supporter`, `pro`) has `kind: "soon"`, and `team` has `kind: "contact"`.
- `planStatusCopy` returns the strings above.

- [ ] **Step 2: `plans.ts`**

Use the pricing spec's amounts, as display strings only:

- **Supporter:** monthly `"£3/month"`, yearly `"£30/year"`
- **Pro:** monthly `"£5/month"`, yearly `"£50/year"`, with the note `"Founding price, held while your membership continues. Standard £8/month or £80/year once per-capita and Reach ship."`
- **Team:** yearly `"£480/year ex VAT"`, with the note `"5 seats; £96 per extra seat. Public library services get 20% off."`
- **Public and Free:** `"free"`

Take the "Who" and "includes" copy from the plans table in the pricing spec. Pro's `includes` is built from `PRO_FEATURE_COPY`: live items are listed plainly, and soon items get "(coming soon)". The Team CTA is `{ kind: "contact", label: "Talk to us", href: "mailto:hello@libraries.global?subject=Team%20plan" }`. Check the repo for the canonical contact address (for example in `SECURITY.md` or `lib/constants.ts`) and use it.

- [ ] **Step 3: `PlansTable`, `PlanStatusBanner` and the `/pro` page**

**`PlansTable`** is a client-safe presentational component.

- It shows five cards on desktop and stacks them on mobile, with no horizontal scroll.
- Each card has: a serif name, the price or "Free", the "who" line, an includes list with check icons, and the CTA.
  - "soon" is a disabled secondary pill with the text "Coming soon". Status is conveyed in text as well.
  - "signup" links to `/auth/register?callbackUrl=/pro`.
  - "contact" is an indigo pill.
- The current plan is highlighted, via a `currentPlan?: string` prop, with an "Your plan" badge in text plus an icon.
- Underneath, a line reading "Prices are placeholders" shows when `PRICES_ARE_PLACEHOLDERS` is true.

**`PlanStatusBanner`** shows `planStatusCopy(...)` in a tinted card with an icon. It renders nothing when the copy is `null`.

**`/pro` page** (RSC):

- `getSessionSSR(headers())`
- a `PageHero` with the title "Plans and Pro" and a lead line: "Library facts are free, always. Membership keeps the index running; Pro adds analysis on top."
- the `PlanStatusBanner`
- `PlansTable` with `currentPlan`
- a "Get Pro free" section listing three routes, each with its status:
  - verified library staff, students and charities (self-serve verification coming soon; until then, write to us)
  - earned at Archivist tier, with the 90-day hold
  - grants for press and partners
- a short FAQ:
  - What stays free (everything factual).
  - Does Pro change my role or review? No; money never buys trust.
  - VAT: prices shown are what you pay.
  - Cancelling: a 14-day no-questions refund once checkout exists.

Set the page metadata through the existing SEO helper (`lib/seo/metadata.ts`). Read how other pages call it.

- [ ] **Step 4: Atlas sheet, account menu, sitemap and footer**

Make the changes listed under Files. In `AtlasPlansSheet`:

- Keep its three columns: public, free and pro. Also add the Team row if it already shows one.
- Map the names and prices from `PLANS`.
- The "Not yet available" CTA text becomes "Coming soon", with a link "See all plans" to `/pro`.

- [ ] **Step 5: Verify and commit**

Run `cd apps/ui && npx vitest run && npx tsc --noEmit && npx eslint src/lib/plans.ts src/components/pro src/app/[locale]/pro`.

Live check:

- `GET http://localhost:3000/pro` returns 200 and contains "Prices are placeholders".
- Signed in as the reader fixture, the page shows no banner and highlights Free.

Commit: `feat(ui): add the plans and pro page and plan surfaces`. Commit the CMS footer change separately if there is one. It isn't a git change, so describe it in the report.

---

### Task 4: The first Pro feature, Atlas export (CSV and GeoJSON)

**Files:**

- Create: `apps/ui/src/lib/export-format.ts` (pure CSV and GeoJSON builders with formula-injection escaping)
- Test: `apps/ui/src/lib/__tests__/export-format.test.ts`
- Create: `apps/ui/src/app/api/export/atlas/route.ts`
- Test: `apps/ui/src/app/api/export/atlas/__tests__/route.test.ts`. If the vitest config only includes `src/**/*.test.ts`, that path works.
- Modify: `apps/ui/src/components/atlas/AtlasListView.tsx`, or the Atlas toolbar that owns the list. Add an "Export" control: live for users with `atlas.export`, locked with a Pro chip that opens the plans sheet for everyone else.

**Interfaces:**

- Consumes:
  - `requireEntitlement` from `@/lib/access-server`
  - the session `limits.exportRows`
  - the Strapi public endpoint `GET /api/libraries/atlas` (`apps/strapi/src/api/library/controllers/library.ts`, `atlas`), which the Atlas already loads through `/api/public-proxy/api/libraries/atlas`
- Produces:
  - `POST /api/export/atlas` with body `{ format: "csv" | "geojson"; ids: string[] }`. The `ids` are the documentIds, or whatever stable id the Atlas library objects carry (check `atlas.logic.ts` `AtlasLibrary`), of the libraries currently in view.
  - It returns the file with `Content-Disposition: attachment; filename="libraries-global-atlas-<YYYY-MM-DD>.<ext>"` and `X-Data-Attribution: libraries.global contributors; see /docs for licences`.
  - Errors: 401 when signed out, 402 without `atlas.export`, 400 for a bad body, 413 when there are more ids than `limits.exportRows`.

- [ ] **Step 1: Test the pure builders first**

`export-format.test.ts` covers:

- `toCsv(rows, columns)` quotes fields containing commas, quotes or newlines, and doubles embedded quotes.
- It prefixes `'` to any cell starting with `=`, `+`, `-`, `@`, a tab or a carriage return, which prevents CSV formula injection (spec §7).
- It outputs a header row, in the given column order.
- `toGeoJson(rows)` returns a `FeatureCollection` of `Point` features with `[lng, lat]`, skips rows without coordinates, and puts an `attribution` string on the collection.
- Null and undefined values become empty cells.

Implement `export-format.ts` with no Next or server imports. Use these columns, in order: `name, slug, libraryType, operationalStatus, streetAddress, city, region, country, lat, lng, website, phone, email, url`. `url` is the absolute library page URL, built with the same path helper the Atlas uses; find it. Use only fields the atlas endpoint already returns.

- [ ] **Step 2: Test the route first**

In `route.test.ts`, mock `@/lib/auth` `auth.api.getSession`, `next/headers` and `fetch`. Assert:

- 401 when signed out, and 402 with `features: []`.
- 413 when `ids.length > limits.exportRows`.
- 400 when `format` is invalid, when `ids` isn't a string array, or when there are more than 10,000 ids.
- 200 CSV containing only the requested ids, in request order, with the attachment and attribution headers.
- Ids not found in the dataset are silently skipped.

- [ ] **Step 3: The route**

Implement the route:

1. Get the session. Call `requireEntitlement(session?.user, "atlas.export")` and return on denial.
2. Parse the body with zod: `format` is the enum, and `ids` is `z.array(z.string().min(1).max(64)).min(1).max(10_000)`.
3. Read `cap = session.user.limits?.exportRows ?? 0`, and return 413 if `ids.length > cap`.
4. Fetch the atlas dataset server-side from Strapi (`${STRAPI_URL}/api/libraries/atlas`), with the same public read key the public proxy uses (read `app/api/public-proxy`) and `next: { revalidate: 300 }`. Index it by id, pick the requested ids, and build the output.
5. Return the file.

Never trust client-supplied row data. Only ids come from the client.

- [ ] **Step 4: The Atlas control**

Read `useEntitlements()` from `@/lib/access-client`.

- With `can("atlas.export")`: an "Export" menu button offering CSV and GeoJSON. It POSTs the ids of the libraries currently in the list or view, as the list view already holds them, and triggers the download from the blob. While the request runs, it shows a busy state with `aria-busy`.
- Without it: the same button shows a Pro chip, and clicking it opens `AtlasPlansSheet`. Follow how `AtlasLayersTab` opens it through a callback prop from `AtlasExplorer`. The text says "Export is a Pro feature."
- Keep the component under its current size where you can. If the export control needs more than about 60 lines, put it in a new `AtlasExportButton.tsx`.

- [ ] **Step 5: Verify and commit**

Run the UI vitest, tsc and eslint on the touched paths.

Live checks:

- As the reader fixture: `curl` a POST to `/api/export/atlas` returns 402. Sign in with a cookie jar, as the E2E does.
- As a Pro fixture it returns 200. If the Pro fixture doesn't exist until Task 5, do the 200 check in Task 5's E2E and note that here.

Commit:

- `feat(ui): export atlas results as csv or geojson for pro`
- `feat(ui): add a pro-gated export control to the atlas`

---

### Task 5: Test users of every type, and E2E for onboarding and Pro

**Files:**

- Modify: `qa/tests/playwright/helpers/access-fixtures.ts` (the new fixtures)
- Modify: `qa/tests/playwright/helpers/seed-access-fixtures.ts` and `helpers/strapi-access-writer.cjs`
- Modify: `qa/tests/playwright/e2e/access/role-matrix.spec.ts` (the Pro rows and export)
- Create: `qa/tests/playwright/e2e/access/onboarding.spec.ts` (a browser test)
- Update the local, git-ignored `qa/tests/playwright/TEST-USERS.local.md` with the new users. Never commit it.

**Interfaces:**

- Consumes: Tasks 1–4.
- Produces these fixtures, all with the `ACCESS_FIXTURE_PASSWORD` password and Contributor Role `reader` unless stated:

| key            | Purpose            | State after seeding                                                                             |
| -------------- | ------------------ | ----------------------------------------------------------------------------------------------- |
| `onboarding`   | Onboarding test    | `username` **null**, reset on every seed, with the profile fields onboarding sets cleared       |
| `pro-grant`    | Admin-granted Pro  | One `entitlement-grant` `{plan:"pro", source:"admin", expiresAt:null, reason:"access fixture"}` |
| `pro-earned`   | Earned Pro         | `points: 1500`, `tier: "Archivist"`                                                             |
| `pro-verified` | Verified-staff Pro | One `pro-verification` `{kind:"library_staff", verifiedAt: now, expiresAt: now + 365d}`         |
| `team`         | Team grant         | One `entitlement-grant` `{plan:"team", source:"team", expiresAt:null}`                          |

The existing five fixtures must converge to having **no** grants or verifications, `points: 0`, `tier: "Reader"` and `earnedProUntil: null`, so their `plan` stays `free`.

- [ ] **Step 1: Seed and writer**

- Extend `FIXTURES` with `{ key, role: "reader", claim: false, plan?: ..., username?: null }`, or an equivalent shape, so the writer knows each fixture's target state.
- The writer converges grants, verifications, points, tier and `earnedProUntil` for every fixture, in both directions, using `strapi.documents()`. It creates rows that are missing and deletes rows that shouldn't be there.
- For `onboarding`, it sets `username: null` and clears the other fields onboarding writes: read `OnboardingShell.tsx` `handleSave` and `api/profile/me` PUT `allowed`. The profile stays `private`.
- Keep every existing guard: local only, the `?host=` refusal, `cron.destroy()`, and the minimal env.
- The seed must pass the current terms version when signing up. That was committed in `698a0c6`; keep it.

Run `pnpm seed:access` twice. The second run must be a no-op, apart from resetting the onboarding fixture.

- [ ] **Step 2: Role-matrix Pro rows**

Add a `PLAN_MATRIX` loop:

| key            | plan | planSource | has `atlas.export` |
| -------------- | ---- | ---------- | ------------------ |
| `reader`       | free | none       | no                 |
| `pro-grant`    | pro  | grant      | yes                |
| `pro-earned`   | pro  | earned     | yes                |
| `pro-verified` | pro  | verified   | yes                |
| `team`         | team | grant      | yes                |

For each row, sign in and assert `plan`, `planSource`, the presence of `atlas.export` in `features`, and `limits.exportRows` (0 for free, 10000 for pro, 50000 for team). Then POST `/api/export/atlas` with `{ format: "csv", ids: [<one real atlas id>] }`, fetching one id from `/api/public-proxy/api/libraries/atlas`. Expect 402 for free and 200 for Pro, with a `text/csv` content type and a header row starting `name,slug`.

Also assert that **every Pro fixture's `capabilities` equal the reader's**, because money never buys trust.

Keep the sign-in count low. The rate limit is 5 per minute: reuse contexts, and wait out 429s the way the existing `signIn` helper does. The existing and new tests together will need about 10 sign-ins, so a cold run takes about 2 minutes. That's acceptable, but say so in a comment.

- [ ] **Step 3: Onboarding browser spec**

In `onboarding.spec.ts`, using `page`:

1. Go to `/auth/signin`.
2. Fill in the email and password for `onboarding` and submit. Read `SignInForm.tsx` for the field labels and submit text.
3. Expect the URL to match `/profile/onboarding`.
4. Fill in the username with `access_onboarded_<Date.now() % 1e6>` and any other required fields. Wait for the availability check to show it's available. Save with "Enter your profile", or whatever the primary save button is called.
5. Expect the URL to match `/profile/<that username>`.
6. `GET /api/auth/get-session` in the same context returns the new username, and `profileLoaded: true`.
7. Sign out, sign in again, and expect to land somewhere other than onboarding.

Locate elements by role and label, not CSS. If the page's labels aren't accessible enough to locate by role or label, that's an accessibility bug: report it, and add the smallest `aria-label` fix to `OnboardingShell.tsx` if needed.

The `onboarding` fixture is reset by the seed. The spec must run after `pnpm seed:access`. Add a `test.beforeAll` that fails with a clear message if the fixture's session already has a username.

- [ ] **Step 4: Run and commit**

Run:

- `pnpm seed:access`
- `npx playwright test --project=access`, which runs the whole access project, including onboarding. The onboarding spec must be matched by the `access` project's `testMatch`.

Everything must pass. Then update `TEST-USERS.local.md` with every fixture, its plan and source, what to try, and "run `pnpm seed:access` to reset onboarding".

Commit:

- `test(tests-playwright): seed pro, team and onboarding fixtures`
- `test(tests-playwright): e2e for pro plans, export and onboarding`

---

### Task 6: The docs

**Files:**

- Strapi wiki articles in the local CMS. Create, update and publish them through the `libraries-local` MCP tools (`list_wiki-article`, `get_wiki-article`, `create_wiki-article`, `update_wiki-article`, `publish_wiki-article`). Bodies are Strapi Blocks JSON: copy the block shapes from an existing article.
- `CONTEXT.md`
- `CLAUDE.md`
- `TODOS.md`

**Interfaces:**

- Consumes: the shipped behaviour of Tasks 1–5, the pricing spec, and spec §3 and §10.3.

- [ ] **Step 1: Public docs**

- **New article "Plans and Pro"** in the Governance section. Check the section list and choose the best fit; Getting started is acceptable. The slug is `plans-and-pro`. It covers:
  - what's free forever
  - Supporter, Pro and Team, with the placeholder prices, clearly labelled
  - which Pro features are live (Atlas export) and which are coming soon
  - the three ways to get Pro free
  - "money never buys trust"
  - VAT and the 14-day cancellation promise
  - a link to `/pro`
- **`points-streaks-and-tiers`:** add "Reaching Archivist gives you Pro while you stay there, and for 90 days after."
- **`your-account-and-profile`:** add that limited profiles also hide badges from strangers.
- **`roles-and-permissions`:** add one line saying that plans are separate from roles.

Publish all four. Verify with a REST GET that each is published.

- [ ] **Step 2: `CONTEXT.md`**

- Add the definitions **Capability**, **Entitlement**, **Plan** (public, free, supporter (planned), pro, team), **Plan source** (grant, earned, verified, paid) and **Submission states** (draft → pending → approved | rejected | needs_info, with needs_info → pending).
- Fix the Contributor Role caching note: the session's bridge cache is 60 s (spec §3.2), not 24 h.

- [ ] **Step 3: `CLAUDE.md`**

- Fix "Next.js 15" to 16.
- Move Contribute and User profiles out of "Planned pillars". They're built.
- Replace "Future Goals §3" with a short "Contribution & moderation (built)" summary: the plugins, the submission types, the state machine, the pointer to the spec, and what's still to come (the needs_info thread, library edit apply, the journal pitch).
- Add an **"Access model"** section:
  - the three axes
  - `@repo/access` exports
  - the session fields (`capabilities`, `claimedLibraryIds`, `plan`, `planSource`, `features`, `limits`, `profileLoaded`)
  - the server helpers `requireCapability`/`requireEntitlement` and the client hooks `useCapabilities`/`useEntitlements`
  - the 60 s cache and invalidation
  - the Pro sources and the admin-only collections
  - the rule that Strapi is authoritative
- Add a **"Testing access"** note: `pnpm seed:access`, `--project=access`, the local-only guard, and the local test-users notes.
- Don't touch the design-system component table or the PageHero sections.

- [ ] **Step 4: `TODOS.md`**

- Mark the items P-A and P-B finished as done.
- Add the P-C deferred list from `.git/sdd/progress.md`, which is the "PB DEFERRED" line.
- Reconcile item 6, the profile privacy toggles, with the current state.

- [ ] **Step 5: Commit**

Commit with `docs: document plans, pro and the access model`. The Strapi article changes aren't in git, so list them in the report.
