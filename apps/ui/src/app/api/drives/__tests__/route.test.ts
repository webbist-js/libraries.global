import { beforeEach, describe, expect, it, vi } from "vitest"

const { session, revalidateTag } = vi.hoisted(() => ({
  session: { value: null as null | { user: Record<string, unknown> } },
  revalidateTag: vi.fn(),
}))

vi.mock("next/headers", () => ({ headers: async () => new Headers() }))
vi.mock("next/cache", () => ({ revalidateTag }))
vi.mock("@/lib/auth-server", () => ({
  getSessionSSR: async () => session.value,
}))
// The live counter pulls in the search client; the create route never counts.
vi.mock("@/lib/drives/drive-progress", () => ({ driveCounts: vi.fn() }))

const fetchMock = vi.fn()

const { POST } = await import("../route")
const { MemoryRateLimitStore } = await import("@/lib/rate-limit")

const BOARD = {
  id: "board-1",
  email: "board@example.test",
  name: "Board Member",
  capabilities: ["moderate.queue", "drives.manage"],
}
const ID_A = "i4ufvks2vsdq2qctu74bwq6p"

const DRIVE = {
  title: "Opening hours for *Vermont*",
  summary: "Add opening hours to every public library in Vermont.",
  steps: ["Open the library's own website."],
  focus: { kind: "gaps", gaps: ["hours"] },
  scope: { places: { region: ["vermont"] }, libraryTypes: ["Public"] },
  unit: "library",
  startsAt: "2026-10-06T00:00:00.000Z",
  endsAt: "2026-11-04T23:59:59.000Z",
  goalPercent: 100,
  whereToLook: { name: "Sites", url: "https://x.org", licenceNote: "" },
}

const post = (body: unknown) =>
  POST(
    new Request("http://localhost/api/drives", {
      method: "POST",
      body: typeof body === "string" ? body : JSON.stringify(body),
    })
  )

/** The calls that reached Strapi's drive routes (not the slug lookups). */
const driveCalls = () =>
  (fetchMock.mock.calls as unknown as [string, RequestInit][]).filter(([url]) =>
    new URL(url).pathname.startsWith("/api/drives")
  )
const sentBody = () => JSON.parse(String(driveCalls()[0]?.[1].body))

beforeEach(() => {
  ;(globalThis as { _rateLimitStore?: unknown })._rateLimitStore =
    new MemoryRateLimitStore()
  session.value = { user: { ...BOARD } }
  revalidateTag.mockReset()
  fetchMock.mockReset().mockImplementation(async (url: string) => {
    if (new URL(url).pathname === "/api/libraries") {
      return Response.json({
        data: [{ slug: "brooks-memorial-library", documentId: ID_A }],
      })
    }

    return Response.json(
      { data: { documentId: "drv00000000000000000001", slug: "vermont" } },
      { status: 200 }
    )
  })
  vi.stubGlobal("fetch", fetchMock)
  vi.stubEnv("STRAPI_URL", "http://strapi.test")
  vi.stubEnv("STRAPI_BRIDGE_SECRET", "bridge-secret")
})

