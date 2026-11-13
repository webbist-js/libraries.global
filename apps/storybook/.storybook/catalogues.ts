import type { AbstractIntlMessages } from "next-intl"

import type { FixtureLocale } from "./fixture-locale"

/**
 * UI catalogues, loaded on first use.
 *
 * Every story file renders in a fresh frame that evaluates the preview again,
 * so a static import of every locale parsed all of them for each file. Story
 * tests render one locale; loading only that one keeps each frame small.
 */
const loaders: Record<
  FixtureLocale,
  () => Promise<{ default: AbstractIntlMessages }>
> = {
  en: () => import("../../ui/locales/en"),
  cs: () => import("../../ui/locales/cs"),
  es: () => import("../../ui/locales/es"),
  fr: () => import("../../ui/locales/fr"),
  ja: () => import("../../ui/locales/ja"),
}

const loaded = new Map<FixtureLocale, AbstractIntlMessages>()

export function isFixtureLocale(value: unknown): value is FixtureLocale {
  return typeof value === "string" && Object.hasOwn(loaders, value)
}

export async function loadCatalogue(locale: FixtureLocale) {
  const cached = loaded.get(locale)
  if (cached) return cached
  const messages = (await loaders[locale]()).default
  loaded.set(locale, messages)

  return messages
}

/** A catalogue a story loader has already loaded. */
export function loadedCatalogue(locale: FixtureLocale) {
  const messages = loaded.get(locale)
  if (!messages) throw new Error(`The ${locale} catalogue is not loaded yet.`)

  return messages
}
