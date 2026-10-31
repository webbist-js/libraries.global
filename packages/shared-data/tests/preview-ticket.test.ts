import { expect, it } from "vitest"

import { readPreviewTicket, signPreviewTicket } from "../preview-ticket"

it("binds a short-lived preview to the exact target without exposing the long-lived secret", () => {
  const target = { url: "/about", locale: "en", status: "draft" } as const
  const token = signPreviewTicket(target, "fixture", 1000)
  expect(token).not.toContain("fixture")
  expect(readPreviewTicket(token, "fixture", 1001)).toMatchObject(target)
  expect(readPreviewTicket(token + "x", "fixture", 1001)).toBeNull()
  expect(readPreviewTicket(token, "different", 1001)).toBeNull()
  expect(readPreviewTicket(token, "fixture", 61_001)).toBeNull()
  expect(readPreviewTicket(token, "fixture", -1)).toBeNull()
})
