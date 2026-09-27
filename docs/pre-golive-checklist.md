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

Ensure the Meilisearch `library` index is populated. Libraries are indexed via the Strapi `afterCreate` / `afterUpdate` lifecycle hooks, but a full re-index may be needed after a bulk ingest:

- Trigger via Strapi admin → Content Manager → bulk publish (hooks fire on publish)
- Or run a manual re-index script if one exists

### 3b. Verify search settings

Confirm searchable attributes, filters, and sortable fields match `apps/ui/src/lib/meilisearch.ts`.

---

## 4. Authentication & Roles

- Confirm Better Auth is configured for production domain (callback URLs, OAuth app credentials)
- Verify Strapi Roles & Permissions for the `Public` role match `docs/strapi-role-permissions.md`
- Test OAuth flows (GitHub, Google) end-to-end in staging

---

## 5. Environment

- `NEXT_PUBLIC_APP_URL` set to production domain (used in `metadataBase` and sitemap)
- `STRAPI_BRIDGE_SECRET` rotated for production
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
- [ ] Show the libraryOn credit ("Contains information from LibraryOn, published by the British Library under CC BY 4.0") on records with `source: "libraryon"`.
- [ ] When bulk downloads ship, include a licence file and an attribution file.
- [ ] Never import OpenStreetMap-derived library records: ODbL data can't be republished as CC BY-SA.
- [ ] Decide D-P6 for good (keep CC BY-SA 4.0, or move to ODbL or CC BY). CC BY-SA 4.0 covers database rights and is compatible with our current sources.

### 7c. Maps and boundaries

- [ ] **Replace the GADM boundaries** (`apps/ui/public/boundaries/countries/*`, 41 files from `scripts/download-boundaries.mjs`). GADM's licence reads: "Redistribution or commercial use is not allowed without prior permission". We serve these files publicly, and Pro would be commercial. The candidate replacement is geoBoundaries ADM1 (CC BY 4.0; credit "geoBoundaries" with a link, and check each country's own licence field). Replacing means regenerating the files and re-matching Region slugs in Strapi. The alternative is written permission from GADM.
- [x] OpenStreetMap/CARTO credit shown on both MapLibre maps (`BASEMAP_ATTRIBUTION` in `components/map/map.helpers.ts`); Mapbox and OpenStreetMap credit under the static map.
- [ ] **CARTO basemap limits.** Free for non-commercial use up to 5M requests a month. Once Pro launches it's commercial: free up to 1M a month, then $500 a month (up to 10M). Before Pro, either self-host tiles (OpenFreeMap or Protomaps) or budget for the paid plan.
- [ ] Mapbox Static Images: stay within the free tier, and keep the token restricted to our domains.

### 7d. Registrations

- [ ] **ICO data protection fee.** Likely required, since there's no sole-trader exemption and the site has user accounts. It's tier 1, around £52 a year; check with https://ico.org.uk/fee-checker. Once registered, the number can go in the privacy notice.
- [ ] Optional: register "Libraries Global" as a UK trademark with the UKIPO (about £170 for one class online).
- [ ] Optional, for later: EU GDPR Article 27 says a non-EU controller serving EU users may need an EU representative. Most small UK sites don't appoint one.

### 7e. Providers named in the privacy notice

- [ ] Production matches the notice: Vercel (website), Strapi Cloud (database and uploads), Mailgun (email), Meilisearch (search host still undecided; name it once chosen), Sentry (remove it from the privacy notice and cookie policy if `SENTRY_DSN` isn't set).
- [ ] Accept each provider's data processing agreement (usually a click-through in their dashboard).

### 7f. Before charging for Pro

- [ ] Publish Pro terms before anyone is charged: prices including VAT, 14-day cancellation rights under the Consumer Contracts Regulations, and the subscription rules in the Digital Markets, Competition and Consumers Act 2024.
- [ ] Watch the VAT registration threshold (£90,000 turnover).
- [ ] Add Stripe to the privacy notice as a processor (it keeps invoices for tax purposes).
