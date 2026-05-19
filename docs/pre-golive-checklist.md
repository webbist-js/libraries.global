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

---

## 6. Final checks

- [ ] Sitemap generates correctly at `/sitemap.xml`
- [ ] `robots.txt` is correct for production
- [ ] Auth pages (`/auth/*`), settings, and onboarding are `noindex`
- [ ] Library detail pages render without errors for a sample of published records
- [ ] Map renders and loads boundaries for at least one European country
- [ ] Search returns results for common queries
