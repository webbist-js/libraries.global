# Sponsored access: implementation decisions

Status: decisions recorded 6 November 2026, before coding, against [the pricing proposal](sponsored-access-pricing.md) and [the implementation spec](sponsored-access-implementation-spec.md). Where this page differs from the spec, this page wins. It does not authorise live billing, production publication or deployment.

## Beta reset instead of migration

The service is in closed beta with sandbox billing. The owner has approved amending existing accounts outright, with no grandfathering.

- No transition campaign, refund/credit migration, compatibility projection or `new_access_model` flag. Nothing is kept to roll back to.
- Personal Supporter/Pro purchases and Team seat billing are removed: routes, UI, Stripe catalogue entries, worker handlers, CMS projections and tests. `packages/access/src/billing.ts` and `team-billing.ts` are deleted.
- The `entitlement-grant` and `pro-verification` content types, `earnedProUntil` and the 5,000-point earned-Pro hold are removed. The points total remains for leaderboards and badges.
- The £15 Team API offer and its 100,000-request / 10 GiB limits are replaced by the £100 offer. Local sandbox rows are disposable. `billing:migrate` installs the new schema; it does not convert old rows.
- Pre-launch rule: no Strapi migration files or one-off backfills. Indexes go in the bootstrap `HOT_PATH_INDEXES` list. A recount script may rebuild recognition counters from point events.

## Access model

`resolveEntitlements` (`packages/access/src/entitlements.ts`) resolves independent facts instead of a ranked plan:

| Fact          | Source                                            | Adds                                                                                                                                                                              |
| ------------- | ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `explorer`    | Any signed-in account                             | Former Pro browse, comparison, context layers, alerts, notes, history and export features. 1,000 saved views/searches, 10,000 export rows per action, 20 exports per rolling day. |
| `contributor` | At least 1 accepted contribution                  | `atlas.reach`: 2 new one-library Reach calculations per rolling 7 days. No service or network Reach.                                                                              |
| `supporter`   | At least 100 accepted contributions               | Recognition only. No tools, quota or authority.                                                                                                                                   |
| `apiCustomer` | Organiser of an API account with settled coverage | `api.key`, `atlas.reach`, `atlas.serviceReach`: 20 new browser Reach calculations an hour, pooled 100 a day per API account, up to 50 eligible libraries, standard envelopes.     |

- Staff tools are **capabilities**, not entitlements. The workspace, embeds, bulk upload, team view and traffic come from verified staff claims through `canStaff(c, "embed" | "bulkUpload" | "traffic" | "seeTeam" | ...)` and `staff.area`. The type-level invariant that entitlements never carry trust fields is kept.
- Library-scoped tools apply to the libraries in the user's own staff claims. Organisation membership never unlocks them.
- Sessions carry `standing`, `facts`, `recentlyActive`, `acceptedContributions`, `features`, `limits`, `teams` (free workspaces) and `apiAccounts`. `plan`, `planSource` and `teamLibraryIds` are removed.

## Recognition counting

- The Rewards plugin keeps `acceptedContributions` and `lastContributionAt` on the user profile.
- Both are incremented in the same transaction as a qualifying, positive award (`isQualifyingContribution`), once per award idempotency key.
- Administrative adjustments, streaks and automatic bonuses never count.
- `recognitionRevokedAt` (admin-only) lets a moderator revoke recognition for fraud or duplication.
- A recount script rebuilds the counters from point events, using bounded keyset pages.

## API account

- An API account belongs to an organisation (the existing Team record, now a free workspace container).
- An individual buyer gets a single-member organisation, created at API checkout.
- Creating an organisation is free for any verified-email account. Covering a library still requires verified owner authority on that library.
- Roles: organisers own billing and keys; members view usage. Separate billing-manager and key-manager roles are deferred.
- One active API subscription per organisation.
- A workspace's existence or payment state never grants library editing.

## API offer

- **Price:** £100/month, tax-inclusive base GBP.
- **Included per billing period:** 10,000 successful requests, 262,144,000 response bytes and 100 analysis credits.
- **Rate and size limits:** 30 attempts a minute, 2 concurrent requests, 128 KiB maximum response, 50 records per page.
- **Period:** the settled Stripe subscription item period `[start, end)`, replacing the calendar month.
- **Overage** is opt-in, at 1p per request, 10p per MiB and 50p per analysis credit. The cap runs from £10 to £500 in £10 steps, preselected at £100 but never enabled without an affirmative action.
- **Ledger and Stripe:** the PostgreSQL ledger is the admission authority; Stripe meters are the invoice authority, with reconciliation.

## Flags

All flags are server environment variables and default to false. A flag never bypasses authorisation or accounting.

- `API_ENABLED`: new API checkout.
- `API_OVERAGE_ENABLED`: overage opt-in.
- `API_SERVICE_READS_ENABLED`
- `API_SUBMISSIONS_ENABLED`
- `API_ANALYSIS_ENABLED`
- `API_NETWORK_REACH_ENABLED`: network-mode Reach, additionally.

## Sponsorship

Sponsorship gets:

- A public information page.
- An enquiry form through the existing contact route.
- An admin-only `sponsor` collection: organisation, tier anchor, term, recognition consent, logo, acknowledgement text and a published flag. It drives the acknowledgement surface.

Sponsor records never feed entitlements, capabilities, ranking or moderation.

## Content

- Knowledge and legal copy is prepared as preview-by-default content scripts that stage drafts. Nothing is published by a code build.
- Legal revisions are new versions. Historical versions are not overwritten.
- Production Knowledge inventory and publication remain operator steps.
- Review copies of the legal drafts: [API purchase terms](legal-drafts/membership.md), [cancellation and refunds](legal-drafts/cancellation-refunds.md), [terms](legal-drafts/terms.md), [privacy](legal-drafts/privacy.md), [data licence](legal-drafts/data-licence.md).
