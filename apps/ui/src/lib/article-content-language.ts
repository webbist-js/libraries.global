import { isSupportedLocale } from "@repo/shared-data"

/** An explicit article language never silently falls back to another variant. */
export function articleContentLanguage(
  params: Record<string, string | string[] | undefined>
): string | null {
  const value = Array.isArray(params.contentLang)
    ? params.contentLang[0]
    : params.contentLang

  return isSupportedLocale(value) ? value : null
}

export function contentLanguageSuffix(language: string | null): string {
  return isSupportedLocale(language)
    ? `?contentLang=${encodeURIComponent(language)}`
    : ""
}

/** Shared reader actions keep the displayed variant when interface and content differ. */
export function articleReaderPath(
  path: string,
  interfaceLocale: string,
  contentLocale?: string | null
): string {
  const language = articleContentLanguage({
    contentLang: contentLocale ?? undefined,
  })

  return (
    path +
    contentLanguageSuffix(
      language && language !== interfaceLocale ? language : null
    )
  )
}
