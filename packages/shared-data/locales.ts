/** Fully translated app routes; public content choices also require CMS enablement. */
export const SUPPORTED_LOCALES = [
  "cs",
  "en",
  "es",
  "fr",
  "ja",
  "zh-TW",
] as const
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number]
export const DEFAULT_LOCALE: SupportedLocale = "en"

export function isSupportedLocale(value: unknown): value is SupportedLocale {
  return (
    typeof value === "string" &&
    (SUPPORTED_LOCALES as readonly string[]).includes(value)
  )
}

/** Strapi's built-in Taiwan locale has an explicit script subtag. Public routes use zh-TW. */
export function cmsLocale(locale: string): string {
  return locale === "zh-TW" ? "zh-Hant-TW" : locale
}

export function routeLocale(locale: string): string {
  return locale === "zh-Hant-TW" ? "zh-TW" : locale
}
