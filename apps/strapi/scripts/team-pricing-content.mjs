/**
 * Retired 6 November 2026. The Team seat, personal Supporter/Pro and £-priced
 * Team API copy this module generated was withdrawn by the sponsored-access
 * model (apps/docs/docs/proposals/sponsored-access-decisions.md). Plans,
 * pricing and API guides are now staged by update-sponsored-access-content.mjs.
 *
 * Only the shared CMS helper remains, because other editorial helpers use it.
 */

/** Remove Strapi component/row ids so CMS reads can be compared and resent. */
export function stripComponentIds(value) {
  if (Array.isArray(value)) return value.map(stripComponentIds)
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => key !== "id")
        .map(([key, child]) => [key, stripComponentIds(child)])
    )

  return value
}
