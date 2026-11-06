/**
 * Retired 6 November 2026. The self-service Team seat, annual billing and
 * Organiser handover copy this module generated was withdrawn by the
 * sponsored-access model; staff workspaces are free. The verified-staff guide
 * is now staged by update-sponsored-access-content.mjs.
 *
 * Only the link canonicaliser remains: it contains no plan copy.
 */

/** Upgrade relative workspace links, preserving locale and checkout continuation. */
export function canonicalTeamContent(value, field = "") {
  if (Array.isArray(value))
    return value.map((child) => canonicalTeamContent(child, field))
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [
        key,
        canonicalTeamContent(child, key),
      ])
    )
  if (typeof value !== "string") return value
  if (
    field === "url" &&
    /^\/(?:[a-z]{2}\/)?staff\/teams?(?:[/?#]|$)/.test(value)
  ) {
    const url = new URL(value, "https://knowledge.invalid")
    url.pathname = url.pathname.replace(/\/staff\/team(?=\/|$)/, "/staff/teams")
    url.searchParams.delete("team")

    return `${url.pathname}${url.search}${url.hash}`
  }

  return field === "text"
    ? value.replaceAll(
        /(?<!\/api)\/staff\/team(?=[/\s.,;:]|$)/g,
        "/staff/teams"
      )
    : value
}
