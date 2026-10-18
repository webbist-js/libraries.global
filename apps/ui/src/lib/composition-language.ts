import { COUNTRIES } from "@/lib/data/countries"
import type { LanguageEntry } from "@/lib/types/profile"

/** Owner-only hints for new content, never a browsing filter or access grant. */
export type CompositionPreferences = {
  country?: string | null
  languages?: readonly LanguageEntry[]
}

/** Ignore malformed optional profile hints without invalidating the session. */
export function compositionPreferencesFrom(input: {
  country?: unknown
  languages?: unknown
}): CompositionPreferences {
  return {
    country:
      typeof input.country === "string" && input.country.length <= 100
        ? input.country
        : null,
    languages: Array.isArray(input.languages)
      ? input.languages
          .slice(0, 50)
          .flatMap((entry) =>
            entry &&
            typeof entry.code === "string" &&
            entry.code.length <= 35 &&
            ["native", "fluent", "conversational"].includes(entry.proficiency)
              ? [{ code: entry.code, proficiency: entry.proficiency }]
              : []
          )
      : [],
  }
}

function languageTag(value: string | null | undefined): Intl.Locale | null {
  if (!value) return null
  try {
    const locale = new Intl.Locale(value.replaceAll("_", "-"))

    return locale.language === "und" ? null : locale
  } catch {
    return null
  }
}

const proficiencyRank = { native: 0, fluent: 1, conversational: 2 }

/**
 * Explicit draft/selection > listed profile language > country hint > fallback.
 * Country is optional ISO-2 in profile settings; old names/slugs also work.
 * CLDR likely subtags provide a hint, not a claim that a country is monolingual.
 * Every result is restricted to the form's configured languages when supplied.
 */
export function compositionLanguage({
  selected,
  preferences,
  available = [],
  fallback = "en",
  defaultLanguage,
}: {
  selected?: string | null
  preferences?: CompositionPreferences | null
  available?: readonly string[]
  fallback?: string
  defaultLanguage?: string
}): string {
  const country = preferences?.country?.trim().toLowerCase()
  const region = COUNTRIES.find(
    (item) =>
      item.code.toLowerCase() === country ||
      item.name.toLowerCase() === country ||
      item.slug === country
  )?.code
  const configured = available.flatMap((code) => {
    const tag = languageTag(code)

    return tag ? [{ code, tag }] : []
  })
  const match = (candidate?: string | null): string | undefined => {
    const tag = languageTag(candidate)
    if (!tag) return
    if (!configured.length) return tag.baseName
    const exact = configured.find((item) => item.tag.baseName === tag.baseName)
    if (exact) return exact.code
    // Honour scripts (e.g. Traditional Chinese) rather than substituting one.
    const sameLanguage = configured.filter(
      (item) =>
        item.tag.language === tag.language &&
        (!tag.script || item.tag.script === tag.script)
    )

    return (
      sameLanguage.find((item) => item.tag.region === region)?.code ??
      sameLanguage.find((item) => !item.tag.region)?.code ??
      sameLanguage[0]?.code
    )
  }
  const explicit = match(selected)
  if (explicit) return explicit
  const listed = [...(preferences?.languages ?? [])].sort(
    (a, b) => proficiencyRank[a.proficiency] - proficiencyRank[b.proficiency]
  )
  for (const entry of listed) {
    const code = match(entry.code)
    if (code) return code
  }
  if (region) {
    const code = match(new Intl.Locale("und", { region }).maximize().language)
    if (code) return code
  }

  return (
    match(fallback) ?? match(defaultLanguage) ?? configured[0]?.code ?? "en"
  )
}
