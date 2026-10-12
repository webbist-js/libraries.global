# Managed Payments billing

Stripe Managed Payments is the selected provider. The application uses hosted Checkout and the Stripe Customer Portal; Better Auth still owns identity and Strapi still owns complimentary access, Teams and notifications. Payment changes access only, never community roles, trust, contribution points or staff permissions.

Purchase flags default to off. The local sandbox is configured and real Stripe-hosted monthly and yearly card payments have passed through webhooks, reconciliation and Strapi access. Physical wallets, bank authentication, failed renewals and actual email delivery remain acceptance work. Keep live purchases off until the remaining checks pass. All twelve supplied mockups guide the modal and Settings layout; their dates, VAT statement and refund promise are examples, not commercial terms.

## What the implementation does

- Plan/details dialog and a direct `/contribute/membership/checkout` route. Verified existing accounts only; registration uses the existing consent and email verification flow. Public credit is an explicit opt-in.
- Server-owned catalogue and customer binding, per-owner PostgreSQL locks, durable checkout attempts, Stripe idempotency keys, strict 4 KiB mutation bodies and origin checks. Customers and amounts cannot be supplied by the browser.
- Hosted sessions set `managed_payments[enabled]=true`. No custom card inputs, manual wallet buttons, tax calculation or Payment Intents. Stripe shows eligible payment methods and confirms tax, localized currency and the final recurring charge.
- Signed, size-bounded raw webhooks are persisted before acknowledgment. A retrying worker re-fetches provider state and verifies the owned Managed Payments session before projecting settled paid invoices.
- Private, versioned Strapi projections feed the shared entitlement resolver, session bridge and supporter directory. Status waits for settlement and Strapi acknowledgment. Paid membership and effective access are shown separately in Settings.
- Owned recent invoices, masked payment details, founding-price status and an authenticated portal handoff for billing details and cancellation. The plan-change dialog hands the exact charge, credits and final consent to Stripe. Scheduled changes show their provider date while preserving current paid access. Recognition controls reuse Privacy.
- Seven-day renewal grace requires a previously settled invoice and retains the first failure timestamp. Unpaid first purchases and unpaid upgrades grant no new access. Current-period full refunds/disputes suspend paid access; replay cannot undo the hold.
- Account erasure first stops subscriptions and expires owned sessions. Failure refuses erasure. Minimal provider-reference tombstones prevent late events from recreating access; account exports include owned billing metadata without card data.

## Stripe account setup: owner actions

