# Membership pricing and rollout

The agreed catalogue is in `src/lib/membership-pricing.json`. Static plan cards, Stripe preparation and CMS content generators read those amounts. Stripe confirms the actual checkout price and tax. A catalogue record does not enable purchases.

| Offer                       | Price                                | Tax treatment                                                     |
| --------------------------- | ------------------------------------ | ----------------------------------------------------------------- |
| Supporter                   | £3/month or £30/year                 | Tax-inclusive base GBP                                            |
| Founding Pro                | £5/month or £50/year                 | Tax-inclusive base GBP; existing subscriptions retain their Price |
| Future standard Pro         | £8/month or £80/year (future offer)  | Not offered or activated yet                                      |
| Team, five seats            | £600/year                            | Excluding VAT                                                     |
| Additional Team seat        | £120/year                            | Excluding VAT                                                     |
| Public-library-service Team | £480/year; additional seats £96/year | Excluding VAT; 20% discount on Team items only                    |
| Team API add-on             | £15/month, billed separately         | Tax-inclusive base GBP                                            |

New Teams use self-service annual Stripe subscriptions when enabled. `/staff/team/new` creates an inactive Team; settled payment activates its seats and the purchaser becomes its Organiser. The subscription uses one £120 annual seat item with a five-seat minimum, or £96 after public-library-service eligibility is confirmed separately. Organisers manage renewal, seat quantities and invoices online. Existing agreed invoice Teams keep their quoted terms and are not converted automatically. Verification is assessed separately. API subscriptions have their own Team customer binding and never buy staff authority. See [Team billing](TEAM-BILLING.md).

## Stripe catalogue

`scripts/pricing-catalogue.mjs` uses the official Stripe MCP and verifies the account and coupon restrictions through Stripe's read API. It reuses matching immutable prices, refuses conflicting catalogue entries and creates only missing products, prices, a scoped coupon and the API billing portal. It never creates invoices, payments, customers or subscriptions, and never enables live checkout.

```sh
node apps/ui/scripts/pricing-catalogue.mjs
node apps/ui/scripts/pricing-catalogue.mjs --apply
node apps/ui/scripts/pricing-catalogue.mjs --live
node apps/ui/scripts/pricing-catalogue.mjs --live --apply
```

Account-specific catalogue IDs are saved locally in Git-ignored `scripts/pricing-sandbox-catalogue.json` and `scripts/pricing-live-catalogue.json`. Personal founding prices remain unchanged. Standard Pro prices are not created or put in the portal until a separate pricing decision enables that offer. Shipping Reach does not activate a price change.

For a Team invoice, use one base item plus the number of additional seats. Six seats cost £720/year ex VAT, or £576 for an eligible public-library service. Apply the public-service coupon only after confirming eligibility; it is restricted to the Team base and additional-seat products. It does not discount Supporter, Pro or the API add-on. API usage is capped in the application, with no automatic Stripe overage charges.

## Code and content to release together

- Ship the static pricing JSON/plan copy, Team consent version 1.2 and the existing personal/API offer consent version 1.1. Existing personal paid snapshots and their original Price IDs remain valid.
- Ship the complete Team API UI, machine routes, private CMS access-plugin routes and billing-worker accounting from `TEAM-API.md`. UI and CMS must agree on the bridge routes.
- Ship the self-service Team flow and worker from `TEAM-BILLING.md`, build the Access plugin and generate Strapi types. The CMS Team schema includes private payment bindings and projections.
- Apply `billing:migrate` to the application/auth PostgreSQL database. It installs the personal, Team API and Team seat billing tables transactionally.
- Configure the matching-mode API Price and portal IDs from the prepared catalogue. Keep runtime credentials private and preserve separate sandbox/live bindings.
- Publish the reviewed current policy revisions and matching Knowledge copy before enabling Team seat purchases. Policy document revisions can differ from purchase offer consent versions; preserve historical revisions and accepted offers. [Content operations](../strapi/CONTENT-OPERATIONS.md) documents production and local targets.
- Complete the owned sandbox purchase, key lifecycle, usage, limits and cancellation checks before live activation. Production Knowledge guides distinguish Stripe Test mode from live purchases and record temporary checkout restrictions.
- Prepare personal live portals/webhooks through the existing billing runbook after its acceptance requirements are met. Preparing the pricing catalogue does not satisfy settlement or Managed Payments activation checks.
- Promote the accepted UI/CMS/worker release using the deployment runbook, then update the production API availability copy when purchases are enabled.

The production CMS can be updated independently. The deployed static membership/Atlas prices change only when the new UI build is promoted. See `BILLING.md`, `BILLING-LOCAL-TESTS.md`, `TEAM-API.md` and the private `docs/operations/infrastructure/digitalocean/deployment.md` from the repository root for acceptance and deployment details.

## Atlas analysis capacity

Pro supports up to 50 eligible libraries per service, Team 100. Four-time calculations use conservative geographic envelopes of 2,500 km² / 75 km span for Pro and 5,000 km² / 150 km for Team. Larger services use only the selected time, up to 20,000 km² / 200 km span for Pro or 40,000 km² / 400 km for Team. Both the service and reporting envelope must fit; area is not land area. The hourly allowance is 20 new calculations for Pro or 100 for an active Team seat. Cache hits do not consume a new calculation. Changing the time for a larger service requires another calculation.

An active Team seat receives the larger analysis allowance without changing its personal Pro plan or its Library editing permissions. Lapsed or expired seats fall back to any independently held plan. Transit, shared workspaces, benchmarking and traffic reports remain marked as planned. Deprivation, households without a car, Library access comparison and UK walking/cycling Reach are delivered; availability still depends on the required country datasets and mapped Library records. Checkout remains subject to the beta availability notice.

## Earned Pro

Earned Pro requires at least 5,000 current reward points and an accepted contribution within the last 30 days. Each positive qualifying award extends `earnedProUntil` to its acceptance time plus 30 days. Expiry is checked when resolving entitlements; no scheduled downgrade is needed. Another accepted contribution restores access if the points requirement is still met. Recognition tiers and permanent badges do not grant Pro. Paid Pro and other independent access grants are unaffected.

Qualifying actions are defined in `packages/access/src/earned-pro.ts`. Administrative point adjustments, daily streaks and automatic drive-completion bonuses do not renew access. Moderated discussion threads earn 2 points, replies 1 and edits 1; each approved revision can be credited only once, using its original approval time even on delayed outbox delivery.

The November 2026 migration replaces old tier-based holds using each account's latest positive qualifying point event plus 30 days. Existing accounts receive no new rollout grace period. Deploy the migration with the updated entitlement code. At 50 points per approved new library, 5,000 points is equivalent to 100 new libraries before other rewards.

Approved event-feed connections or replacements and accepted option suggestions each earn 5 points and renew the 30-day clock from acceptance. Option suggestions credit the original suggester (including accepted merges or clarifications), not voters; legacy anonymous suggestions have no reward recipient. Acceptance and rewards commit atomically, with an idempotency key per submission or suggestion. Access requests and role applications should remain separate from contribution rewards. Badges now recognise discussion threads/replies and the 5,000-point milestone; approved corrections count toward edit badges and Journal translations toward Copy Editor.
