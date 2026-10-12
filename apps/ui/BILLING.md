# Membership billing runbook

Stripe Managed Payments hosts Checkout, financial confirmations and payment management. Better Auth owns identity; Strapi owns private access projections, complimentary grants, Teams and notifications. Membership never changes community roles, trust, points, moderation or staff authority. Libraries Global’s operator remains the service seller; Stripe Managed Payments is merchant of record for transactions, not seller of record. Stripe handles payment operations and indirect taxes, while service delivery and applicable consumer obligations remain with the operator. Link’s refund policy overrides a more restrictive seller policy. [Managed Payments service terms, sections 2.1(a) and 3.3](https://stripe.com/legal/ssa-services-terms).

The application and sandbox catalogue are ready for acceptance. The owner's initial Pro annual purchase has settled and synchronized to Strapi. Initial Supporter settlement, declined/3DS/wallet paths and production acceptance still need completion. Live preparation remains separate from sandbox testing and requires a confirmed production URL.

## Delivered plans

| Plan      | Tax-inclusive base GBP            | Tools                                                                                                   |
| --------- | --------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Free      | Free                              | Records, individual downloads, contributions, following, saved events and separate opt-in weekly emails |
| Supporter | £3 monthly / £30 yearly           | Detailed history; Atlas CSV/GeoJSON exports up to 500 libraries per download; optional recognition      |
| Pro       | £5 monthly / £50 yearly, founding | Supporter tools; exports up to 10,000; delivered population comparisons                                 |
| Team      | Quoted separately                 | Existing Pro seats and library-scoped permissions; 50,000-row export cap                                |

Saved views/searches and private notes are not delivered benefits. Unfinished analysis tools remain Coming soon. Founding prices are immutable; preserve settled Price IDs and do not silently replace cohorts. Stripe confirms tax and any local-currency charge. Application amounts use the base billing currency; financial confirmations show the customer charge.

Both sandbox products now describe digital tools, are active and use eligible SaaS personal-use candidate tax code `txcd_10103000`. The legacy `STRIPE_SUPPORTER_APPROVED` flag now confirms this delivered digital offer/classification. No special patronage approval has been invented. Confirm live Managed Payments activation and classification before enabling purchases. [Eligibility](https://docs.stripe.com/payments/managed-payments/eligibility).

## Purchase, access and changes

Verified accounts create owned customers and durable attempts before Stripe calls. Per-owner PostgreSQL locks and stable idempotency keys protect retries. Customers, prices, quantities and access grants never come from the browser. Hosted sessions require retrieved `managed_payments.enabled=true`; the app has no card/CVC fields or custom wallet buttons. Eligible cards, Apple Pay, Google Pay and Link appear on Stripe's page.

A signed, bounded webhook stores references before acknowledgement. The worker refetches provider state, verifies the original owned Managed Payments binding and projects settled invoice coverage. Return status waits for both payment and Strapi acknowledgement. Unpaid first purchases grant nothing; an unpaid Pro upgrade preserves a still-paid Supporter period. Renewal grace is seven days from the first failure, without resetting on retries. Current-period full refunds/disputes hold paid access; independent complimentary access remains.

Paid upgrades continue to Stripe's exact proration review and confirmation. Lower plans and shorter intervals are reviewed in Settings and start at the paid period end, with no charge today. Durable `billing_plan_changes` intents survive interrupted calls. Settings provides Undo before the future phase starts. The worker resumes preparation and releases the schedule once its target phase begins, permitting later changes. Future choices never grant access.

Stripe Portal schedules reductions only within one product. Three configurations protect the separate products: Pro permits only Pro prices; Supporter permits its prices and paid Pro upgrades; recovery permits billing/payment updates, invoices and cancellation while disabling plan changes. [Portal limitation](https://docs.stripe.com/customer-management/configure-portal).

Settings distinguishes paid membership from effective access and displays confirming, active, ended, failed-payment and suspended states. It includes masked payment details, billing details, invoices/PDFs and founding status. Stripe billing-email edits do not change the sign-in email. Recognition remains in Privacy; private/limited profiles are never publicly credited.

Account erasure stops subscriptions and open sessions first and refuses uncertain cancellation. Successful/expired attempts discard capability URLs. User exports include membership snapshots, consent records and scheduled-change history without card data or capability links. Daily retention removes completed/ignored event references after 90 days and erased bindings after six years, in bounded batches; pending work and live accounts remain.

## Local sandbox and checks

For the owner’s browser acceptance steps, test cards and restart instructions, use [BILLING-LOCAL-TESTS.md](BILLING-LOCAL-TESTS.md). `billing:sandbox:watch` runs the local worker every five seconds while its terminal remains open.

Safe IDs are in [billing-sandbox-catalogue.json](scripts/billing-sandbox-catalogue.json). The helper uses private `STRIPE_SANDBOX` from Strapi's ignored environment and never substitutes a live key.

```bash
pnpm --filter @repo/access build
pnpm --filter @repo/ui billing:sandbox:configure
pnpm --filter @repo/ui billing:migrate
pnpm --filter @repo/ui billing:check
pnpm --filter @repo/ui billing:sandbox:listen
# Start/restart after the listener saves its private signing secret.
pnpm --filter @repo/ui dev --port 3000
pnpm --filter @repo/ui billing:sandbox:work
```

Run the worker again if projections remain pending. Local development has no Vercel scheduler. CLI signing secrets differ from deployed endpoint secrets. Unowned synthetic events cannot grant access. Fixture profiles stay private and reserved `.invalid` recipients are excluded from SMTP delivery.

The listener and worker default to `APP_PUBLIC_URL` in the private UI environment; the example above uses `http://localhost:3000`, with matching `NEXT_PUBLIC_APP_URL`. Restart helpers when changing ports, and clear or update explicit forwarding/worker origin overrides. A stopped app or wrong forwarding port prevents timely confirmation even though Stripe has paid the invoice.

Checkout keeps polling through delayed synchronization and transient failures, using slower checks after the initial 30 seconds. On verified readiness it refetches the existing reactive session with `disableCookieCache: true` and refreshes server UI. That flag also bypasses the per-process Strapi profile cache for that authenticated user; no plan or role is accepted from the browser. Acknowledged billing sync invalidates the local profile cache, and the worker attempts to sync projections created during the same run before its existing time budget expires. Settings keeps pending paid purchases visible and refreshes membership/access automatically. Existing paid/refund/mode/ownership guards remain authoritative.

```bash
pnpm --filter @repo/access test
pnpm --filter @repo/ui test src/lib/billing src/app/api/billing src/components/billing
pnpm --filter @repo/ui billing:db:test
pnpm --filter @repo/strapi test tests/paid-membership.test.ts tests/billing-notice.test.ts tests/email-recipients.test.ts
```

The database suite refuses remote URLs and creates/drops an isolated local schema. Source tests verify both CSV/GeoJSON caps, server-selected exports, ownership/mode/origin/body guards, settlement, replay, recovery, notices, profile visibility and retention. Typecheck and production build pass after repairing pre-existing blockers.

Real sandbox evidence includes the previously settled Pro monthly/yearly purchase and annual proration, plus authenticated cross-product scheduling/undo with no extra invoice and one Strapi notice per revision. The two new initial purchases remain awaiting human completion. Physical wallets, bank authentication, decline and mailbox delivery require honest provider/device evidence; do not mark them passed from mocks.

Test card: `4242 4242 4242 4242`; future expiry; CVC `123`. Insufficient funds: `4000 0000 0000 9995`. Authentication: `4000 0025 0000 3155`. Enter these only into Stripe-hosted sandbox fields. [Stripe test details](https://docs.stripe.com/testing).

## Deployment and live MCP

Use separate sandbox/production auth and Strapi databases; changing a populated database's mode does not convert customers. UI and Strapi `BILLING_ENV` must match. Runtime is `stripe@22.0.0`, pinned API `2026-03-25.dahlia`, with patched Better Auth `1.4.18`.

Private configuration is documented in `.env.local.example`: runtime key, endpoint secret, four prices, three Portal configurations, bridge credential, cron secret, fixed public origin and backend URL. Purchase/Managed Payments/Supporter confirmation flags default false. Stopping new purchases leaves recovery and reconciliation running.

Deploy shared access code, migrate billing, and deploy the private Strapi sync, UI/webhook and worker. Generate Strapi types after schema changes; this shuffle changes shared access types and the billing database, not Strapi schemas. Vercel schedules billing each minute and retention daily. Other hosts, including the proposed DigitalOcean setup, need equivalent authenticated jobs; `vercel.json` does not schedule work there. Monitor worker failures, pending counts, oldest pending event, projection lag and reconciliation health; connect operational alerts before enabling purchases.

For public paid launch, remove closed-beta barriers. Link also provides renewal management through financial confirmations if app access is unavailable. Confirm service URL/DNS/HTTPS and current public legal pages before activating checkout.

The official MCP setup helper is read-only by default:

```bash
node apps/ui/scripts/billing-live.mjs --origin https://YOUR_PRODUCTION_HOST
# After both owned sandbox purchases and access projections pass:
node apps/ui/scripts/billing-live.mjs --origin https://YOUR_PRODUCTION_HOST --apply --sandbox-accepted
# After installing the endpoint signing secret in the deployed app:
node apps/ui/scripts/billing-live.mjs --origin https://YOUR_PRODUCTION_HOST --apply --sandbox-accepted --verify-receiver
```

It prepares two digital products, four immutable prices and three restricted Portal configurations, reusing stable IDs/lookups/names and refusing mismatched objects. It can register the pinned webhook once legal pages and the deployed handler are reachable, including a handler awaiting its first signing secret. The optional signed probe validates the receiver's secret/mode without a charge or access grant. It does not prove database/worker/Strapi health; verify those separately.

The safe manifest contains no keys. Deployment values are saved to ignored `.scratch/billing-live.env` with permissions `0600`; live flags remain false. If MCP redacts a newly created endpoint signing secret, retrieve it privately from the Dashboard. Confirm Managed Payments terms/activation, classification, support contacts/refund escalation, deployment health, legal details and email delivery before enabling flags. Charges/payouts being enabled alone does not prove these requirements.

Stripe MCP stops accepting ordinary untagged keys after 31 October 2026. Use installed OAuth or an Agent-tagged key for continued helper access; the normal Stripe runtime API is separate. [Official MCP guide](https://docs.stripe.com/mcp).

## Webhooks, notices and emails

`BILLING_EVENTS` in `src/lib/billing/events.ts` allowlists checkout, subscription, invoice, refund/dispute and schedule lifecycle events. Only exact `POST /api/billing/webhook` bypasses beta/basic-auth; signature and environment checks remain mandatory. Missing/oversized signature headers are rejected before a bounded raw body is read.

Strapi writes `billing_update` transactionally with each projection revision. Activation, changes, scheduled reductions/undo, cancellation/resumption, recovery and access ending have templates. Ordinary renewal does not repeat a welcome. First failure is inbox-only because Stripe owns recovery emails. Link sends financial receipts, invoices and refund confirmations; sandbox financial emails are not sent automatically. [Managed Payments flow](https://docs.stripe.com/payments/managed-payments/how-it-works).

```bash
# Offline HTML/text examples; no mail sent.
pnpm --filter @repo/ui email:check --suite --preview-dir /tmp/libraries-billing-email-previews
# Verify SMTP/TLS/credentials without sending.
pnpm --filter @repo/ui email:check
# Deliberate resend to the authorized test inbox: eleven billing samples.
pnpm --filter @repo/ui email:check --billing --to info@libraries.global
pnpm --filter @repo/ui email:check --suite --only verification --to info@libraries.global
```

All 43 previews render and Brevo SMTP verification passes. On 12 October 2026, the server accepted all eleven application billing samples plus the checkout account-verification sample for `info@libraries.global`, as explicitly requested. SMTP acceptance and mailbox delivery are separate; inspect received authentication headers and links. App notices use English; billing controls are EN/FR/CS and English-only legal policies are labelled. Membership does not enrol anyone in marketing.

## Knowledge, legal and recovery

[BILLING-HELP.md](BILLING-HELP.md) is the customer guide. `apps/strapi/scripts/update-billing-docs.mjs` preserves unrelated content, backs up before writes, updates existing knowledge articles in EN/FR/CS and updates general terms/privacy/cookies. Membership terms and cancellation/refund policy, including a model cancellation form, were published in the configured CMS on 12 October 2026. The owner confirmed Alexander Bennett and info@libraries.global, then explicitly authorised the email-footer postal address for public use. That address is saved in the ignored Strapi environment as BILLING_LEGAL_POSTAL_ADDRESS; no private address is copied automatically. The policies link to each other and appear in legal navigation, checkout and the membership page. The existing legal reader provides section anchors and print/save controls. Policies currently use English; FR/CS routes display the English fallback with its language note.

```bash
node --experimental-transform-types apps/strapi/scripts/update-billing-docs.mjs
node --experimental-transform-types apps/strapi/scripts/update-billing-docs.mjs --apply
# Update only these two policies; preserves other content and earlier revisions.
node --experimental-transform-types apps/strapi/scripts/update-billing-docs.mjs --legal-only --apply
```

Current UK guidance provides a normal 14-day initial online-service cancellation period and requires an express request for early service. Immediate access does not automatically waive rights. There is no blanket automatic full refund after every renewal. [Distance-selling requirements](https://www.gov.uk/online-and-distance-selling-for-businesses/distance-selling), [Consumer Contracts Regulations](https://www.legislation.gov.uk/uksi/2013/3134). Public terms must match the application's recorded version before live checkout opens. Membership consent and both policy revisions use version 1.0, published on 12 October 2026. Earlier stored consents labelled 2026-10-12 remain evidence for that release and are not rewritten. UK subscription reforms were subsequently announced for January 2027; verify commencement, provider reminders and any renewal cooling-off requirements before launch/renewals under that regime. The policy preserves any statutory rights that apply to renewals rather than excluding them. [Latest government announcement, 9 August 2026](https://www.gov.uk/government/news/pm-starts-roll-out-of-everyday-fixes-on-the-cost-of-living-ending-rip-off-discounts-and-subscription-traps).

Retry with the same binding/selection after timeouts. After 23 hours with unresolved creation, reconcile before retrying because provider idempotency retention is finite. Events/projections back off durably; replay original event IDs and refetch current state. An erased-profile 410 is acknowledged only with a local tombstone; missing non-erased profiles need repair. Refund/dispute holds require explicit operator reconciliation with provider evidence and an audit record; no customer hold-reset or self-service refund endpoint exists. Changed periods or expired idempotency windows remain pending for operator reconciliation.

Keep keys, cookies, signing secrets, capability links and fixture backups out of source, logs and shared reports. See the launch review for verified evidence and remaining external dependencies.
