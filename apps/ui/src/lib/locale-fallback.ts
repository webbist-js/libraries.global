/**
 * Default-locale fallback for translated pages. When a Knowledge article,
 * Journal article, library, location or legal document has no version in the
 * requested locale, the fetchers in `strapi-api/content/server.ts` return
 * the default-locale version flagged `localeFallback`. Pages say so under
 * the title and keep the stand-in out of search engines (`buildMetadata` robots
 * "noindex-follow", i.e. `{ index: false, follow: true }`).
 */

/**
 * A language's name in the requested interface language. English can use
 * Strapi's configured name; other languages use `Intl.DisplayNames`.
 */
export function languageName(
  code: string,
  locales: readonly { code: string; name: string }[] = [],
  displayLocale = "en"
): string {
  const configured = locales.find((l) => l.code === code)?.name
  // "Czech (cs)" → "Czech"
  if (configured && displayLocale === "en")
    return configured.split(" (")[0]!.trim()
  try {
    return (
      new Intl.DisplayNames([displayLocale], { type: "language" }).of(code) ??
      code
    )
  } catch {
    return code
  }
}

/** The line shown under the title of a fallback render. */
export function notTranslatedText(code: string): string {
  return `Not yet translated into ${languageName(code)}.`
}
