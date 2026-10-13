import { afterEach, describe, expect, it, vi } from "vitest"

import { knowledgeSections, sourceCount, sourceRows } from "../source"

afterEach(() => vi.unstubAllGlobals())

describe("bounded sitemap reads", () => {
  it("jumps to a late file once, then follows id cursors without re-reading its first page", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      const params = new URL(url).searchParams
      const start = Number(params.get("start"))
      const after = Number(params.get("after"))
      const id = (after || start) + 1
      const data = Array.from({ length: 1000 }, (_, i) => ({
        id: id + i,
        slug: `library-${id + i}`,
      }))

      return Response.json({ data, meta: { next: id + 999 } })
    })
    vi.stubGlobal("fetch", fetchMock)
    const rows = await sourceRows("libraries", "en", 2_890_000, 10_000)
    expect(fetchMock).toHaveBeenCalledTimes(10)
    expect(rows).toHaveLength(10_000)
    expect(new Set(rows.map((row) => row.id)).size).toBe(10_000)
    expect(rows[0]?.id).toBe(2_890_001)
    expect(rows.at(-1)?.id).toBe(2_900_000)
    const calls = fetchMock.mock.calls.map(([url]) => new URL(url).searchParams)
    expect(calls[0]?.get("start")).toBe("2890000")
    expect(calls[1]?.get("start")).toBe("0")
    expect(calls[1]?.get("after")).toBe("2891000")
  })

  it("does not turn failed or malformed reads into empty success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("down", { status: 500 }))
    )
    await expect(sourceCount("journal", "en")).rejects.toThrow("500")
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(Response.json({ count: -1 }))
    )
    await expect(sourceCount("journal", "en")).rejects.toThrow(
      "Invalid sitemap count"
    )
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(Response.json({ data: [] }))
    )
    await expect(sourceRows("journal", "en", 0, 1000)).rejects.toThrow(
      "Invalid sitemap batch"
    )
  })

  it("rejects a repeated cursor instead of duplicating entries or looping", async () => {
    const data = Array.from({ length: 1000 }, (_, i) => ({ id: i + 1 }))
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ data, meta: { next: 1000 } }))
    )
    await expect(sourceRows("events", "en", 0, 2000)).rejects.toThrow(
      "cursor did not advance"
    )
  })

  it("walks every Knowledge section beyond the first response", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      const page = Number(new URL(url).searchParams.get("pagination[page]"))

      return Response.json({
        data: [{ slug: `section-${page}` }],
        meta: { pagination: { page, pageCount: 2 } },
      })
    })
    vi.stubGlobal("fetch", fetchMock)
    expect(await knowledgeSections()).toEqual([
      { slug: "section-1" },
      { slug: "section-2" },
    ])
  })
})
