# CMS content operations

Routine editorial and content changes target production unless the user specifies otherwise. Feature development, schema changes, test fixtures and import experiments target local explicitly. Publishing CMS text does not deploy application code.

## Connections and credentials

| Target     | Connection                                             | Operator credential                                                                                                   |
| ---------- | ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| Local      | `http://127.0.0.1:1337/mcp`                            | `STRAPI_MCP_TOKEN` in private `apps/strapi/.env`                                                                      |
| Production | Private SSH tunnel, currently `http://127.0.0.1:18013` | Same current token value, with different server-side permissions; optional `STRAPI_PRODUCTION_MCP_TOKEN` overrides it |

These are two separate CMS environments. A successful local tool call does not prove production permissions. Discover MCP tools at the selected endpoint when MCP is enabled. Keep the existing SSH tunnel, scoped Admin Token and private listener; there is no public CMS hostname.

On 13 October 2026, both credentials were checked. Local MCP works. Production has `MCP_ENABLED=false`; its scoped Admin Token works with the existing `/content-manager` API. The pricing update used that API, including its authentication and content permissions. Automatic approval review rejected enabling production MCP and restarting the CMS, so that setting remains unchanged. The token is configured for production content work; enabling the MCP transport is a separate security-setting decision.

Use `STRAPI_PRODUCTION_URL` to override the production tunnel origin. Never fall back to local when production is unavailable. Tokens stay in private environment files, out of source, logs, browser URLs and release images.

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
