# CMS content operations

Routine editorial and content changes target production unless the user specifies otherwise. Feature development, schema changes, test fixtures and import experiments target local explicitly. Publishing CMS text does not deploy application code.

## Environment selection and credentials

Use the operator-approved connection and a token scoped to the requested content actions. Local and production permissions are independent; a successful local request does not prove production access. Connection addresses, tunnel commands, credential arrangements and transport status belong in the private operator runbook.

Content helpers use private environment inputs such as `STRAPI_MCP_TOKEN`, `STRAPI_PRODUCTION_MCP_TOKEN` and `STRAPI_PRODUCTION_URL`. Never print values, put tokens in browser URLs or commit environment files. Do not enable a disabled transport, restart the CMS or expand permissions merely to complete a content update. Never silently fall back to local when production is unavailable.

## Updating pricing content

From the repository root:

```sh
# Production preview; no writes.
node apps/strapi/scripts/update-team-pricing.mjs

# Publish the reviewed production changes and verify them by reading back.
node apps/strapi/scripts/update-team-pricing.mjs --apply

# Correct just the existing Team API guide, preserving unrelated copy.
node apps/strapi/scripts/update-team-pricing.mjs --api-guide-only --apply

# Explicit local feature-development copy.
node apps/strapi/scripts/update-team-pricing.mjs --local --apply
```

The script checks for unpublished edits, preserves unrelated content and creates private backups and previews under `.scratch/pricing-rollout/`. It updates existing Knowledge guides in English, French and Czech, membership pricing/API terms, and the English Team API guide. It does not change permissions, enable purchases or restart services.

The production API guide states that purchases are not enabled yet. Update that availability copy after the complete API release and owned checkout acceptance. Existing published articles keep their section, links, author, media and other metadata.

The older `update-billing-docs.mjs` script remains a local feature migration. It now preserves the current Team pricing section; use an explicit reviewed production update for editorial work.
