import { isSupportedLocale } from "@repo/shared-data"

/** Explicit content languages remain selectable when other filters leave them with no results. */
export function articleLanguageOptions(
  available: readonly string[],
  selected: readonly string[]
): string[] {
  return [...new Set([...available, ...selected])].filter(isSupportedLocale)
}
