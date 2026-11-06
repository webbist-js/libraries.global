/**
 * Retired 6 November 2026. It was a local migration for personal Supporter/Pro membership terms and billing guides. Those offers were withdrawn; running it would restore retired copy.
 * See apps/docs/docs/proposals/sponsored-access-decisions.md and
 * apps/strapi/CONTENT-OPERATIONS.md.
 */
console.error(
  "update-billing-docs.mjs is retired: it wrote the withdrawn personal membership terms. Use node apps/strapi/scripts/update-sponsored-access-content.mjs, which previews by default and stages drafts only."
)
process.exit(1)
