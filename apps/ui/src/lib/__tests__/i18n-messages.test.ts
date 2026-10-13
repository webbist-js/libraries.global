import { describe, expect, it } from "vitest"

import { checkMessages } from "../../../scripts/i18n-audit.mjs"

import cs from "../../../locales/cs.json"
import en from "../../../locales/en.json"
import fr from "../../../locales/fr.json"

describe("translation catalogues", () => {
  it("cover the same keys with valid ICU arguments in English, Czech and French", () => {
    expect(checkMessages({ en, cs, fr })).toEqual([])
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
