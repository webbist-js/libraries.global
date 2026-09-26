import { describe, expect, it } from "vitest"

import {
  isDocumentIdParam,
  isSubmissionTypeParam,
  readJsonCapped,
} from "@/lib/bridge-params"

describe("bridge params", () => {
  it("rejects traversal in submission types", () => {
    expect(isSubmissionTypeParam("wiki_edit")).toBe(true)
    expect(
      isSubmissionTypeParam("../../auth-bridge/user-affiliations?baUserId=x")
    ).toBe(false)
  })
  it("accepts only document ids", () => {
    expect(isDocumentIdParam("um66mf6ytj5r7ct0rrgxxh8u")).toBe(true)
    expect(isDocumentIdParam("..%2F..")).toBe(false)
    expect(isDocumentIdParam("../x")).toBe(false)
  })
  it("caps body size", async () => {
    const big = new Request("http://x", {
      method: "POST",
      body: JSON.stringify({ a: "x".repeat(2000) }),
    })
    expect(await readJsonCapped(big, 1000)).toEqual({ ok: false, status: 413 })
    const bad = new Request("http://x", { method: "POST", body: "{" })
    expect(await readJsonCapped(bad, 1000)).toEqual({ ok: false, status: 400 })
    const ok = new Request("http://x", { method: "POST", body: '{"a":1}' })
    expect(await readJsonCapped(ok, 1000)).toEqual({ ok: true, body: { a: 1 } })
  })
})
