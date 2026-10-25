import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const getSession = vi.fn()
const fetchMock = vi.fn()
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }))
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession } } }))
vi.mock("@/lib/env-vars", () => ({
  getEnvVar: (name: string) => ({ STRAPI_URL: "http://strapi.test" })[name],
}))

const { POST } = await import("../route")
const sharp = (await import("sharp")).default
const PNG = new Uint8Array(
  await sharp({
    create: { width: 2, height: 2, channels: 3, background: "#ffffff" },
  })
    .png()
    .toBuffer()
)
const reservationId = "a1234567-1234-1234-1234-123456789abc"
function request(form?: FormData, extraHeaders: Record<string, string> = {}) {
  const body = form ?? new FormData()
  if (!form)
    body.append("file", new File([PNG], "photo.png", { type: "image/png" }))

  return new Request("http://localhost/api/submissions/upload-image", {
    method: "POST",
    headers: { origin: "http://localhost", ...extraHeaders },
    body,
  })
}
beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal("fetch", fetchMock)
  vi.stubEnv("APP_PUBLIC_URL", "http://localhost")
  vi.stubEnv("STRAPI_URL", "http://strapi.test")
  vi.stubEnv("STRAPI_BRIDGE_SECRET", "secret")
  vi.stubEnv("STRAPI_UPLOAD_API_KEY", "upload-token")
  getSession.mockResolvedValue({
    user: { id: "writer", email: "writer@example.test" },
  })
  fetchMock.mockImplementation(async (url: string) => {
    if (url.endsWith("/api/upload"))
      return Response.json([{ id: 7, url: "/uploads/photo.png" }])
    if (url.endsWith("/uploads/reservations"))
      return Response.json({
        reservationId,
        expiresAt: "2026-10-17T00:00:00.000Z",
      })

    return Response.json({ ok: true })
  })
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe("submission image upload", () => {
  it("requires a signed-in user before consuming the body", async () => {
    getSession.mockResolvedValue(null)
    expect((await POST(request())).status).toBe(401)
    expect(fetchMock).not.toHaveBeenCalled()
  })
  it("rejects cross-site writes", async () => {
    expect(
      (await POST(request(undefined, { origin: "https://foreign.test" })))
        .status
    ).toBe(403)
    expect(fetchMock).not.toHaveBeenCalled()
  })
  it("rejects declared oversized bodies without parsing multipart", async () => {
    const input = request(undefined, {
      "content-length": String(11 * 1024 * 1024),
    })
    const parser = vi.fn()
    Object.defineProperty(input, "formData", { value: parser })
    expect((await POST(input)).status).toBe(413)
    expect(parser).not.toHaveBeenCalled()
    expect(fetchMock).not.toHaveBeenCalled()
  })
  it("reserves quota, stores, records ownership, then returns a usable asset", async () => {
    const result = await POST(request())
    expect(result.status).toBe(200)
    expect(await result.json()).toEqual({
      id: 7,
      url: "/api/asset/uploads/photo.png",
    })
    const storedForm = fetchMock.mock.calls.find(([url]) =>
      String(url).endsWith("/api/upload")
    )![1].body as FormData
    expect((storedForm.get("files") as File).name).toBe(
      `upload-${reservationId}.png`
    )
    const completed = fetchMock.mock.calls.find(([url]) =>
      String(url).endsWith("/complete")
    )!
    expect(JSON.parse(completed[1].body)).toEqual({
      reservationId,
      fileId: 7,
      displayName: "photo.png",
    })
    expect(fetchMock.mock.calls.map(([url]) => String(url))).toEqual([
      "http://strapi.test/api/content-moderation/uploads/reservations",
      "http://strapi.test/api/upload",
      "http://strapi.test/api/content-moderation/uploads/reservations/complete",
    ])
  })
  it("does not store a file when the authoritative quota is exceeded or unavailable", async () => {
    fetchMock.mockResolvedValue(
      Response.json({ error: "files" }, { status: 429 })
    )
    expect((await POST(request())).status).toBe(429)
    expect(
      fetchMock.mock.calls.some(([url]) => String(url).endsWith("/api/upload"))
    ).toBe(false)
    fetchMock.mockResolvedValue(new Response("offline", { status: 503 }))
    expect((await POST(request())).status).toBe(503)
  })
  it("fails closed and asks for cleanup after storage succeeds but ownership recording fails", async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.endsWith("/api/upload"))
        return Response.json([{ id: 7, url: "/uploads/photo.png" }])
      if (url.endsWith("/uploads/reservations"))
        return Response.json({
          reservationId,
          expiresAt: "2026-10-17T00:00:00.000Z",
        })
      if (url.endsWith("/complete"))
        return new Response("bridge failed", { status: 503 })

      return Response.json({ ok: true })
    })
    const result = await POST(request())
    expect(result.status).toBe(503)
    const json = await result.json()
    expect(json).not.toHaveProperty("id")
    expect(json).not.toHaveProperty("url")
    expect(
      fetchMock.mock.calls.filter(([url]) => String(url).endsWith("/complete"))
    ).toHaveLength(3)
    expect(
      fetchMock.mock.calls.filter(([url]) => String(url).endsWith("/cancel"))
    ).toHaveLength(1)
  })
  it("rejects duplicate files and additional fields before quota or storage", async () => {
    const body = new FormData()
    body.append("file", new File([PNG], "one.png"))
    body.append("file", new File([PNG], "two.png"))
    expect((await POST(request(body))).status).toBe(400)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
