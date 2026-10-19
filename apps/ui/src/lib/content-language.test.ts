import { describe, expect, it } from "vitest"

import { preferredContentLanguage } from "@/lib/content-language"

describe("content language defaults", () => {
  it.each(["en", "fr", "cs"])(
    "uses the header choice %s without a profile language",
    (locale) => {
      expect(preferredContentLanguage(locale)).toBe(locale)
      expect(
        preferredContentLanguage(locale, { country: "CO", languages: [] })
      ).toBe(locale)
    }
  )
  it("uses the user's strongest profile language, preserving profile order for ties", () => {
    expect(
      preferredContentLanguage("en", {
        languages: [
          { code: "es", proficiency: "conversational" },
          { code: "FR_ca", proficiency: "native" },
          { code: "cs", proficiency: "native" },
        ],
      })
    ).toBe("fr")
  })
  it("skips malformed and unsupported profile languages in favour of the header", () => {
    expect(
      preferredContentLanguage("fr", {
        languages: [
          { code: "<invalid>", proficiency: "native" },
          { code: "es", proficiency: "fluent" },
        ],
      })
    ).toBe("fr")
  })
})
