import { describe, expect, it } from "vitest"

import {
  reviewHref,
  reviewReturnHref,
} from "@/components/moderation/queue-navigation"

describe("review return links", () => {
  const queue =
    "/contribute/moderation?category=claims&status=needs_info&locale=fr&page=2"
  it("carries category and filters into the review link", () => {
    expect(reviewHref("claim-1", queue)).toBe(
      `/contribute/moderation/claim-1?returnTo=${encodeURIComponent(queue)}`
    )
    expect(reviewReturnHref(queue)).toBe(queue)
  })
  it.each([
    "https://outside.test",
    "//outside.test",
    "/contribute/moderation/other",
    "/auth/signin",
    [queue],
    "/contribute/moderation" + "?".repeat(1500),
  ])("refuses destinations outside the queue: %j", (href) => {
    expect(reviewReturnHref(href)).toBeUndefined()
  })
})
