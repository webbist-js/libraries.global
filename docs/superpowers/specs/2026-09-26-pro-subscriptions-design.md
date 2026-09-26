# Pro subscriptions — Design

**Date:** 2026-09-26
**Status:** Draft. Needs the decisions in §10 before implementation starts.
**Related:** `2026-09-26-ace-libraries-activity-design.md` (Organisations + ACE data), `apps/ui/src/components/atlas/` (Atlas Explorer, which already models `public | free | pro` tiers).

## Goal

Add a paid **Pro** tier, and later a **Team** tier for library services and councils, running end to end through the Better Auth accounts we already have. That means checkout, billing, plan changes, cancellation, invoices, deletion and data export. Pro should show up across the Atlas, the Index, library pages, data, events and contribution wherever it makes sense, rather than as a separate paid corner of the site.

## Principles

These constrain every later section. Where a feature idea conflicts with one, the principle wins.

1. **Library facts are free. Always.** Every record, hours, services, search, filters, list and map views, and raw open-data downloads (OGL/CC0 sources) stay free for everyone, signed in or not.
2. **Contributing is free and is never paywalled.** Submitting, editing, claiming, the wiki and events feeds all stay free.
3. **Money never buys trust.** Pro doesn't award points, raise a tier, improve leaderboard rank, fast-track moderation or grant a Contributor Role. The contribute hub already says roles are "never bought with points"; this extends that to money.
4. **Contribution can earn Pro.** Complimentary Pro is a reward for sustained contribution and for verified library staff (§6). This keeps the paid tier tied to the community, not in tension with it.
5. **Pro pays for what costs us money or is new analysis on top of the facts.** That covers licensed or heavy context data, compute (routing, spatial analysis), exports at volume, alerts, and convenience at scale.
6. **Gate on the server.** UI locks are for explanation only. Every Pro capability is enforced in a Next route handler or in Strapi.
7. **Show locked features honestly.** Locked features stay visible with a Pro chip and say what they do. We don't show fake data. Anything not built yet is labelled "Coming soon".

## Plans

| Plan               | Who                                                     | How you get it                                                            |
| ------------------ | ------------------------------------------------------- | ------------------------------------------------------------------------- |
| **Public**         | Anyone                                                  | No account                                                                |
| **Free account**   | Anyone signed in                                        | Sign up                                                                   |
| **Pro**            | Researchers, journalists, enthusiasts, students         | Monthly or annual subscription, or complimentary (§6)                     |
| **Team** (phase 4) | Library services, councils, consultancies, universities | Per-seat subscription on an Organisation; one billing owner, many members |

Plans resolve to **entitlements**: named features plus numeric limits. Code checks entitlements, never plan names, so pricing and packaging can change without touching feature code.

## What Pro adds, by area

"Now" means it can be built on data and infrastructure that exist today. "Needs data" and "needs backend" mark dependencies.

### Atlas Explorer (`/map`)

| Feature                                                                         | Free account | Pro                               | Depends on                         |
| ------------------------------------------------------------------------------- | ------------ | --------------------------------- | ---------------------------------- |
| All library layers (density, open late, closures, access, events, completeness) | ✓            | ✓                                 | now                                |
| Saved map views                                                                 | 3            | Unlimited, with names and sharing | now (new `saved-view` type)        |
| Founded-year layer and time slider                                              | —            | ✓                                 | now (sparse data)                  |
| Libraries per 100k people                                                       | —            | ✓                                 | ACE + ONS population (ACE spec)    |
| Population, deprivation, transit, schools overlays                              | —            | ✓                                 | tiles + gated tile proxy           |
| Reach (walk/cycle/transit isochrones)                                           | —            | ✓                                 | self-hosted routing (Valhalla/ORS) |
| Draw-to-analyse, coverage gaps                                                  | —            | ✓                                 | H3 population aggregates           |
| Compare two areas                                                               | —            | ✓                                 | per-capita data                    |
| Export in-view results (CSV/GeoJSON)                                            | —            | ✓                                 | now                                |
| Printable report (PDF)                                                          | —            | ✓                                 | needs backend                      |

The Atlas already has `Tier`, `layerAccess` and a Pro upsell. Phase 0 swaps `useTier()` for real entitlements.

### Index (`/index`)

| Feature                                                                                 | Free    | Pro                                       |
| --------------------------------------------------------------------------------------- | ------- | ----------------------------------------- |
| Search, facets, sort, grid/list/map                                                     | ✓       | ✓                                         |
| Saved searches                                                                          | 3       | Unlimited                                 |
| **Alerts on saved searches** ("a new library matching this", "hours changed")           | —       | ✓ (needs email delivery; none exists yet) |
| Export results (CSV/GeoJSON) with attribution                                           | —       | ✓                                         |
| Advanced filters: completeness threshold, last-verified age, source, has catalogue/IIIF | ✓ basic | ✓ all                                     |
| Side-by-side compare (up to 6 libraries)                                                | —       | ✓                                         |

