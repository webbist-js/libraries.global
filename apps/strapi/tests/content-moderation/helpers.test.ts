import { describe, expect, it } from "vitest"

import { isDocumentId } from "../../src/plugins/content-moderation/server/utils/params"
import { payloadHash } from "../../src/plugins/content-moderation/server/utils/payload-hash"
import { canTransition } from "../../src/plugins/content-moderation/server/utils/transitions"

describe("canTransition", () => {
  it.each([
    ["draft", "pending", true],
    ["pending", "approved", true],
    ["pending", "rejected", true],
    ["pending", "needs_info", true],
    ["needs_info", "pending", true],
    ["needs_info", "approved", true],
    ["needs_info", "rejected", true],
    ["approved", "approved", false],
    ["approved", "pending", false],
    ["rejected", "approved", false],
    ["draft", "approved", false],
  ] as const)("%s → %s = %s", (from, to, ok) => {
    expect(canTransition(from, to)).toBe(ok)
  })
})

describe("payloadHash", () => {
  const base = {
    submissionType: "wiki_edit",
    targetSlug: "a",
    fields: { x: 1, y: [1, 2] },
    draftData: { body: [] },
  }
  it("is stable across key order", () => {
    expect(payloadHash(base)).toBe(
      payloadHash({
        draftData: { body: [] },
        fields: { y: [1, 2], x: 1 },
        targetSlug: "a",
        submissionType: "wiki_edit",
      })
    )
  })
  it("changes when content or target changes", () => {
    expect(payloadHash(base)).not.toBe(
      payloadHash({ ...base, targetSlug: "b" })
    )
    expect(payloadHash(base)).not.toBe(
      payloadHash({ ...base, fields: { x: 2, y: [1, 2] } })
    )
  })
})

describe("isDocumentId", () => {
  it("accepts Strapi document ids and rejects traversal", () => {
    expect(isDocumentId("um66mf6ytj5r7ct0rrgxxh8u")).toBe(true)
    expect(isDocumentId("../../auth-bridge")).toBe(false)
    expect(isDocumentId("12")).toBe(false)
    expect(isDocumentId(42)).toBe(false)
  })
})
