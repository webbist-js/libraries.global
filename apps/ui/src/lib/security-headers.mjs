// Plain ESM so next.config.mjs can import it at config-load time (Node runs the
// config without TypeScript) and vitest can test the same code.

/**
 * @typedef {{ key: string, value: string }} Header
 */

/**
 * The origin (`scheme://host[:port]`) of a URL, or undefined when it isn't one.
 * @param {string | undefined} value
 * @returns {string | undefined}
 */
function originOf(value) {
  if (!value) return
  try {
    return new URL(value).origin
  } catch {
    return
  }
}

/**
 * Response headers every page and route carries. Framing is limited to the
 * site itself plus the Strapi admin (its preview pane embeds the site), and
 * HSTS is production-only so `next dev` over http keeps working.
 *
 * @param {{ strapiAdminOrigin?: string, isProduction: boolean }} opts
 * @returns {Header[]}
 */
export function buildSecurityHeaders({ strapiAdminOrigin, isProduction }) {
  const frameAncestors = ["'self'"]
  const adminOrigin = originOf(strapiAdminOrigin)
  if (adminOrigin) frameAncestors.push(adminOrigin)

  /** @type {Header[]} */
  const headers = [
    {
      key: "Content-Security-Policy",
      value: `frame-ancestors ${frameAncestors.join(" ")}`,
    },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    {
      key: "Permissions-Policy",
      value: "camera=(), microphone=(), geolocation=(self)",
    },
  ]
  if (isProduction) {
    headers.push({
      key: "Strict-Transport-Security",
      value: "max-age=63072000; includeSubDomains",
    })
  }

  return headers
}

/**
 * `images.remotePatterns` for the Strapi hosts and any CDN hosts, in place of
 * the old `hostname: "*"`. Each entry is a URL or a comma-separated list of
 * bare hostnames (https assumed). Anything that isn't a valid host is skipped.
 *
 * @param {{ hosts: (string | undefined)[] }} opts
 * @returns {{ protocol: "http" | "https", hostname: string, port: string }[]}
 */
export function imageRemotePatterns({ hosts }) {
  /** @type {Map<string, { protocol: "http" | "https", hostname: string, port: string }>} */
  const patterns = new Map()
  for (const entry of hosts) {
    if (!entry) continue
    for (const raw of entry.split(",")) {
      const value = raw.trim()
      if (!value) continue
      const url = parseHost(value)
      if (!url) continue
      const pattern = {
        protocol: /** @type {"http" | "https"} */ (url.protocol.slice(0, -1)),
        hostname: url.hostname,
        port: url.port,
      }
      patterns.set(`${pattern.protocol}://${url.host}`, pattern)
    }
  }

  return [...patterns.values()]
}

/**
 * @param {string} value
 * @returns {URL | undefined}
 */
function parseHost(value) {
  const candidate = /^https?:\/\//.test(value) ? value : `https://${value}`
  try {
    const url = new URL(candidate)
    // A bare word with a space or no dot-ish host isn't a hostname.
    if (!url.hostname || /\s/.test(value)) return
    if (url.protocol !== "http:" && url.protocol !== "https:") return

    return url
  } catch {
    return
  }
}
