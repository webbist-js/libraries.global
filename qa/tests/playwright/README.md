# Browser acceptance

Use local, disposable fixtures. Do not use production accounts, real provider credentials or customer records. Keep authenticated traces, videos, storage state and fixture passwords out of Git and CI artifacts. Admin screenshots must contain only synthetic fixture data. Admin QA refuses remote CMS origins and requires an `@example.test` account.

## Automated checks

Run checks sequentially with bounded Node memory and `--workers=1`. Reuse the existing local UI/CMS and Docker PostgreSQL database for routine development. Projects needing disposable infrastructure run only in an approved isolated CI/acceptance environment. The smoke project starts a frontend, so do not run it alongside another local Next.js server.

| Suite             | Command                                                                                                                               | Coverage                                                                                                                                                                                                 |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Public smoke      | `pnpm --filter @repo/tests-playwright exec playwright test --project=smoke`                                                           | Built, hydrated public shells, skip-link focus, French/Czech routes and Events server search. Runs in CI after the UI build.                                                                             |
| Accessibility     | `pnpm tests:playwright:axe`                                                                                                           | The public template inventory in `helpers/urls.json`; keep this aligned with visual checks.                                                                                                              |
| Visual            | `pnpm tests:playwright:visual`                                                                                                        | Hydrated pages with images and JavaScript enabled; stable fonts and disabled animations.                                                                                                                 |
| Application roles | `pnpm --filter @repo/tests-playwright seed:access`, then `pnpm --filter @repo/tests-playwright exec playwright test --project=access` | Public/member/paid/staff/organiser/moderator authority and account transitions using the local fixture services. Read `helpers/seed-access-fixtures.ts` before seeding.                                  |
| CMS plugins       | `pnpm --filter @repo/tests-playwright exec playwright test --project=admin`                                                           | Configured custom CMS plugins in light/dark at 390px and 1440px, axe and screenshots; Access direct load/reload. Set `QA_STRAPI_URL`, `QA_ADMIN_EMAIL` and `QA_ADMIN_PASSWORD` in the local environment. |

Snapshots are **never accepted automatically**. A missing baseline is a failure. To create or deliberately update them, run the appropriate project with `--update-snapshots`, inspect every generated image, then rerun the comparison without updates. Synthetic fixtures must be deterministic; arbitrary production content is not a visual baseline.

The smoke project starts the built frontend on port 3101, disables the beta gate for that local fixture process and points CMS reads at an unavailable local port so fallback/error shells are exercised. It does not change a running application's environment. Run the richer content checks below against the normal local CMS as well.

## Atlas dashboard gate

`e2e/dashboard-shell.spec.ts` exercises the hydrated frontend with deterministic,
public synthetic read responses. Reuse the existing local frontend and run
`NODE_OPTIONS=--max-old-space-size=4096 pnpm --filter @repo/tests-playwright exec playwright test e2e/dashboard-shell.spec.ts --project=chromium --workers=1 --retries=0`.
Run Firefox and WebKit sequentially with their project names. Screenshots for
manual comparison are written to ignored `.scratch/dashboard-batch-a/`.
Bind the dev server to the hostname in the configured application origin
(`--hostname localhost` for a localhost origin); a mismatched host can produce
default-locale redirects before the Atlas page loads.

The cross-section test requires the existing local CMS/database fixture services
and is opt-in with `QA_DASHBOARD_LIVE_CONTENT=1`. Its pending status must be
reported separately; synthetic responses do not verify real account access,
entitlements or CMS integration. The baseline-only capture is deliberately
excluded from normal acceptance; `QA_DASHBOARD_BASELINE=1` is only for capturing
the previous Atlas shell before adoption. Review images rather than accepting
them as automatic snapshot updates.

## Location and profile dashboard gate

`e2e/dashboard-geography.spec.ts` extends the Atlas gate through continent,
country, region, library, Find and service/network routes. It checks the
persistent rail, directional motion and its unsupported/reduced-motion fallbacks,
workspace scroll history, compact section drawers, recovery states and fixed-panel
accessibility. The profile case uses the real account sections and form with
synthetic session/read/write responses; it does not write to a real account.

Run the combined gate against the existing local services:

```bash
NODE_OPTIONS=--max-old-space-size=4096 QA_DASHBOARD_LIVE_CONTENT=1 pnpm --filter @repo/tests-playwright exec playwright test e2e/dashboard-shell.spec.ts e2e/dashboard-geography.spec.ts --project=chromium --project=firefox --project=webkit --workers=1 --retries=0 --reporter=line
```

Motion assertions require native transition-type support. Firefox 146 exposes a
partial native API without transition types, so its hierarchy/history checks
exercise the functional fallback. Map-toolbar checks wait for the renderer;
headless WebGL fallback keeps exercising List and URL history. Screenshots hide
only GPU canvas pixels temporarily, leaving overlaid controls visible.

