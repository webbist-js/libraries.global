# Self-service Team subscriptions

New Teams start at `/staff/team/new`. A verified account creates an inactive organisation and becomes its Organiser. The organiser chooses seats, accepts Team terms version 1.2 and continues to Stripe Managed Payments Checkout. Settled invoice lines activate seats; the return page and subscription status alone grant nothing. The API add-on remains a separate monthly subscription.

## Onboard a Team with API access

1. Sign up, verify your email and finish your profile. Open `/staff/team/new`, enter the organisation's name, choose seats and continue to billing. The Team is saved before payment, so you can return to it without creating another.
2. Review the annual total and accept the membership terms. Complete Stripe Checkout. In beta, use Stripe test payment details. The Team billing page shows whether payment and activation are still pending; use **Refresh payment status** if confirmation takes time.
3. Open **Members and Libraries**. Add the Libraries your Team covers, then invite colleagues by email. Each invitation reserves a seat. Colleagues accept their invitation using a verified account with that email address. Promote another active colleague to Organiser so someone else can manage the Team if you leave.
4. Arrange verification of Library authority through the existing Library access process. Paying for a Team does not grant verified owner or editor permissions. An Organiser can manage Team billing without verified Library authority.
5. Open **API access and usage** and purchase the separate monthly API add-on when available. Once its payment is confirmed, create a key with the scopes and expiry your integration needs. Copy the full key when it appears; it is shown once. Store it in your integration's secret storage.
6. Make a request using the examples in [Team API](TEAM-API.md#requests), then check the usage dashboard. Keep both the annual Team subscription and monthly API add-on active. Regenerate or revoke keys from that dashboard when access changes.

Use **Manage Team billing and seats** for invoices, payment details, seat changes and cancellation. Increases require confirmed payment. Reductions start at renewal, and members plus pending invitations must fit the new allowance. Cancel the API add-on separately when the integration ends. Existing invoice Teams keep their agreed arrangement.

## Team workspaces

The membership card opens an existing Team instead of offering another signup.
Default selection prefers active self-service Teams, then other active Teams;
explicit Team links keep their selection. Inactive setups remain available for
resuming payment or discarding, without concealing paid Teams with the same name.

Members and libraries, billing and seats, and API access share the staff area’s
navigation and panels. The checkout uses the same accessible dialog and progress
indicator as personal memberships. Stripe collects billing and tax information
in its hosted payment step. Selecting public library service records an eligibility
request in private administrator notes; it never approves a discount or staff access.

A settled checkout refreshes the session without submitting another reconciliation.
Billing Portal returns still reconcile changes to seats or renewal. Pending status
polls are sequential, time out, and stop when the component unmounts or settlement
is confirmed. Internal Team queries omit nested private-field selections because
Strapi rejects them; outgoing session summaries use an explicit public projection.

## Price and ownership

Team uses one annual, licensed, GBP subscription item at £120 per seat excluding VAT, with a minimum of five seats and a maximum of 500. This preserves the £600 five-seat offer. A separately configured £96 seat price applies only when an administrator has confirmed public-library-service eligibility on the Team. The browser cannot choose a price, customer, discount, verified status or paid-through date. Existing invoice Teams retain their agreed terms and are not converted or charged automatically.

Customers, attempts and paid projections belong to the organisation, independently of personal membership and API billing. Every management request resolves the signed-in, verified account, checks same-origin mutations, applies the existing PostgreSQL billing limiter and rechecks organiser membership in Strapi. Ordinary members can inspect billing status but cannot create checkout or Portal sessions. Team billing remains accessible when Team access expires.

The organisation's Organisers can manage its billing even if the original buyer leaves. Deleting the last Organiser's account is refused until another active member becomes an Organiser, or an unused Team is discarded. Discard closes open Team and API checkouts, revokes remaining API keys and refuses unresolved provider creation, ongoing subscriptions, paid Team coverage or other active members. Signup retries use a persisted UUID and the same account; checkout/customer retries use stable provider idempotency keys. Uncertain writes older than 23 hours require reconciliation rather than risking a duplicate charge.

## Access and seat changes

The existing signed webhook and billing worker refetch provider state and verify the persisted customer, environment, checkout and subscription binding. Only paid invoice lines matching the owned subscription item and the original price prove seat coverage. An unpaid increase preserves the existing paid seats. Refund/dispute holds remain sticky across event replays. A replacement subscription has a later owned attempt; late events from an earlier subscription cannot replace its access. Monotonic account revisions make CMS synchronization retryable and reject conflicting or older projections.

Stripe Portal permits quantity changes at the subscription's original price only, between five and 500 seats. It shows paid increases with immediate proration and schedules reductions for renewal. Payment details, invoices and cancellation at period end are available there. Runtime validates those exact controls before issuing a Portal URL. Configuration changes cannot silently expose the discounted price or permit immediate reductions.

Invitations reserve seats. A scheduled lower quantity caps new invitations immediately after synchronization. If existing members and invitations exceed the settled allowance when a reduction takes effect, the CMS suspends Team access and the worker keeps retrying synchronization. Organisers can remove excess members/invitations or purchase more seats, then use Refresh payment status. No member records are silently deleted. Renewal grace is bounded by seven days from the original failed renewal and cannot restart on retries. The CMS expiry enforces access ending even when a worker is delayed.

Payment never changes Team verification, staff roles or covered Libraries. Organisers can configure the Team name and Libraries. An unverified Team's assignments remain claims requiring review. Adding a Library to a verified Team requires the organiser to hold verified owner access to that Library; payment cannot bypass this check. Removing a covered Library ends the affiliations this Team created there.

Paid projections and checkout capabilities remain private. Consent exports include the requesting account's own Team payment attempts, without customer/checkout capability URLs. Archived Team financial bindings are removed after six years. Stripe owns financial receipts and payment-recovery emails; the application adds deduplicated Team access notices for Organisers. Session cache invalidation follows the existing per-instance model and 60-second TTL; CMS permission checks remain authoritative.

## Configure and release

1. Build the Access plugin and run `pnpm --filter @repo/strapi generate:types` after its schema changes. Deploy the matching UI, CMS and billing worker together.
2. Run `pnpm --filter @repo/ui billing:migrate` against the selected application/auth database. It installs the personal, API and Team billing tables transactionally. Strapi manages the private Team schema additions on startup.
3. Run `pnpm --filter @repo/ui team-billing:check` for a read-only catalogue inspection. `team-billing:setup` prepares the annual standard/public-service prices and restricted Portals, saving an ignored account-specific manifest. Live preparation additionally requires `--live` and matching live credentials. Neither command creates a subscription or enables purchasing.
4. Set `STRIPE_PRICE_TEAM_SEAT_ANNUAL`, `STRIPE_PRICE_TEAM_PUBLIC_SEAT_ANNUAL`, `STRIPE_PORTAL_CONFIGURATION_TEAM` and `STRIPE_PORTAL_CONFIGURATION_TEAM_PUBLIC` from the selected manifest in the private runtime environment. Keep the existing Stripe, webhook, bridge and billing-worker configuration. Sandbox and live databases and credentials stay separate.
5. Publish the generated Team membership, privacy and cancellation updates as version 1.2 before enabling the new offer. `scripts/update-team-pricing.mjs` previews those updates by default and preserves historical revisions. Historical accepted versions are not rewritten. Personal and API purchases keep their existing offer version; the new Team checkout records version 1.2.
6. Enable `TEAM_BILLING_ENABLED=true` only in the intended accepted environment. The flag defaults false. Disabling it stops new signup/checkout while existing billing management, webhook processing and reconciliation continue. Preserve the beta gate and sandbox billing until live release acceptance is complete.

## Validation

`pnpm --filter @repo/ui billing:db:test` runs personal/API/Team concurrency, settlement and retry tests in generated local PostgreSQL schemas, then removes them. It refuses remote database hosts. Route tests cover browser-selected billing/authority fields, invalid quantities and organiser checks. CMS tests cover inactive signup, replay ordering, mode separation, operator suspension, capacity recovery and account-transfer requirements. Component checks cover consent, the purchase gate, member visibility and pending payment.

Owned sandbox acceptance must also verify the full account → Team → hosted checkout → settlement → CMS activation path, a paid increase, scheduled reduction/undo, renewal failure/recovery, cancellation, API eligibility and payment management while inactive. Test provider/device requirements honestly; fixture tests do not prove a real provider payment or live eligibility. Run the existing minute billing worker throughout acceptance, including when new purchases are disabled.
