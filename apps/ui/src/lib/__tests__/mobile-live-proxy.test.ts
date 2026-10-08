import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  staff: vi.fn(),
  query: vi.fn(),
  proof: "",
  counts: new Map<string, number>(),
}))
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => ({ value: mocks.proof }) }),
}))
vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: mocks.session } },
  authDbPool: { query: mocks.query },
}))
vi.mock("@/lib/access-server", () => ({ requireStaff: mocks.staff }))

import { POST as start } from "@/app/api/mobile/live/start/route"
import { POST as takeover } from "@/app/api/mobile/live/takeover/route"

import { signLiveProof } from "../live-proof"

const id = "mobile000000000000000001"
const request = (
  path = "start",
  origin = "https://libraries.example",
  body: Record<string, unknown> = {}
) =>
  new Request(`https://libraries.example/api/mobile/live/${path}`, {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/json" },
    body: JSON.stringify({ libraryDocumentId: id, mode: "checkins", ...body }),
  })
beforeEach(() => {
  vi.clearAllMocks()
  mocks.counts.clear()
  vi.stubEnv("APP_PUBLIC_URL", "https://libraries.example")
  vi.stubEnv("STRAPI_BRIDGE_SECRET", "test-only-secret")
  mocks.proof = signLiveProof("staff", "ba-session")
  mocks.session.mockResolvedValue({
    user: { id: "staff", email: "crew@example.org", name: "Crew" },
    session: { id: "ba-session" },
  })
  mocks.staff.mockReturnValue(null)
  mocks.query.mockImplementation(async (_sql: string, args: unknown[]) => {
    const key = String(args[0]),
      count = (mocks.counts.get(key) ?? 0) + 1
    mocks.counts.set(key, count)

    return { rows: [{ value: JSON.stringify({ count }) }] }
  })
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json({ session: { id: "session" } }))
  )
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe("live staff bridge", () => {
  it("prechecks scoped staff and strips browser supplied author, settings and token fields", async () => {
    expect(
      (
        await start(
          request("start", undefined, {
            startedBy: "attacker",
            tokenHash: "injected",
            enabled: true,
          })
        )
      ).status
    ).toBe(200)
    expect(mocks.staff).toHaveBeenCalledWith(
      expect.objectContaining({ id: "staff" }),
      id,
      "goLive"
    )
    const options = vi.mocked(fetch).mock.calls[0]![1]!
    expect(JSON.parse(options.body as string)).toEqual({
      libraryDocumentId: id,
      mode: "checkins",
    })
    expect(options.headers).toMatchObject({
      "X-Ba-User-Id": "staff",
      "X-Ba-Session-Id": "ba-session",
    })
  })
  it("refuses cross-site requests, missing confirmation and unrelated staff before contacting Strapi", async () => {
    expect(
      (await start(request("start", "https://another.example"))).status
    ).toBe(403)
    mocks.proof = ""
    expect((await start(request())).status).toBe(401)
    mocks.proof = signLiveProof("staff", "ba-session")
    mocks.staff.mockReturnValue(
      Response.json({ error: "not_found" }, { status: 404 })
    )
    expect((await start(request())).status).toBe(404)
    expect(fetch).not.toHaveBeenCalled()
  })
  it("shares the five-per-hour start and takeover limit in a persisted per-user bucket", async () => {
    for (let i = 0; i < 5; i++)
      expect(
        (await (i % 2 ? takeover(request("takeover")) : start(request())))
          .status
      ).toBe(200)
    expect((await takeover(request("takeover"))).status).toBe(429)
    expect(mocks.counts.size).toBe(1)
    expect(fetch).toHaveBeenCalledTimes(5)
  })
})
