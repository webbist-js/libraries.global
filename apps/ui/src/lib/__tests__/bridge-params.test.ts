import { describe, expect, it, vi } from "vitest"

import {
  DOCUMENT_ID_PATTERN,
  isDocumentIdParam,
  isSubmissionTypeParam,
  MAX_ID_LENGTH,
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
  it("uses the same documentId rule as Strapi's library export", () => {
    expect(DOCUMENT_ID_PATTERN.source).toBe("^[a-z0-9]{20,32}$")
    expect(MAX_ID_LENGTH).toBe(32)
    expect(isDocumentIdParam("a".repeat(MAX_ID_LENGTH))).toBe(true)
    expect(isDocumentIdParam("a".repeat(MAX_ID_LENGTH + 1))).toBe(false)
    expect(isDocumentIdParam("a".repeat(19))).toBe(false)
    expect(isDocumentIdParam("UM66MF6YTJ5R7CT0RRGXXH8U")).toBe(false)
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

const bytes = (text: string) => new TextEncoder().encode(text)

/** A POST whose body streams `chunks` one read at a time, counting pulls. */
function streamed(chunks: Uint8Array[], headers?: HeadersInit) {
  let pulls = 0
  const cancel = vi.fn()
  const body = new ReadableStream<Uint8Array>(
    {
      pull(controller) {
        const chunk = chunks[pulls]
        pulls += 1
        if (chunk) controller.enqueue(chunk)
        else controller.close()
      },
      cancel,
    },
    { highWaterMark: 0 }
  )
  const req = new Request("http://x", {
    method: "POST",
    body,
    headers,
    duplex: "half",
  } as RequestInit)

  return { req, cancel, pulls: () => pulls }
}

describe("readJsonCapped: counting bytes as they're read", () => {
  it("returns 413 for an over-limit Content-Length without reading the body", async () => {
    const { req, pulls } = streamed([bytes('{"a":1}')], {
      "Content-Length": "1001",
    })

    expect(await readJsonCapped(req, 1000)).toEqual({ ok: false, status: 413 })
    expect(pulls()).toBe(0)
    expect(req.bodyUsed).toBe(false)
  })

  it("stops reading a streamed body once it passes the cap", async () => {
    // 40 chunks of 256 spaces: the fourth takes the count to 1,024 bytes.
    const { req, cancel, pulls } = streamed(
      Array.from({ length: 40 }, () => new Uint8Array(256).fill(0x20))
    )

    expect(await readJsonCapped(req, 1000)).toEqual({ ok: false, status: 413 })
    expect(pulls()).toBe(4)
    expect(cancel).toHaveBeenCalledTimes(1)
  })

  it("doesn't trust a Content-Length smaller than the body", async () => {
    const { req } = streamed([bytes(JSON.stringify("x".repeat(2000)))], {
      "Content-Length": "10",
    })

    expect(await readJsonCapped(req, 1000)).toEqual({ ok: false, status: 413 })
  })

  it("counts bytes, not characters", async () => {
    // 10 two-byte characters in quotes: 12 characters, 22 bytes.
    const json = JSON.stringify("é".repeat(10))
    const at = (cap: number) => readJsonCapped(streamed([bytes(json)]).req, cap)

    expect(await at(21)).toEqual({ ok: false, status: 413 })
    expect(await at(22)).toEqual({ ok: true, body: "é".repeat(10) })
  })

  it("reads a body split across chunks, even mid-character", async () => {
    const whole = bytes('{"name":"Biblioteka Narodowa — Warszawa"}')
    const { req } = streamed([whole.slice(0, 30), whole.slice(30)])

    expect(await readJsonCapped(req, 1000)).toEqual({
      ok: true,
      body: { name: "Biblioteka Narodowa — Warszawa" },
    })
  })
})
