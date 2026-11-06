# API accounts

The paid API gives software versioned access to published public library information. It is the only paid product besides sponsorship. Prices, allowances and flags are in [PRICING.md](PRICING.md); this page covers the account model, requests, accounting and the developer workspace. The module still lives under `src/lib/team-api/` while it is renamed in a compatibility-safe sequence.

## Accounts and roles

- An API account belongs to an organisation, which is the existing Team record and is now a free workspace container. An individual buyer gets a single-member organisation, created at API checkout.
- Any verified-email account can create an organisation free of charge. Covering a library still needs verified owner authority on that library.
- Organisers own billing, keys and overage settings. Members can view usage. Separate billing-manager and key-manager roles are deferred.
- An organisation has one active API subscription at a time.
- A staff workspace does not include API access, and an API account never grants staff verification, library editing, moderation or access to protected data. Keys never become user sessions.

Organisers manage everything from `/developers` (overview, keys, usage, reference and playground). The former `/staff/teams/api` URL redirects there.

## Requests

The machine-readable description is the static `public/openapi.json`; `/llms.txt` is generated from the published Knowledge catalogue. Update both, and the introduction in `src/lib/agent-discovery.ts`, alongside changes to versioned routes, projections, limits or live content locales. Routes behind a disabled flag stay out of the OpenAPI paths until they are callable.

Send `Authorization: Bearer YOUR_API_KEY`. Machine routes authenticate keys directly and do not need browser beta or Basic Auth cookies. The CMS, Meilisearch and the native analysis service stay private behind the bridge.

| Scope | Routes | Flag |
| --- | --- | --- |
| `search:read` | `POST /api/v1/search/libraries` | — |
| `libraries:read` | `GET /api/v1/libraries`, `GET /api/v1/libraries/{entityRef}`, `GET /api/v1/places/...` | — |
| `services:read` | `GET /api/v1/services`, `/services/{ref}`, `/services/{ref}/libraries` | `API_SERVICE_READS_ENABLED` |
| `submissions:write` | `POST /api/v1/submissions/libraries`, `POST /api/v1/submissions/corrections`, `GET /api/v1/submissions/{id}` | `API_SUBMISSIONS_ENABLED` |
| `analysis:run` | `POST /api/v1/analysis/summary`, `POST /api/v1/analysis/reach`, `GET /api/v1/analysis/jobs/{id}` and `/result` | `API_ANALYSIS_ENABLED` (network mode also `API_NETWORK_REACH_ENABLED`) |

New keys default to the read scopes; `analysis:run` and `submissions:write` need explicit confirmation.

```sh
curl -X POST https://libraries.global/api/v1/search/libraries \
  -H "Authorization: Bearer $LIBRARIES_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"q":"Bristol","locale":"en","limit":20}'

curl 'https://libraries.global/api/v1/libraries?locale=en&limit=50' \
  -H "Authorization: Bearer $LIBRARIES_API_KEY"
```

Search, list, detail and place routes keep their existing cursor, filter, projection and attribution contracts, now with at most 50 records a page. Follow `meta.nextCursor` as `after` and treat it as opaque. Encode `entityRef` as one path segment. Only live content locales are accepted. Source records carry each Dataset's licence, redistribution and attribution metadata.

Service routes return published services and networks with a stable public ref, their kind and member libraries from the CMS, never caller-supplied memberships. Service membership is not staff authority.

Submissions are untrusted proposals. They enter the Content Moderation queue through a dedicated private route that whitelists fields and records the submitting API account, source licence, idempotency key and review history. They never publish directly, cannot assert staff identity and earn no points for the key. Protected fields and arbitrary CMS paths are rejected.

Analysis jobs use the existing CMS and native admission checks, canonical service membership and country dataset coverage. Inputs are bounded: no arbitrary polygons, coordinate arrays, client-selected memberships, upstream URLs or unbounded batches. Results stay below 128 KiB. API jobs never call the browser's session-only Atlas routes.

