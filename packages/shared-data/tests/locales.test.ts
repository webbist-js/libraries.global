import { describe, expect, it } from "vitest"

import { cmsLocale, routeLocale } from "../locales"

describe("Taiwan locale boundary", () => {
  it("keeps public URLs short and uses Strapi's supported code", () => {
    expect(cmsLocale("zh-TW")).toBe("zh-Hant-TW")
    expect(routeLocale("zh-Hant-TW")).toBe("zh-TW")
    expect(cmsLocale("ja")).toBe("ja")
    expect(routeLocale("en")).toBe("en")
  })
})
