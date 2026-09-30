/**
 * iCalendar (RFC 5545) value escaping, shared by every ICS the app writes.
 * Nothing user-controlled may add a line: a value with CR/LF would otherwise
 * become a new property.
 */

// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g

/** Escape a TEXT value: backslash, semicolon, comma, and every line break. */
export function escapeIcs(value: string): string {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll(";", String.raw`\;`)
    .replaceAll(",", String.raw`\,`)
    .replaceAll(/\r\n|\r|\n/g, String.raw`\n`)
    .replaceAll(CONTROL_CHARS, "")
}

/**
 * A URI value (`URL:`), which RFC 5545 does not TEXT-escape: line breaks and
 * control characters are removed, and anything but http(s) is refused.
 */
export function escapeIcsUri(value: string): string | null {
  const cleaned = value.replaceAll(/[\r\n]/g, "").replaceAll(CONTROL_CHARS, "")
  try {
    const url = new URL(cleaned)
    if (url.protocol !== "http:" && url.protocol !== "https:") return null

    return cleaned
  } catch {
    return null
  }
}

/** An event documentId as the events plugin issues them. */
export const isEventDocumentId = (value: string): boolean =>
  /^[a-z0-9]{1,64}$/i.test(value)
