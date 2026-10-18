import { describe, expect, it } from "vitest"

import {
  articleContentLanguage,
  articleReaderPath,
  contentLanguageSuffix,
} from "./article-content-language"

describe("explicit article language links", () => {
  it("preserves a valid content language independent of route language", () => {
    expect(articleContentLanguage({ contentLang: "es" })).toBe("es")
    expect(contentLanguageSuffix("es")).toBe("?contentLang=es")
    expect(articleContentLanguage({ contentLang: ["pt-BR", "en"] })).toBe(
      "pt-BR"
    )
  })
  it("keeps reader actions on the displayed content variant while preserving same-language URLs", () => {
    expect(articleReaderPath("/journal/feature/story", "en", "es")).toBe(
      "/journal/feature/story?contentLang=es"
    )
    expect(articleReaderPath("/knowledge/reference/guide", "en", "fr")).toBe(
      "/knowledge/reference/guide?contentLang=fr"
    )
    expect(articleReaderPath("/journal/feature/story", "fr", "fr")).toBe(
      "/journal/feature/story"
    )
    expect(articleReaderPath("/journal/feature/story", "en", "../draft")).toBe(
      "/journal/feature/story"
    )
  })
  it("drops arbitrary paths and unsupported query syntax", () => {
    expect(articleContentLanguage({ contentLang: "../../draft" })).toBeNull()
    expect(
      articleContentLanguage({ contentLang: "es&status=draft" })
    ).toBeNull()
    expect(contentLanguageSuffix(null)).toBe("")
  })
})