describe("POST /api/drives", () => {
  it("is 401 signed out, and never calls Strapi", async () => {
    session.value = null
    const res = await post(DRIVE)
    expect(res.status).toBe(401)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("is 403 without drives.manage, even for a moderator", async () => {
    session.value = {
      user: { ...BOARD, capabilities: ["moderate.queue", "docs.directEdit"] },
    }
    const res = await post(DRIVE)
    expect(res.status).toBe(403)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("creates the drive in Strapi as the session's user", async () => {
    const res = await post(DRIVE)
    expect(res.status).toBe(200)
    const [url, init] = driveCalls()[0]!
    expect(url).toBe("http://strapi.test/api/drives")
    expect(init.method).toBe("POST")
    const headers = init.headers as Record<string, string>
    expect(headers["X-Service-Secret"]).toBe("bridge-secret")
    expect(headers["X-Ba-User-Id"]).toBe("board-1")
    expect(sentBody()).toEqual(DRIVE)
  })

  it("forwards only the drive's keys: never status, pins or the author", async () => {
    await post({
      ...DRIVE,
      status: "open",
      pinned: true,
      featured: true,
      createdByUserId: "ba:someone-else",
      openedAt: "2026-01-01T00:00:00Z",
    })
    expect(Object.keys(sentBody()).sort()).toEqual(Object.keys(DRIVE).sort())
  })

  it("drops keys a scope or focus doesn't have, and malformed values", async () => {
    await post({
      ...DRIVE,
      focus: { kind: "gaps", gaps: ["hours"], extra: "x" },
      scope: {
        places: { region: ["vermont", 'x"] OR id > 0'], planet: ["earth"] },
        libraryTypes: ["Public", 7],
        completenessBelow: "40",
        injected: true,
      },
    })
    expect(sentBody().focus).toEqual({ kind: "gaps", gaps: ["hours"] })
    expect(sentBody().scope).toEqual({
      places: { region: ["vermont"] },
      libraryTypes: ["Public"],
    })
  })

  it("resolves a pasted list's slugs to documentIds before saving", async () => {
    await post({
      ...DRIVE,
      scope: {
        libraries: [
          "brooks-memorial-library",
          ID_A,
          "zzzzzzzzzzzzzzzzzzzzzzzz",
        ],
      },
    })
    const lookup = (fetchMock.mock.calls as unknown as [string][]).find(
      ([url]) => new URL(url).pathname === "/api/libraries"
    )
    const params = new URL(lookup![0]).searchParams
    expect(params.get("filters[slug][$in][0]")).toBe("brooks-memorial-library")
    expect(params.get("filters[slug][$in][1]")).toBeNull()
    expect(sentBody().scope.libraries).toEqual([
      ID_A,
      "zzzzzzzzzzzzzzzzzzzzzzzz",
    ])
  })

  it("refuses a list with slugs that aren't libraries, in Strapi's error shape", async () => {
    const res = await post({
      ...DRIVE,
      scope: { libraries: ["gone-library", "brooks-memorial-library"] },
    })
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({
      error: {
        details: { errors: ["These libraries weren’t found: gone-library."] },
      },
    })
    expect(driveCalls()).toHaveLength(0)
  })

  it("passes Strapi's validation errors through unchanged", async () => {
    fetchMock.mockResolvedValueOnce(
      Response.json(
        {
          data: null,
          error: {
            status: 400,
            message: "Invalid drive",
            details: { errors: ["Write a summary of 10 to 280 characters."] },
          },
        },
        { status: 400 }
      )
    )
    const res = await post({ ...DRIVE, summary: "short" })
    expect(res.status).toBe(400)
    expect((await res.json()).error.details.errors).toEqual([
      "Write a summary of 10 to 280 characters.",
    ])
    expect(revalidateTag).not.toHaveBeenCalled()
  })

  it("expires the cached drive reads once Strapi accepts the write", async () => {
    await post(DRIVE)
    expect(revalidateTag).toHaveBeenCalledWith("drive", { expire: 0 })
  })

  it("is 400 for a body that isn't JSON", async () => {
    const res = await post("{not json")
    expect(res.status).toBe(400)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("is 502 when Strapi can't be reached", async () => {
    fetchMock.mockRejectedValueOnce(new Error("ECONNREFUSED"))
    const res = await post(DRIVE)
    expect(res.status).toBe(502)
  })

  it("allows 30 writes a minute per user, then 429", async () => {
    for (let i = 0; i < 30; i++) {
      expect((await post(DRIVE)).status).toBe(200)
    }
    const res = await post(DRIVE)
    expect(res.status).toBe(429)
    expect(res.headers.get("Retry-After")).toBeTruthy()
  })
})
