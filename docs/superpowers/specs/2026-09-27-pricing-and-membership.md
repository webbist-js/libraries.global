# Pricing and membership

**Date:** 2026-09-27
**Status:** Proposal. The owner confirms the numbers before any Stripe prices are created. Until then, the pricing page labels every amount "Prices are placeholders".
**Builds on:**

- `2026-09-26-pro-subscriptions-design.md`: the principles, the plans, and what Pro adds.
- `2026-09-26-access-contribution-pro-implementation-design.md` §2 and §6: the design's £8/£80 and Team from £40/month, and D-P2 on VAT.

## What membership is for

Grants fund development. **Membership keeps the lights on**: hosting, email, search, map tiles and the Pro compute. Any surplus goes to new data ingests and integrations. The principles in the Pro design spec still bind:

- Library facts are free.
- Contributing is free.
- Money never buys trust.
- Contribution can earn Pro.

So the offer is **patronage plus analysis**, never access to the facts.

## Running costs (estimate, to be checked against real invoices)

These are monthly figures at launch scale, in GBP at about $1 = £0.79. The provider prices are list prices as I understand them and may have changed. Treat them as a planning range, not a quote.

| Item               | Likely choice                                                    | Per month   |
| ------------------ | ---------------------------------------------------------------- | ----------- |
| Frontend           | Vercel Pro, 1 seat                                               | £16         |
| CMS and API        | Strapi Cloud (Essential if it fits, or Pro)                      | £23–78      |
| Auth database      | Managed Postgres (Neon or Supabase entry paid tier)              | £15–20      |
| Search             | Meilisearch Cloud entry tier, or self-hosted on a small VPS      | £6–24       |
| Basemap tiles      | Protomaps on Cloudflare R2, or MapTiler                          | £5–20       |
| Email              | Transactional plus digests (Postmark or Mailgun)                 | £12–15      |
| Error monitoring   | Sentry (free tier at first)                                      | £0–21       |
| Storage and CDN    | R2 for uploads and open-data dumps                               | £2–5        |
| Sync worker        | A small container or cron host                                   | £4–8        |
| Domain and misc    |                                                                  | £2          |
| **Baseline**       |                                                                  | **£85–210** |
| Pro compute (P-D3) | A routing engine (Valhalla or ORS, UK extract) on an 8–16 GB VPS | £13–26      |

**Planning figure: about £200 a month (£2,400 a year),** not counting your time. The Strapi Cloud line is the biggest variable, and it may be discounted for you.

## Proposed plans

VAT handling is covered in its own section below.

| Plan             | Price                                                                                                                                           | Who it's for                                            | What it includes                                                                                                                                                                                                 |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Public**       | Free                                                                                                                                            | Anyone                                                  | Every record, search, map and list, plus the open-data downloads                                                                                                                                                 |
| **Free account** | Free                                                                                                                                            | Anyone who signs up                                     | Contribute, follow libraries, save events, 3 saved views and searches, a weekly digest of followed libraries (D-P7)                                                                                              |
| **Supporter**    | **£3/month or £30/year**                                                                                                                        | People who value the index and want to keep it running  | Everything in Free, plus an optional, hideable Supporter mark and credit on a supporters page. **No features and no trust.** It's patronage.                                                                     |
| **Pro**          | **Founding price £5/month or £50/year**, held while the membership continues. **Standard £8/month or £80/year** once per-capita and Reach ship. | Researchers, journalists, consultants, enthusiasts      | Everything in Supporter, plus the Pro features: context layers, compare, exports, alerts, notes and a personal calendar feed. Features that aren't built yet are shown as "Coming soon" and aren't sold as live. |
| **Team**         | **£480/year ex VAT for 5 seats** (£96 per seat per year), extra seats £96. **Public library services get 20% off** (£384).                      | Library services, councils, universities, consultancies | Pro for every seat. Later: the workspace, bulk updates, the embeddable finder and page analytics (P-D4). At launch, a Team is an enquiry fulfilled by invoice, with team grants.                                 |
| **Data and API** | Later                                                                                                                                           | Developers, researchers                                 | A free low-quota key, higher quotas on Team, and bespoke licences by quote. Bulk open-data dumps stay free (§11.3).                                                                                              |

**Complimentary Pro is unchanged:**

- verified library staff, students and charities (C5), renewed yearly
- earned at Archivist tier, with a 90-day hold (D-P4)
- admin grants for press and partners

Someone with complimentary Pro is never asked to pay. The page offers them Supporter instead.

## Why these numbers

- **Supporter at £3/£30** sits where small memberships and "buy me a coffee" sit. It gives the many people who don't need analysis, including library staff who already get Pro free, a way to help.
- **Pro starts below the design's £8 because, at launch, most Pro value is still "Coming soon"**: per-capita data needs ACE and ONS joins, and Reach needs routing.
  - A founding price that's held for early members is honest, and it rewards the people who fund the early months.
  - The standard price then moves to the design's £8/£80 when the analysis ships. Individual research and mapping tools commonly sit at £5–£15 a month.
- **The annual plans give two months free,** which improves cash flow and cuts card fees per pound.
- **Team at £480/year** is small enough for a card payment or a single quote at most councils, and cheaper than the staff time it saves on one data return. The public-library discount matches the design.

## Break-even

These are net of UK card fees, estimated at 1.5% + 20p, and assume no VAT is charged; see the VAT section.

| Plan                  | Gross      | Approximate net |
| --------------------- | ---------- | --------------- |
| Supporter, annual     | £30        | £29.35          |
| Pro founding, annual  | £50        | £49.05          |
| Pro founding, monthly | £5 a month | £4.72 a month   |
| Team                  | £480       | £472            |

Covering £2,400 a year could look like this: **2 Teams (about £944) + 20 annual Pro (about £981) + 20 annual Supporters (about £587), roughly £2,510.** That's a realistic first-year target. Grants stay the development budget.

## VAT and consumer rules (confirm with an accountant)

- **UK VAT registration is compulsory only above £90k of taxable turnover.** Below it, you charge no VAT, and the prices above are the prices.
- If you register, whether you have to or choose to, show Pro and Supporter **including VAT** (D-P2), and keep Team ex VAT.
- **Selling digital services to consumers in the EU normally means accounting for EU VAT from the first sale** for a UK seller, through the non-Union OSS scheme. Before any non-UK consumer checkout opens, either use Stripe Tax or limit consumer checkout to the UK at launch.
- **Consumers have a 14-day right to cancel online purchases.** Honour it with a no-questions refund, and say so on the page.
- Your legal structure (a CIC, a charity or a sole trader) changes grant eligibility and VAT treatment, so settle it before taking payments.

## Implementation notes

- **The pricing page (`/pro`) reads its amounts from one config module.** It exists now, marked as placeholders. P-D swaps it for Stripe Price IDs, so no feature code ever hard-codes an amount.
- **Supporter needs a new plan key in P-D.** It has the same features and limits as Free, plus `supporterMark`. Until checkout exists, the page shows "Join — coming soon" for Supporter and Pro.
- **Until P-D, Pro comes only from grants, earned Archivist status and verification.** There's no payment path.
