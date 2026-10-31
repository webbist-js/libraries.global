/** Canonical destinations after separating public pricing from account management. */
export function membershipLink(href: string): string {
  // Only our public site and root-relative links. Never rewrite another host,
  // protocol-relative URLs, checkout callbacks or a similarly named sub-route.
  const match =
    /^(https?:\/\/(?:www\.)?libraries\.global)?(\/(?:en|fr|cs))?(\/[^?#]*)(\?[^#]*)?(#.*)?$/.exec(
      href
    )
  if (!match) return href
  const [, origin = "", locale = "", path, query = "", hash = ""] = match
  // /contribute/membership is now the dashboard's live account view.
  if (path === "/pro" || path === "/pro/")
    return `${origin}${locale}/plans${query}${hash}`
  if (path === "/membership" || path === "/membership/")
    return `${origin}${locale}/profile/membership${query}${hash}`
  if (path === "/profile/settings" && hash === "#membership")
    return `${origin}${locale}/profile/membership${query}`
  if (path === "/profile/settings" && hash === "#supporter-settings")
    return `${origin}${locale}/profile/membership${query}#recognition`

  return href
}
