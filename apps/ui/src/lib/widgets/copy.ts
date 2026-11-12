import { isSupportedLocale } from "@repo/shared-data"
import { createTranslator } from "next-intl"

import csCatalogue from "../../../locales/cs/widget-public.json"
import enCatalogue from "../../../locales/en/widget-public.json"
import esCatalogue from "../../../locales/es/widget-public.json"
import frCatalogue from "../../../locales/fr/widget-public.json"
import jaCatalogue from "../../../locales/ja/widget-public.json"

// Embeds use their configured content language without the site's providers.
// Each locale's widget-public file holds only this namespace, so the embed
// bundle never pulls in the site catalogues.
const en = enCatalogue.widgetPublic
const translators = {
  en: createTranslator({ locale: "en", messages: en }),
  cs: createTranslator({ locale: "cs", messages: csCatalogue.widgetPublic }),
  es: createTranslator({ locale: "es", messages: esCatalogue.widgetPublic }),
  fr: createTranslator({ locale: "fr", messages: frCatalogue.widgetPublic }),
  ja: createTranslator({ locale: "ja", messages: jaCatalogue.widgetPublic }),
}
const keys = new Map(
  Object.entries(en).map(([key, value]) => [value, key as keyof typeof en])
)

/** Preserve CMS values while translating known public-widget interface copy. */
export function widgetCopy(locale: string, text: string) {
  const key = keys.get(text)
  if (!key) return text

  return translators[isSupportedLocale(locale) ? locale : "en"](key)
}

export function hasWidgetTranslation(locale: string, text: string) {
  return locale !== "en" && isSupportedLocale(locale) && keys.has(text)
}
