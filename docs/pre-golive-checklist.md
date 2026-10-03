# Pre-Golive Checklist

Tasks that must be completed before launching libraries.global to the public. Ordered roughly by dependency.

---

## 1. Geography — Populate Countries & Regions

### 1a. European countries

Run the Strapi script that creates all sovereign European countries in the `Country` content type:

```bash
STRAPI_API_TOKEN=$(grep 'STRAPI_API_TOKEN=' apps/strapi/.env | cut -d'=' -f2) \
  apps/strapi/node_modules/.bin/tsx apps/strapi/scripts/populate-european-countries.ts
```

Creates ~40 European country records (draft status) linked to the Europe continent.

### 1b. Map boundary files

Generate the per-country GeoJSON boundary files (admin-1 regions) from GADM 4.1. These are committed to the repo under `apps/ui/public/boundaries/countries/` so this only needs re-running when coverage expands.

```bash
node apps/ui/scripts/download-boundaries.mjs
```

Currently covers all European countries (41 files, ~960 region features). To expand to other continents, add entries to `EU_GADM_COUNTRIES` in that script.

**Commit the generated files** — they are served statically at `/boundaries/countries/{slug}.geojson`.

### 1c. Wire up boundaryUrl + create Region records

After boundary files are generated and countries are in Strapi, run the populate script. This:

- Sets `Country.boundaryUrl` for every European country
- Creates a `Region` record in Strapi for each feature in the GeoJSON (with matching `slug` and `boundaryUrl`)

```bash
# Dry run first — no writes
STRAPI_API_TOKEN=$(grep 'STRAPI_API_TOKEN=' apps/strapi/.env | cut -d'=' -f2) \
  apps/strapi/node_modules/.bin/tsx apps/strapi/scripts/populate-eu-boundaries.ts --dry-run

# Full run
STRAPI_API_TOKEN=$(grep 'STRAPI_API_TOKEN=' apps/strapi/.env | cut -d'=' -f2) \
  apps/strapi/node_modules/.bin/tsx apps/strapi/scripts/populate-eu-boundaries.ts
```

Script is idempotent — safe to re-run. Regions already in Strapi are found and updated, not duplicated.

**Notes:**

- `uk.geojson` is intentionally skipped — the devolved nations (Scotland, Wales, Northern Ireland) are modelled as separate country records and each has its own boundary file.
- Slug collision warnings (e.g. Moldova/Romania both have a "Calarasi") are non-fatal; the region is still created correctly.

### 1d. UK — London boroughs

London boroughs require a separate script (they come from a different data source):

```bash
node apps/ui/scripts/download-london-boroughs.mjs
```

### 1e. World countries

- [ ] Run `populate-world-countries.ts` with an `ingest-*` token, then reindex Meilisearch.

```bash
STRAPI_URL=<strapi url> STRAPI_API_TOKEN=<ingest-* token> \
  apps/strapi/node_modules/.bin/tsx apps/strapi/scripts/populate-world-countries.ts --dry-run
# review the plan, then run again without --dry-run
node apps/strapi/scripts/seed-meilisearch.mjs
```

`STRAPI_URL` defaults to `http://127.0.0.1:1337`; set it to the target Strapi or the script writes to local dev. Publishes every country in `apps/ui/public/boundaries/seed-data.json` (229 of its 247 Natural Earth features; the 18 with no ISO 3166-1 alpha-2 code, such as Bir Tawil, are skipped and listed) so the country picker is never empty. Existing countries are matched by `iso2`, then `slug`, and only their empty `iso2`, `mapConfig`, `boundaryUrl`, `sourceAttribution` and `continent` are filled. The seed's Americas list is split into `north-america` and `south-america` (created if missing; there is no `americas` continent). Draft-only countries and regions are published too.

### Expansion to other continents

Repeat steps 1b–1c for each new continent. The `download-boundaries.mjs` script and `populate-eu-boundaries.ts` are designed to be extended:

- Add country entries to `EU_GADM_COUNTRIES` in the boundary script
- Re-run both scripts

---

## 2. Content — Libraries

### 2a. LibraryOn bulk ingest (UK public libraries)

