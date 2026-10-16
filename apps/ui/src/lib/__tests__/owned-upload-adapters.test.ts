import sharp from "sharp"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  requireCapability: vi.fn(),
  invalidate: vi.fn(),
}))
vi.mock("next/headers", () => ({ headers: async () => new Headers() }))
vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: mocks.getSession } },
}))
vi.mock("@/lib/access-server", () => ({
  requireCapability: mocks.requireCapability,
}))
vi.mock("@/lib/session-profile", () => ({
  invalidateSessionProfile: mocks.invalidate,
}))
vi.mock("@/lib/env-vars", () => ({ getEnvVar: () => "http://strapi.test" }))

import { POST as avatar } from "@/app/api/profile/me/avatar/route"
import {
  POST as cover,
  DELETE as clearCover,
} from "@/app/api/profile/me/cover/route"
import { POST as article } from "@/app/api/upload/route"

const reservationId = "a1234567-1234-1234-1234-123456789abc"
const fetchMock = vi.fn()
let png: Uint8Array<ArrayBuffer>
beforeEach(async () => {
  vi.clearAllMocks()
  vi.stubEnv("APP_PUBLIC_URL", "http://localhost")
  vi.stubEnv("STRAPI_URL", "http://strapi.test")
  vi.stubEnv("STRAPI_UPLOAD_API_KEY", "upload-token")
  vi.stubEnv("STRAPI_BRIDGE_SECRET", "secret")
  vi.stubGlobal("fetch", fetchMock)
  png = new Uint8Array(
    await sharp({
      create: { width: 2, height: 2, channels: 3, background: "#ffffff" },
    })
      .png()
      .toBuffer()
  )
  mocks.getSession.mockResolvedValue({
    user: { id: "writer", email: "writer@example.test" },
  })
  mocks.requireCapability.mockReturnValue(null)
  fetchMock.mockImplementation(async (url: string) => {
    if (url.endsWith("/uploads/reservations"))
      return Response.json({
        reservationId,
        expiresAt: "2026-10-17T00:00:00.000Z",
      })
    if (url.endsWith("/api/upload"))
      return Response.json([{ id: 7, url: "/uploads/image.png" }])

    return Response.json({ ok: true })
  })
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})
const request = (field: "file" | "files") => {
  const form = new FormData()
  form.append(field, new File([png], "image.png"))

  return new Request("http://localhost/upload", {
    method: "POST",
    headers: { origin: "http://localhost" },
    body: form,
  })
}

describe("avatar, cover and legacy article upload adapters", () => {
  it("reserves cover quota and binds only the just-uploaded owned image to the signed-in profile", async () => {
    expect((await cover(request("file"))).status).toBe(200)
    expect(JSON.parse(fetchMock.mock.calls[0]![1].body).purpose).toBe("cover")
    const write = fetchMock.mock.calls.find(([url]) =>
      String(url).endsWith("upsert-profile")
    )!
    expect(JSON.parse(write[1].body)).toEqual({
      baUserId: "writer",
      coverImageFileId: 7,
    })
    expect(mocks.invalidate).toHaveBeenCalledWith("writer")
  })
  it("removes a cover relation but never calls media deletion, and blocks cross-origin removal", async () => {
    const req = (origin: string) =>
      new Request("http://localhost/api/profile/me/cover", {
        method: "DELETE",
        headers: { origin },
      })
    expect((await clearCover(req("http://foreign.test"))).status).toBe(403)
    expect(fetchMock).not.toHaveBeenCalled()
    expect((await clearCover(req("http://localhost"))).status).toBe(200)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(JSON.parse(fetchMock.mock.calls[0]![1].body)).toEqual({
      baUserId: "writer",
      coverImageFileId: null,
    })
  })
  it("reserves avatar quota and records ownership before updating the profile", async () => {
    const response = await avatar(request("file"))
    expect(response.status).toBe(200)
    expect(fetchMock.mock.calls.map(([url]) => String(url))).toEqual([
      "http://strapi.test/api/content-moderation/uploads/reservations",
      "http://strapi.test/api/upload",
      "http://strapi.test/api/content-moderation/uploads/reservations/complete",
      "http://strapi.test/api/auth-bridge/upsert-profile",
    ])
    expect(JSON.parse(fetchMock.mock.calls[0]![1].body).purpose).toBe("avatar")
    expect(mocks.invalidate).toHaveBeenCalledWith("writer")
  })
  it("does not update an avatar when ownership cannot be confirmed", async () => {
    const normal = fetchMock.getMockImplementation()!
    fetchMock.mockImplementation((url: string) =>
      url.endsWith("/complete")
        ? Promise.resolve(new Response("unavailable", { status: 503 }))
        : normal(url)
    )
    expect((await avatar(request("file"))).status).toBe(503)
    expect(
      fetchMock.mock.calls.some(([url]) =>
        String(url).endsWith("upsert-profile")
      )
    ).toBe(false)
    expect(mocks.invalidate).not.toHaveBeenCalled()
  })
  it("uses the same reservation and ownership path for an authorised article upload", async () => {
    expect((await article(request("files"))).status).toBe(200)
    expect(JSON.parse(fetchMock.mock.calls[0]![1].body).purpose).toBe("article")
    expect(
      fetchMock.mock.calls.some(([url]) => String(url).endsWith("/complete"))
    ).toBe(true)
  })
  it("enforces article editor capability before parsing a body or reserving storage", async () => {
    mocks.requireCapability.mockReturnValue(
      Response.json({ error: "Forbidden" }, { status: 403 })
    )
    expect((await article(request("files"))).status).toBe(403)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