1. Complete Stripe business verification, payout/bank setup and support contact details. Enable dashboard MFA. Apply for Managed Payments and accept its terms in the Dashboard. Pro must be classified as an eligible digital product. Obtain an explicit eligibility decision for patronage-only Supporter before enabling it. [Eligibility](https://docs.stripe.com/payments/managed-payments/eligibility).
2. Confirm the sandbox catalogue described below before copying it to production. Pro has monthly £5 and yearly £50 GBP recurring prices, interval count one and quantity one, with tax included. Supporter £3/£30 prices exist under an inactive product pending eligibility. These are sandbox commercial candidates; approve the live classification, prices and founding policy explicitly. Never repurpose an existing Price to change founding subscriptions. [Setup and tax behavior](https://docs.stripe.com/payments/managed-payments/set-up).
3. Configure branding, business/support URLs, statement descriptor, cancellation policy and published membership terms. Link is the merchant of record and appears at checkout and on statements. Respond to Stripe support escalations within 48 hours. The mockup's automatic 14-day refund promise is not implemented; agree and publish a policy before launch. [Managed Payments behavior](https://docs.stripe.com/payments/managed-payments/how-it-works).
4. Recreate the tested sandbox Customer Portal configuration in live mode: payment method updates, billing information, invoices and cancellation at period end. Permit only the approved founding Pro monthly/yearly prices, invoice immediate increases, and schedule changes that shorten the billing interval at period end. The sandbox monthly-to-yearly charge and annual-to-monthly scheduling have been verified. Validate these policies again in the production configuration before enabling sales. Set its new configuration ID. Link also provides customer order management; sandbox orders do not appear in the Link app.
5. Configure Stripe's renewal, expired-card and failed-payment email settings. Link owns financial receipts, invoices and refunds. Sandbox receipts are not automatically emailed; preview them in the Dashboard. Do not send duplicate app receipts.
6. Create an endpoint for `/api/billing/webhook` in each deployed environment and subscribe to the events below. Pin the endpoint API version to the installed integration. Store its signing secret in that environment's secret store.
7. Configure deployment secrets privately. Do not paste credentials into chat, source files, documentation or screenshots. A restricted server API key may be used if its customer/Checkout/subscription/invoice/refund/dispute permissions cover this service. Stripe MCP OAuth is a separate developer connection, not the application's payment credential.

Managed Payments supports recurring Apple Pay and Google Pay; Stripe controls availability by device, browser, wallet and customer location. Verify both on eligible devices. Bacs, Team invoicing and custom payment forms are outside this first release. [Payment methods](https://docs.stripe.com/payments/managed-payments/how-it-works).

## Sandbox catalogue and production copy

The non-secret [catalogue manifest](scripts/billing-sandbox-catalogue.json) records the products, four Prices, lookup keys, tax behavior and portal configuration. Pro uses SaaS personal-use tax code `txcd_10103000` as a candidate classification; confirm whether personal or business use is correct for your live offering. Supporter is deliberately inactive and unclassified until Stripe confirms patronage eligibility.

Stripe MCP is installed as an enabled local Codex server at `https://mcp.stripe.com`, and OAuth completed. Its tools were not exposed to this already-running chat, so sandbox setup used the supplied sandbox integration key through the SDK. MCP credentials and application credentials remain separate. No live product, checkout or charge was created.

To prepare production:

1. Open the Pro sandbox product in the Stripe Dashboard and use **Copy to live mode**. Verify the two resulting recurring Prices, inclusive tax behavior, classification and metadata. Preserve `lg_catalogue=membership_v1`, `lg_plan=pro`, and `lg_cohort=founding`; record the new live Price IDs. [Stripe product copying](https://docs.stripe.com/products-prices/manage-prices).
2. Create a live Portal configuration with the tested policy above and its own live product/Price IDs. Sandbox configuration IDs and customer IDs cannot be reused in live mode.
3. Configure the live key already supplied through the production secret store as `STRIPE_SECRET_KEY`; do not run the sandbox helper against production. Set `BILLING_ENV=live` in both apps, the new price/configuration IDs and a dedicated deployed endpoint signing secret. Keep databases separate.
4. Apply migrations and deploy the private Strapi bridge, UI, webhook and authenticated minute worker. Verify delivery monitoring, retention, published terms and owner support settings. Complete remaining acceptance before turning the live purchase flags on.

## Recorded sandbox acceptance — 12 October 2026

These checks used a private local fixture and Stripe test card details. No production funds were charged. The manual completion supplied by the owner finished Stripe’s browser-verification step.

| Check                       | Observed result                                                                                                                                                                              |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Monthly hosted Pro purchase | Complete, paid, sandbox, Managed Payments enabled; £5 total including £0.83 VAT.                                                                                                             |
| Activation                  | Signed events received; worker drained events/projections; Strapi and Next resolved paid Pro; owned return showed Thank you.                                                                 |
| Settings and portal         | Masked Visa ending 4242, expiry 12/2034, owned invoice PDFs, billing information, founding price and portal handoff.                                                                         |
| Monthly → yearly            | Stripe showed and settled £45 after the unused monthly credit; invoice includes £7.50 tax; yearly price £50. Both apps retained Pro through 12 October 2027.                                 |
| Yearly → monthly            | Stripe scheduled £5/month from 12 October 2027; current yearly paid access remains. Settings reads the future phase from Stripe.                                                             |
| Undo scheduled change       | Stripe’s Update subscription → Cancel change removed the schedule, retaining settled yearly Pro.                                                                                             |
| Focused UI checks           | Desktop/mobile membership and checkout, no horizontal page/modal overflow; zero serious/critical axe findings in the billing panel and both dialogs. Escape restored focus to both triggers. |
| Replay and recovery         | Real PostgreSQL tests cover concurrent requests, duplicate event revisions, failed private sync retry, refund hold and forged owner binding.                                                 |
| Notification previews       | 38 offline HTML/text samples generated, including six fictional membership notice samples. Actual provider/app email delivery remains unverified.                                            |

Test clocks/renewal failure, actual Apple Pay/Google Pay, 3DS, decline, refunds/cancellation and delivery still need the broader provider matrix below. These observations are not a claim of complete production acceptance.

## Configuration and deployment

Install versions: `stripe@22.0.0`, API `2026-03-25.dahlia`; Better Auth remains on the repository's patched 1.4.18 installation. Managed Payments fields have a narrow typed extension because this SDK omits them. The sandbox verified both creation and retrieved `managed_payments.enabled` under the pinned API; an absent value fails closed.

UI private environment variables are listed in `.env.local.example`:

| Variable                                                          | Purpose                                                                      |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `BILLING_ENV`                                                     | `sandbox` or `live`; must also match Strapi.                                 |
| `STRIPE_SECRET_KEY`                                               | Matching sandbox/live server key; never public.                              |
| `STRIPE_WEBHOOK_SECRET`                                           | Correct endpoint signing secret.                                             |
| `STRIPE_PRICE_PRO_MONTHLY`, `STRIPE_PRICE_PRO_ANNUAL`             | Current purchase allowlist.                                                  |
| `STRIPE_PRICE_SUPPORTER_MONTHLY`, `STRIPE_PRICE_SUPPORTER_ANNUAL` | Only after explicit product approval.                                        |
| `STRIPE_PORTAL_CONFIGURATION`                                     | Matching tested portal configuration.                                        |
| `STRIPE_MANAGED_PAYMENTS_ENABLED`                                 | Owner has activated and verified MP; default false.                          |
| `STRIPE_SUPPORTER_APPROVED`                                       | Explicit patronage-product eligibility; default false.                       |
| `PRO_ENABLED`                                                     | New purchase switch; default false. Does not stop recovery or portal access. |
| `CRON_SECRET`                                                     | Protects the billing worker endpoint.                                        |
| `STRAPI_BRIDGE_SECRET`                                            | Matching UI/Strapi service credential.                                       |
| `APP_PUBLIC_URL`, `STRAPI_URL`                                    | Fixed UI return origin and reachable backend URL.                            |

Use separate sandbox and production auth databases and Strapi databases. A billing owner has one environment per database; switching a populated database to live does not convert its customers. Backend `BILLING_ENV` must match. Use HTTPS for deployed payment journeys.

Deploy shared access build and generated Strapi types, run the auth database migration, deploy Strapi's private sync endpoint, then deploy UI/webhook and worker. The local migration has been applied. Other databases still require it:

```bash
pnpm --filter @repo/access build
pnpm --filter @repo/strapi generate:types
pnpm --filter @repo/ui billing:migrate
pnpm --filter @repo/ui billing:check
```

`billing:check` prints presence and safe catalogue properties only, not keys. It cannot prove account eligibility. Enable flags only after successful acceptance. Turning `PRO_ENABLED` off stops new purchases; it must leave webhooks, portal and reconciliation running.

`apps/ui/vercel.json` schedules `/api/cron/billing` each minute. Ensure the hosting plan supports that frequency, configure `CRON_SECRET`, and monitor the authenticated endpoint's status. Local development needs an explicit worker invocation using the same bearer credential; `pnpm dev` alone does not run Vercel cron. The worker uses a global advisory lock, short provider timeouts and a bounded work budget; deferred jobs remain durable for the next run.

## Webhooks and notifications

Endpoint: `POST /api/billing/webhook`. Only this exact route bypasses beta/basic-auth; the Stripe signature still applies. Unrelated auth/billing routes retain their guards. The signed event must match the configured environment and must not belong to a Connect account.

Subscribe to:

- `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`
- `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `customer.subscription.paused`, `customer.subscription.resumed`
- `invoice.paid`, `invoice.payment_failed`, `invoice.payment_action_required`, `invoice.marked_uncollectible`, `invoice.voided`
- `charge.refunded`, `charge.dispute.created`, `charge.dispute.closed`, `refund.updated`

Local setup uses the private `STRIPE_SANDBOX` value in Strapi’s ignored `.env`, never its live credentials:

```bash
pnpm --filter @repo/ui billing:sandbox:configure
pnpm --filter @repo/ui billing:migrate
# Keep this process running; it obtains Stripe CLI through pnpm dlx.
pnpm --filter @repo/ui billing:sandbox:listen
# Start/restart the UI after the listener saves its signing secret.
pnpm --filter @repo/ui dev
# Local development has no Vercel scheduler; run this after payment,
# then again if a pending projection remains.
pnpm --filter @repo/ui billing:sandbox:work
```

For an alternate review port, set `BILLING_FORWARD_URL=http://localhost:3005/api/billing/webhook` for the listener, `APP_PUBLIC_URL=http://localhost:3005` for the UI, and `BILLING_LOCAL_ORIGIN=http://localhost:3005` for the worker command. The helpers print readiness, delivery statuses and counters while keeping keys/signing secrets private. A deployed webhook endpoint is still required in each deployed environment.

Use the CLI's local signing secret locally; it differs from the deployed endpoint secret. Synthetic unowned `stripe trigger` events cannot grant access. A real owned hosted subscription is required to test activation.

Strapi's existing notification queue receives `billing_update` with a subscription/revision event key inside the same transaction as its projection. Duplicate revisions produce no duplicate notice. Essential emails use the current verified account address; no marketing enrollment. Initial activation, cancellation/resumption, recovery, plan/interval changes and access ending have HTML/text previews. First payment failure is inbox-only because Stripe owns payment recovery emails. App notice copy currently falls back to English; the checkout and settings labels exist in EN/CS/FR.

```bash
# Offline fictional previews only; no email is sent.
pnpm --filter @repo/ui email:check --suite --preview-dir /tmp/libraries-billing-email-previews
```

## Testing and acceptance

Automated coverage includes shared paid access bounds, complimentary access, checkout ownership/body/origin guards, event signatures, private Strapi sync/replay/rollback, session projection, supporter visibility, erasure, annual-price/consent UI and a real local PostgreSQL concurrency/recovery test with a fake Stripe provider. The latter creates and drops an isolated schema and refuses remote database URLs:

```bash
pnpm --filter @repo/access test
pnpm --filter @repo/ui test src/lib/billing src/app/api/billing src/components/billing
pnpm --filter @repo/ui billing:db:test
pnpm --filter @repo/strapi test tests/paid-membership.test.ts tests/billing-notice.test.ts
```

Complete these in an approved sandbox before live release:

| Scenario                                 | Expected evidence                                                                                                                                 |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Successful card `4242 4242 4242 4242`    | One subscription/invoice; MP enabled; Next and Strapi access agree; one welcome.                                                                  |
| Insufficient funds `4000 0000 0000 9995` | No paid first-purchase access; no success message; safe retry.                                                                                    |
| Authentication `4000 0025 0000 3155`     | Complete and cancel 3DS separately through hosted Checkout.                                                                                       |
| Annual purchase                          | Full annual charge, correct invoice currency/tax, recurring terms and period.                                                                     |
| Wallets                                  | Actual Apple Pay and Google Pay on eligible devices; usable card fallback when unavailable.                                                       |
| Replay/outage                            | Duplicate/out-of-order events; backend outage; worker restart; missed completion recovered; no duplicate access notice.                           |
| Renewal failure                          | Seven days from the first delinquency, no reset on repeated retries, recovery and end-of-grace notice. Use supported provider billing test tools. |
| Cancel and refund                        | Period-end cancellation retains settled access; current full refund suspends only paid access; earned/grant/Team access remains.                  |
| Ownership/deletion                       | Second account cannot access invoices/portal/status; deletion failure preserves account; late events cannot recreate erased access.               |
| UI accessibility                         | Desktop/mobile dialog and direct route, keyboard focus/Back, 200% zoom and translated states.                                                     |

Use future expiry and any valid test CVC. Only enter test card details into Stripe-hosted sandbox fields. [Stripe test values](https://docs.stripe.com/testing). Do not treat automated fixture tests as proof of real Stripe behavior.

## Recovery and remaining launch work

Monitor worker 503s, `pendingEvents`, `pendingProjections`, oldest pending event and last successful reconciliation. Alerting must be connected to the deployment's operations system before launch. Do not send operational alerts through end-user notifications.

- Replay a Stripe event from the Dashboard with its original ID; ledger insertion is idempotent. Pending failed events back off automatically up to one hour. Never edit a snapshot to fabricate payment.
- If customer/session creation times out, retry the same account and selection. The persisted token/attempt reuses its idempotency key. After 23 hours, reconcile with Stripe using that binding before resetting anything; Stripe idempotency retention is finite. Never create another session blindly.
- A deleted-account 410 is acknowledged only when a local erasure tombstone exists. A missing profile without erasure remains pending for operator repair.
- A current full-refund/dispute hold persists through later active-event replays. Clearing a resolved hold is an explicit operator reconciliation, with provider evidence and an audit record; there is no public hold-reset endpoint in this release. Partial and prior-period refunds do not automatically revoke a later paid period.
- Portal plan changes must remain restricted to the approved catalogue and cohort. Immediate changes use Stripe’s paid confirmation; shorter billing intervals wait until the current period ends. Scheduled changes can be reviewed or cancelled in secure billing (Update subscription → Cancel change). A dedicated in-app Undo action, Supporter upgrades/downgrades, self-service refunds and automated Team billing remain outside the verified slice.
- Confirm the actual provider response shapes under the pinned API and perform the sandbox matrix. Review retention duration for the minimal financial tombstone with the owner, then add the purge schedule. Add monitoring, a daily complete provider audit and operator reconciliation tooling before production scale.
- Replace Membership/Atlas placeholder pricing and founding/coming-soon claims with approved catalogue policy before live purchases. Publish the actual terms version represented by `MEMBERSHIP_TERMS_VERSION`; verify tax and refund wording. The integration does not make the mockups' promises true.

The repository has pre-existing UI typecheck errors in About tests, globe geometry and library hours/address code. Track them separately; this payment change must not introduce billing diagnostics. Playwright inspected the actual sandbox membership panel on desktop/mobile with no page overflow; focused accessibility and dialog keyboard checks are recorded above. A complete translated, zoom and physical-device review remains required.
