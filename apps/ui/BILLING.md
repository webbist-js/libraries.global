# API billing

The billing implementation uses hosted Stripe Managed Payments, durable owned checkout attempts, invoice settlement, an application usage ledger and private Strapi access projections. Better Auth owns account identity. API Access changes machine access and limits; it never grants community roles, trust, moderation or library staff authority.

This guide describes implementation and repeatable checks. Provider account readiness, enabled flags, purchase evidence, approvals and deployment results belong in private operator storage.

## Offer and ownership

Read [Pricing](PRICING.md) and `src/lib/membership-pricing.json` for the catalogue. The [API account](TEAM-API.md) is the only paid product: £100/month, tax-inclusive base GBP, with 10,000 requests, 250 MiB of response data and 100 analysis credits per settled billing period. Explorer, Contributor, Supporter and Verified Staff are free; see the beta reset note in [Pricing](PRICING.md#beta-reset).

An API account belongs to an organisation. Organisers buy and manage it; members see usage. A buyer without an organisation gets a single-member organisation at checkout (`POST /api/billing/api/checkout`). Settled payment, rather than an optimistic checkout return, activates access.

## Checkout, periods and overage

Verified accounts create owned customer/attempt records before provider calls. Per-owner PostgreSQL locks and stable idempotency keys protect retries. Prices, customers and return destinations are server-selected. Payment details remain on the hosted page. Each purchase snapshots the offer version, Price ID, tax behaviour, limits, overage rates and consent version.

A bounded signed webhook records references before acknowledging delivery. The worker refetches provider state and verifies environment, customer, subscription and settled invoice coverage. Allowances follow the settled subscription item period `[start, end)`; a new allowance starts only when the next period is paid, and past-due time never authorises overage.

The PostgreSQL ledger is the real-time admission authority: each request reserves capacity under one account/period lock, settles actual bytes and credits after success and refunds failures. Overage (`API_OVERAGE_ENABLED`) is off until an organiser opts in with fresh consent and chooses a cap of £10–£500. Metered overage items are added to the subscription at opt-in. Immutable usage events are delivered to Stripe meters with the event ID as idempotency identifier, bounded retries and a dead-letter state; a period is reconciled only when invoiced quantities match the ledger.

Cancellation preserves settled access through the paid period. Refund/dispute holds remove paid access and stay sticky across replays.

Account erasure cancels API subscriptions the account alone owns and expires open checkout sessions before clearing bindings. Uncertain cancellation blocks erasure. Completed attempts discard capability URLs. Retention is bounded and preserves pending work; user exports omit payment credentials and capability links.

## Local sandbox checks

Follow [Local acceptance](BILLING-LOCAL-TESTS.md). Reuse the existing database and apps. Helpers read the configured local origin; listener, worker and UI must agree on its port. Do not start another Next.js or Strapi server.

```sh
pnpm --filter @repo/ui billing:check
pnpm --filter @repo/ui api:check
pnpm --filter @repo/ui billing:sandbox:work
```

`billing:check` inspects the configured billing setup and `api:check` the API catalogue (the £100 Price, the three metered overage Prices, their Billing Meters and the API Portal). `api:setup` creates missing sandbox catalogue entries; live writes additionally require `--live`. Neither command creates a subscription or enables purchasing. `billing:sandbox:work` processes a finite local worker pass; use it when testing delayed projection recovery. The sandbox listener saves its signing secret privately. Changing an origin or signing secret requires the relevant existing process to reload its configuration.

Focused checks, run sequentially with bounded memory and one worker:

```sh
NODE_OPTIONS=--max-old-space-size=2048 pnpm --filter @repo/ui test src/lib/billing src/lib/team-api src/app/api/billing src/app/api/v1 --maxWorkers=1
NODE_OPTIONS=--max-old-space-size=2048 pnpm --filter @repo/strapi test tests/access/api-accounts.test.ts tests/access/api-data.test.ts tests/email-recipients.test.ts --maxWorkers=1
```

`billing:db:test` creates temporary PostgreSQL schemas. Run it only in an approved isolated CI/acceptance environment, never against the shared development database. Mocks and fixture projections do not establish provider/device acceptance.

## Configuration and deployment

Keep sandbox and live bindings separate. UI and CMS `BILLING_ENV` must match; changing a populated database's mode does not convert its provider records. Package versions come from `package.json`/the lockfile; the provider API version and event allowlist come from `src/lib/billing/`.

The checked-in environment examples describe names and placeholders for runtime keys, webhook signing secrets, Price IDs, Portal configurations, bridge credentials, job authentication and public origins. Keep values and generated account-specific catalogue manifests ignored. Disabling new purchases must leave reconciliation and existing billing management available.

The API flags (`API_ENABLED`, `API_OVERAGE_ENABLED`, `API_SERVICE_READS_ENABLED`, `API_SUBMISSIONS_ENABLED`, `API_ANALYSIS_ENABLED`, `API_NETWORK_REACH_ENABLED`) default to false. A flag never bypasses authorisation or accounting.

A release must apply the billing migration (`billing:migrate`, which installs the `api_*` ledger tables; `--drop-retired` removes the withdrawn billing tables explicitly), ship matching shared access/CMS/UI/worker code and configure authenticated billing and retention jobs. `vercel.json` applies only when running on that platform; another host needs its own installed scheduler. Verify signatures, mode, retries, pending-event age, projection lag and alerts before activation.

Live catalogue preparation uses `api:setup --live` after owned sandbox acceptance. Confirm that Managed Payments supports the metered overage items before enabling `API_OVERAGE_ENABLED` in live mode. Authentication and signing-secret recovery stay in private operator configuration.

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

[Customer help](BILLING-HELP.md) describes the user flow. [CMS content operations](../strapi/CONTENT-OPERATIONS.md) defines the environment and publication workflow; `update-sponsored-access-content.mjs` stages the current copy as drafts.

Published policy revisions, purchase consent versions and accepted historical snapshots are distinct. Check `src/lib/membership-pricing.json`, the current checkout consent constants and the CMS publication before releasing changes. Preserve earlier consent evidence. Do not copy a dated legal version or jurisdiction-specific claim from an old launch report into a new release.

Retry interrupted provider work with the same owned binding. Reconcile before retrying beyond the provider's idempotency retention. Replay original event IDs and refetch current state. Missing non-erased profiles require repair; only a recorded erased-account tombstone can acknowledge the corresponding gone response. Refund/dispute holds require provider evidence and an operator audit record.

Keep keys, cookies, signing secrets, capability links, fixture identities and recovery evidence out of source and shared reports.
