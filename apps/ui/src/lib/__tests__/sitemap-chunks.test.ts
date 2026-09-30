import { describe, expect, it } from "vitest"

import { chunkIds, SITEMAP_CHUNK_SIZE, sliceForChunk } from "../sitemap-chunks"

describe("sitemap chunks", () => {
  it("splits at 40,000 URLs", () => {
    expect(SITEMAP_CHUNK_SIZE).toBe(40_000)
  })

  it("always has chunk 0 (the non-library pages) plus one per 40,000 libraries", () => {
    expect(chunkIds(0)).toEqual([{ id: 0 }])
    expect(chunkIds(1)).toEqual([{ id: 0 }, { id: 1 }])
    expect(chunkIds(40_000)).toEqual([{ id: 0 }, { id: 1 }])
    expect(chunkIds(40_001)).toEqual([{ id: 0 }, { id: 1 }, { id: 2 }])
  })

  it("slices the library list for a chunk", () => {
    const items = Array.from({ length: 5 }, (_, i) => i)

    expect(sliceForChunk(items, 1, 2)).toEqual([0, 1])
    expect(sliceForChunk(items, 2, 2)).toEqual([2, 3])
    expect(sliceForChunk(items, 3, 2)).toEqual([4])
    expect(sliceForChunk(items, 4, 2)).toEqual([])
  })
})
