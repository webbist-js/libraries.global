import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  checkUploadQuota,
  MemoryUploadLedger,
  strapiUploadUsage,
  UPLOAD_QUOTA,
  uploadQuotaResponse,
} from "../upload-quota"

const MB = 1024 * 1024
const DAY = 24 * 60 * 60 * 1000
const T0 = Date.UTC(2026, 8, 29, 10)

describe("UPLOAD_QUOTA", () => {
  it("is 20 files and 50 MB a day", () => {
    expect(UPLOAD_QUOTA).toEqual({ files: 20, bytes: 50 * MB })
  })
})

describe("MemoryUploadLedger", () => {
  it("adds up a user's uploads within the current UTC day", async () => {
    const ledger = new MemoryUploadLedger()
    ledger.record("u1", 3 * MB, T0)
    ledger.record("u1", 2 * MB, T0 + 1000)
    ledger.record("u2", 1 * MB, T0)

    expect(await ledger.usage("u1", T0 + 2000)).toEqual({
      files: 2,
      bytes: 5 * MB,
    })
    expect(await ledger.usage("u2", T0)).toEqual({ files: 1, bytes: 1 * MB })
    expect(await ledger.usage("nobody", T0)).toEqual({ files: 0, bytes: 0 })
  })

  it("starts over at UTC midnight", async () => {
    const ledger = new MemoryUploadLedger()
    ledger.record("u1", MB, T0)

    expect(await ledger.usage("u1", T0 + DAY)).toEqual({ files: 0, bytes: 0 })
  })

  it("keeps a bounded number of users", async () => {
    const ledger = new MemoryUploadLedger({ maxUsers: 2 })
    ledger.record("a", 1, T0)
    ledger.record("b", 1, T0)
    ledger.record("c", 1, T0)

    expect(ledger.size).toBe(2)
    expect(await ledger.usage("a", T0)).toEqual({ files: 0, bytes: 0 })
  })
})

describe("strapiUploadUsage", () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal("fetch", fetchMock)
  })
  afterEach(() => vi.unstubAllGlobals())

  const source = () =>
    strapiUploadUsage({ strapiUrl: "http://strapi.test", secret: "s3cret" })

  it("asks Strapi for the user's usage with the bridge secret", async () => {
    fetchMock.mockResolvedValue(Response.json({ files: 4, bytes: 123 }))

    const usage = await source().usage("u1", T0)

    expect(usage).toEqual({ files: 4, bytes: 123 })
    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe("http://strapi.test/api/content-moderation/uploads/usage")
    expect(init.headers).toMatchObject({
      "X-Service-Secret": "s3cret",
      "X-Ba-User-Id": "u1",
    })
    expect(init.cache).toBe("no-store")
  })

  it.each([
    ["a missing endpoint", new Response("Not Found", { status: 404 })],
    ["a server error", new Response("boom", { status: 500 })],
    ["a malformed body", Response.json({ files: "4" })],
    ["a body that isn't JSON", new Response("<html>")],
  ])("returns null for %s", async (_label, response) => {
    fetchMock.mockResolvedValue(response)

    expect(await source().usage("u1", T0)).toBeNull()
  })

  it("returns null when Strapi is unreachable", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"))

    expect(await source().usage("u1", T0)).toBeNull()
  })

  it("returns null without calling Strapi when the secret is missing", async () => {
    const usage = await strapiUploadUsage({
      strapiUrl: "http://strapi.test",
      secret: undefined,
    }).usage("u1", T0)

    expect(usage).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe("checkUploadQuota", () => {
  const fixed = (usage: { files: number; bytes: number } | null) => ({
    usage: async () => usage,
  })

  it("allows an upload within the quota", async () => {
    const result = await checkUploadQuota({
      userId: "u1",
      incomingBytes: MB,
      sources: [fixed({ files: 19, bytes: 49 * MB })],
      now: T0,
    })

    expect(result).toEqual({ ok: true })
  })

  it("refuses the 21st file of the day", async () => {
    const result = await checkUploadQuota({
      userId: "u1",
      incomingBytes: 1,
      sources: [fixed({ files: 20, bytes: 0 })],
      now: T0,
    })

    expect(result).toEqual({ ok: false, reason: "files" })
  })

  it("refuses a file that would pass 50 MB for the day", async () => {
    const result = await checkUploadQuota({
      userId: "u1",
      incomingBytes: 2 * MB,
      sources: [fixed({ files: 0, bytes: 49 * MB })],
      now: T0,
    })

    expect(result).toEqual({ ok: false, reason: "bytes" })
  })

  it("takes the highest count any source reports", async () => {
    const result = await checkUploadQuota({
      userId: "u1",
      incomingBytes: 1,
      sources: [
        fixed(null),
        fixed({ files: 3, bytes: 0 }),
        fixed({ files: 20, bytes: 0 }),
      ],
      now: T0,
    })

    expect(result).toEqual({ ok: false, reason: "files" })
  })

  it("allows the upload when no source can answer", async () => {
    const result = await checkUploadQuota({
      userId: "u1",
      incomingBytes: 1,
      sources: [fixed(null)],
      now: T0,
    })

    expect(result).toEqual({ ok: true })
  })
})

describe("uploadQuotaResponse", () => {
  it("is a 429 that names the limit", async () => {
    const res = uploadQuotaResponse("files")

    expect(res.status).toBe(429)
    expect(await res.json()).toEqual({
      error: "Daily upload limit reached (20 files). Try again tomorrow.",
    })
    expect(await uploadQuotaResponse("bytes").json()).toEqual({
      error: "Daily upload limit reached (50 MB). Try again tomorrow.",
    })
  })
})
