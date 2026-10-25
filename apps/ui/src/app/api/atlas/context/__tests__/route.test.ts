import { beforeEach, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))
const state = vi.hoisted(() => ({
  user: null as { id: string; features: string[] } | null,
  calls: [] as string[],
}))
vi.mock("@/lib/auth", () => ({
  auth: {
    api: { getSession: async () => (state.user ? { user: state.user } : null) },
  },
}))
vi.mock("@/lib/rate-limit", () => ({
  createRateLimiter: () => ({ check: async () => ({ ok: true }) }),
  rateLimitResponse: () => new Response(null, { status: 429 }),
}))
vi.mock("@/lib/access-server", () => ({
  requireEntitlement: (user: { features?: string[] }) =>
    user.features?.includes("atlas.analysis")
      ? null
      : new Response(null, { status: 402 }),
}))
vi.mock("@/lib/atlas-backend", () => ({
  createAtlasBackend: () => ({
    bridge: async (path: string) => {
      state.calls.push(path)
      if (path.includes("catalogue"))
        return {
          schemaVersion: 1,
          releases: [
            { id: "population-gb-test", theme: "population" },
            { id: "deprivation-gb-eng-test", theme: "deprivation" },
          ],
        }

      return { png: Buffer.from([137, 80, 78, 71]).toString("base64") }
    },
  }),
}))
import { GET } from "../route"

beforeEach(() => {
  state.user = null
  state.calls.length = 0
  process.env.ATLAS_QUERY_ENABLED = "true"
})
it("requires sign-in before touching the private bridge", async () => {
  expect(
    (await GET(new Request("http://localhost/api/atlas/context"))).status
  ).toBe(401)
  expect(state.calls).toHaveLength(0)
})
it("allows the free population layer but gates deprivation before tile access", async () => {
  state.user = { id: "free", features: [] }
  const response = await GET(
    new Request(
      "http://localhost/api/atlas/context?kind=tile&release=population-gb-test&z=0&x=0&y=0"
    )
  )
  expect(response.status).toBe(200)
  expect(response.headers.get("content-type")).toBe("image/png")
  state.calls.length = 0
  expect(
    (
      await GET(
        new Request(
          "http://localhost/api/atlas/context?kind=tile&release=deprivation-gb-eng-test&z=0&x=0&y=0"
        )
      )
    ).status
  ).toBe(402)
  expect(state.calls.some((path) => path.includes("kind=tile"))).toBe(false)
})
it("accepts an entitled context request and rejects uninstalled or arbitrary releases", async () => {
  state.user = { id: "pro", features: ["atlas.analysis"] }
  expect(
    (
      await GET(
        new Request(
          "http://localhost/api/atlas/context?kind=tile&release=deprivation-gb-eng-test&z=0&x=0&y=0"
        )
      )
    ).status
  ).toBe(200)
  expect(
    (
      await GET(
        new Request(
          "http://localhost/api/atlas/context?kind=geometry&release=unknown"
        )
      )
    ).status
  ).toBe(404)
  expect(
    (
      await GET(
        new Request(
          "http://localhost/api/atlas/context?kind=geometry&release=../../secrets"
        )
      )
    ).status
  ).toBe(400)
})