```bash
# Dry run
STRAPI_API_TOKEN=$(grep 'STRAPI_API_TOKEN=' apps/strapi/.env | cut -d'=' -f2) \
  apps/strapi/node_modules/.bin/tsx apps/strapi/scripts/libraryon-ingest.ts --dry-run

# Full ingest (~3,800 records), resumable
STRAPI_API_TOKEN=$(grep 'STRAPI_API_TOKEN=' apps/strapi/.env | cut -d'=' -f2) \
  apps/strapi/node_modules/.bin/tsx apps/strapi/scripts/libraryon-ingest.ts --resume
```

Inspect `ingest-log.json` after the dry run for mapping errors before committing to the full ingest.

### 2b. Publish library records

After ingest, bulk-review drafts in the Strapi admin and publish approved records. Unpublished libraries do not appear on the site.

---

## 3. Search Index

### 3a. Meilisearch — populate index

- [ ] Reindex after the countries import (1e), the library ingest (2a) and the first deploy of the community moderation work, which made the indexes hold every locale.

```bash
node apps/strapi/scripts/seed-meilisearch.mjs
```

The script fills the `library`, `wiki-article` and `blog-article` indexes with every locale's version (`locale: "*"`, with `locale` filterable) and applies the same settings as `apps/strapi/config/plugins.ts`. Publishing in Strapi keeps them current from then on. Search filters by the route locale when it is in `LIVE_LOCALES` (`apps/ui/src/lib/live-locales.ts`), else English, so an index without a `locale` on every document returns nothing.

### 3b. Verify search settings

Confirm searchable attributes, filters, and sortable fields match `apps/ui/src/lib/meilisearch.ts`.

---

## 4. Authentication & Roles

- Confirm Better Auth is configured for production domain (callback URLs, OAuth app credentials)
- Verify Strapi Roles & Permissions for the `Public` role match `docs/strapi-role-permissions.md`
- Test OAuth flows (GitHub, Google) end-to-end in staging
- [ ] Add the Role Grants production needs in the Content Manager (Role Grant): the editorial board and any Moderators, with `grantedBy` and `reason`. Moderators work at `/contribute/moderation` and need no Strapi admin account.
- [ ] If any admin role besides Super Admin exists, make Library Change and Article Change read only for it, and keep Role Grant, Entitlement Grant and Pro Verification Super Admin only (`docs/strapi-role-permissions.md`, "Admin panel RBAC").

### 4a. Boot backfills (automatic)

The first Strapi boot of the community moderation release runs these one-offs. Each is guarded by a core-store flag, so it runs once, and a failure is logged without blocking boot. Nothing to run by hand; check the boot log.

- `migrateContributorRolesToGrants` (`src/utils/role-grants.ts`): a global Role Grant for every profile whose `contributorRole` is above `reader`. Logs `[role-grants] Backfilled grants for N profiles`.
- `backfillSubmissionLocales` (`content-moderation/server/utils/locales.ts`): a `contentLocale` on Submissions from before they carried one.
- `migrateReviewerPrefix` (`content-moderation/server/utils/reviewer.ts`): prefixes bare reviewer ids with `admin:`.
- `backfillLibraryHistory` (`content-moderation/server/services/history.ts`): one Change Batch (field names only) for every approved `library_edit` and record `correction` from before Change Records. Claims, facility answers, photos and free-text corrections aren't backfilled.

A failure appears as `[role-grants] Contributor role migration failed` or `[content-moderation] … failed`. Fix the cause and restart: a backfill whose flag wasn't set runs again.

### 4b. Build the Strapi plugins before deploying

- [ ] The `content-moderation`, `rewards` and `events` plugins ship built bundles. `pnpm --filter @repo/strapi build` runs `build:plugins` first, and so does `postinstall`; if the deploy skips both, run `pnpm --filter @repo/strapi build:plugins` before `strapi build`, or the admin queue and the server's routes won't match the source.

---

## 5. Environment

