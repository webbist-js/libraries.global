import { describe, expect, it } from "vitest"

import { assetPath } from "../../src/plugins/content-moderation/admin/src/components/submissionMeta"

describe("moderation upload URLs", () => {
  it("preserves the CDN origin and signed query parameters", () => {
    const url =
      "https://media.example.org/upload_library.jpg?signature=abc&expires=123"
    expect(assetPath(url)).toBe(url)
  })
  it("supports local uploads without rewriting their path", () => {
    expect(assetPath("/uploads/library.jpg?version=2")).toBe(
      "/uploads/library.jpg?version=2"
    )
  })
  it.each([
    null,
    // eslint-disable-next-line sonarjs/code-eval -- regression fixture, never executed
    "javascript:alert(1)",
    "data:image/svg+xml,hello",
    "//other.example/file.jpg",
    String.raw`/\other.example/file.jpg`,
    "https://user:password@other.example/file.jpg",
  ])("rejects unsafe addresses: %s", (url) => {
    expect(assetPath(url)).toBeNull()
  })
})
