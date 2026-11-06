# Team seat billing (retired)

Paid Team seats were removed in the November 2026 beta reset. Staff workspaces are free: an organisation keeps its name, members, organisers and covered libraries, with no seats, seat limits, annual subscription or payment gate. Staff tools come from verified staff claims on named libraries (`canStaff`), never from workspace membership or payment.

- The access model and prices are in [PRICING.md](PRICING.md) and the decisions in [sponsored-access-decisions.md](../docs/docs/proposals/sponsored-access-decisions.md).
- The paid product for organisations is an [API account](TEAM-API.md), which is billed separately and grants no staff authority.
- Seat checkout, the seat Stripe catalogue, `TEAM_BILLING_ENABLED` and the related worker handlers are deleted. Local sandbox rows from the old flow are disposable.
- The Knowledge guide for workspaces is staged by `apps/strapi/scripts/update-sponsored-access-content.mjs`; the old `update-team-pricing.mjs` helper is retired.
