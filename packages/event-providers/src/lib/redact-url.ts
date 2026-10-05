/**
 * Provider errors can carry the URL that failed, and a feed URL from a
 * credential may hold an API key in its query string or basic-auth
 * userinfo. Anything written to `last_error_message` or a run's
 * `failed_credentials` (both shown in the admin) goes through here first.
 */

/** `origin + pathname` only: no userinfo, query or fragment. */
export function redactUrl(raw: string): string {
  try {
    const url = new URL(raw)
    if (url.protocol !== "http:" && url.protocol !== "https:") return "[url]"

    return `${url.origin}${url.pathname}`
  } catch {
    return "[url]"
  }
}

// A URL runs to the next whitespace; closing punctuation that commonly
// follows a URL in prose (`.`, `,`, `)`, `]`, `;`, `:`) is left in place.
const URL_IN_TEXT = /https?:\/\/[^\s<>"']+/gi
const TRAILING_PUNCT = /[),.;:\]!?]+$/

export function redactUrlsInText<T extends string | null | undefined>(
  text: T
): T {
  if (typeof text !== "string") return text

  return text.replaceAll(URL_IN_TEXT, (match) => {
    const trailing = TRAILING_PUNCT.exec(match)?.[0] ?? ""
    const core = trailing ? match.slice(0, -trailing.length) : match

    return `${redactUrl(core)}${trailing}`
  }) as T
}
