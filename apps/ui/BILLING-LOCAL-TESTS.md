# Local membership acceptance

Use the existing local UI and Strapi with the selected sandbox configuration. Open `/contribute/membership` on that UI origin. Check processes and ports before starting helpers; run at most one Next.js and one Strapi server across checkouts. These are sandbox purchases using explicitly controlled test accounts.

## Start again after a restart

Run from the repository root. Reuse the existing Docker PostgreSQL database and apps. Configure/check the selected sandbox; reload an existing process only when its inputs change:

```bash
pnpm --filter @repo/access build
pnpm --filter @repo/ui billing:sandbox:configure
pnpm --filter @repo/ui billing:migrate
pnpm --filter @repo/ui billing:check
```

The check must report `mode: sandbox`, four matching prices and three matching portal policies. The helper only accepts the sandbox key/catalogue; it does not copy production credentials. Keep environment files private.

Set `APP_PUBLIC_URL` and `NEXT_PUBLIC_APP_URL` in the private UI environment to the existing local origin (for example `http://localhost:3000`). The listener and worker read this origin by default. Start a listener only if none is already serving that sandbox:

```bash
# 1: wait for “Sandbox listener ready”. It saves the signing secret privately.
pnpm --filter @repo/ui billing:sandbox:listen
```

After listener readiness, reload the existing UI only if it needs the new signing secret. Process a finite worker pass after the test action:

```bash
pnpm --filter @repo/ui billing:sandbox:work
```

Without processing, Stripe can show a successful payment while the application is still confirming membership. Stop any listener started for this check when acceptance finishes. Avoid a watch worker for routine finite validation.

If you choose another port, update both public-origin values, start the UI on that port and restart both helpers. Check the listener's printed forwarding URL. Explicit `BILLING_FORWARD_URL` and `BILLING_LOCAL_ORIGIN` overrides take precedence and must match that port; old background helpers keep their earlier origin until restarted. A production domain is not needed for local card tests.

Confirmation keeps checking after 30 seconds, backs off to five-second checks and recovers from temporary status failures. The worker attempts to acknowledge newly settled projections in the same run when its time budget allows. The app shows success only after paid coverage and Strapi acknowledgment agree. It then refreshes the existing Better Auth session and server UI; no new login is needed. Settings also polls a paid purchase awaiting projection and refreshes access when ready, so a paid invoice is not left beside a stale “No paid membership” card.

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
3. Read/accept the recurring membership consent. Continue must remain disabled until accepted. Verify the membership/refund links serve the reviewed policies and current public contact details. Open both links and check section navigation and Print / Save to PDF. Confirm the deployed production site serves the same version before live launch.
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

## Email acceptance

Generate offline HTML/text previews before requesting a delivery check:

```sh
pnpm --filter @repo/ui email:check --billing --preview-dir /tmp/libraries-checkout-email-review
```

Cover activation, upgrades, reductions, interval changes, scheduled changes/Undo, cancellation, recovery, access ending and account verification. Check plain text, links, desktop/mobile rendering and email-client behavior.

A real send requires an explicitly authorized recipient. Record SMTP acceptance, mailbox delivery and authentication-header checks separately in private acceptance evidence. Application notices and provider financial messages have different senders and test controls; inspect the actual provider output through its supported sandbox tools.

## Evidence and release limits

Source tests cover plan/interval selection, consent, recognition defaults, step focus, canceled returns, ownership and pending acknowledgement. They do not prove real payment settlement, bank authentication, wallets, email delivery or browser geometry.

Record the selected commit, environment, controlled fixture inventory and actual outcomes privately. A skipped or unavailable check remains pending. Complete the applicable card/decline/authentication/device journeys, access caps, scheduled-change lifecycle and recovery checks before enabling the corresponding live flow. See [Billing](BILLING.md), [Team billing](TEAM-BILLING.md) and the [release contract](../../scripts/release/README.md).
