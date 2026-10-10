import { afterEach, beforeEach, expect, it, vi } from "vitest"

import { openNow } from "@/components/atlas/atlas.logic"

const { bridge } = vi.hoisted(() => ({ bridge: vi.fn() }))
vi.mock("@/lib/atlas-backend", () => ({
  createAtlasBackend: () => ({
    state: async () => ({ canonicalLocale: "en" }),
    bridge,
  }),
}))
import { GET } from "../route"

import fixture from "../../../../../../../../qa/fixtures/atlas/corpus.json"

beforeEach(() => {
  vi.stubEnv("ATLAS_QUERY_ENABLED", "true")
  vi.useFakeTimers()
  vi.setSystemTime(new Date(fixture.evaluatedAt))
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.useRealTimers()
  vi.clearAllMocks()
})
it("resolves an unmapped published selection without fabricating a plotted point and retains Notice hours", async () => {
  bridge.mockResolvedValue({
    source: {
      ...fixture.defaults,
      documentId: "one",
      slug: "one",
      name: "One",
      location: null,
      notices: [
        {
          documentId: "closure",
          type: "closure",
          from: "2026-10-08",
          to: "2026-10-08",
        },
      ],
    },
  })
  const result = await GET(
    new Request("https://ui.test/api/atlas/library?key=one&locale=cs")
  )
  expect(result.status).toBe(200)
  const { library } = await result.json()
  expect(library).toMatchObject({ id: "one", mapped: false })
  expect(library.notices).toHaveLength(1)
  expect(openNow(library, new Date(fixture.evaluatedAt))).toBe("closed")
  expect(bridge).toHaveBeenCalledWith("/api/atlas/library?key=one&locale=cs")
})
it("keeps missing/unpublished selections 404 and rejects invalid locale before the bridge", async () => {
  bridge.mockRejectedValue(new Error("Atlas backend HTTP 404"))
  expect(
    (await GET(new Request("https://ui.test/api/atlas/library?key=missing")))
      .status
  ).toBe(404)
  bridge.mockClear()
  expect(
    (
      await GET(
        new Request("https://ui.test/api/atlas/library?key=one&locale=*")
      )
    ).status
  ).toBe(400)
  expect(bridge).not.toHaveBeenCalled()
})
