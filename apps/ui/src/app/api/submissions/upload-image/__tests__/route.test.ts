import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const getSession = vi.fn()
const fetchMock = vi.fn()

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers()),
}))
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession } } }))
vi.mock("@/lib/env-vars", () => ({
  getEnvVar: (name: string) => ({ STRAPI_URL: "http://strapi.test" })[name],
}))

const { POST } = await import("../route")
const { uploadLedger } = await import("@/lib/upload-quota")
const sharp = (await import("sharp")).default

const MB = 1024 * 1024

// A real (tiny) PNG: the route re-encodes uploads with sharp, so the bytes
// must decode.
const PNG = new Uint8Array(
  await sharp({
    create: { width: 2, height: 2, channels: 3, background: "#ffffff" },
  })
    .png()
    .toBuffer()
)
const pngFile = (name = "photo.png") =>
  new File([PNG], name, { type: "image/png" })

function uploadRequest(file: File, headers: Record<string, string> = {}) {
  const form = new FormData()
  form.append("file", file, file.name)

  return new Request("http://localhost/api/submissions/upload-image", {
    method: "POST",
    headers,
    body: form,
  })
}

let userSeq = 0
const signIn = () => {
  userSeq += 1
  const user = { id: `user-${userSeq}`, email: `u${userSeq}@example.org` }
  getSession.mockResolvedValue({ user, session: { id: "s1" } })

  return user
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal("fetch", fetchMock)
  vi.stubEnv("STRAPI_URL", "http://strapi.test")
  vi.stubEnv("STRAPI_BRIDGE_SECRET", "s3cret")
  vi.stubEnv("STRAPI_UPLOAD_API_KEY", "upload-token")
  fetchMock.mockImplementation(async (url: string) => {
    if (url.endsWith("/api/upload"))
      return Response.json([{ id: 7, url: "/uploads/photo_abc.png" }])
    if (url.endsWith("/api/content-moderation/uploads/usage"))
      return new Response("Not Found", { status: 404 })

    return Response.json({ ok: true })
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe("POST /api/submissions/upload-image", () => {
  it("returns 401 when signed out", async () => {
    getSession.mockResolvedValue(null)

    const res = await POST(uploadRequest(pngFile()))

    expect(res.status).toBe(401)
  })

  it("returns 413 from Content-Length alone, before reading the form", async () => {
    signIn()
    const req = uploadRequest(pngFile(), {
      "content-length": String(11 * MB),
    })
    const formData = vi.fn()
    Object.defineProperty(req, "formData", { value: formData })

    const res = await POST(req)

    expect(res.status).toBe(413)
    expect(formData).not.toHaveBeenCalled()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("uploads a valid image and returns the proxied asset URL, never STRAPI_URL", async () => {
    signIn()

    const res = await POST(uploadRequest(pngFile()))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      id: 7,
      url: "/api/asset/uploads/photo_abc.png",
    })
  })

  it("refuses the 21st upload of the day for a user, before calling Strapi", async () => {
    const user = signIn()
    for (let i = 0; i < 20; i++) uploadLedger.record(user.id, 1, Date.now())

    const res = await POST(uploadRequest(pngFile()))

    expect(res.status).toBe(429)
    expect(
      fetchMock.mock.calls.some(([url]) => String(url).endsWith("/api/upload"))
    ).toBe(false)
  })

  it("refuses an upload that would pass the user's 50 MB for the day", async () => {
    const user = signIn()
    uploadLedger.record(user.id, 50 * MB - 10, Date.now())

    const res = await POST(uploadRequest(pngFile()))

    expect(res.status).toBe(429)
  })

  it("counts a successful upload against the user's quota", async () => {
    const user = signIn()

    await POST(uploadRequest(pngFile()))

    const usage = await uploadLedger.usage(user.id, Date.now())
    expect(usage.files).toBe(1)
    expect(usage.bytes).toBeGreaterThan(0)
  })

  it("uses the count Strapi reports when its usage endpoint exists", async () => {
    signIn()
    fetchMock.mockImplementation(async (url: string) => {
      if (url.endsWith("/api/content-moderation/uploads/usage"))
        return Response.json({ files: 20, bytes: 0 })

      return Response.json([{ id: 7, url: "/uploads/photo_abc.png" }])
    })

    const res = await POST(uploadRequest(pngFile()))

    expect(res.status).toBe(429)
  })
})
