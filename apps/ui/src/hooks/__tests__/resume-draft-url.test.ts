import { describe, expect, it } from "vitest"

import { resumeDraftUrl } from "../useSubmissions"

describe("resumeDraftUrl", () => {
  it("asks for the default locale's draft without a locale", () => {
    const url = new URL(
      resumeDraftUrl("correction", "bl", undefined, "http://x")
    )
    expect(url.pathname).toBe("/api/submissions/draft/correction")
    expect(url.searchParams.get("targetSlug")).toBe("bl")
    expect(url.searchParams.has("locale")).toBe(false)
  })

  it("asks for a translation's draft in translation mode", () => {
    const url = new URL(resumeDraftUrl("library_edit", "bl", "cs", "http://x"))
    expect(url.searchParams.get("locale")).toBe("cs")
  })
})
