import { beforeEach, describe, expect, it, vi } from "vitest"

const { session, driveCounts } = vi.hoisted(() => ({
  session: { value: null as null | { user: Record<string, unknown> } },
  driveCounts: vi.fn(),
}))

vi.mock("next/headers", () => ({ headers: async () => new Headers() }))
vi.mock("next/cache", () => ({ revalidateTag: vi.fn() }))
vi.mock("@/lib/auth-server", () => ({
  getSessionSSR: async () => session.value,
}))
vi.mock("@/lib/drives/drive-progress", () => ({ driveCounts }))

const fetchMock = vi.fn()

const { POST } = await import("../route")
const { MemoryRateLimitStore } = await import("@/lib/rate-limit")

const BOARD = {
  id: "board-1",
  email: "board@example.test",
  name: "Board Member",
  capabilities: ["drives.manage"],
}
const ID_A = "i4ufvks2vsdq2qctu74bwq6p"
const FOCUS = { kind: "gaps", gaps: ["hours"] }
const SCOPE = { places: { region: ["vermont"] }, libraryTypes: ["Public"] }

const preview = (body: unknown) =>
  POST(
    new Request("http://localhost/api/drives/preview", {
      method: "POST",
      body: JSON.stringify(body),
    })
  )

beforeEach(() => {
  ;(globalThis as { _rateLimitStore?: unknown })._rateLimitStore =
    new MemoryRateLimitStore()
  session.value = { user: { ...BOARD } }
  driveCounts.mockReset().mockResolvedValue({ total: 187, todo: 187 })
  fetchMock.mockReset().mockResolvedValue(
    Response.json({
      data: [{ slug: "brooks-memorial-library", documentId: ID_A }],
    })
  )
  vi.stubGlobal("fetch", fetchMock)
  vi.stubEnv("STRAPI_URL", "http://strapi.test")
})

describe("POST /api/drives/preview", () => {
  it("is 403 without drives.manage, and counts nothing", async () => {
    session.value = { user: { ...BOARD, capabilities: ["submit.correction"] } }
    const res = await preview({ scope: SCOPE, focus: FOCUS })
    expect(res.status).toBe(403)
    expect(driveCounts).not.toHaveBeenCalled()
  })

  it("counts the scope and focus as if the drive opened now", async () => {
    const before = Date.now()
    const res = await preview({ scope: SCOPE, focus: FOCUS })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ total: 187, todo: 187 })
    const [input] = driveCounts.mock.calls[0]!
    expect(input.scope).toEqual(SCOPE)
    expect(input.focus).toEqual(FOCUS)
    const opened = Date.parse(input.openedAt)
    expect(opened).toBeGreaterThanOrEqual(before - 1000)
    expect(opened).toBeLessThanOrEqual(Date.now() + 1000)
  })

  it("is 400 for a focus that isn't one to three known gaps", async () => {
    for (const focus of [
      { kind: "gaps", gaps: [] },
      { kind: "gaps", gaps: ["hours", "nope"] },
      { kind: "gaps", gaps: ["hours", "photo", "contact", "accessibility"] },
      { kind: "verify", sections: ["hours_ts < 0 OR x"], before: "x" },
      null,
    ]) {
      expect((await preview({ scope: SCOPE, focus })).status).toBe(400)
    }
    expect(driveCounts).not.toHaveBeenCalled()
  })

  it("is 400 with nowhere to look", async () => {
    const res = await preview({
      scope: { libraryTypes: ["Public"] },
      focus: FOCUS,
    })
    expect(res.status).toBe(400)
    expect((await res.json()).error.details.errors).toEqual([
      "Limit the drive to places or to a list of libraries.",
    ])
  })

  it("is 400 for a list over 500", async () => {
    const libraries = Array.from({ length: 501 }, (_, i) => `library-${i}`)
    const res = await preview({ scope: { libraries }, focus: FOCUS })
    expect(res.status).toBe(400)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("resolves a pasted list and names the slugs it couldn't find", async () => {
    const res = await preview({
      scope: { libraries: ["brooks-memorial-library", "gone-library"] },
      focus: FOCUS,
    })
    expect(await res.json()).toEqual({
      total: 187,
      todo: 187,
      unknown: ["gone-library"],
    })
    expect(driveCounts.mock.calls[0]![0].scope).toEqual({ libraries: [ID_A] })
  })

  it("is zero, without counting, when nothing on the list was found", async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ data: [] }))
    const res = await preview({ scope: { libraries: ["gone"] }, focus: FOCUS })
    expect(await res.json()).toEqual({ total: 0, todo: 0, unknown: ["gone"] })
    expect(driveCounts).not.toHaveBeenCalled()
  })

  it("is 502 when Meilisearch can't count", async () => {
    driveCounts.mockResolvedValueOnce(null)
    expect((await preview({ scope: SCOPE, focus: FOCUS })).status).toBe(502)
  })

  it("has its own, looser limit than board writes", async () => {
    for (let i = 0; i < 31; i++) {
      expect((await preview({ scope: SCOPE, focus: FOCUS })).status).toBe(200)
    }
  })
})
