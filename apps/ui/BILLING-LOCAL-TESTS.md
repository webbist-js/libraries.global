# Local membership acceptance

Open [local membership](http://localhost:3005/contribute/membership). The current local UI, Strapi, Stripe sandbox listener and billing worker are running. Reload the page to pick up the layout changes. These are sandbox purchases; use Stripe test details.

## Start again after a restart

Run from the repository root. Start Strapi and its database as usual. Configure/check the sandbox before starting the UI:

```bash
pnpm --filter @repo/access build
pnpm --filter @repo/ui billing:sandbox:configure
pnpm --filter @repo/ui billing:migrate
pnpm --filter @repo/ui billing:check
```

The check must report `mode: sandbox`, four matching prices and three matching portal policies. The helper only accepts the sandbox key/catalogue; it does not copy production credentials. Keep environment files private.

Leave these running in three separate terminals:

```bash
# 1: wait for “Sandbox listener ready”. It saves the signing secret privately.
BILLING_FORWARD_URL=http://localhost:3005/api/billing/webhook pnpm --filter @repo/ui billing:sandbox:listen
```

```bash
# 2: start after listener readiness; restart if its signing secret changes.
APP_PUBLIC_URL=http://localhost:3005 NEXT_DIST_DIR=.next/billing-review pnpm --filter @repo/ui dev --port 3005
```

```bash
# 3: process payments and Strapi projections every five seconds.
BILLING_LOCAL_ORIGIN=http://localhost:3005 pnpm --filter @repo/ui billing:sandbox:watch
```

Ctrl-C stops each process. Without the worker, Stripe can show a successful payment while the application is still confirming membership. A one-off pass is also available with `billing:sandbox:work`.

## Initial purchases

Use a verified account you control. For independent initial Supporter and Pro purchases, use two fresh verified accounts without an existing paid membership. An account with complimentary Pro cannot buy redundant paid Pro; use a fresh test account for that case. Sign in through the normal UI and create the checkout there, so its return link belongs to that account.

| Scenario          | Selection           | Expected base price |
| ----------------- | ------------------- | ------------------- |
| Supporter monthly | Supporter / Monthly | £3                  |
| Supporter annual  | Supporter / Yearly  | £30                 |
| Pro monthly       | Pro / Monthly       | £5                  |
| Pro annual        | Pro / Yearly        | £50                 |

Test at least one initial purchase for each plan; use further fresh accounts if testing all four initial combinations. Paid accounts manage changes in Settings instead of opening another subscription.

1. Check the plan cards, interval control, feature list and matching order summary. Try switching to yearly in the summary and returning to monthly. Check at a narrow viewport and 200% browser zoom; verify the modal scrolls and Escape restores focus to its trigger.
2. Continue to Details. Confirm the account email. Public credit starts off; the Supporter mark can be hidden. Checkout must not change profile visibility.
3. Read/accept the recurring membership consent. Continue must remain disabled until accepted. The membership/refund policies are now published in the configured CMS with the confirmed contact details. Open both links and check section navigation and Print / Save to PDF. Confirm the deployed production site serves the same version before live launch.
4. Continue to the Stripe-hosted page. Confirm **Test mode** there. Use `4242 4242 4242 4242`, expiry `12/34`, CVC `123` and your test billing address. Complete any Stripe verification shown. Stripe confirms the final tax/local-currency total; the application shows base GBP.
5. Return to the application in the same signed-in browser. Wait for “Thank you” after webhook processing and Strapi acknowledgement. Do not pay again because confirmation is slow. Check the listener reports HTTP 200 and the worker reports no failures/pending work.
6. Open Settings → Membership & billing. Confirm plan, interval, status, paid period, masked payment method and invoice/PDF. Check the activation notice in the account’s notifications and email inbox.
7. Open detailed library history and download Atlas CSV and GeoJSON. Supporter is limited to 500 libraries/download; Pro to 10,000. Population comparisons require Pro. Free records, individual downloads, contributions and following remain available. Membership must not change the community role, points or review authority.
8. Check Privacy: hidden marks stay hidden; private/limited profiles are never publicly credited, even if the credit preference is selected.

Stripe test transactions do not move funds. Official [test cards and authentication cases](https://docs.stripe.com/testing).

## Failure and membership management

| Check                                                   | Expected result                                                                                                                     |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Leave Stripe without paying                             | Return to plan selection; no paid access granted.                                                                                   |
| Insufficient funds: `4000 0000 0000 9995`               | Hosted decline; no first-purchase access. Retry with a successful test card.                                                        |
| Authentication: `4000 0025 0000 3155`                   | Hosted bank-check flow; abandoning it must not grant first-purchase access.                                                         |
| Supporter → Pro                                         | Review Stripe’s exact proration before confirming. Existing settled Supporter access stays if the upgrade fails.                    |
| Monthly → yearly                                        | Stripe reviews the charge/renewal date; Settings updates after settlement.                                                          |
| Pro → Supporter, or yearly → monthly                    | Review the future date and price, with no charge today. Current paid tools stay until that date. Undo removes the scheduled change. |
| Cancel renewal, then resume before the paid period ends | Confirmation notices and Settings update; paid access continues through the settled period.                                         |
| Update card/billing details or download an invoice      | Secure Stripe management; changing the billing email does not change the sign-in email.                                             |

Apple Pay/Google Pay visibility depends on Stripe and the eligible browser/device/wallet. Record those tests separately; a successful card test does not prove a wallet test. Future renewals, grace expiry and refunds/disputes need dedicated sandbox lifecycle tests; scheduling a change alone does not prove its later transition.

## Email samples already sent

On 12 October 2026, SMTP accepted the eleven application billing samples below for **info@libraries.global**, plus the account-verification sample. Subjects start `[Delivery sample: …]`; their actions are examples and do not change accounts.

- Pro and Supporter activation.
- Upgrade to Pro, downgrade to Supporter and billing-interval change.
- Scheduled change and Undo.
- Cancellation, resumption, payment recovery and access ending.
- New-account email verification.

Check both inbox and spam, mobile/desktop presentation, plain-text content, links and authentication headers. SMTP acceptance is recorded; mailbox delivery still needs your confirmation. Application notices currently use English.

Stripe/Link owns receipts, invoices, refund confirmations and payment-recovery emails. These were not fabricated or sent through our SMTP templates. Managed Payments financial emails come from Link; Stripe does not automatically deliver test-environment financial emails. See [Managed Payments email ownership](https://docs.stripe.com/payments/managed-payments/how-it-works). Inspect the actual provider messages through its supported testing tools before live acceptance.

Offline previews and deliberate resends:

```bash
pnpm --filter @repo/ui email:check --billing --preview-dir /tmp/libraries-checkout-email-review
# Explicit send: eleven billing examples, not the entire notification suite.
pnpm --filter @repo/ui email:check --billing --to info@libraries.global
pnpm --filter @repo/ui email:check --suite --only verification --to info@libraries.global
```

## Evidence and current limits

Checkout component tests cover all four plan/interval request selections, explicit consent, recognition defaults, annual selection, step focus, canceled returns and pending acknowledgement. Earlier integration evidence covers a settled Pro purchase, annual proration, authenticated scheduled downgrade/Undo and the Strapi notification pipeline.

Fresh initial Supporter/Pro settlement and wallet/decline/authentication acceptance remain manual checks. The browser automation tool rejected inspection of the local page during this spacing review; the layout changes were compared against saved browser screenshots and the supplied references, then checked with component tests, lint, typecheck and a production build. New rendered geometry and browser zoom are not claimed as verified.

Production purchases remain off. Public legal details, deployed origin/webhook/worker and live Stripe preparation remain separate requirements in [BILLING-REVIEW.md](BILLING-REVIEW.md).
