import { createHash } from "node:crypto"

/** Convert any ISO 8601 string (with offset) to a UTC ISO string. */
export function toUtcIso(dateStr: string): string {
  return new Date(dateStr).toISOString()
}

/** Truncate a description to ≤ maxLen chars at a word boundary, appending ellipsis. */
export function truncateSummary(text: string, maxLen = 280): string {
  if (text.length <= maxLen) return text
  const slice = text.slice(0, maxLen)
  const lastSpace = slice.lastIndexOf(" ")
  const cut = lastSpace > maxLen / 2 ? lastSpace : maxLen

  return slice.slice(0, cut) + "…"
}

/** SHA-1 hash of the four change-detection inputs. Not used for security — change detection only. */
export function computeSyncHash(
  externalId: string,
  provider: string,
  startTimeUtc: string,
  title: string
): string {
  // eslint-disable-next-line sonarjs/hashing
  return createHash("sha1")
    .update(`${externalId}|${provider}|${startTimeUtc}|${title}`)
    .digest("hex")
}
