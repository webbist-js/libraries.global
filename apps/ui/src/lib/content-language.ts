import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from "@repo/shared-data"

import type { CompositionPreferences } from "@/lib/composition-language"
import { supportedContentLanguage } from "@/lib/content-locales"

const proficiencyRank = { native: 0, fluent: 1, conversational: 2 }

/** A chosen profile language wins; the header language supplies the guest default. */
export function preferredContentLanguage(
  interfaceLocale: string,
  preferences?: CompositionPreferences | null,
  available: readonly string[] = SUPPORTED_LOCALES
): string {
  const languages = [...(preferences?.languages ?? [])].sort(
    (a, b) => proficiencyRank[a.proficiency] - proficiencyRank[b.proficiency]
  )
  for (const entry of languages) {
    const code = supportedContentLanguage(entry.code)
    if (code && available.includes(code)) return code
  }

  const header = supportedContentLanguage(interfaceLocale)

  return (
    (header && available.includes(header) ? header : null) ??
    available.find((code) => code === DEFAULT_LOCALE) ??
    available[0] ??
    DEFAULT_LOCALE
  )
}
