# Billing launch review — 12 October 2026

The application work is implemented and the production build passes. Final purchase acceptance and live Stripe preparation remain dependent on the user's hosted-test completion, email recipient, public legal address and production URL. This report does not claim the two new purchases or production payments have passed.

## What changed

Supporter is now a delivered digital membership: detailed library change history and Atlas CSV/GeoJSON exports up to 500 libraries/download for £3 monthly or £30 yearly. Pro keeps the £5/£50 founding price, 10,000-row exports and delivered population comparisons. Free records/downloads, following, contributions, saved events and weekly opt-ins remain free; Team is quoted separately. Unbuilt tools stay Coming soon.

Hosted Managed Payments, owned checkout attempts, invoice settlement, private Strapi projections and access/role separation remain in place. Settings now supports reviewed period-end reductions and Undo, in addition to Stripe-confirmed paid upgrades and invoice/payment management. Three restricted portals avoid Stripe's same-product scheduling limitation and block plan changes during payment recovery. Durable intents and an owner-lock recheck protect interrupted calls and Undo/erasure races.

Billing notices cover Supporter activation, upgrades/downgrades, scheduled changes, undo, cancellation/resumption, recovery and access ending. The queue remains revisioned and private. Reserved fictional recipients are excluded from SMTP. Billing retention and user-exported consent/change records are implemented.

Knowledge articles were updated through the configured Strapi content-manager MCP in EN/FR/CS. General terms, privacy and cookies were updated. Membership terms and cancellation/refund policy, including a model cancellation form, are drafts until public postal details are confirmed. The terms version for new accounts and membership consent is aligned to 2026-10-12; old recorded consents are preserved.

## Verified evidence

- Shared access: 85 tests pass. Supporter includes history/export without Pro analysis; the limits remain 500 / 10,000 / 50,000.
- Focused UI/API/access/export and affected baseline suite: 213 tests pass, including the final schedule-race cases. Isolated local PostgreSQL: three tests pass for concurrency, recovery and retention. Relevant Strapi tests: 23 pass; earlier history tests also passed.
- Production Next.js build and UI typecheck pass. Thirteen pre-existing type errors were repaired, including obsolete About-test assumptions, canvas overload typing, nullable slugs, opening-hour tuples and correction-gap types. The affected About/globe/export tests pass.
- All four sandbox prices and three portal policies match mode, amount, interval, inclusive tax and allowlist expectations. Both products are active with SaaS classification.
- Real authenticated sandbox scheduling and Undo preserve the paid Pro period and create no extra invoice. Strapi acknowledges the future change and Undo, with exactly one owned notification each. Forged customer input returns 400, cross-origin mutation 403 and another owner's attempt 404.
- The previously completed Pro monthly/yearly journey and paid annual proration remain provider evidence. The two fresh Supporter/Pro sessions were last checked open/unpaid with Managed Payments enabled. Human hosted verification is required to finish them.
- All 43 HTML/text email previews render. Brevo connection, TLS and credentials verify. No test email has been sent yet because the recipient is unconfirmed.
- Official live MCP reads succeed; account charges/payouts and submitted details are enabled. The supplied live runtime key can read prices. Live products/prices/webhooks are still absent. The idempotent setup helper is prepared and defaults to read-only; its deployment values remain private and purchase flags remain off.

## Design review

