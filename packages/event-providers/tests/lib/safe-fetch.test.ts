/* eslint-disable sonarjs/no-hardcoded-ip -- SSRF guard: IP literals are the blocklist / test fixtures */
import type * as Undici from "undici"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { mockLookup, mockFetch } = vi.hoisted(() => ({
  mockLookup: vi.fn(),
  mockFetch: vi.fn(),
}))
vi.mock("node:dns/promises", () => ({ lookup: mockLookup }))
// safe-fetch goes through undici's own fetch (see the module doc), so that is
// what gets mocked here, not the global.
vi.mock("undici", async (importOriginal) => ({
  ...(await importOriginal<typeof Undici>()),
  fetch: mockFetch,
}))

import { FeedFormatError } from "../../src/errors"
import {
  assertPublicUrl,
  isBlockedAddress,
  parseJsonBody,
  safeFetch,
  safeFetchText,
} from "../../src/lib/safe-fetch"

beforeEach(() => {
  mockFetch.mockReset()
  mockLookup.mockReset()
  mockLookup.mockResolvedValue([{ address: "93.184.216.34", family: 4 }])
})

describe("isBlockedAddress", () => {
  it.each([
    "127.0.0.1",
    "10.1.2.3",
    "172.16.0.5",
    "192.168.1.1",
    "169.254.169.254",
    "100.64.0.1",
    "0.0.0.0",
    "::1",
    "::",
    "fd00::1",
    "fe80::1",
    "::ffff:127.0.0.1",
    // IPv4-mapped in hex form (what WHATWG URL produces for [::ffff:127.0.0.1])
    "::ffff:7f00:1",
    "::ffff:a9fe:a9fe",
    // IPv4-translated (RFC 6145)
    "::ffff:0:7f00:1",
    // NAT64 well-known prefix (RFC 6052) wrapping 127.0.0.1
    "64:ff9b::7f00:1",
    "64:ff9b::a9fe:a9fe",
    // 6to4 wrapping 127.0.0.1
    "2002:7f00:1::",
    "2002:a9fe:a9fe::1",
    // IPv4-compatible (deprecated) wrapping 127.0.0.1
    "::7f00:1",
    "::a9fe:a9fe",
    // Teredo (client v4 is XOR-obfuscated; the whole tunnel range is blocked)
    "2001:0:4136:e378:8000:63bf:3fff:fdd2",
    // multicast, site-local, documentation
    "ff02::1",
    "fec0::1",
    "2001:db8::1",
  ])("blocks %s", (ip) => {
    expect(isBlockedAddress(ip)).toBe(true)
  })

  it.each([
    "93.184.216.34",
    "8.8.8.8",
    "2606:4700:4700::1111",
    "::ffff:8.8.8.8",
    "::ffff:808:808",
    "64:ff9b::808:808",
    "2002:808:808::",
  ])("allows %s", (ip) => {
    expect(isBlockedAddress(ip)).toBe(false)
  })

  it("blocks garbage", () => {
    expect(isBlockedAddress("not-an-ip")).toBe(true)
    expect(isBlockedAddress("")).toBe(true)
  })
})

describe("assertPublicUrl", () => {
  it("rejects non-http schemes", async () => {
    await expect(assertPublicUrl("file:///etc/passwd")).rejects.toThrow(
      /scheme/
    )
  })

  it("rejects literal private IPs without DNS", async () => {
    await expect(
      assertPublicUrl("http://169.254.169.254/latest/meta-data")
    ).rejects.toThrow(/non-public/)
    expect(mockLookup).not.toHaveBeenCalled()
  })

  it.each([
    "http://[::ffff:127.0.0.1]/",
    "http://[::ffff:169.254.169.254]/latest/meta-data",
    "http://[64:ff9b::7f00:1]/",
    "http://[2002:7f00:1::]/",
    "http://[::7f00:1]/",
    "http://0x7f000001/",
    "http://2130706433/",
    "http://127.1/",
  ])("rejects the bracketed / odd literal %s", async (url) => {
    await expect(assertPublicUrl(url)).rejects.toThrow(/non-public/)
    expect(mockLookup).not.toHaveBeenCalled()
  })

  it("rejects hostnames that resolve to private addresses", async () => {
    mockLookup.mockResolvedValueOnce([{ address: "10.0.0.7", family: 4 }])
    await expect(assertPublicUrl("https://internal.example")).rejects.toThrow(
      /non-public/
    )
  })

  it("rejects hostnames where any resolved address is private", async () => {
    mockLookup.mockResolvedValueOnce([
      { address: "93.184.216.34", family: 4 },
      { address: "::ffff:a9fe:a9fe", family: 6 },
    ])
    await expect(assertPublicUrl("https://mixed.example")).rejects.toThrow(
      /non-public/
    )
  })

  it("accepts public hosts", async () => {
    await expect(
      assertPublicUrl("https://example.com/cal.ics")
    ).resolves.toBeInstanceOf(URL)
  })
})

