# Membership billing

The billing implementation uses hosted Stripe Managed Payments, durable owned checkout attempts, invoice settlement and private Strapi access projections. Better Auth owns account identity. Membership changes tools and limits; it never grants community roles, trust, moderation or library staff authority.

This guide describes implementation and repeatable checks. Provider account readiness, enabled flags, purchase evidence, approvals and deployment results belong in private operator storage.

## Plans and ownership

Read [Pricing](PRICING.md) and `src/lib/membership-pricing.json` for the catalogue. Supporter includes detailed history and exports up to 500 libraries; Pro includes delivered analysis and 10,000-row exports. Team's library-scoped tools have a 50,000-row cap. Do not sell unfinished features or silently replace founding Price IDs.

Personal membership, [Team seats](TEAM-BILLING.md) and the separate [Team API add-on](TEAM-API.md) have independent customer bindings, attempts and paid projections. Settled payment, rather than an optimistic checkout return, activates access.

## Checkout and plan changes

Verified accounts create owned customer/attempt records before provider calls. Per-owner PostgreSQL locks and stable idempotency keys protect retries. Prices, quantities, customers and return destinations are server-selected. Payment details remain on the hosted page.

A bounded signed webhook records references before acknowledging delivery. The worker refetches provider state and verifies environment, customer, subscription and settled invoice coverage. The return page waits for both payment and Strapi acknowledgement before refreshing the existing session. A pending or unpaid initial purchase grants nothing; a failed upgrade preserves the already-settled lower plan.

Paid upgrades use the provider's proration review. Reductions and shorter intervals are reviewed in Settings and start at the paid period end with no charge today. Durable plan-change intents recover interrupted schedule creation. Undo removes a future change; the worker releases the schedule after its target phase starts. Future selections never grant access.

Separate restricted Pro, Supporter and recovery Portal configurations constrain allowed plan changes. Cancellation preserves settled access through the paid period. A failed renewal's grace period is bounded from the first failure. Refund/dispute holds affect paid access independently of complimentary sources.

Account erasure stops subscriptions and open checkout sessions before clearing bindings. Uncertain cancellation blocks erasure. Completed attempts discard capability URLs. Retention is bounded and preserves pending work; user exports omit payment credentials and capability links.

## Local sandbox checks

Follow [Local acceptance](BILLING-LOCAL-TESTS.md). Reuse the existing database and apps. Helpers read the configured local origin; listener, worker and UI must agree on its port. Do not start another Next.js or Strapi server.

```sh
pnpm --filter @repo/ui billing:check
pnpm --filter @repo/ui billing:sandbox:work
```

`billing:check` inspects the configured catalogue. `billing:sandbox:work` processes a finite local worker pass; use it when testing delayed projection recovery. The sandbox listener saves its signing secret privately. Changing an origin or signing secret requires the relevant existing process to reload its configuration.

Focused checks, run sequentially with bounded memory and one worker:

```sh
NODE_OPTIONS=--max-old-space-size=2048 pnpm --filter @repo/ui test src/lib/billing src/app/api/billing src/components/billing --maxWorkers=1
NODE_OPTIONS=--max-old-space-size=2048 pnpm --filter @repo/strapi test tests/paid-membership.test.ts tests/billing-notice.test.ts tests/email-recipients.test.ts --maxWorkers=1
```

`billing:db:test` creates temporary PostgreSQL schemas. Run it only in an approved isolated CI/acceptance environment, never against the shared development database. Mocks and fixture projections do not establish provider/device acceptance.

## Configuration and deployment

Keep sandbox and live bindings separate. UI and CMS `BILLING_ENV` must match; changing a populated database's mode does not convert its provider records. Package versions come from `package.json`/the lockfile; the provider API version and event allowlist come from `src/lib/billing/`.

The checked-in environment examples describe names and placeholders for runtime keys, webhook signing secrets, Price IDs, Portal configurations, bridge credentials, job authentication and public origins. Keep values and generated account-specific catalogue manifests ignored. Disabling new purchases must leave reconciliation and existing billing management available.

A release must apply the billing migration, ship matching shared access/CMS/UI/worker code and configure authenticated billing and retention jobs. `vercel.json` applies only when running on that platform; another host needs its own installed scheduler. Verify signatures, mode, retries, pending-event age, projection lag and alerts before activation.

The live preparation helper defaults to inspection:

```sh
node apps/ui/scripts/billing-live.mjs --origin https://YOUR_PRODUCTION_HOST
```

After owned sandbox acceptance, its `--apply --sandbox-accepted` mode prepares matching catalogue/Portal/webhook objects. The optional `--verify-receiver` probe checks the deployed signature boundary without granting access or charging an account. It does not establish database, worker or CMS health. Review the helper and current provider requirements before using it; authentication and signing-secret recovery stay in private operator configuration.

Catalogue preparation, code deployment, public opening and live purchase activation are separate operations. Preserve the beta gate and sandbox billing during routine releases. See [Release helpers](../../scripts/release/README.md) for generic promotion requirements.

## Webhooks, notices and email

`BILLING_EVENTS` in `src/lib/billing/events.ts` allowlists lifecycle events. Only the exact billing webhook route bypasses the beta/basic-auth gate; raw signature, body-size and environment checks still apply.

Strapi enqueues access notices transactionally with each accepted projection revision. Repeated or older revisions do not duplicate notices. Notices use essential delivery and do not opt anyone into marketing. Financial receipts, invoices and provider payment-recovery messages are separate from application access notifications.

Use offline previews first:

```sh
pnpm --filter @repo/ui email:check --billing --preview-dir /tmp/libraries-billing-previews
```

A real delivery check needs an explicitly authorized recipient. Record SMTP acceptance separately from mailbox receipt, rendering and authentication-header checks; retain that evidence privately. See [Notifications](../strapi/NOTIFICATIONS.md).

## Content and recovery

[Customer help](BILLING-HELP.md) describes the user flow. [CMS content operations](../strapi/CONTENT-OPERATIONS.md) defines the environment and publication workflow; the older `update-billing-docs.mjs` helper is a local feature migration, not the routine production publication path.

Published policy revisions, purchase consent versions and accepted historical snapshots are distinct. Check `src/lib/membership-pricing.json`, the current checkout consent constants and the CMS publication before releasing changes. Preserve earlier consent evidence. Do not copy a dated legal version or jurisdiction-specific claim from an old launch report into a new release.

Retry interrupted provider work with the same owned binding. Reconcile before retrying beyond the provider's idempotency retention. Replay original event IDs and refetch current state. Missing non-erased profiles require repair; only a recorded erased-account tombstone can acknowledge the corresponding gone response. Refund/dispute holds require provider evidence and an operator audit record.

Keep keys, cookies, signing secrets, capability links, fixture identities and recovery evidence out of source and shared reports.
