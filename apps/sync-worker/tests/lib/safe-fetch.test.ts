/* eslint-disable sonarjs/no-hardcoded-ip -- SSRF guard: IP literals are the blocklist / test fixtures */
import { beforeEach, describe, expect, it, vi } from "vitest"

const { mockLookup } = vi.hoisted(() => ({ mockLookup: vi.fn() }))
vi.mock("node:dns/promises", () => ({ lookup: mockLookup }))

import {
  assertPublicUrl,
  isBlockedAddress,
  safeFetch,
} from "../../src/lib/safe-fetch"

const mockFetch = vi.fn()
vi.stubGlobal("fetch", mockFetch)

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
    "fd00::1",
    "fe80::1",
    "::ffff:127.0.0.1",
  ])("blocks %s", (ip) => {
    expect(isBlockedAddress(ip)).toBe(true)
  })

  it.each(["93.184.216.34", "8.8.8.8", "2606:4700:4700::1111"])(
    "allows %s",
    (ip) => {
      expect(isBlockedAddress(ip)).toBe(false)
    }
  )
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

  it("rejects hostnames that resolve to private addresses", async () => {
    mockLookup.mockResolvedValueOnce([{ address: "10.0.0.7", family: 4 }])
    await expect(assertPublicUrl("https://internal.example")).rejects.toThrow(
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
})
