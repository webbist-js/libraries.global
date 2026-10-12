# Billing launch review — 12 October 2026

The application work is implemented and the production build passes. Final purchase acceptance and live Stripe preparation remain dependent on the user's hosted-test completion, mailbox confirmation and production URL. This report does not claim the two new purchases or production payments have passed.

## What changed

Supporter is now a delivered digital membership: detailed library change history and Atlas CSV/GeoJSON exports up to 500 libraries/download for £3 monthly or £30 yearly. Pro keeps the £5/£50 founding price, 10,000-row exports and delivered population comparisons. Free records/downloads, following, contributions, saved events and weekly opt-ins remain free; Team is quoted separately. Unbuilt tools stay Coming soon.

Hosted Managed Payments, owned checkout attempts, invoice settlement, private Strapi projections and access/role separation remain in place. Settings now supports reviewed period-end reductions and Undo, in addition to Stripe-confirmed paid upgrades and invoice/payment management. Three restricted portals avoid Stripe's same-product scheduling limitation and block plan changes during payment recovery. Durable intents and an owner-lock recheck protect interrupted calls and Undo/erasure races.

Billing notices cover Supporter activation, upgrades/downgrades, scheduled changes, undo, cancellation/resumption, recovery and access ending. The queue remains revisioned and private. Reserved fictional recipients are excluded from SMTP. Billing retention and user-exported consent/change records are implemented.

Knowledge articles were updated through the configured Strapi content-manager MCP in EN/FR/CS. General terms, privacy and cookies were updated. Membership terms and cancellation/refund policy, including a model cancellation form, are now published in the configured CMS with the owner-confirmed operator/email and explicitly authorised email-footer postal address. New-account and membership consent use numbered version 1.0, published on 12 October 2026. Earlier records labelled 2026-10-12 refer to that same release; recorded consents are preserved.

## Verified evidence

- Shared access: 85 tests pass. Supporter includes history/export without Pro analysis; the limits remain 500 / 10,000 / 50,000.
- Focused UI/API/access/export and affected baseline suite: 213 tests pass, including the final schedule-race cases. Isolated local PostgreSQL: three tests pass for concurrency, recovery and retention. Relevant Strapi tests: 23 pass; earlier history tests also passed.
- Production Next.js build and UI typecheck pass. Thirteen pre-existing type errors were repaired, including obsolete About-test assumptions, canvas overload typing, nullable slugs, opening-hour tuples and correction-gap types. The affected About/globe/export tests pass.
- All four sandbox prices and three portal policies match mode, amount, interval, inclusive tax and allowlist expectations. Both products are active with SaaS classification.
- Real authenticated sandbox scheduling and Undo preserve the paid Pro period and create no extra invoice. Strapi acknowledges the future change and Undo, with exactly one owned notification each. Forged customer input returns 400, cross-origin mutation 403 and another owner's attempt 404.
- The previously completed Pro monthly/yearly journey and paid annual proration remain provider evidence. The two fresh Supporter/Pro sessions were last checked open/unpaid with Managed Payments enabled. Human hosted verification is required to finish them.
- All 43 HTML/text email previews render. Brevo connection, TLS and credentials verify. All eleven application billing examples and the new-account verification example were accepted by SMTP for `info@libraries.global` on 12 October 2026. Inbox delivery and authentication headers still need the owner’s confirmation.
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

## Checkout spacing follow-up

The owner reported that the earlier accessible layouts did not match the visual references closely enough. Saved browser screenshots confirm cramped headings, a 1024px modal, small unstructured plan cards, a bare Back link and a top-heavy summary. Margin-based spacing mixed with reset margins on headings/fieldsets made the spacing inconsistent.

The follow-up uses explicit flex gaps, a 1152px maximum checkout dialog and 60/40 desktop split, larger serif headings/prices, equal feature cards, connected steps, a circular close control and a warm-paper summary with a real annual-saving action. Details has larger recognition cards, a read-only email display, separated consent and aligned Back/Stripe controls. Loading no longer describes unavailable prices as “Coming soon”. Plan changes use the same spacing/control treatment, include interval labels and current-plan marking, and disable choices while a request is in flight. Programmatic step focus and summary locking during payment handoff are covered by component tests. Payment inputs remain Stripe-hosted.

