import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ session: vi.fn() }))
vi.mock("next/headers", () => ({ headers: async () => new Headers() }))
vi.mock("next/cache", () => ({ revalidateTag: vi.fn() }))
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: mocks.session } } }))

import { GET } from "@/app/api/staff/[documentId]/drawer/route"

const ID = "lib000000000000000000001"
const OTHER = "lib000000000000000000002"
const user = (id = "u1") => ({
  id,
  email: "crew@example.org",
  name: "Crew",
  emailVerified: true,
  capabilities: ["staff.area"],
  staffLibraries: [
    {
      id: ID,
      role: "editor",
      canGoLive: false,
      name: "Central Library",
      slug: "central-library",
      libraryType: "Public",
    },
  ],
})
const get = (documentId = ID) =>
  GET(new Request(`https://libraries.example/api/staff/${documentId}/drawer`), {
    params: Promise.resolve({ documentId }),
  })
const drawer = {
  library: {
    documentId: ID,
    name: "Central Library",
    slug: "central-library",
    path: "/x",
    libraryType: "Public",
    role: "editor",
  },
  suggestions: 2,
  noticesUpcoming: 0,
  live: null,
  drives: [],
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv("STRAPI_BRIDGE_SECRET", "test-only-secret")
  vi.stubEnv("STRAPI_URL", "http://strapi.test")
  mocks.session.mockResolvedValue({
    user: user(),
    session: { id: "ba-session" },
  })
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json(drawer))
  )
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe("GET /api/staff/[documentId]/drawer", () => {
  it("answers 401 to a visitor without a session, before contacting Strapi", async () => {
    mocks.session.mockResolvedValue(null)
    const res = await get()
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: "Unauthorized" })
    expect(fetch).not.toHaveBeenCalled()
  })

  it("answers 404 for a library outside the session's staff, so scope can't be probed", async () => {
    const res = await get(OTHER)
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: "Not found" })
    expect(fetch).not.toHaveBeenCalled()
  })

  it("rejects a malformed id with 400", async () => {
    const res = await get("not-an-id!")
    expect(res.status).toBe(400)
    expect(fetch).not.toHaveBeenCalled()
  })

  it("proxies the staff member's read to library-staff with the bridge identity and no caching", async () => {
    const res = await get()
    expect(res.status).toBe(200)
    expect(res.headers.get("Cache-Control")).toBe("no-store")
    expect(await res.json()).toEqual(drawer)
    const [url, options] = vi.mocked(fetch).mock.calls[0]!
    expect(String(url)).toBe(
      `http://strapi.test/api/library-staff/libraries/${ID}/drawer`
    )
    expect(options).toMatchObject({ method: "GET", cache: "no-store" })
    expect(options!.headers).toMatchObject({
      "X-Ba-User-Id": "u1",
      "X-Ba-Email-Verified": "true",
    })
  })

  it("rate limits reads at 120 a minute per user with a Retry-After", async () => {
    mocks.session.mockResolvedValue({
      user: user("u-limit"),
      session: { id: "s" },
    })
    for (let i = 0; i < 120; i++) expect((await get()).status).toBe(200)
    const res = await get()
    expect(res.status).toBe(429)
    expect(res.headers.get("Retry-After")).toMatch(/^\d+$/)
    expect(await res.json()).toEqual({
      error: "Too many requests. Please try again later.",
    })
    expect(fetch).toHaveBeenCalledTimes(120)
  })

  it("answers 502 when Strapi can't be reached", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error("down"))
    const res = await get()
    expect(res.status).toBe(502)
    expect(await res.json()).toEqual({
      error: "The staff service is unavailable.",
    })
  })
})
