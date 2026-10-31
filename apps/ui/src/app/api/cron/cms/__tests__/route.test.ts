import { NextRequest } from "next/server"
import { afterEach, describe, expect, it, vi } from "vitest"

import { betaGate } from "@/lib/proxies/betaGate"

const maintenance = vi.hoisted(() => vi.fn())
vi.mock("server-only", () => ({}))
vi.mock("@/lib/cms-maintenance", () => ({ cmsMaintenance: maintenance }))
import { GET } from "../route"

afterEach(() => {
  vi.unstubAllEnvs()
  vi.clearAllMocks()
})

describe("CMS maintenance through closed beta", () => {
  it("reaches service authentication without a browser pass and rejects missing/invalid credentials", async () => {
    vi.stubEnv("BETA_GATE_ENABLED", "true")
    vi.stubEnv("CRON_SECRET", "maintenance-test-secret")
    for (const authorization of [undefined, "Bearer incorrect"]) {
      const request = new NextRequest("https://libraries.global/api/cron/cms", {
        headers: authorization ? { authorization } : {},
      })
      expect(betaGate(request)).toBeNull()
      expect((await GET(request)).status).toBe(401)
    }
    expect(maintenance).not.toHaveBeenCalled()
  })
  it.each([
    [true, 200],
    [false, 503],
  ])("reports actual maintenance success=%s", async (ok, status) => {
    vi.stubEnv("CRON_SECRET", "maintenance-test-secret")
    maintenance.mockResolvedValue({ ok })
    const response = await GET(
      new Request("https://libraries.global/api/cron/cms", {
        headers: { authorization: "Bearer maintenance-test-secret" },
      })
    )
    expect(response.status).toBe(status)
    expect(await response.json()).toEqual({ ok })
    expect(maintenance).toHaveBeenCalledWith("maintenance")
    expect(response.headers.get("cache-control")).toBe("no-store")
  })
})
