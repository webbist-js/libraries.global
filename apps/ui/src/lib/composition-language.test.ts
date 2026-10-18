import { describe, expect, it } from "vitest"

import { compositionLanguage } from "./composition-language"

const available = ["en", "es", "fr", "cs", "de"]
describe("new content language defaults", () => {
  it.each([
    ["CO", "es"],
    ["Colombia", "es"],
    ["colombia", "es"],
    ["GB", "en"],
    ["CZ", "cs"],
    ["FR", "fr"],
  ])("uses profile country %s as a hint for %s", (country, expected) => {
    expect(compositionLanguage({ preferences: { country }, available })).toBe(
      expected
    )
  })
  it("prefers an explicitly listed language in a multilingual country, then proficiency and profile order", () => {
    expect(
      compositionLanguage({
        preferences: {
          country: "CA",
          languages: [
            { code: "en", proficiency: "conversational" },
            { code: "fr", proficiency: "native" },
            { code: "de", proficiency: "native" },
          ],
        },
        available,
      })
    ).toBe("fr")
  })
  it("keeps explicit choices and saved draft languages ahead of country/profile hints", () => {
    expect(
      compositionLanguage({
        selected: "fr",
        preferences: { country: "CO" },
        available,
      })
    ).toBe("fr")
  })
  it("normalizes profile language codes while returning the configured regional variant", () => {
    expect(
      compositionLanguage({
        preferences: { country: "CO" },
        available: ["en", "es-MX", "es-CO"],
      })
    ).toBe("es-CO")
    expect(
      compositionLanguage({ selected: "FR_ca", available: ["en", "fr-CA"] })
    ).toBe("fr-CA")
  })
  it("does not substitute another writing script for an explicit one", () => {
    expect(
      compositionLanguage({
        selected: "zh-Hant",
        available: ["en", "zh-Hans"],
      })
    ).toBe("en")
  })
  it("falls back within configured/subject languages when profile hints are unsupported", () => {
    expect(
      compositionLanguage({
        preferences: { country: "CO" },
        available: ["fr"],
        fallback: "en",
      })
    ).toBe("fr")
    expect(
      compositionLanguage({
        preferences: { country: "JP" },
        available,
        fallback: "cs",
      })
    ).toBe("cs")
  })
  it("handles absent/unknown countries and invalid choices without guessing an unconfigured language", () => {
    expect(
      compositionLanguage({
        selected: "<invalid>",
        preferences: { country: "ZZ" },
        available: ["cs", "fr"],
        fallback: "de",
        defaultLanguage: "fr",
      })
    ).toBe("fr")
    expect(compositionLanguage({ available, fallback: "fr" })).toBe("fr")
  })
})
