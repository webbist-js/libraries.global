import { createTranslator } from "next-intl"
import { describe, expect, it } from "vitest"

import cs from "../../../locales/cs"
import en from "../../../locales/en"
import es from "../../../locales/es"
import fr from "../../../locales/fr"
import ja from "../../../locales/ja"
import {
  checkCatalogueFiles,
  checkMessages,
  readCatalogueFiles,
} from "../../../scripts/i18n-audit.mjs"

describe("translation catalogues", () => {
  it("cover the same keys with valid ICU arguments in every supported language", () => {
    expect(checkMessages({ en, cs, es, fr, ja })).toEqual([])
  })
  it("keeps each locale's feature files in step with English", () => {
    expect(checkCatalogueFiles(readCatalogueFiles())).toEqual([])
  })
  it("uses Czech plural forms and Japanese counts in public search", () => {
    const czech = createTranslator({
      locale: "cs",
      messages: cs,
      namespace: "articleSearch",
    })
    const japanese = createTranslator({
      locale: "ja",
      messages: ja,
      namespace: "articleSearch",
    })
    expect(czech("results", { count: 1, query: "Praha" })).toBe(
      "1 výsledek pro „Praha“"
    )
    expect(czech("results", { count: 3, query: "Praha" })).toBe(
      "3 výsledky pro „Praha“"
    )
    expect(czech("results", { count: 5, query: "Praha" })).toBe(
      "5 výsledků pro „Praha“"
    )
    expect(japanese("results", { count: 3, query: "東京" })).toBe(
      "「東京」の検索結果：3 件"
    )
  })
  it("rejects a missing interpolation argument or rich text tag", () => {
    expect(
      checkMessages({
        en: { count: "<strong>{count}</strong>" },
        fr: { count: "{total}" },
      })
    ).toEqual(["fr: ICU arguments differ for count"])
  })
})