describe("safeFetch", () => {
  it("re-validates redirect targets", async () => {
    mockFetch.mockResolvedValueOnce({
      status: 302,
      headers: new Headers({ location: "http://127.0.0.1:1337/admin" }),
    })
    await expect(safeFetch("https://example.com/feed")).rejects.toThrow(
      /non-public/
    )
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it("follows safe redirects", async () => {
    mockFetch
      .mockResolvedValueOnce({
        status: 301,
        headers: new Headers({ location: "https://example.com/new" }),
      })
      .mockResolvedValueOnce({ status: 200, headers: new Headers() })
    const res = await safeFetch("https://example.com/old")
    expect(res.status).toBe(200)
    expect(mockFetch).toHaveBeenLastCalledWith(
      "https://example.com/new",
      expect.objectContaining({ redirect: "manual" })
    )
  })

  it("passes a timeout signal and a pinned dispatcher to fetch", async () => {
    mockFetch.mockResolvedValueOnce({ status: 200, headers: new Headers() })
    await safeFetch("https://example.com/feed", {}, { timeoutMs: 1234 })
    const init = mockFetch.mock.calls[0]![1]
    expect(init.signal).toBeInstanceOf(AbortSignal)
    expect(init.dispatcher).toBeDefined()
    expect(typeof init.dispatcher.dispatch).toBe("function")
  })

  // Finding 9: a redirect to a different origin must not carry the first
  // origin's Authorization/Cookie along — undici, unlike a browser, never
  // strips these on its own.
  it("refuses credentialed cross-origin redirects without replaying any bytes", async () => {
    mockFetch.mockResolvedValueOnce({
      status: 302,
      headers: new Headers({ location: "https://other.example/new" }),
    })
    await expect(
      safeFetch("https://example.com/old", {
        headers: { Authorization: "Bearer fixture" },
        body: "secret body",
        method: "POST",
      })
    ).rejects.toThrow(/cross-origin/)
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it("keeps Authorization across a same-origin redirect", async () => {
    mockFetch
      .mockResolvedValueOnce({
        status: 302,
        headers: new Headers({ location: "https://example.com/new" }),
      })
      .mockResolvedValueOnce({ status: 200, headers: new Headers() })
    await safeFetch("https://example.com/old", {
      headers: { Authorization: "Bearer secret" },
    })
    const secondHeaders = new Headers(mockFetch.mock.calls[1]![1].headers)
    expect(secondHeaders.get("authorization")).toBe("Bearer secret")
  })
})

describe("safeFetchText", () => {
  it("returns the body of a small response", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response("BEGIN:VCALENDAR", { status: 200 })
    )
    const r = await safeFetchText("https://example.com/cal.ics")
    expect(r).toMatchObject({ ok: true, status: 200, text: "BEGIN:VCALENDAR" })
  })

  it("rejects a body that exceeds the cap while streaming", async () => {
    const cancelled = vi.fn()
    let pulls = 0
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulls++
        controller.enqueue(new Uint8Array(1024))
      },
      cancel: cancelled,
    })
    mockFetch.mockResolvedValueOnce(new Response(stream, { status: 200 }))
    await expect(
      safeFetchText("https://example.com/big", { maxBytes: 4096 })
    ).rejects.toThrow(/too large/i)
    expect(pulls).toBeLessThan(20)
    expect(cancelled).toHaveBeenCalled()
  })

  it("rejects up front when content-length exceeds the cap", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response("x", {
        status: 200,
        headers: { "content-length": String(10 * 1024 * 1024) },
      })
    )
    await expect(
      safeFetchText("https://example.com/big", { maxBytes: 5 * 1024 * 1024 })
    ).rejects.toThrow(/too large/i)
  })

  it("rejects when the request hangs past the timeout", async () => {
    mockFetch.mockImplementationOnce(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal!.addEventListener("abort", () =>
            reject(init.signal!.reason)
          )
        })
    )
    await expect(
      safeFetchText("https://example.com/slow", { timeoutMs: 50 })
    ).rejects.toThrow(/timed out|timeout/i)
  })

  it("reads mocks that only implement text()", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers(),
      text: async () => "hello",
    })
    const r = await safeFetchText("https://example.com/x")
    expect(r.text).toBe("hello")
  })

  // Finding 9, on the body-capped entry point too.
  it("refuses a body-capped credentialed redirect", async () => {
    mockFetch.mockResolvedValueOnce({
      status: 302,
      headers: new Headers({ location: "https://other.example/new" }),
      text: async () => "",
    })
    await expect(
      safeFetchText("https://example.com/old", {
        headers: { Authorization: "Bearer fixture" },
      })
    ).rejects.toThrow(/cross-origin/)
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })
})

describe("parseJsonBody", () => {
  it("throws FeedFormatError on unparseable JSON, never echoing the body", () => {
    const res = {
      ok: true,
      status: 200,
      headers: new Headers(),
      text: "not json {{{",
    }
    expect(() => parseJsonBody(res, "TestProvider")).toThrow(FeedFormatError)
    try {
      parseJsonBody(res, "TestProvider")
    } catch (err) {
      expect(String((err as Error).message)).not.toContain("not json")
    }
  })

  it("parses valid JSON", () => {
    const res = {
      ok: true,
      status: 200,
      headers: new Headers(),
      text: '{"a":1}',
    }
    expect(parseJsonBody(res, "TestProvider")).toEqual({ a: 1 })
  })
})

it("refuses HTTPS downgrade before making the second request", async () => {
  mockFetch.mockResolvedValueOnce({
    status: 302,
    headers: new Headers({ location: "http://example.com/plain" }),
  })
  await expect(safeFetch("https://example.com/feed")).rejects.toThrow(/HTTPS/)
  expect(mockFetch).toHaveBeenCalledTimes(1)
})
