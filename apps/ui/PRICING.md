# Membership pricing and rollout

The agreed catalogue is in `src/lib/membership-pricing.json`. Static plan cards, Stripe preparation and CMS content generators read those amounts. Stripe confirms the actual checkout price and tax. A catalogue record does not enable purchases.

| Offer                       | Price                                 | Tax treatment                                                     |
| --------------------------- | ------------------------------------- | ----------------------------------------------------------------- |
| Supporter                   | £3/month or £30/year                  | Tax-inclusive base GBP                                            |
| Founding Pro                | £5/month or £50/year                  | Tax-inclusive base GBP; existing subscriptions retain their Price |
| Future standard Pro         | £8/month or £80/year once Reach ships | Not offered or activated yet                                      |
| Team, five seats            | £600/year                             | Excluding VAT                                                     |
| Additional Team seat        | £120/year                             | Excluding VAT                                                     |
| Public-library-service Team | £480/year; additional seats £96/year  | Excluding VAT; 20% discount on Team items only                    |
| Team API add-on             | £15/month, billed separately          | Tax-inclusive base GBP                                            |

New Teams use self-service annual Stripe subscriptions when enabled. `/staff/team/new` creates an inactive Team; settled payment activates its seats and the purchaser becomes its Organiser. The subscription uses one £120 annual seat item with a five-seat minimum, or £96 after public-library-service eligibility is confirmed separately. Organisers manage renewal, seat quantities and invoices online. Existing agreed invoice Teams keep their quoted terms and are not converted automatically. Verification is assessed separately. API subscriptions have their own Team customer binding and never buy staff authority. See [Team billing](TEAM-BILLING.md).

## Stripe catalogue

`scripts/pricing-catalogue.mjs` uses the official Stripe MCP and verifies the account and coupon restrictions through Stripe's read API. It reuses matching immutable prices, refuses conflicting catalogue entries and creates only missing products, prices, a scoped coupon and the API billing portal. It never creates invoices, payments, customers or subscriptions, and never enables live checkout.

```sh
node apps/ui/scripts/pricing-catalogue.mjs
node apps/ui/scripts/pricing-catalogue.mjs --apply
node apps/ui/scripts/pricing-catalogue.mjs --live
node apps/ui/scripts/pricing-catalogue.mjs --live --apply
```

Account-specific catalogue IDs are saved locally in Git-ignored `scripts/pricing-sandbox-catalogue.json` and `scripts/pricing-live-catalogue.json`. Personal founding prices remain unchanged. Standard Pro prices are not created or put in the portal before Reach is delivered.

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
