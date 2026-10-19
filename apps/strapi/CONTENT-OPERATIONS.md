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

The production API guides distinguish closed-beta Stripe Test mode from live purchases. Update availability copy only after the deployed checkout passes owned acceptance. Existing published articles keep their section, links, author, media and other metadata.

## Team API onboarding guides

The signup walkthrough and request reference live in the production Knowledge Data & API section, linked from the existing API, Team and plans articles.

```sh
# Preview the English onboarding/reference guides and related corrections.
node apps/strapi/scripts/update-team-api-guides.mjs

# Publish and verify content, relations and preserved editorial metadata.
node apps/strapi/scripts/update-team-api-guides.mjs --apply
```

Use `--local` explicitly for development. Private previews and backups stay under ignored `.scratch/team-api-guides/`. The helper refuses unpublished edits and concurrent changes. It does not provision Teams, create keys, contact testers, change billing flags or deploy code.

The current rollout includes a temporary new-subscription checkout notice. Remove that notice from `team-api-knowledge-content.mjs` only after the matching UI release passes an owned sandbox checkout, settled-payment activation and first-key acceptance. Keep Stripe Test mode and live availability separate. A source regression test or synthetic paid fixture does not prove provider checkout.

The older `update-billing-docs.mjs` script remains a local feature migration. It now preserves the current Team pricing section; use an explicit reviewed production update for editorial work.

## Discussion guide rollout

The community publishing release updates existing guides in English, French and Czech and adds one localized conversation guide. Detailed membership instructions belong in the plans and Team guides; other guides link to them. The pricing helper preserves that separation.

```sh
# Read production and save a private preview; no CMS writes.
node apps/strapi/scripts/update-discussions-guides.mjs

# Save reviewed private drafts, preserving current publications and metadata.
node apps/strapi/scripts/update-discussions-guides.mjs --stage

# Resume or verify the saved staging checkpoint after an interrupted operation.
node apps/strapi/scripts/update-discussions-guides.mjs --resume-stage

# After the matching feature release passes production acceptance, publish
# only the staged versions and verify each publication by reading it back.
node apps/strapi/scripts/update-discussions-guides.mjs --publish
```

Use `--local` explicitly for local development. Backups, previews and staging checkpoints stay under ignored `.scratch/discussions-guide-rollout/`. The script refuses unrelated drafts or content changed after staging. All three translations of the new guide share one document identity. Publication is separate from staging so the live guides do not advertise features before deployment.
