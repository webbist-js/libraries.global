/**
 * Target locales for the local CMS translation scripts. English is the source;
 * every other supported locale is a candidate, and a locale is only written
 * when its reviewed dictionary entries exist. Missing translations are never
 * filled with English copy.
 */
import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  isSupportedLocale,
} from "@repo/shared-data"

export type Dictionary = Record<string, Record<string, string>>

/** Every supported locale except the English source. */
export const TRANSLATION_LOCALES: readonly string[] = SUPPORTED_LOCALES.filter(
  (locale) => locale !== DEFAULT_LOCALE
)

/** Codes from `--locale fr`, `--locale=fr`, repeats or `--locale cs,fr`. */
export function requestedLocales(argv: readonly string[]): string[] {
  const values: string[] = []
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index]!
    if (arg === "--locale") {
      const value = argv[index + 1]
      if (!value || value.startsWith("-"))
        throw new Error("--locale needs a locale code, for example --locale fr")
      values.push(value)
      index++
    } else if (arg.startsWith("--locale=")) {
      values.push(arg.slice("--locale=".length))
    }
  }
  const locales = values
    .flatMap((value) => value.split(","))
    .map((value) => value.trim())
  if (locales.some((locale) => !locale))
    throw new Error("--locale needs a locale code, for example --locale fr")

  return [...new Set(locales)]
}

/** Locales that have at least one entry in the given dictionaries. */
export function dictionaryLocales(
  ...dictionaries: readonly Dictionary[]
): Set<string> {
  const locales = new Set<string>()
  for (const dictionary of dictionaries)
    for (const translations of Object.values(dictionary))
      for (const locale of Object.keys(translations ?? {})) locales.add(locale)

  return locales
}

export interface TargetLocales {
  locales: string[]
  skipped: string[]
}

/**
 * Requested locales must be supported targets with dictionary entries, or the
 * run stops. Without `--locale`, every target is considered and locales with
 * no dictionary are reported as skipped.
 */
export function resolveTargetLocales(
  argv: readonly string[],
  covered: ReadonlySet<string>,
  dictionaryName: string
): TargetLocales {
  const requested = requestedLocales(argv)
  const invalid = requested.filter(
    (locale) => !isSupportedLocale(locale) || locale === DEFAULT_LOCALE
  )
  if (invalid.length)
    throw new Error(
      `Not a translation target: ${invalid.join(", ")}. Choose from ${TRANSLATION_LOCALES.join(", ")}.`
    )
  const candidates = requested.length ? requested : [...TRANSLATION_LOCALES]
  const skipped = candidates.filter((locale) => !covered.has(locale))
  if (requested.length && skipped.length)
    throw new Error(
      `No ${skipped.join(", ")} translations in ${dictionaryName}. Add reviewed dictionary entries first; English copy is never written as a translation.`
    )
  const locales = candidates.filter((locale) => covered.has(locale))
  if (!locales.length)
    throw new Error(
      `${dictionaryName} has no translations for any target locale`
    )

  return { locales, skipped }
}

export function skippedLocalesMessage(
  skipped: readonly string[],
  dictionaryName: string
): string | undefined {
  if (!skipped.length) return undefined

  return `Skipping ${skipped.join(", ")}: no translations in ${dictionaryName}. These locales keep their current CMS content (English fallback when absent).`
}
