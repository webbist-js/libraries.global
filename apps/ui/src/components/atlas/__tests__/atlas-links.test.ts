import { expect, it } from "vitest"

import { atlasExternalUrl } from "../atlas-links"

it("accepts public catalogue URLs and rejects executable, ambiguous or credential-bearing links", () => {
  expect(
    atlasExternalUrl("https://catalogue.example.org/search?q=library")
  ).toBe("https://catalogue.example.org/search?q=library")
  expect(atlasExternalUrl("http://catalogue.example.org")).toBe(
    "http://catalogue.example.org/"
  )
  for (const value of [
    // eslint-disable-next-line sonarjs/code-eval -- This fixture verifies rejection; it is never evaluated.
    "javascript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "//example.org",
    "https://user:password@example.org",
    "invalid",
    "",
    null,
  ])
    expect(atlasExternalUrl(value)).toBeNull()
})
