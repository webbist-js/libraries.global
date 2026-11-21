import { describe, expect, it } from "vitest"

import {
  dictionaryLocales,
  requestedLocales,
  resolveTargetLocales,
  skippedLocalesMessage,
  TRANSLATION_LOCALES,
} from "../scripts/translation-locales"

const DICTIONARY = "i18n/site-translations.json"

describe("CMS translation locales", () => {
  it("targets every supported locale except English", () => {
    expect(TRANSLATION_LOCALES).toEqual(["cs", "es", "fr", "ja"])
  })

  it("reads repeated and comma-separated --locale arguments", () => {
    expect(requestedLocales(["--apply"])).toEqual([])
    expect(requestedLocales(["--locale", "fr", "--locale=cs,fr"])).toEqual([
      "fr",
      "cs",
    ])
    expect(() => requestedLocales(["--locale"])).toThrow(/needs a locale/)
    expect(() => requestedLocales(["--locale", "--apply"])).toThrow(
      /needs a locale/
    )
    expect(() => requestedLocales(["--locale="])).toThrow(/needs a locale/)
  })

  it("collects the locales a dictionary covers", () => {
    expect(
      dictionaryLocales(
        { Home: { cs: "Domů", fr: "Accueil" } },
        { About: { fr: "À propos" } }
      )
    ).toEqual(new Set(["cs", "fr"]))
  })

  it("skips locales without a dictionary when none were requested", () => {
    const result = resolveTargetLocales([], new Set(["cs", "fr"]), DICTIONARY)
    expect(result).toEqual({ locales: ["cs", "fr"], skipped: ["es", "ja"] })
    expect(skippedLocalesMessage(result.skipped, DICTIONARY)).toMatch(
      /^Skipping es, ja: no translations in i18n\/site-translations\.json/
    )
    expect(skippedLocalesMessage([], DICTIONARY)).toBeUndefined()
  })

  it("refuses a requested locale without a dictionary", () => {
    expect(() =>
      resolveTargetLocales(
        ["--locale", "ja"],
        new Set(["cs", "fr"]),
        DICTIONARY
      )
    ).toThrow(/No ja translations in i18n\/site-translations\.json/)
    expect(
      resolveTargetLocales(["--locale=fr"], new Set(["cs", "fr"]), DICTIONARY)
    ).toEqual({ locales: ["fr"], skipped: [] })
  })

  it("refuses English and unsupported locales", () => {
    for (const locale of ["en", "de", "jp"])
      expect(() =>
        resolveTargetLocales(["--locale", locale], new Set(["cs"]), DICTIONARY)
      ).toThrow(/Not a translation target/)
  })

  it("stops when no target locale has a dictionary", () => {
    expect(() => resolveTargetLocales([], new Set(), DICTIONARY)).toThrow(
      /no translations for any target locale/
    )
  })
})
