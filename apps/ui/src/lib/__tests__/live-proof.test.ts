import { NextRequest, NextResponse } from "next/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { liveCookieOptions, readLiveProof, signLiveProof } from "../live-proof"
import {
  checkConfirmationCode,
  confirmationLocked,
  newConfirmationCode,
  recordFailure,
} from "../mobile-live/confirmation-store"
import {
  isLivePath,
  liveSecurityRequest,
  liveSecurityResponse,
} from "../mobile-live/security"

// `lib/live-path` reads the locale list from the routing config; the
// next-intl navigation module it lives in doesn't load under vitest.
vi.mock("@/lib/navigation", () => ({
  routing: { locales: ["cs", "en"], defaultLocale: "en" },
}))

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date("2026-10-06T09:00:00Z"))
  vi.stubEnv("STRAPI_BRIDGE_SECRET", "test-secret")
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
})
describe("live step-up proof", () => {
  it("requires the same user and BA session, refuses tampering, expires in twelve hours and fails closed without a secret", () => {
    const proof = signLiveProof("u1", "session1")
    expect(readLiveProof(proof, "u1", "session1")?.expiresAt).toBe(
      Date.now() + 12 * 3_600_000
    )
    expect(readLiveProof(proof, "u2", "session1")).toBeNull()
    expect(readLiveProof(proof, "u1", "session2")).toBeNull()
    expect(readLiveProof(`${proof}x`, "u1", "session1")).toBeNull()
    vi.advanceTimersByTime(12 * 3_600_000)
    expect(readLiveProof(proof, "u1", "session1")).toBeNull()
    vi.stubEnv("STRAPI_BRIDGE_SECRET", "")
    expect(() => signLiveProof("u1", "session1")).toThrow()
    expect(liveCookieOptions).toMatchObject({
      httpOnly: true,
      secure: true,
      sameSite: "strict",
    })
  })
  it("uses a single-use six-digit code bound to the current session, never stores the raw code, and locks five failures", () => {
    const state = { attempts: 0, windowAt: Date.now(), lockedUntil: 0 }
    const code = newConfirmationCode(state, "u1", "session1")
    expect(code).toMatch(/^\d{6}$/)
    expect(JSON.stringify(state)).not.toContain(code)
    expect(checkConfirmationCode(state, "u1", "session2", code)).toBe(false)
    expect(checkConfirmationCode(state, "u1", "session1", code)).toBe(true)
    expect(checkConfirmationCode(state, "u1", "session1", code)).toBe(false)
    const expired = newConfirmationCode(state, "u1", "session1")
    vi.advanceTimersByTime(10 * 60_000)
    expect(checkConfirmationCode(state, "u1", "session1", expired)).toBe(false)
    for (let i = 0; i < 4; i++) expect(recordFailure(state)).toBe(false)
    expect(recordFailure(state)).toBe(true)
    expect(confirmationLocked(state)).toBe(true)
    vi.advanceTimersByTime(15 * 60_000)
    expect(confirmationLocked(state)).toBe(false)
  })
})
describe("live route security policy", () => {
  it("covers localized console and live APIs, propagates a nonce and preserves a locale rewrite", () => {
    expect(isLivePath("/en/live/mobile-id")).toBe(true)
    expect(isLivePath("/api/mobile/live/start")).toBe(true)
    expect(isLivePath("/cs/live/mobile-id")).toBe(true)
    const forged = liveSecurityRequest(
      new NextRequest("https://libraries.global/en/community", {
        headers: {
          "x-live-console": "true",
          "x-nonce": "attacker",
          "Content-Security-Policy": "script-src *",
        },
      })
    )
    expect(forged.headers.get("x-live-console")).toBeNull()
    expect(forged.headers.get("x-nonce")).toBeNull()
    expect(forged.headers.get("content-security-policy")).toBeNull()
    const regular = liveSecurityResponse(forged, NextResponse.next())
    expect(regular.headers.get("x-middleware-override-headers")).not.toContain(
      "x-live-console"
    )
    expect(
      regular.headers.get("x-middleware-request-x-live-console")
    ).toBeNull()
    expect(isLivePath("/en/contribute/staff/live")).toBe(false)
    const request = liveSecurityRequest(
      new NextRequest("https://libraries.global/en/live")
    )
    const response = liveSecurityResponse(
      request,
      NextResponse.rewrite(new URL("https://libraries.global/en/live"))
    )
    const policy = response.headers.get("content-security-policy")!
    expect(policy).toContain(`'nonce-${request.headers.get("x-nonce")}'`)
    expect(policy).toContain("connect-src 'self'")
    expect(policy).toContain("frame-ancestors 'none'")
    expect(response.headers.get("x-middleware-rewrite")).toContain("/en/live")
    expect(response.headers.get("x-middleware-request-x-live-console")).toBe(
      "true"
    )
    expect(response.headers.get("referrer-policy")).toBe("no-referrer")
    expect(response.headers.get("cache-control")).toBe("no-store")
    expect(response.headers.get("permissions-policy")).toBe(
      "geolocation=(self)"
    )
  })
})
