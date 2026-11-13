import type { routing } from "@/lib/routing"

type Locale = (typeof routing.locales)[number]

// Each locale's catalogue, merged from its feature files under `locales/`.
const catalogues = {
  en: () => import("../../locales/en"),
  cs: () => import("../../locales/cs"),
  es: () => import("../../locales/es"),
  fr: () => import("../../locales/fr"),
  ja: () => import("../../locales/ja"),
} satisfies Record<Locale, () => Promise<unknown>>

/** The whole catalogue for a locale. Server only: never send it as is. */
export async function loadCatalogue(locale: Locale) {
  return (await catalogues[locale]()).default
}
