import { describe, expect, it, vi } from "vitest"

import { limitOf, concurrencyOf } from "../../scripts/ingests/_shared/cli"
import { libraryDirectory } from "../../scripts/ingests/_shared/json-source"
import {
  importLibraryDrafts,
  validateLibraries,
} from "../../scripts/ingests/_shared/pipeline"

describe("complete API snapshots", () => {
  it("handles Kirkanta's total=0 on later nonempty pages and reads to an empty page", async () => {
    const download = vi
      .fn()
      .mockResolvedValueOnce({
        type: "library",
        total: 2,
        items: [{ id: 1 }],
        refs: { city: { 10: { name: "Helsinki" } } },
      })
      .mockResolvedValueOnce({ type: "library", total: 0, items: [{ id: 2 }] })
      .mockResolvedValueOnce({ type: "library", total: 0, items: [] })
    expect(
      await libraryDirectory("https://example.fi/library", download)
    ).toMatchObject({ total: 2, items: [{ id: 1 }, { id: 2 }] })
    expect(download).toHaveBeenCalledTimes(3)
  })
  it("rejects shifting pages and truncated downloads", async () => {
    const duplicate = vi
      .fn()
      .mockResolvedValueOnce({ type: "library", total: 2, items: [{ id: 1 }] })
      .mockResolvedValueOnce({ type: "library", total: 0, items: [{ id: 1 }] })
    await expect(
      libraryDirectory("https://example.fi/library", duplicate)
    ).rejects.toThrow("duplicate library ID")
    const partial = vi
      .fn()
      .mockResolvedValueOnce({ type: "library", total: 2, items: [{ id: 1 }] })
      .mockResolvedValueOnce({ type: "library", total: 0, items: [] })
    await expect(
      libraryDirectory("https://example.fi/library", partial)
    ).rejects.toThrow("Incomplete directory")
  })
})

describe("resumable draft pipeline", () => {
  const records = [1, 2, 3].map((id) => ({
    recordId: String(id),
    data: {
      name: `Library ${id}`,
      slug: `library-${id}`,
      libraryType: "Public",
      source: "example",
    },
    warnings: [],
  }))
  it("checks scalar schema limits while allowing longer text fields", () => {
    expect(() =>
      validateLibraries([
        {
          ...records[0],
          data: {
            ...records[0].data,
            website: `https://example.org/${"x".repeat(256)}`,
          },
        },
      ])
    ).toThrow(/website/)
    expect(() =>
      validateLibraries([
        {
          ...records[0],
          data: { ...records[0].data, summary: "x".repeat(500) },
        },
      ])
    ).not.toThrow()
  })
  it("bounds parallel requests and counts the limit after existing records", async () => {
    let active = 0,
      peak = 0
    const client = {
      createLibrary: vi.fn(async (data) => {
        active++
        peak = Math.max(peak, active)
        await new Promise((resolve) => setImmediate(resolve))
        active--

        return { documentId: data.slug }
      }),
    }
    const result = await importLibraryDrafts({
      client: client as never,
      records: [
        ...records,
        ...[4, 5, 6].map((id) => ({
          ...records[0],
          recordId: String(id),
          data: {
            ...records[0].data,
            name: `Library ${id}`,
            slug: `library-${id}`,
          },
        })),
      ],
      existing: new Map([["1", "curated"]]),
      dataset: "example",
      retrievedAt: "2026-10-10T12:00:00Z",
      log: { add: vi.fn(), save: vi.fn() } as never,
      limit: 4,
      concurrency: 3,
      relations: () => ({}),
    })
    expect(result).toBe(4)
    expect(peak).toBe(3)
    expect(client.createLibrary).toHaveBeenCalledTimes(4)
  })
  it("stops dispatch after a failure and waits for in-flight writes to checkpoint", async () => {
    let finish: (value: { documentId: string }) => void = () => {}
    const inFlight = new Promise<{ documentId: string }>((resolve) => {
      finish = resolve
    })
    const client = {
      createLibrary: vi
        .fn()
        .mockRejectedValueOnce(new Error("Lost response"))
        .mockReturnValueOnce(inFlight),
    }
    const log = { add: vi.fn(), save: vi.fn() },
      existing = new Map<string, string>()
    let settled = false
    const run = importLibraryDrafts({
      client: client as never,
      records,
      existing,
      dataset: "example",
      retrievedAt: "2026-10-10T12:00:00Z",
      log: log as never,
      limit: Infinity,
      concurrency: 2,
      relations: () => ({}),
    }).catch((error) => {
      settled = true

      return error
    })
    await new Promise((resolve) => setImmediate(resolve))
    expect(client.createLibrary).toHaveBeenCalledTimes(2)
    expect(settled).toBe(false)
    finish({ documentId: "committed" })
    expect((await run).message).toBe("Lost response")
    expect(client.createLibrary).toHaveBeenCalledTimes(2)
    expect(existing.get("2")).toBe("committed")
    expect(log.add).toHaveBeenCalledWith(
      expect.objectContaining({ recordId: "2", status: "created" })
    )
  })
  it("rejects invalid concurrency before dispatch", () => {
    expect(concurrencyOf({})).toBe(1)
    expect(concurrencyOf({ concurrency: "3" })).toBe(3)
    for (const concurrency of ["0", "5", "1.5", "no"])
      expect(() => concurrencyOf({ concurrency })).toThrow(/concurrency/)
  })
  it("limits new drafts, leaves existing records alone and attaches source dates", async () => {
    const client = { createLibrary: vi.fn(async () => ({ documentId: "new" })) }
    const log = { add: vi.fn(), save: vi.fn() }
    await importLibraryDrafts({
      client: client as never,
      records,
      existing: new Map([["1", "curated"]]),
      dataset: "example",
      retrievedAt: "2026-10-10T12:00:00Z",
      log: log as never,
      limit: 1,
      relations: () => ({}),
    })
    expect(client.createLibrary).toHaveBeenCalledTimes(1)
    expect(client.createLibrary).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Library 2",
        sourceRecords: [
          {
            dataset: "example",
            recordId: "2",
            retrievedAt: "2026-10-10",
            url: undefined,
          },
        ],
      })
    )
    expect(log.add).toHaveBeenCalledWith(
      expect.objectContaining({ status: "exists", documentId: "curated" })
    )
  })
  it("checkpoints a lost response and stops without retrying a potentially committed create", async () => {
    const client = {
      createLibrary: vi.fn().mockRejectedValue(new Error("Lost response")),
    }
    const log = { add: vi.fn(), save: vi.fn() }
    await expect(
      importLibraryDrafts({
        client: client as never,
        records,
        existing: new Map(),
        dataset: "example",
        retrievedAt: "2026-10-10T12:00:00Z",
        log: log as never,
        limit: Infinity,
        relations: () => ({}),
      })
    ).rejects.toThrow("Lost response")
    expect(client.createLibrary).toHaveBeenCalledTimes(1)
    expect(log.add).toHaveBeenCalledWith(
      expect.objectContaining({ status: "error" })
    )
    expect(log.save).toHaveBeenCalled()
  })
  it("refuses invalid limits instead of silently doing no work", () => {
    for (const limit of ["0", "-1", "ten", "2oops", "1.5"])
      expect(() => limitOf({ limit })).toThrow("positive integer")
    expect(limitOf({ limit: "25" })).toBe(25)
  })
})
