export type FixtureLocale = "en" | "cs" | "fr"
let locale: FixtureLocale = "en"

export function setFixtureLocale(value: FixtureLocale) {
  locale = value
}
export function getFixtureLocale(): FixtureLocale {
  return locale
}
