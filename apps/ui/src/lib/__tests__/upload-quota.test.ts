import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  completeUploadReservation,
  reserveUploadQuota,
  UPLOAD_QUOTA,
  uploadQuotaResponse,
} from "../upload-quota"

const reservation = {
  reservationId: "a1234567-1234-1234-1234-123456789abc",
  expiresAt: "2026-10-17T00:00:00.000Z",
}
const fetchMock = vi.fn()
beforeEach(() => {
  vi.stubEnv("STRAPI_URL", "http://strapi.test")
  vi.stubEnv("STRAPI_BRIDGE_SECRET", "secret")
  vi.stubGlobal("fetch", fetchMock)
  fetchMock.mockReset()
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe("shared durable upload quota", () => {
  it("uses the same 20-file/50-MiB budget for every route", async () => {
    expect(UPLOAD_QUOTA).toEqual({ files: 20, bytes: 50 * 1024 * 1024 })
    fetchMock.mockResolvedValue(Response.json(reservation))
    const result = await reserveUploadQuota("user", 1234, "avatar")
    expect(result).toEqual({ ok: true, reservation })
    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe(
      "http://strapi.test/api/content-moderation/uploads/reservations"
    )
    expect(JSON.parse(init.body)).toEqual({ bytes: 1234, purpose: "avatar" })
    expect(init.headers).toMatchObject({
      "X-Service-Secret": "secret",
      "X-Ba-User-Id": "user",
    })
    expect(init.cache).toBe("no-store")
  })

  it.each([404, 500, 503])(
    "fails closed when the quota service responds %s",
    async (status) => {
      fetchMock.mockResolvedValue(new Response("unavailable", { status }))
      const result = await reserveUploadQuota("user", 100, "article")
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.response.status).toBe(503)
    }
  )

  it("fails closed on missing bridge credentials, transport errors or malformed replies", async () => {
    vi.stubEnv("STRAPI_BRIDGE_SECRET", "")
    expect((await reserveUploadQuota("user", 100, "article")).ok).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
    vi.stubEnv("STRAPI_BRIDGE_SECRET", "secret")
    fetchMock.mockRejectedValue(new Error("offline"))
    expect((await reserveUploadQuota("user", 100, "article")).ok).toBe(false)
    fetchMock.mockResolvedValue(Response.json({ reservationId: "garbage" }))
    expect((await reserveUploadQuota("user", 100, "article")).ok).toBe(false)
  })

  it.each(["files", "bytes"] as const)(
    "retains the explicit daily %s limit",
    async (reason) => {
      fetchMock.mockResolvedValue(
        Response.json({ error: reason }, { status: 429 })
      )
      const result = await reserveUploadQuota("user", 100, "submission")
      if (result.ok) throw new Error("Quota must reject")
      expect(result.response.status).toBe(429)
      expect(await result.response.json()).toEqual(
        await uploadQuotaResponse(reason).json()
      )
    }
  )

  it("retries an ambiguous completion using the same reservation and file", async () => {
    fetchMock
      .mockRejectedValueOnce(new Error("lost response"))
      .mockResolvedValueOnce(Response.json({ ok: true }))
    expect(
      await completeUploadReservation("user", reservation.reservationId, 7)
    ).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(
      fetchMock.mock.calls.map(([, init]) => JSON.parse(init.body))
    ).toEqual(
      Array.from({ length: 2 }).fill({
        reservationId: reservation.reservationId,
        fileId: 7,
      })
    )
  })

  it("never treats HTTP success without recorded ownership as upload success", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(Response.json({})))
    expect(
      await completeUploadReservation("user", reservation.reservationId, 7)
    ).toBe(false)
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })
})