Validation for this follow-up: 27 checkout component/API tests pass, including all four request selections and step focus. UI typecheck and the final 253-page production build pass. Focused ESLint has no errors and three existing warnings (component complexity, test function scope and CLI email validation regex). Billing translation keys match across EN/FR/CS. The read-only catalogue check confirms four prices and three portal policies. The local worker reports no failures or pending events/projections.

The browser automation tool rejected opening the local page because of its URL policy. No alternate browser surface or workaround was used. This follow-up was reviewed against existing rendered screenshots and the supplied references; fresh browser geometry, zoom and Axe checks remain owner acceptance items. Earlier Axe results above apply to the earlier rendering, not proof of the revised layout.

[Local acceptance checklist](BILLING-LOCAL-TESTS.md) covers both memberships, monthly/yearly prices, consent, settlement, access/export limits, recognition, changes and failure cases. The local sandbox worker now has a watch command so paid-return status can complete without repeatedly running a manual cron pass.

## Plan-change modal styling follow-up

The owner's screenshot exposed overlapping Cancel and Stripe-review buttons. The circular close-button styles targeted every `DialogClose` descendant, so Cancel inherited the icon's fixed square width. `DialogContent` now accepts separate built-in close-button styling, and both billing dialogs use it. Cancel keeps its natural width on desktop; the actions stack at narrow widths and wrap long labels. The title and explanation share a compact header, cards and the schedule notice have explicit spacing, and scrolling preserves each section's height.

Billing choices now show their outer focus outline for keyboard interaction rather than every pointer click. Shared dialog layers sit above the sticky site header and drawers. The 27 focused checkout, dialog and plan-change tests pass, including independent close-button styling, Cancel without a billing mutation, Escape/focus restoration and the separate reduction confirmation. UI typechecking, the 259-page production build and scoped lint pass, with the existing checkout complexity warning. The generated CSS contains the new focus, layering and mobile stacking rules. This review uses the supplied screenshot and source; fresh browser geometry and zoom checks remain outstanding because the browser tool blocked the local URL.

## Security review

Ownership, mode separation, verified identity, origin/body/quantity/price guards, raw signature validation, replay/out-of-order handling, durable retries, private revisions, quotas and erased-account protections were checked. No custom card/CVC processing was introduced. Financial data remains outside public profiles/directories. Pending choices never grant tools.

The unpaid-upgrade bug was fixed: a failed Pro upgrade cannot remove a still-settled Supporter period. The worker rechecks state after acquiring the owner lock, so a stale candidate cannot recreate an undone change or act on an erased account. Successful/expired attempts discard capability URLs. Retention preserves pending work/live accounts and bounds completed references/erased bindings.

This is tested behavior, not an absolute security guarantee. The initial Pro annual settlement is accepted in the follow-up below. Initial Supporter settlement, decline/3DS/wallet/device paths and production infrastructure remain outstanding. Refund/dispute hold clearing remains an explicit operator reconciliation with provider evidence and an audit record; no customer bypass endpoint exists.

## Local post-purchase follow-up — 12 October 2026

The owner's latest initial Pro annual checkout completed in Stripe. Local helpers still pointed to port 3005 after the app moved to 3000, so no fresh webhook/worker processing reached that purchase. The recovery worker fetched the owned completed session and verified settlement, then synchronized its active Pro projection to Strapi. The authoritative bridge now returns active paid Pro, and the billing revision is acknowledged. The helpers were restarted at the configured port 3000; a signed non-payment webhook probe returned HTTP 200. No new charge, customer impersonation or manual access grant was used.

