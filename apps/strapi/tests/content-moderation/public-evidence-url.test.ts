import { describe, expect, it } from "vitest"

import { publicEvidenceUrl } from "../../src/plugins/content-moderation/server/services/submission"

describe("publicEvidenceUrl", () => {
  it("returns the URL for public document evidence", () => {
    expect(
      publicEvidenceUrl("institutional_url", "https://example.org/hours")
    ).toBe("https://example.org/hours")
    expect(
      publicEvidenceUrl("press_release", " http://example.org/news ")
    ).toBe("http://example.org/news")
  })

  it("never exposes evidence that may identify a person", () => {
    expect(
      publicEvidenceUrl("personal_communication", "https://example.org/x")
    ).toBeNull()
    expect(
      publicEvidenceUrl("my_institutional_affiliation", "https://example.org")
    ).toBeNull()
    expect(publicEvidenceUrl("on_site_photo", "https://example.org")).toBeNull()
    expect(publicEvidenceUrl("other", "https://example.org")).toBeNull()
    expect(publicEvidenceUrl(null, "https://example.org")).toBeNull()
  })

  it("drops anything that isn't an http(s) URL", () => {
    expect(publicEvidenceUrl("institutional_url", "")).toBeNull()
    expect(publicEvidenceUrl("institutional_url", null)).toBeNull()
    expect(
      publicEvidenceUrl("institutional_url", "ftp://example.org/x")
    ).toBeNull()
    expect(publicEvidenceUrl("institutional_url", "/relative/path")).toBeNull()
    expect(publicEvidenceUrl("institutional_url", "mailto:a@b.c")).toBeNull()
  })
})