Note: the Index caps its bulk fetch at 1,000 hits (`TODOS.md` §2). Server-side exports need their own endpoint, not the client bulk list.

### Library pages

- Free: everything on the page, including "Check the catalogue".
- Pro:
  - **Watch a library.** Alerts on changes, closures and new events. Follows already exist; Pro adds delivery.
  - **Private notes** on any library (the "collection notes" roadmap item).
  - **Catalogue check at higher limits**, including search across all editions of a work (Open Library).
  - Full revision history with diffs.

### Data and Organisations (ACE spec)

- Free: service pages, headline figures, national dashboard, raw dataset download (it's OGL).
- Pro:
  - Benchmarking against "similar services" (nearest neighbours by population, rurality, deprivation)
  - A custom metric explorer with saved comparisons
  - Exports of derived metrics
  - Year-on-year alerts when a new release lands

This fits the ACE spec's layered audience. The "professional" and "researcher" layers are where Pro sits.

### Events

- Free: browse, save events, download ICS.
- Pro:
  - A **personal subscribable calendar feed**. This needs a tokenised URL; today's ICS is a one-off download.
  - Digests of events at followed libraries.

### Contribution and rewards

- Free, for everyone: all of it (principle 2).
- **Complimentary Pro is earned** (§6).
- Pro members can opt into a small "Supporter" mark on their profile. It's cosmetic, carries no points, and they can hide it.
- **Team plan (phase 4) for library services:**
  - A verified service workspace
  - **Trusted service editors**: staff with a verified council email mapped to a GSS code get their submissions for that service auto-approved. This idea comes from LibrariesHacked's create-librarydata.
  - Bulk CSV updates validated against a table schema
  - Embeddable branded library-finder widget
  - Page analytics for their libraries
  - Event-feed management

Teams buy workflow, not trust. The auto-approve rule comes from verified employment, not from paying.

### API (phase 4)

- API keys with quotas for the atlas data.
- A free key with low limits, higher limits on Team.
- Rate limits use the same entitlements.

## Architecture

### Billing provider

**Recommendation: Stripe, through Better Auth's official Stripe plugin (`@better-auth/stripe`).**

- Better Auth already owns accounts, running in Next.js on its own Postgres. The plugin adds a `subscription` table there.
- The plugin gives us:
  - customer creation on sign-up
  - Checkout sessions
  - the Stripe Customer Portal (payment methods, invoices, cancel)
  - webhook handling at `/api/auth/stripe/webhook`
  - plan definitions with `limits`
  - trials
  - organisation-scoped (`referenceId`) subscriptions, which pairs with the Better Auth `organization` plugin for Team
- Much less code than wiring Stripe or Chargebee by hand.
- Tax: Stripe Tax for UK VAT and other jurisdictions.

**Alternatives:**

- **Chargebee:** strong for complex B2B invoicing and revenue recognition. Overkill before there's a sales-led Team business. It can be added later over Stripe if needed.
- **A merchant of record (Paddle, Lemon Squeezy, Polar):** they become the seller and handle global VAT and sales tax for you. Worth it if selling worldwide as a small UK entity makes tax registration a burden. The trade-offs are a higher fee and less control.

This is decision D1.

### Data model

```
Better Auth DB (Postgres, apps/ui)            Strapi (Postgres)
─────────────────────────────────            ─────────────────────────
user                                          user-profile
subscription   ← @better-auth/stripe            + plan            enum free|pro|team
  plan, status, referenceId,                    + planStatus      enum active|trialing|past_due|canceled
  stripeCustomerId, stripeSubscriptionId,       + planRenewsAt    datetime
  periodStart/End, cancelAtPeriodEnd, seats     + planSource      enum paid|earned|verified|grant|team
organization / member  ← BA organization         (mirrored, read-only outside the bridge)
  (phase 4, Team)
                                              entitlement-grant (new, admin-managed)
                                                baUserId, plan, reason, expiresAt, grantedBy
                                              saved-view / saved-search (new)
                                                baUserId, kind, name, state JSON, alert bool
```

- **Source of truth for paid plans:** the Better Auth `subscription` table, updated by Stripe webhooks.
- **Source of truth for complimentary plans:** Strapi. That's `entitlement-grant` plus the rules in §6, which read rewards tier and `isVerifiedLibrarian`.
- **Mirror:** the Stripe plugin's `onSubscriptionComplete`, `onSubscriptionUpdate` and `onSubscriptionDeleted` hooks call a new bridge route, `POST /api/auth-bridge/sync-plan` (service secret, allowlisted fields), which writes the `plan*` fields on user-profile. Strapi then knows a user's plan for server-side features, cron jobs (alerts) and admin visibility, without calling Stripe.

### Entitlements: one module, used everywhere

A new workspace package, **`packages/entitlements`** (`@repo/entitlements`), pure TypeScript with no I/O:

```ts
export type PlanKey = "public" | "free" | "pro" | "team"
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
  features: Set<Feature>
  limits: Record<Limit, number>
}

export function resolveEntitlements(input: {
  signedIn: boolean
  subscription?: { plan: string; status: string } | null // Better Auth
  grants?: { plan: PlanKey; expiresAt: string | null }[] // Strapi
  rewardsTier?: string | null
  isVerifiedLibrarian?: boolean
  now?: Date
}): Entitlements
export const can = (e: Entitlements, f: Feature) => e.features.has(f)
export const limitOf = (e: Entitlements, l: Limit) => e.limits[l]
```

- **Status rules:**
  - `active`, `trialing`: entitled.
  - `past_due`: stays entitled for a 7-day grace period while Stripe's smart retries run.
  - `canceled` with `cancelAtPeriodEnd`: entitled until `periodEnd`.
  - Anything else: free.
- **Session.** `customSession` in `apps/ui/src/lib/auth.ts` already enriches the user. It extends to read the subscription (same Better Auth database, cheap) and the grants and trust fields (already on the `session-profile` bridge call, extended), then attaches `plan`, `planSource` and a compact `features` array. `auth-server.ts` `BetterAuthUser` gains those fields.
- **Server gate.** A `requireEntitlement(feature)` helper for Next route handlers. It returns 401 when signed out and 402 with an upgrade payload when not entitled. Proxied calls to Strapi already carry the service secret, and gain an `X-Ba-Entitlements` header that Strapi trusts within that boundary.
- **Client.** `useEntitlements()` wraps `authClient.useSession()`. The Atlas `useTier()` is replaced by it.
- **Performance note.** `customSession` hits Strapi on every session read, and `cookieCache` is disabled (`auth.ts` L153-160). Before launch, either re-enable `cookieCache` with a short `maxAge`, after clearing the stale-cookie issue it was disabled for, or cache the bridge response per user for about 60 seconds.

### Account ownership and management

- **Settings, new "Plan & billing" section** (`profile/settings`, alongside the existing five). It shows:
  - Current plan, source ("Paid", "Earned — Archivist tier", "Verified library staff", "Granted until 1 Mar 2027"), renewal or end date.
  - Upgrade, switch monthly/annual, cancel and resume (`authClient.subscription.upgrade/cancel/restore`).
  - **Manage billing:** opens the Stripe Customer Portal for card, invoices, VAT number and address.
  - An honest line on what happens at cancellation: access continues to the period end, and saved views over the free limit become read-only, not deleted.
- **`/pro` page:** the plan comparison, extending the Atlas plans sheet. Checkout comes back to where the user started.
- **Account deletion** (existing `DELETE /api/profile/me`): cancel any subscription immediately, then delete the Stripe customer. Stripe keeps invoices for tax purposes, and we record that in the privacy notice. The existing profile anonymisation then runs. Grants are removed.
- **Data export** (existing `/api/profile/me/export`): add plan history, invoices list (links), saved views and saved searches.
- **Team (phase 4):** Better Auth `organization` plugin. Organisation roles are owner (billing), admin and member. Seats are managed in `/settings/team`. The subscription `referenceId` is the organisation id. Removing a member drops their team entitlement at once, and personal Pro is unaffected. The Team Organisation should link to the ACE spec's `organisation` content type (`orgType: library_service`), so a library service's paid workspace and its public data page are the same entity.

### Complimentary Pro (earned and verified)

Resolved inside `resolveEntitlements`, so every surface agrees:

| Rule                                            | Plan                     | Notes                                                                                                    |
| ----------------------------------------------- | ------------------------ | -------------------------------------------------------------------------------------------------------- |
| Rewards tier **Archivist** (1,500 pts) or above | Pro                      | Re-checked when the session is read; kept for 90 days after dropping below, so nobody loses it mid-month |
| `isVerifiedLibrarian`                           | Pro                      | Library staff, verified by the existing claim flow                                                       |
| `entitlement-grant` (admin)                     | Pro or Team, with expiry | Students, charities, press, partners                                                                     |

Paid and complimentary can overlap. Someone with earned Pro is never asked to pay, and the upgrade UI says why.

### Webhooks and failure handling

- The Stripe webhook is handled by the plugin at `/api/auth/stripe/webhook`, which verifies the signature.
- Our hooks are idempotent upserts keyed by Stripe subscription id.
- If the Strapi mirror call fails, it retries with backoff. A nightly reconcile job lists active subscriptions and re-syncs the mirror. Entitlement checks read the Better Auth table directly, so a stale mirror never wrongly denies a paying user.
- Emails for receipts and card failures come from Stripe. Product emails (welcome to Pro, cancellation) use the existing nodemailer/Mailgun setup in `lib/email.ts`.

### Enforcement map (phase 0 and 1)

| Capability                   | Enforced in                                                                                               |
| ---------------------------- | --------------------------------------------------------------------------------------------------------- |
| Pro map layers (tiles)       | `/api/atlas/tiles/[layer]/…`: checks entitlement, then serves or signs a short-lived CDN URL              |
| Exports (Index, Atlas, Data) | `/api/export/*` route handlers; row caps from `limitOf(e, "exportRows")`; attribution header row          |
| Saved views and searches     | Strapi `saved-view` controller counts per `baUserId` against the limit sent by Next                       |
| Catalogue checks             | `/api/catalogues/availability`: per-user hourly limit from entitlements; per-IP limit for anonymous users |
| Alerts                       | Strapi cron sends only for profiles whose mirrored plan entitles them                                     |

## Phasing

| Phase                       | Scope                                                                                                                                                                                                                                                                                | Ships to users?           |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------- |
| **0 — Foundations**         | `@repo/entitlements` + tests; Better Auth Stripe plugin in **test mode**; session `plan`/`features`; `sync-plan` bridge + profile fields; `entitlement-grant`; earned/verified rules; Settings "Plan & billing"; `/pro`; Atlas `useTier` → entitlements; deletion and export updates | Behind `PRO_ENABLED` flag |
| **1 — Pro on today's data** | Saved views and searches (limits); Index and Atlas CSV/GeoJSON export; founded-year layer; catalogue editions and higher limits; watch a library (UI, no delivery yet); personal ICS feed                                                                                            | Launch Pro                |
| **2 — Data-backed**         | ACE Organisations + benchmarking (with the ACE spec); per-capita layer; population and deprivation tiles via the gated proxy; email delivery for alerts and digests                                                                                                                  |                           |
| **3 — Analysis**            | Self-hosted routing; reach; draw-to-analyse; coverage gaps; compare; PDF reports                                                                                                                                                                                                     |                           |
| **4 — Team**                | `organization` plugin; seats; service workspace; trusted service editors; bulk CSV; embeds; page analytics; API keys                                                                                                                                                                 |                           |

Recommended timing: phase 0 after the 15 Oct 2026 go-live, not before it. Billing touches auth, which is the riskiest thing to change during a launch.

## Testing

- **`@repo/entitlements`:** table-driven unit tests for every status, grant and earned rule, grace periods and expiry.
- **Webhooks:** Stripe CLI (`stripe listen --forward-to localhost:3000/api/auth/stripe/webhook`) with fixtures for created, updated, past_due, canceled and deleted; mirror idempotency; reconcile job.
- **Route gates:** each gated route returns 401, 402 or 200 appropriately; limits are enforced server-side even if the UI is bypassed.
- **E2E (Playwright, `qa/`):** upgrade with a Stripe test card, then Pro layers unlock; cancel, then access holds to period end; delete account, then the Stripe customer is removed.
- **Accessibility:** plan and billing UI follows the existing baseline. Locked states are conveyed in text, never by colour alone.

## Environment

`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_PRO_MONTHLY`, `STRIPE_PRICE_PRO_ANNUAL`, `STRIPE_PRICE_TEAM_SEAT` (phase 4), `PRO_ENABLED`. Add them to `docs/pre-golive-checklist.md`. They are server-only, with no `NEXT_PUBLIC_` exposure.

## Decisions needed

| #   | Decision                                                             | Recommendation                                                                                              |
| --- | -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| D1  | Provider: Stripe via Better Auth, Chargebee, or a merchant of record | **Stripe + Better Auth plugin**, unless global tax registration is a blocker, in which case Paddle or Polar |
| D2  | Who Pro is for first: individuals or institutions                    | **Individuals (Pro) first**; Team once ACE Organisations exist                                              |
| D3  | Prices and currency                                                  | Not set. Price in GBP, with USD and EUR later via Stripe                                                    |
| D4  | Earned Pro threshold                                                 | **Archivist (1,500 pts)**, 90-day hold                                                                      |
| D5  | Complimentary groups (verified staff, students, charities, press)    | **Verified staff automatic**; others by admin grant                                                         |
| D6  | Raw open-data downloads free                                         | **Yes** (principle 1); Pro covers derived analysis and volume                                               |
| D7  | Trial                                                                | **14-day trial** on the first Pro subscription, no card up front, if Stripe supports it for our setup       |
| D8  | Launch timing                                                        | **After go-live**, phase 0 behind a flag                                                                    |

## Out of scope

- One-off purchases, donations, and the Ko-fi link in the footer. That's a separate, simpler thing.
- Paying for moderation priority, visibility or placement. Excluded by principle 3.
- Ads.
