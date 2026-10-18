import { NextRequest } from "next/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { betaPublicRequest } from "@/lib/beta/scope"
import { betaGate } from "@/lib/proxies/betaGate"

const { revalidateTag } = vi.hoisted(() => ({ revalidateTag: vi.fn() }))
vi.mock("next/cache", () => ({ revalidateTag }))

const { POST } = await import("@/app/api/internal/articles/invalidate/route")
const PATH = "/api/internal/articles/invalidate"

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv("BETA_GATE_ENABLED", "true")
  vi.stubEnv("STRAPI_BRIDGE_SECRET", "test-bridge-secret")
})
afterEach(() => vi.unstubAllEnvs())

describe("article privacy invalidation through the beta gate", () => {
  it("lets the CMS callback reach its own authentication without a beta pass", () => {
    expect(
      betaGate(
        new NextRequest(`https://example.test${PATH}`, { method: "POST" })
      )
    ).toBeNull()
    expect(betaPublicRequest(PATH, "GET")).toBe(false)
    expect(betaPublicRequest(`${PATH}/other`, "POST")).toBe(false)
  })

  it.each([undefined, "wrong-secret"])(
    "rejects an untrusted callback",
    async (secret) => {
      const response = await POST(
        new Request(`https://example.test${PATH}`, {
          method: "POST",
          headers: secret ? { "x-service-secret": secret } : {},
        })
      )
      expect(response.status).toBe(401)
      expect(revalidateTag).not.toHaveBeenCalled()
    }
  )

  it("expires only attribution and article caches after authenticated projection", async () => {
    const response = await POST(
      new Request(`https://example.test${PATH}?tag=unrelated`, {
        method: "POST",
        headers: { "x-service-secret": "test-bridge-secret" },
      })
    )
    expect(response.status).toBe(204)
    expect(revalidateTag.mock.calls).toEqual([
      ["blog-article", { expire: 0 }],
      ["wiki-article", { expire: 0 }],
      ["user-profile", { expire: 0 }],
    ])
  })
})