Errors use `{ "error": { "code": "..." } }`. 401 is an invalid, revoked or expired key; 403 a missing scope or no settled coverage; 429 a refusal with a stable code (`quota_requests`, `quota_bytes`, `quota_analysis`, `overage_cap`, `rate_limit`, `concurrency_limit`) and `Retry-After` where meaningful; 502/503 an upstream, response-size or accounting failure. Successful responses include `X-Request-Id` and remaining-allowance and reset headers.

## Accounting

The gateway checks paid coverage, key scope, request shape, per-minute and concurrency budgets, request/byte/credit allowance and the spend cap before dispatch.

- PostgreSQL transactions reserve one request, the maximum response bytes and the operation's credits under one account/period lock. Actual successful bytes and completed credits are settled, and unused reservations are released. Failed accounting never delivers an unmetered payload.
- Async jobs reserve credits at acceptance, settle once on a completed result and refund on failure, cancellation or expiry. A stable job ID across retries prevents two charged jobs. A result fetch spends requests and bytes, never a second credit.
- Every settled request and completed job writes an immutable usage event. Meter delivery to Stripe is idempotent on the ledger event ID, with bounded retries, a dead-letter state and reconciliation by account, period and dimension. A period is reconciled only when Stripe's invoiced quantities match the ledger.
- With overage off, or when the worst-case reservation would cross the cap, the request or job is refused. Lowering the cap or switching overage off stops further paid usage without erasing accrued charges. Changes are versioned and audited.
- Warnings go out at 50%, 80% and 100% of each allowance and of the cap.
- Abandoned reservations are recovered by the existing billing maintenance worker.

Usage records hold the account and key reference, endpoint category, time, outcome, response bytes and credits. Detailed records are kept for 90 days; period totals and key audit events for longer. No query text, request body, IP address or raw credential is retained in usage records or product analytics.

## Keys

Keys contain 256 bits of randomness. Only a SHA-256 digest and display prefix are stored. Full keys appear once, after creation or regeneration, and are never logged, kept in the session or sent to Stripe. Regeneration replaces the digest under the same key id and invalidates the old value immediately. Key count is unlimited, with the existing key-mutation rate limiter, and every key shares the account's allowances. Revocation stays available after coverage lapses.

## Billing

Checkout, settlement, renewal, payment failure, cancellation, refund and dispute holds use the existing signed webhook and billing worker. Checkout completion or subscription status alone grants nothing: settled invoice lines bound to the correct Price and customer open paid access, and replays cannot clear a reversal hold. A past-due grace period never authorises unbilled overage. Cancellation keeps settled access to the paid end unless a full refund or dispute removes it. Account deletion cancels billing first and is refused while the user is the only organiser others rely on.

1. Run `pnpm --filter @repo/ui billing:migrate` to install the API billing, usage-event and overage tables.
2. Prepare the sandbox catalogue (the £100 monthly Price, metered overage Prices and the API portal) and set `STRIPE_PRICE_API_MONTHLY`, `STRIPE_PORTAL_CONFIGURATION_API` and the overage meter bindings in the private runtime environment.
3. Stage the API purchase terms and Knowledge guides with `apps/strapi/scripts/update-sponsored-access-content.mjs`, then publish them after legal review and release acceptance.
4. Enable `API_ENABLED` (and `API_OVERAGE_ENABLED` or the feature flags as each slice passes acceptance) only in the intended environment, with the billing timer running.

`pnpm --filter @repo/ui billing:db:test` runs concurrency and settlement tests in generated local schemas and refuses remote databases. A source or fixture test is not evidence of a settled Stripe payment.

## Playground

The playground at `/developers/playground` requires settled coverage and an existing key, kept only in page memory. Requests call the production `/api/v1` routes with the normal authentication, scopes, limits, reservations and accounting; there is no private unmetered path. Successful requests and bytes count, analysis jobs spend credits, and errors do not consume allowances. The page says so before the form and beside the Run button, and nothing runs on page load. The usage reminder and its `api-playground-usage` prompt preference work as before.
