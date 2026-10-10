import { afterEach, expect, it, vi } from "vitest"
import { NextRequest, NextResponse } from "next/server"

import { atlasCohortFromHeaders, scalableAtlasEnabled } from "../atlas-rollout"
import { atlasCohortRequest, atlasCohortResponse } from "../proxies/atlasCohort"

afterEach(() => vi.unstubAllEnvs())
it("keeps cohorts stable and nested as rollout grows, independently of entitlements", () => {
  vi.stubEnv("ATLAS_QUERY_ENABLED", "true")
  vi.stubEnv("ATLAS_PROVIDER", "scalable")
  vi.stubEnv("ATLAS_ROLLOUT_PERCENT", "5")
  expect(scalableAtlasEnabled("00000000" + "0".repeat(24))).toBe(true)
  expect(scalableAtlasEnabled("40000000" + "0".repeat(24))).toBe(false)
  vi.stubEnv("ATLAS_ROLLOUT_PERCENT", "26")
  expect(scalableAtlasEnabled("40000000" + "0".repeat(24))).toBe(true)
  vi.stubEnv("ATLAS_ROLLOUT_PERCENT", "100")
  expect(scalableAtlasEnabled()).toBe(true)
  vi.stubEnv("ATLAS_QUERY_ENABLED", "false")
  expect(scalableAtlasEnabled("0".repeat(32))).toBe(false)
})
it("assigns one anonymous cookie before server rendering and preserves unrelated cookies", () => {
  vi.stubEnv("ATLAS_QUERY_ENABLED", "true")
  vi.stubEnv("ATLAS_PROVIDER", "scalable")
  vi.stubEnv("ATLAS_ROLLOUT_PERCENT", "5")
  const next = atlasCohortRequest(
    new NextRequest("https://ui.test/en/map", {
      headers: { cookie: "locale=en; atlas-cohort=bad" },
    })
  )
  expect(next.created).toMatch(/^[a-f0-9]{32}$/)
  expect(atlasCohortFromHeaders(next.request.headers)).toBe(next.created)
  expect(next.request.cookies.get("locale")?.value).toBe("en")
  const response = atlasCohortResponse(NextResponse.next(), next.created)
  expect(response.cookies.get("atlas-cohort")).toMatchObject({
    value: next.created,
    httpOnly: true,
    sameSite: "lax",
  })
  expect(atlasCohortRequest(next.request).created).toBeUndefined()
  expect(
    atlasCohortRequest(new NextRequest("https://ui.test/api/atlas/query"))
      .created
  ).toBeUndefined()
})
