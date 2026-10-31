import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from "@repo/shared-data"
import { defineRouting } from "next-intl/routing"

/** Locale configuration must not import navigation or request configuration. */
export const routing = defineRouting({
  locales: SUPPORTED_LOCALES,
  defaultLocale: DEFAULT_LOCALE,
  localePrefix: "as-needed",
})
