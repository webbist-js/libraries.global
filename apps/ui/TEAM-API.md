# Team API add-on

The add-on belongs to a Team, separately from personal memberships and Team Seats. Team Organisers buy and manage it at `/developers`; members can inspect usage. Payment never grants staff authority or access to personal or protected data.

Create a new Team through the [self-service annual Team flow](TEAM-BILLING.md) when enabled. Team Checkout activates seats after payment confirmation; it does not purchase the separate API add-on. Existing invoice Teams retain their agreed terms.

## Price and allowances

The proposed monthly price is £15, tax-inclusive in the base GBP catalogue. The actual displayed and charged price comes from the configured Stripe Price. The default offer includes 100,000 successful requests, 10 GiB of uncompressed response data, 60 attempts per minute shared across the Team, five concurrent requests and unlimited API keys. Each response is capped at 256 KiB and lists at 100 records. The 100,000 requests and 10 GiB are one monthly pool for the whole Team, across every key and application, rather than allowances per key, person or seat. Adding or regenerating keys never increases or resets the pool. There are no automatic overage charges.

At 100,000 requests per month, average API demand is about 0.039 requests/second. A sizing assumption of 50 ms of total CPU work per request would consume about 1.39 CPU-hours per month; this is not a measured benchmark. £15 is a starting commercial estimate. Monitor latency, database size, retained usage history and peak capacity before raising allowances. The operator's hosting costs and capacity records are private.

Limits are saved with the checkout attempt and subscription. Changing environment defaults affects new purchases, not existing paid allowances. The calendar-month allowance resets on the first day at 00:00 UTC, independently of the subscription's payment anniversary. A purchase partway through the month gets the full current allowance. Key creation and regeneration never reset usage.

## Requests

The machine-readable API description is the static `public/openapi.json`. `/llms.txt` is generated from the published Knowledge catalogue, linking every supported language variant to its full `.md` representation. Both discovery routes keep their root paths without locale rewrites and remain behind the existing beta and staging gates. Update the OpenAPI description and the introduction in `src/lib/agent-discovery.ts` alongside changes to the versioned routes, their public field projections, limits or live content locales. Proposed resources are excluded from the OpenAPI paths until they are callable.

Send `Authorization: Bearer YOUR_API_KEY`. Machine routes authenticate keys directly and do not require browser beta or Basic Auth cookies. Staff management routes still require a verified session, same-origin mutations and current Team membership. The CMS and Meilisearch remain private.

```sh
curl -X POST https://libraries.global/api/v1/search/libraries \
  -H "Authorization: Bearer $LIBRARIES_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"q":"Bristol","locale":"en","limit":20}'

curl 'https://libraries.global/api/v1/libraries?locale=en&limit=50' \
  -H "Authorization: Bearer $LIBRARIES_API_KEY"
```

Search accepts `q`, `locale`, `limit`, `offset`, `country`, `region`, `libraryType`, `operationalStatus` and `near: { lat, lng, radius }` (metres). The gateway queries only the public Library index and returns documented attributes. Raw Meilisearch filters, multi-search, settings and administrative operations are unavailable.

`GET /api/v1/libraries` accepts `locale`, `limit`, `after` and `country`. Follow `meta.nextCursor` by passing it as `after`; treat that cursor as opaque. `GET /api/v1/libraries/{entityRef}` returns one published record by its exact entity reference. Take `entityRef` from search or list results and encode it as a single URL path segment (`encodeURIComponent(entityRef)` in JavaScript). For example, `europe:united-kingdom:scotland:national-library-of-scotland` becomes `/api/v1/libraries/europe%3Aunited-kingdom%3Ascotland%3Anational-library-of-scotland`. The detail endpoint does not accept Strapi document IDs. Unknown references return 404. Only live content locales are accepted; English is currently live. Both routes use explicit published-field projections. Source records include the Dataset's licence, redistribution and attribution metadata; preserve these credits. The add-on supplies a managed integration service over public facts, which remain available through existing public site routes.

Successful responses, including cache hits, count towards the monthly allowance. Bytes are the UTF-8 JSON payload produced before compression, not the hosting provider's egress figure or proof that a client received every byte. Separate media and CDN downloads are excluded. Failed responses release their reservation but still affect request rate. Responses cannot be shared-cached across keys.

Errors use `{ "error": { "code": "..." } }`. A 401 means an invalid, revoked or expired key; 403 means insufficient scope or inactive Team/add-on; 429 means rate, concurrency or quota refusal. Successful responses include `X-Request-Id`, `X-API-Requests-Remaining` and `X-API-Quota-Reset`. A 502/503 indicates upstream, response-size or accounting failure; retry with backoff or reduce the requested page size.

## Keys and accounting

Keys contain 256 bits of randomness. Only a SHA-256 digest and display prefix are persisted. Full keys appear once after creation or regeneration and are never logged, stored in the session or sent to Stripe. Regeneration changes the digest under the same key id, invalidates the old value immediately and preserves usage history. Revocation remains available when a Team lapses so an organiser can contain a leaked key.

The application rechecks Team activity through a bridge-secret-only CMS route on every machine request. Paid access is checked from its own durable Team API subscription projection. Keys do not become user sessions. Team verification and staff permissions are independent of this add-on.

