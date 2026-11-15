import { NextRequest, NextResponse } from "next/server"
import { afterEach, expect, it, vi } from "vitest"

import { betaGate, betaResponse, betaShellRequest } from "../betaGate"

afterEach(() => vi.unstubAllEnvs())

it.each(["/", "/ja/libraries", "/api/site-search", "/sitemap.xml", "/map"])(
  "keeps %s public despite a stale beta flag",
  (path) => {
    vi.stubEnv("BETA_GATE_ENABLED", "true")
    const request = new NextRequest(`https://libraries.global${path}`, {
      headers: { "x-beta-public-shell": "true" },
    })
    expect(betaGate(request)).toBeNull()
    expect(betaShellRequest(request).headers.has("x-beta-public-shell")).toBe(
      false
    )
    const response = betaResponse(NextResponse.next())
    expect(response.headers.has("x-robots-tag")).toBe(false)
  }
)
