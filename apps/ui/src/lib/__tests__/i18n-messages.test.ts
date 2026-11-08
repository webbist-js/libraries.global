import { describe, expect, it } from "vitest"

import { checkMessages } from "../../../scripts/i18n-audit.mjs"

import cs from "../../../locales/cs.json"
import en from "../../../locales/en.json"
import es from "../../../locales/es.json"
import fr from "../../../locales/fr.json"
import ja from "../../../locales/ja.json"

describe("translation catalogues", () => {
  it("cover the same keys with valid ICU arguments in every supported language", () => {
    expect(checkMessages({ en, cs, es, fr, ja })).toEqual([])
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
