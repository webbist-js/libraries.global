/**
 * Retired 6 November 2026. It published the Team API onboarding and reference guides for the withdrawn £15 add-on. Running it would restore retired limits and prices.
 * See apps/docs/docs/proposals/sponsored-access-decisions.md and
 * apps/strapi/CONTENT-OPERATIONS.md.
 */
console.error(
  "update-team-api-guides.mjs is retired: it published guides for the withdrawn Team API add-on. Use node apps/strapi/scripts/update-sponsored-access-content.mjs, which previews by default and stages drafts only."
)
process.exit(1)
