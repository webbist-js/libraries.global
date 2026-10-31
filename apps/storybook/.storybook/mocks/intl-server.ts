import {
  createTranslator,
  createFormatter,
  type AbstractIntlMessages,
} from "next-intl"

import { getFixtureLocale } from "../fixture-locale"

import cs from "../../../ui/locales/cs.json"
import en from "../../../ui/locales/en.json"
import fr from "../../../ui/locales/fr.json"

const messages = { en, cs, fr }

export async function getLocale() {
  return getFixtureLocale()
}
export async function getMessages({
  locale = getFixtureLocale(),
}: { locale?: keyof typeof messages } = {}) {
  return messages[locale]
}
export async function getTranslations(
  options?: string | { locale?: keyof typeof messages; namespace?: string }
) {
  const namespace = typeof options === "string" ? options : options?.namespace
  const locale =
    typeof options === "string"
      ? getFixtureLocale()
      : (options?.locale ?? getFixtureLocale())

  return createTranslator({
    locale,
    messages: messages[locale] as AbstractIntlMessages,
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
