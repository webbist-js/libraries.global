import { afterEach, describe, expect, it, vi } from "vitest"

import { GET } from "./route"

afterEach(() => vi.unstubAllGlobals())

describe("approved topics locale", () => {
  it.each(["en", "cs", "fr"])("reads %s topics", async (locale) => {
    const fetch = vi.fn().mockResolvedValue(Response.json({ data: [] }))
    vi.stubGlobal("fetch", fetch)
    await GET(new Request(`http://localhost/api/topics?locale=${locale}`))
    expect(String(fetch.mock.calls[0]?.[0])).toContain(`locale=${locale}`)
  })

  it("falls back to English for an unsupported language", async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json({ data: [] }))
    vi.stubGlobal("fetch", fetch)
    await GET(new Request("http://localhost/api/topics?locale=other"))
    expect(String(fetch.mock.calls[0]?.[0])).toContain("locale=en")
  })
})
