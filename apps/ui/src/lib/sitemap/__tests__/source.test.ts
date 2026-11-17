import { afterEach, expect, it, vi } from "vitest"

import { sitemapJson } from "../source"

afterEach(() => vi.unstubAllGlobals())

it("queries Strapi with the CMS locale while keeping the public sitemap locale", async () => {
  const fetch = vi.fn().mockResolvedValue(Response.json({ data: {} }))
  vi.stubGlobal("fetch", fetch)

  await sitemapJson("/sitemap/pages", { locale: "zh-TW" })

  expect(String(fetch.mock.calls[0]?.[0])).toContain("locale=zh-Hant-TW")
})
