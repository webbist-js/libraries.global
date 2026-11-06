# Pricing and access model

Libraries Global is free public infrastructure. Only two things are paid: machine access through the API, and sponsorship. Payment, sponsorship and recognition never grant trust, ranking, editorial treatment, moderation or staff authority. The authoritative decisions are in [sponsored-access-decisions.md](../docs/docs/proposals/sponsored-access-decisions.md); where it differs from the pricing proposal or implementation spec, it wins.

The catalogue is `src/lib/membership-pricing.json`. Static copy, Stripe preparation and the CMS content scripts read amounts from it. A catalogue entry does not enable a purchase.

| Offer          | Who                                       | What it gives                                                                                                                                                                                               | Charge                                                                                                                                |
| -------------- | ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Explorer       | Any signed-in account                     | The former paid browse, comparison, context-layer, alert, notes, history and export tools. 1,000 saved views and 1,000 saved searches, 10,000 export rows per action, 20 exports per rolling day. No Reach. | Free                                                                                                                                  |
| Contributor    | At least 1 accepted contribution          | 2 new one-library Reach calculations per rolling 7 days. No service or network Reach.                                                                                                                       | Free (earned)                                                                                                                         |
| Supporter      | At least 100 accepted contributions       | Recognition only: no tools, quota or authority.                                                                                                                                                             | Free (earned)                                                                                                                         |
| Verified Staff | Verified affiliation with named libraries | Free staff workspace, editing within scope, embeds, bulk upload, team view and traffic where available.                                                                                                     | Free                                                                                                                                  |
| API Access     | Organiser of an API account               | Keys, usage dashboard, reference and playground; see below.                                                                                                                                                 | £100/month, tax-inclusive base GBP                                                                                                    |
| Sponsor        | Organisation funding the service          | Acknowledgement with consent, quarterly updates and an annual impact report. No API access unless agreed separately.                                                                                        | Annual agreement, agreed in conversation. No amount is shown on the site; enquiries open the contact form with the sponsorship topic. |

Earned recognition counts accepted contributions (`acceptedContributions` on the profile), not points; see `packages/access/src/recognition.ts`. Staff tools are capabilities from verified staff claims (`canStaff`), not entitlements. Library-scoped tools apply only to the libraries in the user's own staff claims; organisation membership never unlocks them.

## API offer

- **Price:** £100/month including tax at the base GBP price. Stripe confirms the final charge.
- **Included per billing period:** 10,000 successful requests, 262,144,000 response bytes (250 MiB) and 100 analysis credits, pooled across all keys.
- **Limits:** 30 attempts a minute, 2 concurrent requests, 128 KiB per response, 50 records per page.
- **Period:** the settled Stripe subscription item period `[start, end)` in UTC, not the calendar month. A partial first period gets the full allowance; a new period opens only after its payment settles.
- **Analysis credits:** simple summary 1, richer summary 5, one-library Reach 5, service Reach 20, network Reach 40. Credits are spent only on completed new jobs; cached repeats cost delivery units only.
- **Overage:** opt-in only, after the organiser accepts overage terms 2.0. 1p per request, 10p per MiB and 50p per credit, exclusive of tax. The cap runs from £10 to £500 in £10 steps over the combined overage before tax; £100 is preselected but never enabled without an affirmative action. Failed, refused, timed-out or internally retried work is never charged.
- **Browser Reach bonus:** organisers of a covered API account get 20 new Reach calculations an hour, pooled 100 a day per API account, up to 50 eligible libraries and the standard envelopes (2,500 km² / 75 km for four times, 20,000 km² / 200 km for one). Members do not inherit it.
- **Consent versions:** API purchase terms 2.0 and overage terms 2.0 (`src/lib/team-api/constants.ts`).

The PostgreSQL ledger is the real-time admission authority; Stripe meters are the invoice authority and are reconciled against it. See [API accounts](TEAM-API.md).

## Flags

All flags are server environment variables, default `false`, and never bypass authorisation or accounting.

| Flag                        | Enables                                                   |
| --------------------------- | --------------------------------------------------------- |
| `API_ENABLED`               | New API checkout                                          |
| `API_OVERAGE_ENABLED`       | Overage opt-in                                            |
| `API_SERVICE_READS_ENABLED` | `/api/v1/services` routes                                 |
| `API_SUBMISSIONS_ENABLED`   | `/api/v1/submissions` routes                              |
| `API_ANALYSIS_ENABLED`      | `/api/v1/analysis` summary and Reach jobs                 |
| `API_NETWORK_REACH_ENABLED` | Network-mode Reach, in addition to `API_ANALYSIS_ENABLED` |

## Beta reset

The service is in closed beta with sandbox billing, and existing accounts were amended outright with no grandfathering. Personal Supporter/Pro purchases, paid Team seats, the £15 Team API add-on and its 100,000-request / 10 GiB limits, earned Pro, `entitlement-grant` and `pro-verification` are removed. Local sandbox rows are disposable; `billing:migrate` installs the new schema and does not convert old rows. Workspaces keep their organisation container, members and organisers, without seats or billing.

## Releasing pricing changes

- Prepare the sandbox catalogue first: one immutable £100 monthly Price, metered overage Prices and the API billing portal. Set `STRIPE_PRICE_API_MONTHLY` and `STRIPE_PORTAL_CONFIGURATION_API` (plus the overage meter bindings) in the private runtime environment. Keep sandbox and live IDs separate. No build creates catalogue entries or enables live checkout.
- Run `pnpm --filter @repo/ui billing:migrate` against the selected application database.
- Stage the Knowledge guides and legal revision drafts with `apps/strapi/scripts/update-sponsored-access-content.mjs` (see [content operations](../strapi/CONTENT-OPERATIONS.md)). Legal drafts need legal review before publication; publication is a separate operator step with the matching release.
- Complete owned sandbox acceptance — purchase, settlement, keys, quota refusal, overage invoice, refusal at the cap, refund, cancellation and job failure — before live activation, then promote through the protected-main release runbook.

Publishing CMS text does not deploy code, and preparing a catalogue does not satisfy settlement or Managed Payments checks.