PostgreSQL transactions serialize reservations on the Team account. A request reserves one request and a bounded response-byte budget, checks the shared rate and concurrency limits, then reconciles actual bytes. Successful accounting commits before returning data. Failed accounting cannot deliver an unmetered payload. Reservations abandoned for more than two minutes are refunded by the existing billing maintenance job. Refused limits are recorded as errors; totals never go below zero or double-charge an accounting retry.

The staff dashboard shows live monthly counters, 30 UTC days of request/error/byte history, per-key and per-API totals, last use, expiry, payment status and 80% allowance warnings. In-flight reservations can temporarily increase the counters. Detailed request records are retained for 90 days, monthly totals and key audit events longer. No query text, body, IP address or raw credential is retained in usage records.

## Billing and operation

The Git-ignored local sandbox catalogue `scripts/team-api-sandbox-catalogue.json` contains the prepared £15 monthly Price and Portal ids. The product uses Stripe's supported SaaS business-use category `txcd_10103001`; review that classification for live activation against [Managed Payments eligibility](https://docs.stripe.com/payments/managed-payments/eligibility). Catalogue creation does not enable purchases or create payments.

Team API customers, attempts and subscription projections are separate from personal billing. A durable attempt and idempotency key precede provider calls. The existing signed webhook and billing worker handle Team subscriptions, renewals, payment failures, cancellation and current-period refund/dispute holds. Checkout completion or subscription status alone grants nothing: matched settled invoice lines must prove paid coverage. Replays cannot clear a reversal hold. Payment recovery continues when new purchases are disabled. A lapsed Team stops API requests but does not automatically cancel its separate API subscription; organisers can still open Manage API billing.

1. Run `pnpm --filter @repo/ui billing:migrate`. This transaction installs personal, Team API and Team seat billing tables in the auth/application PostgreSQL database. Deploy the matching CMS access-plugin routes and Next.js application together. Self-service annual Teams also require the private CMS Team schema additions described in [Team billing](TEAM-BILLING.md).
2. Confirm the product tax classification for this Team API service and set `TEAM_API_STRIPE_TAX_CODE` in the private runtime environment. `pnpm --filter @repo/ui team-api:check` is read-only. `team-api:setup` creates or reuses the product, proposed £15 monthly Price and a Portal configuration with cancellation/recovery controls. `TEAM_API_PRICE_PENCE` changes the proposed price for a new catalogue entry. Live writes additionally require `--live`; these commands never enable purchases or store credentials.
3. Set the returned `STRIPE_PRICE_TEAM_API_MONTHLY` and `STRIPE_PORTAL_CONFIGURATION_TEAM_API`, then enable `TEAM_API_ENABLED=true` with the existing matching-mode Stripe and Managed Payments configuration. The default limits are in `.env.local.example`. Do not substitute live credentials in sandbox databases.
4. Publish the updated membership terms from `apps/strapi/scripts/billing-content.mjs` before enabling purchases. The API consent version is `1.1`. No CMS content is published by a code build.
5. Keep the existing authenticated minute billing timer running. Confirm an actual owned sandbox checkout, settlement, cancellation and Portal recovery before live activation. A successful fixture test does not confirm a provider payment or its eligibility.

`pnpm --filter @repo/ui billing:db:test` runs personal, Team API and Team seat concurrency/settlement tests sequentially in generated local schemas and removes them afterward; it refuses remote databases. Unit and component coverage is under `src/lib/team-api`, `src/components/staff/__tests__/TeamApiDashboard.test.tsx` and `apps/strapi/tests/access/api-data.test.ts`.

## Public workspace and playground

The API workspace lives at `/developers`, with separate keys, usage, request
reference and playground pages. Teams and the main menu link to it. The former
`/staff/teams/api` URL redirects there and preserves checkout/setup continuation.
Docs do not require an account; private controls require a server-verified Team
membership. Existing beta and staging gates still apply.

The playground requires an active Team and API add-on. Users enter an existing
Team API key, kept only in page memory. Requests call the three `/api/v1` routes
directly and use their existing authentication, scopes, Team rate/concurrency
limits, quota reservations and accounting. Successful requests and response
bytes count toward the key’s Team allowance, including “Read this record” actions.
Errors do not consume monthly allowance. The page states this before the form
and beside the Run button. Requests are never run automatically on page load.

A usage reminder opens each time a Team member visits the playground. Closing
it only acknowledges that visit. “Don’t show this again” saves the private
`api-playground-usage` prompt preference to their profile. Active Team members
can re-enable it under Settings → Notifications → Prompts; other accounts do
not see that switch. The inline allowance notice remains visible either way.

All playground traffic uses the authenticated versioned API. There is no
alternate unmetered preview endpoint or geographic restriction. Search and list
results retain their “Read this record” actions. Access remains subject to the
normal paid entitlement and scoped-key checks.

## API credentials and planned resources

Key count is unlimited. Purchase snapshots created before this change may contain a numeric `limits.keys`; the server upgrades that field to `null` on read without changing stored payment evidence or usage limits. Key creation and regeneration retain the shared server-side mutation rate limiter. Key management lists 50 rows per page, returns the total active count separately and never truncates access to older keys. Usage, rate and concurrency limits are enforced per Team across keys and instances.

“Coming soon” in the dashboard describes proposals, not callable routes or included subscription features. The proposed GET resources are Library opening hours for a date/time zone, public Events filtered by place and date, a cursor-based feed of published Library changes/removals, and stable facility/service filter metadata with translations. See `src/lib/team-api/roadmap.ts`. Public data, bounded pagination and separate read scopes must be defined before any endpoint is enabled; no delivery date is promised.
