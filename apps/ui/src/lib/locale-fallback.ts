/**
 * Default-locale fallback for translated pages. When a Knowledge article,
 * Journal article or library has no version in the requested locale, the
 * fetchers in `strapi-api/content/server.ts` return the default-locale
 * version flagged `localeFallback`; pages then say so under the title and
 * keep the stand-in out of search engines (`buildMetadata` robots
 * "noindex-follow", i.e. `{ index: false, follow: true }`).
 */

/**
 * A locale's English name: from Strapi's configured locales when given,
 * else `Intl.DisplayNames`, else the code itself.
 */
export function languageName(
  code: string,
  locales: readonly { code: string; name: string }[] = []
): string {
  const configured = locales.find((l) => l.code === code)?.name
  // "Czech (cs)" → "Czech"
  if (configured) return configured.split(" (")[0]!.trim()
  try {
    return new Intl.DisplayNames(["en"], { type: "language" }).of(code) ?? code
  } catch {
    return code
  }
}

/** The line shown under the title of a fallback render. */
export function notTranslatedText(code: string): string {
  return `Not yet translated into ${languageName(code)}.`
}
