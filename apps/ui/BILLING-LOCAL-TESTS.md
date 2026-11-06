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

## API purchase

Use a verified account you control, with `API_ENABLED=true` in the local sandbox environment and the catalogue from `api:check`/`api:setup`. Test both a buyer who already organises an organisation and a fresh account with none (a single-member organisation is created at checkout). Sign in through the normal UI and start checkout from `/developers`, so its return link belongs to that account.

| Scenario   | Selection           | Expected base price |
| ---------- | ------------------- | ------------------- |
| API Access | `/developers` → Buy | £100/month          |

1. Check the offer summary: price, the three included allowances, rate limits and the overage explanation. Check at a narrow viewport and 200% browser zoom; verify the dialog scrolls and Escape restores focus to its trigger.
2. Read and accept the API purchase consent. Continue must stay disabled until accepted. Verify the terms and refund links serve the reviewed policies.
3. Continue to the Stripe-hosted page. Confirm **Test mode** there. Use `4242 4242 4242 4242`, expiry `12/34`, CVC `123` and your test billing address. Stripe confirms the final tax/local-currency total; the application shows base GBP.
4. Return in the same signed-in browser. Wait for confirmation after webhook processing and Strapi acknowledgement. Do not pay again because confirmation is slow. Check the listener reports HTTP 200 and the worker reports no failures or pending work.
5. On `/developers`, confirm status, paid period, allowances and reset time. Create a read-only key; confirm write and analysis scopes need explicit confirmation. Make requests and check the remaining-allowance headers and dashboard counters.
6. Confirm the organiser now has the browser Reach bonus and that another member of the organisation does not. Payment must not change the community role, points, recognition or library authority.

Stripe test transactions do not move funds. Official [test cards and authentication cases](https://docs.stripe.com/testing).

## Failure, overage and management

| Check                                                       | Expected result                                                                                |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Leave Stripe without paying                                 | Return to `/developers`; no API access granted.                                                |
| Insufficient funds: `4000 0000 0000 9995`                   | Hosted decline; no access. Retry with a successful test card.                                  |
| Authentication: `4000 0025 0000 3155`                       | Hosted bank-check flow; abandoning it must not grant access.                                   |
| Exhaust the request allowance with overage off              | 429 `quota_requests` with remaining balances; nothing charged.                                 |
| Opt in to overage with a £10 cap, then exceed it            | Usage continues until the cap, then 429 `overage_cap`; the dashboard shows the accrued charge. |
| Lower the cap below the accrued charge, or turn overage off | Further paid usage stops; the accrued charge remains.                                          |
| Cancel renewal, then resume before the period ends          | Settings and notices update; access continues through the settled period.                      |
| Update card/billing details or download an invoice          | Secure Stripe management; changing the billing email does not change the sign-in email.        |
| Invoice reconciliation after a period with overage          | Invoiced quantities match the ledger before the period is marked reconciled.                   |

Apple Pay/Google Pay visibility depends on Stripe and the eligible browser/device/wallet. Record those tests separately. Renewals, payment failure, refunds/disputes and meter delivery lag need dedicated sandbox lifecycle tests.

## Email acceptance

Generate offline HTML/text previews before requesting a delivery check:

```sh
pnpm --filter @repo/ui email:check --billing --preview-dir /tmp/libraries-checkout-email-review
```

Cover API activation, allowance and cap warnings (50%, 80%, 100%), cancellation, recovery, access ending and account verification. Check plain text, links, desktop/mobile rendering and email-client behavior.

A real send requires an explicitly authorized recipient. Record SMTP acceptance, mailbox delivery and authentication-header checks separately in private acceptance evidence. Application notices and provider financial messages have different senders and test controls; inspect the actual provider output through its supported sandbox tools.

## Evidence and release limits

Source tests cover consent, organisation creation, step focus, canceled returns, ownership, ledger reservation and settlement, overage caps and pending acknowledgement. They do not prove real payment settlement, bank authentication, wallets, email delivery or browser geometry.

Record the selected commit, environment, controlled fixture inventory and actual outcomes privately. A skipped or unavailable check remains pending. Complete the applicable card/decline/authentication/device journeys, allowance and overage caps, meter reconciliation and recovery checks before enabling the corresponding live flow. See [Billing](BILLING.md), [Team billing](TEAM-BILLING.md) and the [release contract](../../scripts/release/README.md).