- `NEXT_PUBLIC_APP_URL` set to production domain (used in `metadataBase` and sitemap)
- `STRAPI_BRIDGE_SECRET` rotated for production, and the same value in both apps (Strapi checks it on every bridge call and uses it to clear the site's session cache after a Role Grant changes)
- Strapi `APP_PUBLIC_URL` set to the production site: moderation email links and the session cache call (`/api/internal/session/invalidate`) use it
- Strapi `MAILGUN_API_KEY` and `MAILGUN_DOMAIN` set, or moderation emails (decisions, new Role Applications and Location Requests) are logged and skipped. `MODERATORS_EMAIL` (default `moderators@libraries.global`) is a monitored mailbox.
- `CHANGE_RECORDS_ENABLED` unset or `true`: `false` stops the audit trail and is for emergencies only
- `NEXT_PUBLIC_MEILISEARCH_*` pointing to production Meilisearch instance
- Strapi `APP_KEYS`, `JWT_SECRET`, `ADMIN_JWT_SECRET`, `API_TOKEN_SALT` all rotated
- `MAILGUN_SMTP_USER` / `MAILGUN_SMTP_PASS` set (and `MAILGUN_SMTP_HOST=smtp.eu.mailgun.org` for an EU-region domain). Production refuses to send sign-in links without them.
- `CRON_SECRET` set in Vercel so the daily `/api/cron/retention` job (see `apps/ui/vercel.json`) can run. The privacy notice promises expired sessions and 30-day-old rate-limit rows are deleted.
- The `legal@libraries.global` mailbox exists and is monitored (the legal pages, complaints and data-protection requests all point to it).

---

## 6. Final checks

- [ ] Sitemap generates correctly at `/sitemap.xml`
- [ ] `robots.txt` is correct for production
- [ ] Auth pages (`/auth/*`), settings, and onboarding are `noindex`
- [ ] Library detail pages render without errors for a sample of published records
- [ ] Map renders and loads boundaries for at least one European country
- [ ] Search returns results for common queries

---

## 7. Licensing and registrations

Notes from the 2026-09-27 legal review. The legal pages themselves live in Strapi (`legal-document`: terms, privacy, cookies, data-licence, ai-statement, accessibility). They promise the behaviour below, so change the copy if any of this changes.

Open licences aren't granted or registered: you apply one by publishing a clear statement, and anyone reusing the data accepts its conditions. The work is making sure every input allows what we publish, and crediting each one the way it asks.

### 7a. Code licence

- [ ] **Starter notice (MIT).** The repo began from Notum Technologies' MIT starter (`notum-cz/strapi-next-monorepo-starter`, "Copyright (c) 2025 Notum Technologies"); the first commit brought in about 500 files. MIT's one condition is that the copyright and permission notice stay with copies or substantial portions. `LICENSE` now names only Alexander Bennett, which doesn't meet it. The fix that doesn't mention Notum anywhere visible is a `THIRD-PARTY-NOTICES.md` in the repo root containing their copyright line and the MIT text. Undecided; the user chooses.
- [ ] **MIT or AGPL-3.0 for `apps/*`** (decision D-O1 in the access spec). AGPL makes anyone running a modified public copy publish their changes. You can relicense your own code at any time, but copies already published under MIT stay MIT, and starter-derived code keeps its MIT notice.
- [ ] Before accepting outside contributions, add a CLA or DCO if the code might be relicensed later, for example when a charity takes it over.

### 7b. Library data (CC BY-SA 4.0)

- [x] Licence stated on `/legal/data-licence`. The terms license contributions under CC BY-SA 4.0 and grant a wider licence so the index can be relicensed or moved to a charity.
- [ ] **Get libraryOn's licence confirmed in writing.** The site footer says "Except where otherwise noted, content on this site is licensed under a Creative Commons Attribution 4.0 International license", but it doesn't mention the CMS API we imported from. Email the British Library data team. CC BY 4.0 data can be republished under CC BY-SA, provided the credit is kept.
- [x] Show the libraryOn credit ("Contains information from LibraryOn, published by the British Library under CC BY 4.0") on records with `source: "libraryon"`. Done 2026-09-28: the credit comes from the `dataset` registry (`apps/strapi/src/seeds/datasets.ts`) and renders in "Sources & history of this record".
- [ ] When the libraryOn licence is confirmed, set the `libraryon` dataset's `licenceStatus` to `confirmed_in_writing` in the admin and note the date and correspondent in its `notes`.
- [ ] When bulk downloads ship, include a licence file and an attribution file.
- [ ] Never import OpenStreetMap-derived library records: ODbL data can't be republished as CC BY-SA.
- [ ] Decide D-P6 for good (keep CC BY-SA 4.0, or move to ODbL or CC BY). CC BY-SA 4.0 covers database rights and is compatible with our current sources.

### 7c. Maps and boundaries

- [ ] **Replace the GADM boundaries** (`apps/ui/public/boundaries/countries/*`, 41 files from `scripts/download-boundaries.mjs`). GADM's licence reads: "Redistribution or commercial use is not allowed without prior permission". We serve these files publicly, and Pro would be commercial. The candidate replacement is geoBoundaries ADM1 (CC BY 4.0; credit "geoBoundaries" with a link, and check each country's own licence field). Replacing means regenerating the files and re-matching Region slugs in Strapi. The alternative is written permission from GADM.
- [x] OpenStreetMap/CARTO credit shown on every MapLibre map (`BASEMAP_ATTRIBUTION` in `components/map/map.helpers.ts`; the location and library hero maps use the Voyager style's own credit). Mapbox is no longer used.
- [ ] **CARTO basemap limits.** Free for non-commercial use up to 5M requests a month. Once Pro launches it's commercial: free up to 1M a month, then $500 a month (up to 10M). Before Pro, either self-host tiles (OpenFreeMap or Protomaps) or budget for the paid plan.
- [ ] Revoke the old `NEXT_PUBLIC_MAPBOX_TOKEN` in the Mapbox dashboard and remove it from Vercel; nothing reads it now.

### 7d. Registrations

- [ ] **ICO data protection fee.** Likely required, since there's no sole-trader exemption and the site has user accounts. It's tier 1, around £52 a year; check with https://ico.org.uk/fee-checker. Once registered, the number can go in the privacy notice.
- [ ] Optional: register "Libraries Global" as a UK trademark with the UKIPO (about £170 for one class online).
- [ ] Optional, for later: EU GDPR Article 27 says a non-EU controller serving EU users may need an EU representative. Most small UK sites don't appoint one.

### 7f. First-publication review of the legal documents

The six legal documents and the independence statement in Strapi are pre-launch drafts, versioned 0.x with a "Pre-launch draft" notice rendered by `LegalDocumentPage` whenever the newest revision is 0.x. They have never been presented to or accepted by a user. Immediately before launch, in one pass:

- [ ] Review each document's text a final time (terms, privacy, cookies, data-licence, ai-statement, accessibility, independence).
- [ ] Verify the operator identity in Terms §2, the independence statement and the privacy notice (still Alexander Bennett, or the charity if it exists by then).
- [ ] Verify the software licence: `LICENSE`, every `package.json` `license` field, Terms §14, Data licence §5 and the independence statement all say MIT (or whatever D-O1 decided), and the starter notice question in 7a is settled.
- [ ] Verify the data licences and attribution: every `dataset` row has a licence, a licence URL and attribution text; the libraryOn licence is confirmed in writing (7b); GADM is replaced or licensed (7c); the credits render on imported records.
- [ ] Verify the privacy and contact details: legal@libraries.global exists and is monitored; the ICO registration number is in the privacy notice if registered (7d); the providers list in 7e matches production.
- [ ] Check that every legal and footer link resolves on the production host, including `/legal/independence` and the code of conduct link to the repository.
- [ ] Confirm no wording implies affiliation with, endorsement by, or succession to the British Library or LibraryOn, beyond the data credit that CC BY 4.0 requires.
- [ ] Add a `1.0` revision to each document with the actual publication date and the summary "First published version", so the draft notice disappears and "Version" reads v1.0. Keep the 0.x entries: they're the honest history of the drafts.
- [ ] Set `TERMS_VERSION` in `apps/ui/src/lib/legal-consent.ts` to the publication date, then publish all documents together and re-run the legal Playwright checks.

Don't perform this pass early: the drafts must stay marked as drafts until the service opens.

### 7e. Providers named in the privacy notice

- [ ] Production matches the notice: Vercel (website), Strapi Cloud (database and uploads), Mailgun (email), Meilisearch (search host still undecided; name it once chosen), Sentry (remove it from the privacy notice and cookie policy if `SENTRY_DSN` isn't set).
- [ ] Accept each provider's data processing agreement (usually a click-through in their dashboard).

### 7f. Before charging for Pro

- [ ] Publish Pro terms before anyone is charged: prices including VAT, 14-day cancellation rights under the Consumer Contracts Regulations, and the subscription rules in the Digital Markets, Competition and Consumers Act 2024.
- [ ] Watch the VAT registration threshold (£90,000 turnover).
- [ ] Add Stripe to the privacy notice as a processor (it keeps invoices for tax purposes).
