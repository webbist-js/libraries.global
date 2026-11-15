import { createTranslator, createFormatter } from "next-intl"

import { loadCatalogue } from "../catalogues"
import { getFixtureLocale, type FixtureLocale } from "../fixture-locale"

export async function getLocale() {
  return getFixtureLocale()
}
export async function getMessages({
  locale = getFixtureLocale(),
}: { locale?: FixtureLocale } = {}) {
  return loadCatalogue(locale)
}
export async function getTranslations(
  options?: string | { locale?: FixtureLocale; namespace?: string }
) {
  const namespace = typeof options === "string" ? options : options?.namespace
  const locale =
    typeof options === "string"
      ? getFixtureLocale()
      : (options?.locale ?? getFixtureLocale())

  return createTranslator({
    locale,
    messages: await loadCatalogue(locale),
    namespace,
  })
}
export async function getFormatter() {
  return createFormatter({
    locale: getFixtureLocale(),
    timeZone: "Europe/London",
    now: new Date("2026-01-15T12:00:00Z"),
  })
}
export async function getTimeZone() {
  return "Europe/London"
}
export async function getNow() {
  return new Date("2026-01-15T12:00:00Z")
}
export function setRequestLocale() {}
