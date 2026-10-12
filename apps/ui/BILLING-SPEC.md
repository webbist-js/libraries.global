# Supporter and Pro launch specification

Agreed scope, 12 October 2026. Implements the feature split selected in this conversation on top of the existing Managed Payments integration.

## Product and pricing

| Plan      | Monthly / yearly GBP                | Delivered membership tools                                                                                                   |
| --------- | ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Free      | Free                                | Existing public records, individual record downloads, contributions, following, saved events and opt-in weekly digest        |
| Supporter | £3 / £30                            | Detailed library change history and Atlas CSV/GeoJSON exports of up to 500 libraries per download, plus optional recognition |
| Pro       | £5 / £50 founding                   | Everything in Supporter; exports of up to 10,000 libraries and delivered population comparisons                              |
| Team      | Existing negotiated service pricing | Existing Pro seats and library-scoped Team tools; no new automated Team checkout                                             |

Supporter is a digital tools membership. Its public description and Stripe product classification must describe delivered functionality, rather than patronage alone. Pro analysis tools that have not shipped remain labelled coming soon. Existing public access and community authority do not change. Saved searches/views and private notes are separate implementation projects and cannot be sold as delivered benefits here.

Prices are tax-inclusive base GBP amounts. Hosted Stripe Checkout confirms location, any localized currency and the final recurring total. The old blanket no-VAT statement and illustrative refund amounts are not used. Existing founding subscriptions retain their price; new price cohorts must not silently replace them.

## Access and export implementation

- Add the existing `library.history` and `atlas.export` entitlements to Supporter. Pro and Team inherit them. Supporter export cap is 500; Pro 10,000 and Team 50,000 remain unchanged.
- Keep capability/role grants, reputation, staff claims and moderation independent of payment. Paid, earned, verified, granted and Team access continue to use the shared resolver.
- Both Atlas export paths enforce the current server-resolved row cap. At the exact cap an export succeeds; above it the request fails clearly, without silently truncating or accepting a browser-supplied limit. Public individual-library exports remain free.
- History values remain guarded in Next and independently in Strapi. Public change names and the current public record remain visible to everyone.
- Membership cards, full comparison table, Atlas gate, history upgrade link, checkout details, settings and recognition text must agree with the resolver and actual product prices. Reuse existing UI and storage; no new financial fields are public.

## Checkout and subscription changes

- Support both plans, monthly and yearly, through owned Stripe Managed Payments hosted Checkout. Account registration and verified sign-in precede purchase. No guest-email account takeover, card inputs or client-controlled prices/customers/return URLs.
- Preserve durable attempts, owner locks, idempotency, raw signature verification, environment binding and private Strapi projections. Access is granted only after a settled matching invoice; success waits for Strapi acknowledgment.
- Customer Portal allows only these two products and four tested recurring prices. Upgrades use Stripe's actual proration preview and confirmation; downgrades and shortened billing intervals take effect at the paid period end. Pending changes show their effective date and can be cancelled in Stripe.
- An unpaid upgrade keeps the already-settled plan and quota. A successful upgrade changes access only once. Renewal cancellation preserves settled access; expired grace/full-current-period refunds and disputes remove only paid access, preserving any complimentary source.
- Payment and billing updates, invoices, cancellation, scheduled changes and recognition preferences work from Settings. Profile erasure stops billing first; private financial projections and test fixtures must not appear in public profiles/directories.

## Emails

- Reuse essential membership-ready, cancellation/resumption, recovery, plan-change and access-ended notices. Financial receipts, invoices and refund notices remain Stripe's responsibility.
- Produce and inspect HTML/text previews. Send explicitly labelled test messages only to the recipient authorized by the owner, using the configured SMTP transport. Record SMTP acceptance separately from confirmed mailbox delivery.
- Test private projection deduplication, verified-recipient lookup, erasure behavior, opt-in boundaries and failure recovery. No newsletter opt-in follows from purchase.

## Legal and knowledge base

- Update current plan/staff guidance and add membership, billing and payment help covering both plans, quotas, checkout, plan changes, cancellation, invoices, wallets and support.
- Update membership terms and privacy disclosures, and add a cancellation/refund policy where needed. Identify the real operator, contact details, Stripe merchant-of-record relationship, recurring billing, price/tax/currency, immediate access, cancellation and statutory rights. Do not promise a refund automation that does not exist or silently waive cancellation rights.
- Preserve existing content/locales. Review UK distance-selling requirements against current primary guidance; distinguish future subscription legislation from rules already in force. Missing owner details remain an explicit launch dependency, not invented content.
- Terms consent must point to the applicable version and policy, and be recorded with the durable checkout attempt. Provider confirmations and app notices must not contradict published terms.

## Security and design review

- Check account A cannot read or change account B's attempts, subscriptions, invoices, profiles, exported data or recognition. Deny forged customer/price/quantity/role/limit input and cross-origin writes. Keep credentials and provider capability links out of logs and committed artifacts. Share an owned sandbox checkout link directly with the user when hosted browser verification requires their participation.
- Verify replay/out-of-order events, webhook/Strapi outages, duplicate clicks, unpaid initial purchases, unpaid upgrades, stale entitlement data, expired periods and account erasure races. Worker failures remain durable and observable.
- Review desktop/mobile membership, checkout, return/error states, billing settings, plan-change dialog, notifications, profiles, supporters directory, export gate and history prompt. Check keyboard focus, labels, contrast, reduced motion, overflow and useful recovery.
- Run relevant unit/integration tests, actual local PostgreSQL tests and real Stripe sandbox journeys for both plans. Card success, decline and 3DS must be assessed honestly; physical wallet availability and inbox delivery need real device/mailbox evidence when unavailable to automation.

## Live Stripe preparation

Only after sandbox acceptance, use the live Stripe MCP connection to inspect the correct account and idempotently prepare the two products, four prices, eligible classifications, checkout/support/legal URLs, Portal configuration and deployed webhook endpoint. Verify mode, amounts, intervals, tax behavior, metadata/cohorts and webhook API/event selection after writes. Protect any new endpoint signing secret in private configuration.

Implementation amendment: Stripe Portal schedules reductions only between prices on one product. Keep separate Supporter and Pro products, use restricted Pro, Supporter and recovery Portal configurations, and implement owned period-end reductions with durable provider schedules. Settings reviews the date/base recurring amount, confirms no charge today, and offers Undo before the effective date. The worker recovers interrupted preparation and releases the schedule after its target phase starts. Future choices never grant access; revisioned access notices cover scheduling and undo.

Do not charge a real customer for testing. Product creation is not deployment: keep live purchase activation separate from preparation until migrations, private bridge, deployed webhook, authenticated worker, current legal content, owner account requirements and monitoring are verified. Record any account-only actions MCP cannot perform. Existing unrelated Stripe products/configurations must not be modified.

## Acceptance and completion report

1. Free users retain existing community features; Supporter and Pro receive the documented history/export permissions and exact caps across both apps.
2. Both real sandbox checkouts settle and synchronize, with correct settings/invoices/recognition. Upgrade, scheduled downgrade and cancellation/undo preserve the correct paid period and quota.
3. Billing email templates render and authorized test sends are accepted; remaining delivery evidence is identified.
4. Focused security and UI checks pass, generated Strapi types are refreshed after any schema change, and no new typecheck failures are introduced.
5. Live Stripe objects and endpoint/configuration are verified through MCP, with production deployment/owner dependencies explicitly recorded.
6. Knowledge, pricing and legal documentation match behavior. Commit source/docs/configuration manifests without secrets. Finish with a brief report of shipped work, verified tests, remaining owner actions and limitations.
