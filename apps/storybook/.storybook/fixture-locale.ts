export type FixtureLocale = "en" | "cs" | "es" | "fr" | "ja"
let locale: FixtureLocale = "en"

export function setFixtureLocale(value: FixtureLocale) {
  locale = value
}
export function getFixtureLocale(): FixtureLocale {
  return locale
}
