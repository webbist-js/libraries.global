export const MOBILE_SESSION_COOKIE = "libraries-shared.session_token"

export function mobileAuthConfig(
  value: string | undefined,
  siteUrl: string | undefined
) {
  if (!value) return null
  const site = new URL(siteUrl!)
  const mobile = new URL(value)
  const local = site.hostname.endsWith(".localhost")
  if (
    mobile.hostname !== `mobile.${site.hostname}` ||
    mobile.protocol !== site.protocol ||
    (!local && site.protocol !== "https:") ||
    [site, mobile].some(
      (url) =>
        url.pathname !== "/" ||
        url.search ||
        url.hash ||
        url.username ||
        url.password
    )
  )
    throw new Error(
      "MOBILE_APP_URL must be the mobile subdomain of APP_PUBLIC_URL"
    )

  return {
    site,
    mobile,
    cookieDomain: site.hostname,
    secure: site.protocol === "https:",
  }
}