The confirmation page's former 15-check cutoff was removed. It now recovers from transient failures and refreshes the existing session on verified readiness. Settings automatically updates a paid purchase awaiting projection. Worker synchronization now attempts newly settled projections in the same pass, avoiding an unnecessary extra scheduled-run wait. Forced session refresh fetches current private bridge data and fails closed when that bridge is unavailable. Initial Supporter settlement, decline/3DS/wallet/device tests and production acceptance remain outstanding.

Validation: 48 focused checkout/settings/session/security tests and 3 isolated local billing integration tests passed. Frontend typechecking, scoped lint with no errors and the production build (259 pages) passed. The paid-projection and signed-webhook checks used service credentials, never a customer session token. The owner should reload the running app and check the updated flow in their authenticated browser.

## Remaining external inputs and launch work

1. Complete the two owned hosted sandbox checkouts from the pending question. Then verify settled invoices, ready status, Strapi acknowledgement, both access caps, Settings and recognition. Keep fixture credentials/capability links private.
2. Inspect the twelve samples sent to `info@libraries.global`, including presentation and authentication headers. SMTP accepted them; inbox delivery is not inferred. Stripe’s sandbox financial receipts are not automatically emailed.
3. Confirm the deployed site serves /legal/membership and /legal/cancellation-refunds at version 1.0, dated 12 October 2026. Both are published and validated through the configured CMS; the postal address was explicitly authorised. Production must use the matching content/version.
4. Provide the production origin/deployment. `libraries.global` did not resolve to a reachable website here. After sandbox acceptance, execute live MCP preparation for two products, four prices, three portals and the deployed webhook. Capture/install its secret privately, then verify the signed receiver and mode.
5. Deploy production migrations/shared access/Strapi/UI with separate environment databases and matching bridge/mode. Schedule authenticated billing each minute and retention daily on the actual host, connect alerts, verify notification delivery and remove closed-beta barriers for a public launch. Confirm Managed Payments programme/terms, classification and public support/refund-escalation settings; existing charges/payout flags alone are insufficient evidence.
6. Enable live purchase flags only after the above checks. No real customer charge was made for testing. The normal Stripe runtime key is separate from MCP authentication; use OAuth or an Agent-tagged MCP key after Stripe's 31 October deadline.

[BILLING.md](BILLING.md) contains setup, testing and recovery commands; [BILLING-HELP.md](BILLING-HELP.md) contains customer guidance; [BILLING-SPEC.md](BILLING-SPEC.md) records the agreed scope and scheduling amendment.

## Membership legal pages follow-up

The two standalone policies were reviewed and published on 12 October 2026. Membership has seven sections; cancellation/refunds has eight, including contact details, stopping renewal, initial statutory cancellation, refund timing/method, the model form and access consequences. Both use info@libraries.global. Reciprocal links, general terms/privacy links and Link transaction support are real structured content links. Existing section navigation and print/save controls remain available. The membership page also provides #membership-terms and #cancellation-refunds anchors leading to the full policies.

The new legal-only updater preserves earlier revisions, backs up before writes and refuses to overwrite a published policy with a missing postal address. Frontend read-only CMS fetches for both pages return HTTP 200; publication, contact/address equality, absence of placeholders and legal-navigation inclusion were checked without printing private configuration. UI typecheck, 25 legal/billing helper and checkout tests, focused UI/script lint and the 259-page production build pass. The membership/refunds reader’s contact button also uses info@libraries.global.

## Merchant-of-record clarification

Stripe’s Managed Payments service terms, updated 19 August 2026, distinguish merchant of record from seller of record. The operator remains the service seller. The two policies and customer guide now state that explicitly, direct financial refunds to Link, preserve a direct statutory-cancellation contact and recognise Link refund-policy precedence. UK-specific rights remain clearly labelled for UK consumers, with other mandatory local rights preserved. The ambiguous “seller identified at Stripe checkout” wording was removed. This clarification is recorded in policy version 1.0, dated 12 October 2026; CMS backups retain the earlier wording. [Service terms, sections 2.1(a) and 3.3](https://stripe.com/legal/ssa-services-terms).
