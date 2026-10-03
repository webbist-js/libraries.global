/**
 * The bridge sends the user's display name as
 * `X-Ba-User-Name: encodeURIComponent(name)` (HTTP headers carry Latin-1
 * only). Decodes it; a value that isn't valid percent-encoding (an older
 * caller sending the raw name) is returned as it came.
 */
export function decodeHeaderName(raw: unknown): string | null {
  if (typeof raw !== "string") return null
  let decoded = raw
  try {
    decoded = decodeURIComponent(raw)
  } catch {
    decoded = raw
  }
  const trimmed = decoded.trim()

  return trimmed.length > 0 ? trimmed : null
}
