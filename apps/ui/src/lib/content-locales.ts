import { DEFAULT_LOCALE, isSupportedLocale } from "@repo/shared-data"

export type ContentLocale = { code: string; name: string; isDefault: boolean }

/** Publication choices require both CMS configuration and translated app routes. */
export function supportedContentLocales(
  locales: readonly ContentLocale[]
): ContentLocale[] {
  const seen = new Set<string>()
  const supported = locales.filter((locale) => {
    if (
      !isSupportedLocale(locale?.code) ||
      typeof locale.name !== "string" ||
      !locale.name.trim() ||
      seen.has(locale.code)
    )
      return false
    seen.add(locale.code)

    return true
  })
  const defaultCode =
    supported.find((locale) => locale.isDefault === true)?.code ??
    supported.find((locale) => locale.code === DEFAULT_LOCALE)?.code ??
    supported[0]?.code

  return supported.map((locale) => ({
    ...locale,
    isDefault: locale.code === defaultCode,
  }))
}

/** Regional profile preferences can use the supported base language. */
export function supportedContentLanguage(value: string): string | null {
  try {
    const tag = new Intl.Locale(value.replaceAll("_", "-"))
    if (isSupportedLocale(tag.baseName)) return tag.baseName

    return !tag.script && isSupportedLocale(tag.language) ? tag.language : null
  } catch {
    return null
  }
}
