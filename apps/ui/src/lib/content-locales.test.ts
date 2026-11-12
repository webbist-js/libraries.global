import { readFileSync } from "node:fs"

import { SUPPORTED_LOCALES } from "@repo/shared-data"
import { describe, expect, it } from "vitest"

import { articleLanguageOptions } from "./article-language-options"
import {
  supportedContentLanguage,
  supportedContentLocales,
} from "./content-locales"

describe("fully supported content languages", () => {
  it("intersects CMS configuration with app support and keeps a valid default", () => {
    expect(
      supportedContentLocales([
        { code: "de", name: "German", isDefault: true },
        { code: "en", name: "English", isDefault: false },
        { code: "fr", name: "French", isDefault: false },
        { code: "fr", name: "French duplicate", isDefault: false },
      ])
    ).toEqual([
      { code: "en", name: "English", isDefault: true },
      { code: "fr", name: "French", isDefault: false },
    ])
    expect(supportedContentLocales([])).toEqual([])
  })
  it("does not offer an unsupported locale from an old link or a stale facet", () => {
    expect(articleLanguageOptions(["en", "de"], ["de", "fr"])).toEqual([
      "en",
      "fr",
    ])
    expect(supportedContentLanguage("FR_ca")).toBe("fr")
    expect(supportedContentLanguage("ja-JP")).toBe("ja")
    expect(supportedContentLanguage("jp")).toBeNull()
    expect(supportedContentLanguage("de-AT")).toBeNull()
  })
  it.each(SUPPORTED_LOCALES)(
    "has code translations for the shared %s route",
    (locale) => {
      expect(
        JSON.parse(
          readFileSync(
            new URL(`../../locales/${locale}/articles.json`, import.meta.url),
            "utf8"
          )
        )
      ).toHaveProperty("articleEditor")
    }
  )
})
