import { afterEach, expect, it, vi } from "vitest"

import { POST } from "../route"
import { POST as waitlist } from "../../waitlist/route"

afterEach(() => vi.unstubAllEnvs())

it("retires invitations and waitlist collection even with stale beta configuration", async () => {
  vi.stubEnv("BETA_GATE_ENABLED", "true")
  for (const handler of [POST, waitlist]) {
    const response = await handler()
    expect(response.status).toBe(410)
    expect(response.headers.get("cache-control")).toBe("no-store")
    expect(response.headers.has("set-cookie")).toBe(false)
  }
})
