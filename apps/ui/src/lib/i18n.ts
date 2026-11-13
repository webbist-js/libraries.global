import { hasLocale } from "next-intl"
import { getRequestConfig } from "next-intl/server"

import { loadCatalogue } from "@/i18n/catalogues"

import { routing } from "./routing"

export default getRequestConfig(async ({ requestLocale }) => {
  // Typically corresponds to the `[locale]` segment
  const requested = await requestLocale
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale

  return {
    locale,
    // The server has every message; client components get scoped subsets
    // (see src/i18n/scoped-messages.tsx).
    messages: await loadCatalogue(locale),
    timeZone: "Europe/Prague",
  }
})