The geography cases read the local Europe/England/Greater London/Abbey Wood
Library records and the synthetic access-fixture library service. Their screenshots
are written to ignored `.scratch/dashboard-batch-b/`. These layout checks do not
replace real role/entitlement, billing-provider or production performance acceptance.

## Required release acceptance

A release record must contain the commit, commands, fixture inventory and results. An unexecuted fixture-dependent suite is pending, not a pass. Do not promote a release based solely on the public smoke suite.

- Public: homepage, library search/detail, country/region, Events listing/detail, Journal, Knowledge, community, legal and membership; one main landmark after navigation, keyboard skip link, meaningful loading/error/empty states.
- Account: signed out, free, Supporter, Pro, verified staff, Team organiser and moderator; direct URLs and reloads, hidden actions and denied server calls, sign-out/account-switch cache isolation. Keep staff verification separate from a complimentary Pro grant.
- Events: two geographies with distinct fixtures; search/filters and browser back/forward; more than 300 results; save/read/write failures; cancelled and pending records excluded. Verify a direct worker update reaches search after reconciliation.
- Editor: in-step autosave, delayed writes, offline failure/retry, latest edit preserved, leave/reload warning and final submission. Use a disposable draft and inspect the persisted result.
- CMS: all configured plugins in both themes at narrow/wide widths. Cover populated, empty, loading, error/retry and denied states. Check keyboard tabs, modal focus/Escape/dirty dismissal, library search/selection, pagination beyond the first page and permitted action visibility. Exercise a read-only fixture admin as well as a manager; server permission tests remain mandatory.
- Dangerous actions: use isolated synthetic credentials and disposable records. Confirm reward adjustment idempotency, review/version conflict handling and failure recovery without affecting real people or sending invitations.

Restore any temporary appearance preference after interactive verification. Record viewport limitations explicitly rather than treating an unchanged viewport as a mobile pass.

## Reproducing the reviewed baselines

The fixture seeder requires pre-provisioned disposable PostgreSQL (`lg_audit_<name>`) and Meilisearch services in an approved isolated CI/acceptance environment. Do not provision an extra stack, database or schema for routine local checks. Bootstrap the CMS schema and the Better Auth tables in that database; copying **schema only** for `user`, `account`, `session`, `verification` and `passkey` from another local database is sufficient. Do not copy account or customer rows. Point the CMS, frontend and Atlas worker at those disposable services, turn off cron/external integrations, and use a local mail sink with trusted TLS for authentication and team flows.

Set `ACCESS_STRAPI_ENV_PATH` to the absolute path of the fixture CMS environment, `QA_AUDIT_ISOLATED_SERVICES=1`, and generated passwords for `QA_ADMIN_EMAIL`/`QA_ADMIN_PASSWORD` and `QA_READONLY_EMAIL`/`QA_READONLY_PASSWORD`. Both emails must end in `@example.test`. Run `pnpm --filter @repo/tests-playwright seed:audit-content`. The seeder refuses production, remote database/search hosts and an ordinary database name. It creates synthetic US/Cornwall geography, libraries, articles, a drive, and manager/read-only CMS admins. Public article dates and homepage copy are fixed. Read-only API keys are written only to ignored `.scratch/audit-qa/fixture-keys.json`; load them into the local frontend and role-seed environment without printing them.

Run `seed:access` against the fixture frontend, then run the separate Atlas process with `atlas:backfill` against the same disposable database and search index. The role suite exercises the current scoped Atlas export API and needs the worker caught up. The iCalendar acceptance cases can use an ordinary public feed: they verify connection/approval controls and do not depend on event titles. They must run with a configured `EVENT_FEED_TEST_ICS_URL`; an unset URL is a skip, not a pass.

The test files and URL inventory define public baseline coverage in Chromium, Firefox and WebKit. They fix the browser clock, use reduced motion and mask GPU canvases only; globe behavior has separate interaction/motion tests. CMS baselines cover the configured plugins' empty states in both themes at 390/1440px. Their read payloads and upstream release badge are fixed fixtures; native login/RBAC, route denials and direct reload checks remain live. Authenticated runs disable traces, videos, automatic screenshots and failure DOM contexts because those can contain fixture credentials. Manager browser state stays in memory and is reused to respect native login rate limits.

Run public/admin screenshot comparison again **without** `--update-snapshots` after reviewing images. Set `QA_SMOKE_PORT` when the normal fixture frontend already occupies port 3101. Keep output directories distinct between sequential acceptance runs. The public `visual/` directory, including its test and reviewed PNGs, stays local and is ignored by Git. CMS baselines under `admin/` remain versioned. Local service configuration, keys, reports and customer data are not versioned.

## Dashboard search review

Against the already running local application:

```bash
BASE_URL=http://localhost:3000 pnpm --filter @repo/tests-playwright exec playwright test e2e/dashboard-search.spec.ts --project=chromium --workers=1
```

These two checks use the real search endpoint and its public response contract,
then exercise the toolbar, keyboard selection and recent-query clearing. They
start no servers and create no content. The local beta gate must already allow
access. Other dashboard acceptance remains separate from this focused check.