Review basis: the supplied references and the current [Web Interface Guidelines](https://github.com/vercel-labs/web-interface-guidelines). The hosted payment page owns card/wallet controls; the application uses the reference's plan/details and billing layout without copying its example dates, no-VAT claim or unconditional refund promise.

The built membership page and checkout details have no Axe violations at 1440px and 390px, and no page overflow. Paid billing and the plan-change dialog also have no Axe violations. Paid Settings reflows without page overflow at 390, 640 and 720 CSS pixels. Escape closes the checkout dialog and returns focus to its trigger. Reduced-motion checks pass. Billing controls were inspected in EN/FR/CS; English-only legal policies are disclosed.

Fixed findings:

| Location                                                                        | Finding and result                                                                                                                                                                         |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/app/[locale]/contribute/membership/page.tsx:64`                            | Missing main landmark; added the page's main region.                                                                                                                                       |
| `src/app/[locale]/contribute/_components/membership/PlanCompareTable.tsx:158`   | Sticky cells extended mobile page overflow; paint containment keeps scrolling in the table. The region is keyboard-focusable with a unique accessible name.                                |
| `src/app/[locale]/contribute/_components/membership/MembershipPlans.tsx:64`     | Billing-period touch controls were 36px; enlarged to 44px. Existing subscribers now enter billing management.                                                                              |
| `src/app/[locale]/profile/settings/_components/MembershipBillingSection.tsx:55` | Unpaid/expired membership labels were misleading; settlement-aware labels now distinguish them. Invoices use readable dates, compact PDF links, localized statuses and keyboard scrolling. |
| `src/components/billing/PlanChangeDialog.tsx:89`                                | Reductions need their own confirmation; the dialog reviews effective date/price and no charge today. Redundant Pro purchase is disabled when complimentary Pro already applies.            |
| `src/components/billing/CheckoutFlow.tsx:351`                                   | Added clear recurring/immediate-access consent, preserved statutory rights, public-credit privacy explanation and English-policy disclosure.                                               |
| `src/components/atlas/AtlasPlansSheet.tsx:260`                                  | Supporter and exact export caps are now included; scroll containment also protects the five-column comparison.                                                                             |

A CSS-only zoom experiment retained desktop media queries and produced overflow; it was not treated as proof of browser zoom behavior. The 640px reflow check passes. Actual browser zoom/device wallet confirmation remains part of manual acceptance. General development-only indicators are not production UI.

## Security review

Ownership, mode separation, verified identity, origin/body/quantity/price guards, raw signature validation, replay/out-of-order handling, durable retries, private revisions, quotas and erased-account protections were checked. No custom card/CVC processing was introduced. Financial data remains outside public profiles/directories. Pending choices never grant tools.

The unpaid-upgrade bug was fixed: a failed Pro upgrade cannot remove a still-settled Supporter period. The worker rechecks state after acquiring the owner lock, so a stale candidate cannot recreate an undone change or act on an erased account. Successful/expired attempts discard capability URLs. Retention preserves pending work/live accounts and bounds completed references/erased bindings.

This is tested behavior, not an absolute security guarantee. Real initial Supporter settlement, current fresh Pro settlement, decline/3DS/wallet/device paths and production infrastructure are not yet fully accepted. Refund/dispute hold clearing remains an explicit operator reconciliation with provider evidence and an audit record; no customer bypass endpoint exists.

## Remaining external inputs and launch work

1. Complete the two owned hosted sandbox checkouts from the pending question. Then verify settled invoices, ready status, Strapi acknowledgement, both access caps, Settings and recognition. Keep fixture credentials/capability links private.
2. Provide the test-email recipient. Send the billing examples, record SMTP acceptance and inspect the received messages/authentication headers. Stripe's sandbox financial receipts are not automatically emailed.
3. Confirm operator/public postal details. Publish the two new legal policies and confirm the public version/links before checkout opens. No private mailing address has been silently published.
4. Provide the production origin/deployment. `libraries.global` did not resolve to a reachable website here. After sandbox acceptance, execute live MCP preparation for two products, four prices, three portals and the deployed webhook. Capture/install its secret privately, then verify the signed receiver and mode.
5. Deploy production migrations/shared access/Strapi/UI with separate environment databases and matching bridge/mode. Schedule authenticated billing each minute and retention daily on the actual host, connect alerts, verify notification delivery and remove closed-beta barriers for a public launch. Confirm Managed Payments programme/terms, classification and public support/refund-escalation settings; existing charges/payout flags alone are insufficient evidence.
6. Enable live purchase flags only after the above checks. No real customer charge was made for testing. The normal Stripe runtime key is separate from MCP authentication; use OAuth or an Agent-tagged MCP key after Stripe's 31 October deadline.

[BILLING.md](BILLING.md) contains setup, testing and recovery commands; [BILLING-HELP.md](BILLING-HELP.md) contains customer guidance; [BILLING-SPEC.md](BILLING-SPEC.md) records the agreed scope and scheduling amendment.
