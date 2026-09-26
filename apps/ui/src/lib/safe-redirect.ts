/**
 * Returns `value` only if it is a same-origin relative path, otherwise
 * `fallback`. Use for every user-controlled redirect target (`callbackUrl`,
 * `next`, …) before it reaches `location.href`, `redirect()` or an auth
 * provider callback, to prevent open redirects.
 *
 * Rejects absolute URLs, protocol-relative URLs (`//evil.com`), backslash
 * tricks (`/\evil.com`, which browsers normalise to `//`), and control chars.
 */
export function safeRedirectPath(
  value: string | null | undefined,
  fallback = "/"
): string {
  if (!value || typeof value !== "string") return fallback
  if (!value.startsWith("/")) return fallback
  if (value.startsWith("//") || value.startsWith("/\\")) return fallback
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001F\u007F\\]/.test(value)) return fallback

  try {
    const base = "http://internal.invalid"
    const url = new URL(value, base)
    if (url.origin !== base) return fallback

    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return fallback
  }
}
